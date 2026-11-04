// Session storage: Capacitor Preferences in the APK, IndexedDB in the PWA (ADR-0003).
import { isNative } from './platform';
import { db } from './db';

export async function kvGet(key: string): Promise<string | null> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    return (await Preferences.get({ key })).value;
  }
  return (await (await db()).get('session', key))?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
    return;
  }
  await (await db()).put('session', { key, value });
}

export async function kvRemove(key: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
    return;
  }
  await (await db()).delete('session', key);
}
