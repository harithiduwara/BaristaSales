import { t, type MessageKey } from '../i18n';

export const STEP_NAMES: MessageKey[] = ['wizard.step1', 'wizard.step2', 'wizard.step3', 'wizard.step4', 'wizard.step5'];
export const STEP_LONG: MessageKey[] = ['wizard.step1Long', 'wizard.step2Long', 'wizard.step3Long', 'wizard.step4Long', 'wizard.step5Long'];

/** FR-REP-01: visible, clickable stepper with error dots per step. */
export function Stepper({ step, errorSteps, onJump }: { step: number; errorSteps: ReadonlySet<number>; onJump: (s: number) => void }) {
  return (
    <nav className="stepper" aria-label={t('wizard.steps')}>
      <div className="label">
        <b>{t('wizard.stepOf', { step, name: t(STEP_LONG[step - 1] as MessageKey) })}</b>
        {step < 5 ? <span className="muted">{t('wizard.nextStep', { name: t(STEP_NAMES[step] as MessageKey) })}</span> : null}
      </div>
      <ol>
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const state = n === step ? 'current' : n < step ? 'done' : '';
          const hasError = errorSteps.has(n);
          const parts = [t('wizard.stepLabel', { step: n, name: t(STEP_LONG[i] as MessageKey) })];
          if (n === step) parts.push(t('wizard.stepCurrent'));
          if (hasError) parts.push(t('wizard.stepErrors'));
          return (
            <li key={name} className={`${state}${hasError ? ' has-error' : ''}`}>
              <button
                type="button"
                className="seg"
                aria-current={n === step ? 'step' : undefined}
                aria-label={parts.join(', ')}
                onClick={() => onJump(n)}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
