// Device identity and sign-in state (FR-AUTH-01, -02, -04).
import type { Role } from '@aluthgama/shared';
import { kvGet, kvRemove, kvSet } from './kv';
import { createStore } from './store';

export interface Session {
  loaded: boolean;
  deviceId: string | null;
  deviceName: string | null;
  token: string | null;
  role: Role | null;
  expiresAt: string | null;
}

export const session = createStore<Session>({
  loaded: false,
  deviceId: null,
  deviceName: null,
  token: null,
  role: null,
  expiresAt: null,
});

const K = {
  deviceId: 'deviceId',
  deviceName: 'deviceName',
  token: 'token',
  role: 'role',
  expiresAt: 'expiresAt',
} as const;

export async function loadSession(now = Date.now()): Promise<Session> {
  const [deviceId, deviceName, token, role, expiresAt] = await Promise.all([
    kvGet(K.deviceId),
    kvGet(K.deviceName),
    kvGet(K.token),
    kvGet(K.role),
    kvGet(K.expiresAt),
  ]);
  const valid = token && expiresAt && Date.parse(expiresAt) > now;
  const s: Session = {
    loaded: true,
    deviceId,
    deviceName,
    token: valid ? token : null,
    role: valid && (role === 'Manager' || role === 'Owner') ? role : null,
    expiresAt: valid ? expiresAt : null,
  };
  session.set(s);
  return s;
}

/** First-run setup: stores the device name and a new deviceId (UUID v4). */
export async function saveDevice(name: string): Promise<void> {
  const deviceId = session.get().deviceId ?? crypto.randomUUID();
  await kvSet(K.deviceId, deviceId);
  await kvSet(K.deviceName, name);
  session.set((s) => ({ ...s, deviceId, deviceName: name }));
}

export async function signIn(token: string, role: Role, expiresAt: string): Promise<void> {
  await kvSet(K.token, token);
  await kvSet(K.role, role);
  await kvSet(K.expiresAt, expiresAt);
  session.set((s) => ({ ...s, token, role, expiresAt }));
}

/** Clears the token only. Drafts and the outbox are kept (FR-AUTH-04). */
export async function signOut(): Promise<void> {
  await Promise.all([kvRemove(K.token), kvRemove(K.role), kvRemove(K.expiresAt)]);
  session.set((s) => ({ ...s, token: null, role: null, expiresAt: null }));
}
