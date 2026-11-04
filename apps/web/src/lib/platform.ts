// Thin wrappers over Capacitor plugins, with web fallbacks (C-04, ADR-0010).
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

export type ShareResult = 'shareOpened' | 'copied' | 'failed';

/** Opens the share sheet (FR-SHR-02): Capacitor Share → navigator.share → wa.me link → clipboard. */
export async function shareText(text: string): Promise<ShareResult> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ text, dialogTitle: 'Share to WhatsApp' });
      return 'shareOpened';
    } catch {
      return copyText(text);
    }
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shareOpened';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shareOpened';
    }
  }
  const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  if (win) return 'shareOpened';
  return copyText(text);
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Calls `cb(true|false)` when connectivity changes. Returns an unsubscribe function. */
export function onConnectivity(cb: (online: boolean) => void): () => void {
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  let removeNative: (() => void) | undefined;
  if (isNative()) {
    void import('@capacitor/network').then(async ({ Network }) => {
      const h = await Network.addListener('networkStatusChange', (s) => cb(s.connected));
      removeNative = () => void h.remove();
    });
  }
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
    removeNative?.();
  };
}

/** Calls `cb` when the app comes back to the foreground. */
export function onResume(cb: () => void): () => void {
  const vis = () => {
    if (document.visibilityState === 'visible') cb();
  };
  document.addEventListener('visibilitychange', vis);
  let removeNative: (() => void) | undefined;
  if (isNative()) {
    void import('@capacitor/app').then(async ({ App }) => {
      const h = await App.addListener('resume', cb);
      removeNative = () => void h.remove();
    });
  }
  return () => {
    document.removeEventListener('visibilitychange', vis);
    removeNative?.();
  };
}

/** Android hardware back button (AND-03). The handler returns true when it handled the press. */
export function onBackButton(handler: () => boolean): () => void {
  if (!isNative()) return () => undefined;
  let remove: (() => void) | undefined;
  void import('@capacitor/app').then(async ({ App }) => {
    const h = await App.addListener('backButton', () => {
      if (!handler()) void App.exitApp();
    });
    remove = () => void h.remove();
  });
  return () => remove?.();
}
