import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  icon?: IconName;
  /** Shows a spinner after 400 ms (NFR-PERF-03) and blocks repeat presses. */
  busy?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', block, icon, busy = false, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!busy) {
      setShowSpinner(false);
      return;
    }
    const id = setTimeout(() => setShowSpinner(true), 400);
    return () => clearTimeout(id);
  }, [busy]);
  const cls = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {showSpinner ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}
