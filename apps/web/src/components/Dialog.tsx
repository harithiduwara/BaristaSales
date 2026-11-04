import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

/** In-app confirmation (never window.confirm). Focus moves into the dialog; Escape cancels. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button')];
        const first = f[0];
        const last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="dialog-scrim" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" ref={ref} onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">{title}</h2>
        {children ? <div className="text-sm">{children}</div> : null}
        <div className="actions">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} style={danger ? { background: 'var(--danger)', color: 'var(--surface)' } : undefined}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
