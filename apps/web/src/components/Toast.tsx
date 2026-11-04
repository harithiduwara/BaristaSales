import { useSyncExternalStore } from 'react';
import { createStore } from '../lib/store';
import { Icon } from './Icon';

const toastStore = createStore<{ id: number; text: string } | null>(null);
let seq = 0;

/** Short confirmation, e.g. "Copied" (10.3). Disappears after 4 s. */
export function showToast(text: string): void {
  const id = ++seq;
  toastStore.set({ id, text });
  setTimeout(() => {
    if (toastStore.get()?.id === id) toastStore.set(null);
  }, 4000);
}

export function ToastHost() {
  const toast = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return (
    <div aria-live="polite" role="status">
      {toast ? (
        <div className="toast">
          <Icon name="check" size="sm" />
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
