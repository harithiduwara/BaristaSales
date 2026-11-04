// App shell: first-run setup → PIN → routed screens. Keeps the outbox running (FR-REP-09).
import { useEffect } from 'react';
import { session, loadSession } from './lib/session';
import { authLost, processOutbox, refreshOutboxState } from './lib/outbox';
import { onBackButton, onConnectivity, onResume } from './lib/platform';
import { loadCachedConfig, loadTheme, online, refreshConfig, useStore } from './state/app';
import { navigate, parseRoute, useRoute } from './router';
import { Banner } from './components/Banner';
import { ToastHost } from './components/Toast';
import { Setup } from './screens/Setup';
import { Pin } from './screens/Pin';
import { Home } from './screens/Home';
import { Wizard } from './screens/Wizard';
import { Success } from './screens/Success';
import { Conflict } from './screens/Conflict';
import { History } from './screens/History';
import { Detail } from './screens/Detail';
import { Settings } from './screens/Settings';
import { t } from './i18n';

export function App() {
  const s = useStore(session);
  const isOnline = useStore(online);
  const lost = useStore(authLost);
  const path = useRoute();
  const route = parseRoute(path);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadTheme(), loadCachedConfig(), refreshOutboxState()]);
      const loaded = await loadSession();
      if (loaded.token) {
        void refreshConfig();
        void processOutbox({ force: true });
      }
    })();
    const offConn = onConnectivity((up) => {
      online.set(up);
      if (up) void processOutbox({ force: true });
    });
    const offResume = onResume(() => void processOutbox({ force: true }));
    const offBack = onBackButton(() => {
      const r = parseRoute(window.location.hash.replace(/^#/, '') || '/');
      if (r.name === 'wizard') {
        window.dispatchEvent(new Event('app:back'));
        return true;
      }
      if (r.name === 'home') return false;
      navigate('/');
      return true;
    });
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist();
    return () => {
      offConn();
      offResume();
      offBack();
    };
  }, []);

  useEffect(() => {
    // FR-AUTH acceptance: an expired token returns to the PIN screen without losing drafts.
    if (lost > 0) void loadSession();
  }, [lost]);

  let screen: React.ReactNode;
  if (!s.loaded) screen = <div className="screen" aria-busy="true" />;
  else if (!s.deviceId || !s.deviceName) screen = <Setup />;
  else if (!s.token) screen = <Pin />;
  else
    switch (route.name) {
      case 'home':
        screen = <Home />;
        break;
      case 'wizard':
        screen = <Wizard key="wizard" routeDate={route.date} step={route.step} />;
        break;
      case 'saved':
        screen = <Success date={route.date} />;
        break;
      case 'conflict':
        screen = <Conflict date={route.date} />;
        break;
      case 'history':
        screen = <History />;
        break;
      case 'view':
        screen = <Detail key={route.date} date={route.date} />;
        break;
      case 'settings':
        screen = <Settings />;
        break;
      default:
        screen = <Home />;
    }

  return (
    <div className="app">
      {!isOnline && s.token ? (
        <Banner tone="warning" icon="offline" className="offline-banner">
          <p>{t('offline.banner')}</p>
        </Banner>
      ) : null}
      {screen}
      <ToastHost />
    </div>
  );
}
