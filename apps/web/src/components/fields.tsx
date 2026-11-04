// Form fields (10.3). Each is controlled, labelled, and links its error with aria-describedby.
import { useId, useState, type ReactNode } from 'react';
import { formatMoney, parseMoney } from '@aluthgama/shared';
import { Icon } from './Icon';
import { t } from '../i18n';

interface BaseProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  onBlur?: () => void;
}

function Label({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean | undefined;
}) {
  return (
    <label htmlFor={htmlFor}>
      {label}
      {required ? (
        <>
          {' '}
          <span className="req" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{t('field.requiredSr')}</span>
        </>
      ) : null}
    </label>
  );
}

export function FieldError({ id, error }: { id: string; error?: string | undefined }) {
  if (!error) return null;
  return (
    <p className="error-text" id={id}>
      <Icon name="alert" size="sm" />
      {error}
    </p>
  );
}

function describedBy(hintId: string, errId: string, hint: unknown, error: unknown): string | undefined {
  return [hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;
}

/** Shows the raw value while focused and 129,849.85 on blur (MoneyField). Accepts "Rs 1,900/=" (V-02). */
export function MoneyField({
  id,
  label,
  hint,
  error,
  required,
  value,
  onChange,
  onBlur,
}: BaseProps & { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const display = (() => {
    if (focused) return value;
    const n = parseMoney(value);
    return n !== null && Number.isFinite(n) ? formatMoney(n) : value;
  })();
  return (
    <div className="field">
      <Label htmlFor={id} label={label} required={required} />
      <div className={`input${error ? ' is-error' : ''}`}>
        <span className="prefix" aria-hidden="true">
          {t('field.rs')}
        </span>
        <input
          id={id}
          name={id}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          value={display}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errId, hint, error)}
          aria-required={required || undefined}
          onFocus={(e) => {
            setFocused(true);
            const n = parseMoney(value);
            const raw = n !== null && Number.isFinite(n) ? String(n) : value;
            if (raw !== e.target.value) {
              e.target.value = raw;
              if (raw !== value) onChange(raw);
            }
            // Select the whole amount so typing replaces it.
            e.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function IntegerField({
  id,
  label,
  hint,
  error,
  required,
  value,
  onChange,
  onBlur,
}: BaseProps & { value: string; onChange: (v: string) => void }) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="field">
      <Label htmlFor={id} label={label} required={required} />
      <div className={`input${error ? ' is-error' : ''}`}>
        <input
          id={id}
          name={id}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errId, hint, error)}
          aria-required={required || undefined}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function DateField({
  id,
  label,
  hint,
  error,
  required,
  value,
  min,
  max,
  onChange,
  onBlur,
}: BaseProps & { value: string; min: string; max: string; onChange: (v: string) => void }) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="field">
      <Label htmlFor={id} label={label} required={required} />
      <div className={`input${error ? ' is-error' : ''}`}>
        <Icon name="calendar" />
        <input
          id={id}
          name={id}
          type="date"
          value={value}
          min={min}
          max={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errId, hint, error)}
          aria-required={required || undefined}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function TimeField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  onBlur,
}: BaseProps & { value: string; onChange: (v: string) => void }) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="field">
      <Label htmlFor={id} label={label} />
      <div className={`input${error ? ' is-error' : ''}`}>
        <Icon name="clock" />
        <input
          id={id}
          name={id}
          type="time"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errId, hint, error)}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  value,
  max,
  onChange,
  onBlur,
}: BaseProps & { value: string; max: number; onChange: (v: string) => void }) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="field">
      <Label htmlFor={id} label={label} />
      <div className={`input${error ? ' is-error' : ''}`}>
        <input
          id={id}
          name={id}
          value={value}
          maxLength={max + 50}
          style={{ fontFamily: 'var(--font-sans)' }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errId, hint, error)}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="field-foot">
        {hint ? (
          <span className="hint" id={hintId}>
            {hint}
          </span>
        ) : null}
        <span className="counter">{t('field.counter', { count: value.trim().length, max })}</span>
      </div>
      <FieldError id={errId} error={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  value,
  max,
  onChange,
  onBlur,
}: BaseProps & { value: string; max: number; onChange: (v: string) => void }) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const count = value.trim().length;
  return (
    <div className="field">
      <Label htmlFor={id} label={label} />
      <textarea
        id={id}
        name={id}
        className={`textarea${error ? ' is-error' : ''}`}
        value={value}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errId, hint, error)}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="field-foot">
        {hint ? (
          <span className="hint" id={hintId}>
            {hint}
          </span>
        ) : null}
        <span className="counter" aria-live={count > max * 0.9 ? 'polite' : 'off'}>
          {t('field.counter', { count, max })}
        </span>
      </div>
      <FieldError id={errId} error={error} />
    </div>
  );
}

/** Single select (radiogroup) or multi select (pressed buttons). */
export function ChipGroup({
  label,
  options,
  value,
  multiple,
  error,
  onChange,
  hideLabel,
}: {
  label: string;
  options: readonly string[];
  value: string | string[];
  multiple?: boolean;
  error?: string | undefined;
  onChange: (v: string | string[]) => void;
  hideLabel?: boolean;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <fieldset className="field" aria-describedby={error ? errId : undefined}>
      <legend className={hideLabel ? 'sr-only' : undefined}>{label}</legend>
      {/* The fieldset already groups multi-select chips; single select also needs radiogroup semantics. */}
      <div
        className="chips"
        role={multiple ? undefined : 'radiogroup'}
        aria-label={multiple ? undefined : label}
      >
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              className="chip"
              role={multiple ? undefined : 'radio'}
              aria-checked={multiple ? undefined : on}
              aria-pressed={multiple ? on : undefined}
              onClick={() => {
                if (multiple) onChange(on ? selected.filter((x) => x !== o) : [...selected, o]);
                else onChange(on ? '' : o);
              }}
            >
              {on ? <Icon name="check" size="sm" /> : null}
              {o}
            </button>
          );
        })}
      </div>
      <FieldError id={errId} error={error} />
    </fieldset>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`box${checked ? ' on' : ''}`} aria-hidden="true">
        {checked ? <Icon name="check" size="sm" /> : null}
      </span>
      {children}
    </label>
  );
}
