import { saveDevice, signIn as storeSignIn } from '../lib/session';
import type { FakeServer } from './fakeServer';
import { callApi } from '../lib/api';

/** Registers the device and signs in against the fake server. */
export async function signedIn(_server: FakeServer, pin = '111111') {
  await saveDevice('Test phone');
  const d = await callApi('auth.verify', { pin, deviceName: 'Test phone' });
  await storeSignIn(d.token, d.role, d.expiresAt);
  return d;
}
