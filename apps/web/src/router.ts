// Hash routing: works on GitHub Pages sub-paths and inside the APK, and the back button follows history.
import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const read = () => window.location.hash.replace(/^#/, '') || '/';

export function useRoute(): string {
  return useSyncExternalStore(subscribe, read);
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) {
    history.replaceState(null, '', `#${path}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else window.location.hash = path;
}

export type Route =
  | { name: 'home' }
  | { name: 'wizard'; date: string | null; step: number }
  | { name: 'saved'; date: string }
  | { name: 'conflict'; date: string }
  | { name: 'history' }
  | { name: 'view'; date: string }
  | { name: 'settings' }
  | { name: 'notFound' };

export function parseRoute(path: string): Route {
  const p = path.split('/').filter(Boolean);
  const date = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  switch (p[0]) {
    case undefined:
      return { name: 'home' };
    case 'report': {
      const step = Number(p[2] ?? 1);
      return { name: 'wizard', date: date(p[1]), step: step >= 1 && step <= 5 ? step : 1 };
    }
    case 'saved':
      return date(p[1]) ? { name: 'saved', date: p[1] as string } : { name: 'notFound' };
    case 'conflict':
      return date(p[1]) ? { name: 'conflict', date: p[1] as string } : { name: 'notFound' };
    case 'history':
      return { name: 'history' };
    case 'view':
      return date(p[1]) ? { name: 'view', date: p[1] as string } : { name: 'notFound' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'notFound' };
  }
}
