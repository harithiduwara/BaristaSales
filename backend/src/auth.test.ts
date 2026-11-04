import { describe, expect, it } from 'vitest';
import { PROP, setPins, signToken, verifyToken } from './auth';
import { call, errorCode, MANAGER_PIN, OWNER_PIN, setupServices, signIn } from './testkit';
import { b64uEncode } from './util';

describe('FR-AUTH-02 PIN sign-in', () => {
  it('maps PINs to roles and returns a token', () => {
    const s = setupServices();
    const m = call(s, 'auth.verify', { pin: MANAGER_PIN, deviceName: 'Outlet phone' });
    expect(m.ok && m.data.role).toBe('Manager');
    expect(m.ok && m.data.expiresAt).toBe('2026-12-04T21:42:00+05:30');
    const o = call(s, 'auth.verify', { pin: OWNER_PIN, deviceName: 'Owner laptop' });
    expect(o.ok && o.data.role).toBe('Owner');
  });

  it('rejects wrong, malformed and missing PINs and audits them without the PIN', () => {
    const s = setupServices();
    expect(errorCode(call(s, 'auth.verify', { pin: '123456' }))).toBe('UNAUTHORIZED');
    expect(errorCode(call(s, 'auth.verify', { pin: '12345' }))).toBe('UNAUTHORIZED');
    expect(errorCode(call(s, 'auth.verify', {}))).toBe('UNAUTHORIZED');
    expect(s.store.audit.map((a) => a.event)).toEqual(['auth_fail', 'auth_fail', 'auth_fail']);
    expect(JSON.stringify(s.store.audit)).not.toContain('123456');
  });

  it('never stores PINs in plain text (NFR-SEC-01)', () => {
    const s = setupServices();
    expect([...s.props.data.values()].join()).not.toMatch(/111111|999999/);
  });

  it('fails closed when PINs are not set', () => {
    const s = setupServices();
    s.props.data.delete(PROP.OWNER_PIN_HASH);
    expect(errorCode(call(s, 'auth.verify', { pin: MANAGER_PIN }))).toBe('UNAUTHORIZED');
  });
});

describe('FR-AUTH-03 lockout', () => {
  it('locks a device after 5 failures in 15 minutes, even for a correct PIN', () => {
    const s = setupServices();
    for (let i = 0; i < 5; i++) call(s, 'auth.verify', { pin: '000000' });
    expect(errorCode(call(s, 'auth.verify', { pin: MANAGER_PIN }))).toBe('LOCKED_OUT');
    expect(s.store.audit.filter((a) => a.event === 'lockout')).toHaveLength(1);
    expect(errorCode(call(s, 'auth.verify', { pin: MANAGER_PIN }, { deviceId: 'dev-2' }))).toBeNull();
    s.clock.offsetMs = 15 * 60_000 + 1;
    expect(errorCode(call(s, 'auth.verify', { pin: MANAGER_PIN }))).toBeNull();
  });

  it('forgets failures older than 15 minutes and resets on success', () => {
    const s = setupServices();
    for (let i = 0; i < 4; i++) call(s, 'auth.verify', { pin: '000000' });
    s.clock.offsetMs = 16 * 60_000;
    call(s, 'auth.verify', { pin: '000000' });
    expect(errorCode(call(s, 'auth.verify', { pin: MANAGER_PIN }))).toBeNull();
    for (let i = 0; i < 4; i++) call(s, 'auth.verify', { pin: '000000' });
    expect(errorCode(call(s, 'auth.verify', { pin: MANAGER_PIN }))).toBeNull();
  });
});

describe('tokens', () => {
  it('requires a valid token bound to the device', () => {
    const s = setupServices();
    expect(errorCode(call(s, 'config.get', {}))).toBe('UNAUTHORIZED');
    const t = signIn(s);
    expect(errorCode(call(s, 'config.get', {}, { token: t }))).toBeNull();
    expect(errorCode(call(s, 'config.get', {}, { token: t, deviceId: 'dev-2' }))).toBe('UNAUTHORIZED');
    expect(errorCode(call(s, 'config.get', {}, { token: `${t}x` }))).toBe('UNAUTHORIZED');
    expect(errorCode(call(s, 'config.get', {}, { token: `${t}.x` }))).toBe('UNAUTHORIZED');
    expect(errorCode(call(s, 'config.get', {}, { token: 'nodot' }))).toBe('UNAUTHORIZED');
  });

  it('expires after 30 days', () => {
    const s = setupServices();
    const t = signIn(s);
    s.clock.offsetMs = 30 * 86_400_000;
    expect(errorCode(call(s, 'config.get', {}, { token: t }))).toBe('TOKEN_EXPIRED');
  });

  it('OPS-03 rotating PINs signs everyone out', () => {
    const s = setupServices();
    const t = signIn(s);
    expect(setPins(s, '222222', '888888')).toEqual({ ok: true });
    expect(errorCode(call(s, 'config.get', {}, { token: t }))).toBe('TOKEN_EXPIRED');
    expect(errorCode(call(s, 'auth.verify', { pin: '222222' }))).toBeNull();
  });

  it('setPins rejects bad or identical PINs and creates a salt if missing', () => {
    const s = setupServices();
    expect(setPins(s, '12345', '999999').ok).toBe(false);
    expect(setPins(s, '123456', '123456').ok).toBe(false);
    s.props.data.delete(PROP.PIN_SALT);
    expect(setPins(s, '123456', '654321').ok).toBe(true);
    expect(s.props.get(PROP.PIN_SALT)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects well-signed tokens with a bad payload', () => {
    const s = setupServices();
    const secret = s.props.get(PROP.TOKEN_SECRET) as string;
    const forged = (payload: string) => {
      const part = b64uEncode(payload);
      return `${part}.${s.crypto.hmacSha256B64u(part, secret)}`;
    };
    expect(verifyToken(s, forged('not json'), 'dev-1')).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(
      verifyToken(s, forged('{"role":"Admin","deviceId":"dev-1","ver":2,"exp":9999999999}'), 'dev-1').ok,
    ).toBe(false);
    expect(
      verifyToken(
        s,
        signToken(s.crypto, secret, { role: 'Owner', deviceId: 'dev-1', ver: 2, exp: 9999999999 }),
        'dev-1',
      ),
    ).toEqual({
      ok: true,
      role: 'Owner',
    });
    s.props.data.delete(PROP.TOKEN_SECRET);
    expect(verifyToken(s, 'a.b', 'dev-1').ok).toBe(false);
  });
});
