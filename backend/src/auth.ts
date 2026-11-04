// PIN sign-in, tokens and lockout (FR-AUTH-02, FR-AUTH-03, ADR-0003).
import { LOCKOUT_MINUTES, MAX_PIN_FAILURES, TOKEN_TTL_DAYS, type Role } from '@aluthgama/shared';
import type { Crypto, Services } from './ports';
import { b64uDecode, b64uEncode, constantTimeEqual } from './util';

export const PROP = {
  MANAGER_PIN_HASH: 'MANAGER_PIN_HASH',
  OWNER_PIN_HASH: 'OWNER_PIN_HASH',
  PIN_SALT: 'PIN_SALT',
  TOKEN_SECRET: 'TOKEN_SECRET',
  TOKEN_VERSION: 'TOKEN_VERSION',
  SHEET_ID: 'SHEET_ID',
} as const;

export const hashPin = (crypto: Crypto, salt: string, pin: string): string => crypto.sha256Hex(`${salt}:${pin}`);

export interface TokenPayload {
  role: Role;
  deviceId: string;
  ver: number;
  exp: number;
}

export function signToken(crypto: Crypto, secret: string, payload: TokenPayload): string {
  const part = b64uEncode(JSON.stringify(payload));
  return `${part}.${crypto.hmacSha256B64u(part, secret)}`;
}

export type TokenCheck = { ok: true; role: Role } | { ok: false; code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' };

export function verifyToken(s: Services, token: unknown, deviceId: string): TokenCheck {
  const secret = s.props.get(PROP.TOKEN_SECRET);
  if (typeof token !== 'string' || !secret) return { ok: false, code: 'UNAUTHORIZED' };
  const [part, sig, extra] = token.split('.');
  if (!part || !sig || extra !== undefined) return { ok: false, code: 'UNAUTHORIZED' };
  if (!constantTimeEqual(s.crypto.hmacSha256B64u(part, secret), sig)) return { ok: false, code: 'UNAUTHORIZED' };
  const json = b64uDecode(part);
  let p: Partial<TokenPayload>;
  try {
    p = JSON.parse(json ?? '') as Partial<TokenPayload>;
  } catch {
    return { ok: false, code: 'UNAUTHORIZED' };
  }
  if (p.deviceId !== deviceId || (p.role !== 'Manager' && p.role !== 'Owner')) return { ok: false, code: 'UNAUTHORIZED' };
  if (p.ver !== currentTokenVersion(s) || typeof p.exp !== 'number' || p.exp * 1000 <= s.now()) {
    return { ok: false, code: 'TOKEN_EXPIRED' };
  }
  return { ok: true, role: p.role };
}

export const currentTokenVersion = (s: Services): number => Number(s.props.get(PROP.TOKEN_VERSION) ?? '1');

export function issueToken(s: Services, role: Role, deviceId: string): { token: string; expiresAt: number } {
  const exp = Math.floor(s.now() / 1000) + TOKEN_TTL_DAYS * 86400;
  const token = signToken(s.crypto, s.props.get(PROP.TOKEN_SECRET) as string, {
    role,
    deviceId,
    ver: currentTokenVersion(s),
    exp,
  });
  return { token, expiresAt: exp * 1000 };
}

const WINDOW_S = LOCKOUT_MINUTES * 60;
const failKey = (d: string) => `fail:${d}`;
const lockKey = (d: string) => `locked:${d}`;

export const isLockedOut = (s: Services, deviceId: string): boolean => s.cache.get(lockKey(deviceId)) !== null;

/** Records a failed PIN. Returns true when this failure triggered the lockout. */
export function recordFailure(s: Services, deviceId: string): { attempts: number; lockedOut: boolean } {
  const now = s.now();
  const prior = (JSON.parse(s.cache.get(failKey(deviceId)) ?? '[]') as number[]).filter((t) => t > now - WINDOW_S * 1000);
  const attempts = [...prior, now];
  if (attempts.length >= MAX_PIN_FAILURES) {
    s.cache.put(lockKey(deviceId), String(now), WINDOW_S);
    s.cache.remove(failKey(deviceId));
    return { attempts: attempts.length, lockedOut: true };
  }
  s.cache.put(failKey(deviceId), JSON.stringify(attempts), WINDOW_S);
  return { attempts: attempts.length, lockedOut: false };
}

export const clearFailures = (s: Services, deviceId: string): void => s.cache.remove(failKey(deviceId));

/** Role for a PIN, or null. Both hashes are always compared. */
export function roleForPin(s: Services, pin: string): Role | null {
  const salt = s.props.get(PROP.PIN_SALT);
  const manager = s.props.get(PROP.MANAGER_PIN_HASH);
  const owner = s.props.get(PROP.OWNER_PIN_HASH);
  if (!salt || !manager || !owner || !/^\d{6}$/.test(pin)) return null;
  const h = hashPin(s.crypto, salt, pin);
  const isOwner = constantTimeEqual(h, owner);
  const isManager = constantTimeEqual(h, manager);
  return isOwner ? 'Owner' : isManager ? 'Manager' : null;
}

/** Stores new PIN hashes and signs every device out (OPS-03). */
export function setPins(s: Services, managerPin: string, ownerPin: string): { ok: true } | { ok: false; reason: string } {
  if (!/^\d{6}$/.test(managerPin) || !/^\d{6}$/.test(ownerPin)) return { ok: false, reason: 'PINs must be exactly 6 digits.' };
  if (managerPin === ownerPin) return { ok: false, reason: 'The Manager and Owner PINs must be different.' };
  let salt = s.props.get(PROP.PIN_SALT);
  if (!salt) {
    salt = s.crypto.randomHex(32);
    s.props.set(PROP.PIN_SALT, salt);
  }
  s.props.set(PROP.MANAGER_PIN_HASH, hashPin(s.crypto, salt, managerPin));
  s.props.set(PROP.OWNER_PIN_HASH, hashPin(s.crypto, salt, ownerPin));
  s.props.set(PROP.TOKEN_VERSION, String(currentTokenVersion(s) + 1));
  return { ok: true };
}
