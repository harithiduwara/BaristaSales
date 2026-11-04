import { useEffect } from 'react';
import { PIN_LENGTH } from '@aluthgama/shared';
import { Icon } from './Icon';
import { t } from '../i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** S-02: masked 6-digit PIN pad; also accepts the hardware keyboard. */
export function PinPad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key) && value.length < PIN_LENGTH) onChange(value + e.key);
      else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, disabled]);
  const press = (d: string) => {
    if (!disabled && value.length < PIN_LENGTH) onChange(value + d);
  };
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="pin-dots" role="img" aria-label={t('pin.dots', { count: value.length })}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <i key={i} className={i < value.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keypad" role="group" aria-label={t('pin.keypad')} style={disabled ? { opacity: 0.45 } : undefined}>
        {KEYS.map((k) => (
          <button key={k} type="button" className="key" disabled={disabled} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <span className="key ghost" aria-hidden="true" />
        <button type="button" className="key" disabled={disabled} onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="key ghost" disabled={disabled} aria-label={t('pin.delete')} onClick={() => onChange(value.slice(0, -1))}>
          <Icon name="backspace" />
        </button>
      </div>
    </div>
  );
}
