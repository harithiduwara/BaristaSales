// S-04/S-05 report wizard (FR-REP-01 … 07, 10). Values are strings until the shared schema parses them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import {
  CONDITIONS,
  FIELD_STEP,
  PERIODS,
  TEXT_LIMITS,
  WEATHER,
  addDays,
  canEditDate,
  defaultBusinessDate,
  formatDateLong,
  formatDateShort,
  formatMoney,
  isValidDate,
  parseInteger,
  parseMoney,
  reportWarnings,
  todayColombo,
  validateReport,
  colomboTime,
  type FieldIssue,
  type Report,
  type ReportRecord,
  type Warning,
} from '@aluthgama/shared';
import { AppBar } from '../components/AppBar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/Dialog';
import { Stepper, STEP_LONG } from '../components/Stepper';
import { showToast } from '../components/Toast';
import { SummaryStrip, ErrorState } from '../components/misc';
import { ChipGroup, Checkbox, DateField, IntegerField, MoneyField, TextAreaField, TextField, TimeField } from '../components/fields';
import { db, draftKey } from '../lib/db';
import { emptyForm, reportToForm, type FormValues } from '../lib/formModel';
import { removeFromOutbox, submitReport } from '../lib/outbox';
import { cachedRange, getReport } from '../lib/reports';
import { session } from '../lib/session';
import { navigate } from '../router';
import { conflictState, config, editIntent, lastSubmission, useStore } from '../state/app';
import { t, tDynamic, type MessageKey } from '../i18n';

type F = keyof FormValues;

const STEP_FIELDS: Record<number, F[]> = { 1: [], 2: [], 3: [], 4: [] };
for (const [f, s] of Object.entries(FIELD_STEP)) STEP_FIELDS[s]?.push(f as F);

const num = (v: string): number | null => {
  const n = parseMoney(v);
  return n !== null && Number.isFinite(n) ? n : null;
};
const int = (v: string): number | null => {
  const n = parseInteger(v);
  return n !== null && Number.isFinite(n) ? n : null;
};

export function ruleMessage(field: string, rule: string, opening: string): string {
  const max = (TEXT_LIMITS as Record<string, number>)[field] ?? 0;
  return tDynamic(`rule.${rule}`, 'rule.unknown', { max, opening: formatDateLong(opening) });
}

export function Wizard({ routeDate, step }: { routeDate: string | null; step: number }) {
  const cfg = useStore(config);
  const role = useStore(session).role ?? 'Manager';
  const now = Date.now();
  const today = todayColombo(now);
  const ctx = useMemo(() => ({ openingDate: cfg.OPENING_DATE, today }), [cfg.OPENING_DATE, today]);
  const initialDate = routeDate ?? defaultBusinessDate(now, cfg.DATE_CUTOFF_HOUR, cfg.OPENING_DATE);

  const resolver: Resolver<FormValues> = useCallback(
    async (values) => {
      const r = validateReport(values, ctx);
      if (r.ok) return { values, errors: {} };
      const errors: Record<string, { type: string; message: string }> = {};
      for (const i of r.issues) errors[i.field] ??= { type: i.rule, message: i.rule };
      return { values: {}, errors };
    },
    [ctx],
  );

  const form = useForm<FormValues>({ defaultValues: emptyForm(initialDate), mode: 'onTouched', resolver });
  const { control, reset, getValues, trigger, setError, formState, setFocus } = form;
  const values = useWatch({ control }) as FormValues;

  const [loaded, setLoaded] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [existing, setExisting] = useState<ReportRecord | null>(null);
  const [loadedSaved, setLoadedSaved] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; correlationId?: string | undefined } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [history, setHistory] = useState<{ date: string; total: number }[]>([]);
  const [touchedByUser, setTouchedByUser] = useState(false);
  const savedKey = useRef<string | null>(null);

  // ---- load draft (FR-REP-07) or start empty ----
  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await db();
      const draft = await d.get('drafts', draftKey(initialDate));
      if (!alive) return;
      if (draft) {
        reset(draft.values);
        setBaseVersion(draft.baseVersion);
        setRestoredAt(draft.updatedAt);
        savedKey.current = draft.key;
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [initialDate, reset]);

  // ---- autosave, debounced 500 ms ----
  const saveDraft = useCallback(async () => {
    const v = getValues();
    if (!isValidDate(v.businessDate)) return;
    const key = draftKey(v.businessDate);
    const d = await db();
    if (savedKey.current && savedKey.current !== key) await d.delete('drafts', savedKey.current);
    await d.put('drafts', { key, businessDate: v.businessDate, values: v, baseVersion, updatedAt: Date.now() });
    savedKey.current = key;
  }, [getValues, baseVersion]);

  useEffect(() => {
    if (!loaded || !formState.isDirty) return;
    const id = setTimeout(() => void saveDraft(), 500);
    return () => clearTimeout(id);
  }, [values, loaded, formState.isDirty, saveDraft]);

  // ---- keep the URL on the selected date ----
  const date = values.businessDate;
  useEffect(() => {
    if (loaded && isValidDate(date) && date !== routeDate) navigate(`/report/${date}/${step}`, { replace: true });
  }, [date, routeDate, step, loaded]);

  // ---- existing report detection (FR-REP-03) ----
  const intent = useStore(editIntent);
  useEffect(() => {
    if (!loaded || !isValidDate(date)) return;
    let alive = true;
    setExisting(null);
    void getReport(date)
      .then((r) => {
        if (!alive || !r.report) return;
        if (intent === date && !formState.isDirty && !restoredAt) {
          reset(reportToForm(r.report));
          setBaseVersion(r.report.version);
          setLoadedSaved(true);
          editIntent.set(null);
          return;
        }
        setExisting(r.report);
        // Submitting replaces the saved report, as the banner says.
        setBaseVersion((b) => (b === null ? r.report?.version ?? null : b));
      })
      .catch(() => undefined);
    void cachedRange(addDays(date, -7), addDays(date, -1)).then((items) => {
      if (alive) setHistory(items.map((i) => ({ date: i.businessDate, total: i.total })));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the date changes
  }, [date, loaded]);

  const loadSaved = () => {
    if (!existing) return;
    reset(reportToForm(existing), { keepDirty: false });
    setBaseVersion(existing.version);
    setLoadedSaved(true);
    setExisting(null);
    showToast(t('wizard.loaded'));
  };

  // ---- validation state ----
  const validation = useMemo(() => validateReport(values, ctx), [values, ctx]);
  const issues: FieldIssue[] = validation.ok ? [] : validation.issues;
  const touched = formState.touchedFields as Partial<Record<F, unknown>>;
  const visibleIssues = issues.filter((i) => showErrors || touched[i.field as F] || formState.errors[i.field as F]);
  const errorFor = (f: F): string | undefined => {
    const i = visibleIssues.find((x) => x.field === f);
    if (i) return ruleMessage(f, i.rule, cfg.OPENING_DATE);
    const e = formState.errors[f]?.message;
    return e ? ruleMessage(f, String(e), cfg.OPENING_DATE) : undefined;
  };
  const errorSteps = new Set(visibleIssues.map((i) => FIELD_STEP[i.field as keyof typeof FIELD_STEP] ?? 1));
  const warnings: Warning[] = validation.ok ? reportWarnings(validation.value, history) : [];

  const goStep = (n: number) => {
    void saveDraft();
    navigate(`/report/${date}/${n}`, { replace: true });
    document.querySelector('.body')?.scrollTo({ top: 0 });
  };

  const next = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    const ok = await trigger(fields);
    if (!ok) {
      const first = fields.find((f) => issues.some((i) => i.field === f));
      if (first) setFocus(first);
      return;
    }
    goStep(step + 1);
  };

  const leave = () => {
    void saveDraft().finally(() => navigate('/'));
  };
  const requestLeave = () => (formState.isDirty || touchedByUser ? setLeaveOpen(true) : navigate('/'));

  useEffect(() => {
    const onBack = () => (step > 1 ? goStep(step - 1) : requestLeave());
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  });

  // ---- submit (FR-REP-08) ----
  const submit = async () => {
    setShowErrors(true);
    setSubmitError(null);
    if (!validation.ok) {
      document.getElementById('error-summary')?.focus();
      return;
    }
    if (warnings.length > 0 && !confirmed) {
      document.getElementById('confirm-figures')?.focus();
      return;
    }
    if (!canEditDate(role, validation.value.businessDate, today, cfg.EDIT_WINDOW_DAYS)) {
      setSubmitError({ message: t('error.EDIT_WINDOW_CLOSED') });
      return;
    }
    setSubmitting(true);
    const report: Report = validation.value;
    try {
      await saveDraft();
      const { submissionId, outcome } = await submitReport(report, baseVersion);
      if (outcome.kind === 'sent' || outcome.kind === 'queued') {
        lastSubmission.set({ date: report.businessDate, report, queued: outcome.kind === 'queued' });
        reset(getValues());
        navigate(`/saved/${report.businessDate}`, { replace: true });
        return;
      }
      await removeFromOutbox(submissionId);
      const err = outcome.error;
      if (err.code === 'CONFLICT' && err.error?.current) {
        conflictState.set({ mine: report, current: err.error.current });
        navigate(`/conflict/${report.businessDate}`, { replace: true });
        return;
      }
      if (err.code === 'VALIDATION_FAILED') {
        for (const d of err.error?.details ?? []) setError(d.field as F, { type: d.rule, message: d.rule });
      }
      setSubmitError({ message: tDynamic(`error.${err.code}`, 'error.INTERNAL'), correlationId: err.error?.correlationId });
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return <div className="screen" aria-busy="true" />;

  const field = (name: F, render: (p: { value: string; onChange: (v: string) => void; onBlur: () => void; error?: string | undefined }) => React.ReactNode) => (
    <Controller
      name={name}
      control={control}
      render={({ field: f }) => (
        <>
          {render({
            value: f.value as string,
            onChange: (v) => {
              setTouchedByUser(true);
              f.onChange(v);
            },
            onBlur: f.onBlur,
            error: errorFor(name),
          })}
        </>
      )}
    />
  );
  const multi = (name: 'busyPeriods' | 'conditions', options: readonly string[], label: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field: f }) => (
        <ChipGroup
          label={label}
          options={options}
          multiple
          value={f.value}
          error={errorFor(name)}
          onChange={(v) => {
            setTouchedByUser(true);
            f.onChange(v);
          }}
        />
      )}
    />
  );
  const single = (name: F, options: readonly string[], label: string, hideLabel = false) => (
    <Controller
      name={name}
      control={control}
      render={({ field: f }) => (
        <ChipGroup
          label={label}
          options={options}
          value={f.value as string}
          hideLabel={hideLabel}
          error={errorFor(name)}
          onChange={(v) => {
            setTouchedByUser(true);
            f.onChange(v);
          }}
        />
      )}
    />
  );

  const live = <SummaryStrip total={num(values.total)} bills={int(values.bills)} uber={num(values.uber)} pickme={num(values.pickme)} />;
  const titleDate = isValidDate(date) ? formatDateShort(date) : '';

  return (
    <div className="screen">
      <AppBar title={t('wizard.title', { date: titleDate })} leading={{ icon: 'close', label: t('wizard.close'), onClick: requestLeave }} />
      <Stepper step={step} errorSteps={errorSteps} onJump={goStep} />
      <main className="body">
        {restoredAt && step === 1 ? (
          <Banner tone="info">
            <p>{t('wizard.draftRestored', { time: colomboTime(restoredAt) })}</p>
          </Banner>
        ) : null}
        {existing && !loadedSaved ? (
          <Banner tone="warning">
            <p>{t('wizard.existing', { date: formatDateShort(existing.businessDate) })}</p>
            <div>
              <Button variant="secondary" onClick={loadSaved}>
                {t('wizard.loadSaved')}
              </Button>
            </div>
          </Banner>
        ) : null}

        {step === 1 ? (
          <>
            {field('businessDate', (p) => (
              <DateField id="businessDate" label={t('field.businessDate')} required min={cfg.OPENING_DATE} max={today} {...p} />
            ))}
            <div className="pair">
              {field('total', (p) => <MoneyField id="total" label={t('field.total')} required {...p} />)}
              {field('bills', (p) => <IntegerField id="bills" label={t('field.bills')} required {...p} />)}
            </div>
            {live}
            <div className="grid-2">
              {field('dineIn', (p) => <MoneyField id="dineIn" label={t('field.dineIn')} {...p} />)}
              {field('takeaway', (p) => <MoneyField id="takeaway" label={t('field.takeaway')} hint={t('field.takeawayHint')} {...p} />)}
            </div>
            <div className="pair">
              {field('uber', (p) => <MoneyField id="uber" label={t('field.uber')} required hint={t('wizard.enterZero')} {...p} />)}
              {field('uberOrders', (p) => <IntegerField id="uberOrders" label={t('field.uberOrders')} {...p} />)}
            </div>
            <div className="pair">
              {field('pickme', (p) => <MoneyField id="pickme" label={t('field.pickme')} required hint={t('wizard.enterZero')} {...p} />)}
              {field('pickmeOrders', (p) => <IntegerField id="pickmeOrders" label={t('field.pickmeOrders')} {...p} />)}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="hint">{t('field.paymentsHint')}</p>
            {field('cash', (p) => <MoneyField id="cash" label={t('field.cash')} {...p} />)}
            {field('card', (p) => <MoneyField id="card" label={t('field.card')} {...p} />)}
            {field('qr', (p) => <MoneyField id="qr" label={t('field.qr')} {...p} />)}
            {field('discounts', (p) => <MoneyField id="discounts" label={t('field.discounts')} {...p} />)}
            {field('comps', (p) => <MoneyField id="comps" label={t('field.comps')} hint={t('field.compsHint')} {...p} />)}
            {field('voids', (p) => <MoneyField id="voids" label={t('field.voids')} {...p} />)}
          </>
        ) : null}

        {step === 3 ? (
          <>
            {field('foreignCustomers', (p) => <IntegerField id="foreignCustomers" label={t('field.foreignCustomers')} {...p} />)}
            {multi('busyPeriods', PERIODS, t('field.busyPeriods'))}
            {single('quietPeriod', PERIODS, t('field.quietPeriod'))}
            {field('topItems', (p) => <TextField id="topItems" label={t('field.topItems')} max={TEXT_LIMITS.topItems} {...p} />)}
            {field('stockOuts', (p) => <TextAreaField id="stockOuts" label={t('field.stockOuts')} max={TEXT_LIMITS.stockOuts} {...p} />)}
            {field('staffOnDuty', (p) => <IntegerField id="staffOnDuty" label={t('field.staffOnDuty')} {...p} />)}
            <div className="grid-2">
              {field('openTime', (p) => <TimeField id="openTime" label={t('field.openTime')} {...p} />)}
              {field('closeTime', (p) => (
                <TimeField
                  id="closeTime"
                  label={t('field.closeTime')}
                  hint={values.openTime && p.value && p.value < values.openTime ? t('field.closeAfterMidnight') : undefined}
                  {...p}
                />
              ))}
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <fieldset className="field">
              <legend>{t('field.weather')}</legend>
              <div className="stack-sm">
                {(['wxMorning', 'wxAfternoon', 'wxEvening', 'wxNight'] as const).map((k) => (
                  <div className="wx-row" key={k}>
                    <span className="text-sm" style={{ fontWeight: 500 }}>
                      {t(`field.${k}` as MessageKey)}
                    </span>
                    {single(k, WEATHER, `${t('field.weather')}: ${t(`field.${k}` as MessageKey)}`, true)}
                  </div>
                ))}
              </div>
            </fieldset>
            {multi('conditions', CONDITIONS, t('field.conditions'))}
            {field('conditionsOther', (p) => <TextField id="conditionsOther" label={t('field.conditionsOther')} max={TEXT_LIMITS.conditionsOther} {...p} />)}
            {field('promotions', (p) => <TextField id="promotions" label={t('field.promotions')} max={TEXT_LIMITS.promotions} {...p} />)}
            {field('feedback', (p) => (
              <TextAreaField id="feedback" label={t('field.feedback')} max={TEXT_LIMITS.feedback} hint={t('field.privacyHint')} {...p} />
            ))}
            {field('comments', (p) => (
              <TextAreaField id="comments" label={t('field.comments')} max={TEXT_LIMITS.comments} hint={t('field.privacyHint')} {...p} />
            ))}
          </>
        ) : null}

        {step === 5 ? (
          <Review
            values={values}
            issues={showErrors ? issues : []}
            warnings={warnings}
            confirmed={confirmed}
            setConfirmed={setConfirmed}
            submitError={submitError}
            opening={cfg.OPENING_DATE}
            live={live}
            onJump={(f) => {
              goStep(FIELD_STEP[f as keyof typeof FIELD_STEP] ?? 1);
              setTimeout(() => document.getElementById(f)?.focus(), 50);
            }}
          />
        ) : null}
      </main>
      <div className="actionbar">
        {step < 5 ? (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                void saveDraft().then(() => {
                  showToast(t('wizard.draftSaved'));
                })
              }
            >
              {t('wizard.saveDraft')}
            </Button>
            <Button onClick={() => void next()}>{t('wizard.next')}</Button>
          </>
        ) : (
          <Button block busy={submitting} onClick={() => void submit()}>
            {submitting ? t('review.submitting') : t('review.submit')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={leaveOpen}
        title={t('wizard.leaveTitle')}
        confirmLabel={t('wizard.leave')}
        cancelLabel={t('wizard.stay')}
        onConfirm={leave}
        onCancel={() => setLeaveOpen(false)}
      >
        {t('wizard.leaveBody')}
      </ConfirmDialog>
    </div>
  );
}

// ---------- Review (S-05) ----------

const REVIEW_SECTIONS: { step: number; fields: F[] }[] = [
  { step: 1, fields: ['businessDate', 'total', 'bills', 'dineIn', 'takeaway', 'uber', 'uberOrders', 'pickme', 'pickmeOrders'] },
  { step: 2, fields: ['cash', 'card', 'qr', 'discounts', 'comps', 'voids'] },
  { step: 3, fields: ['foreignCustomers', 'busyPeriods', 'quietPeriod', 'topItems', 'stockOuts', 'staffOnDuty', 'openTime', 'closeTime'] },
  { step: 4, fields: ['wxMorning', 'wxAfternoon', 'wxEvening', 'wxNight', 'conditions', 'conditionsOther', 'promotions', 'feedback', 'comments'] },
];

const MONEY = new Set<F>(['total', 'dineIn', 'takeaway', 'uber', 'pickme', 'cash', 'card', 'qr', 'discounts', 'comps', 'voids']);

function displayValue(f: F, v: string | string[]): string {
  if (Array.isArray(v)) return v.join(', ');
  if (f === 'businessDate') return isValidDate(v) ? formatDateLong(v) : v;
  if (MONEY.has(f)) {
    const n = num(v);
    return n === null ? v : `Rs ${formatMoney(n)}`;
  }
  return v;
}

export function warningText(w: Warning): string {
  switch (w.code) {
    case 'channelSplit':
    case 'paymentSplit':
      return t(w.code === 'channelSplit' ? 'warn.channelSplit' : 'warn.paymentSplit', {
        amount: `Rs ${formatMoney(Math.abs(w.diff))}`,
        direction: t(w.direction === 'over' ? 'warn.more' : 'warn.less'),
      });
    case 'avgBillUnusual':
      return t('warn.avgBillUnusual');
    case 'farFromAverage':
      return t('warn.farFromAverage');
  }
}

function Review({
  values,
  issues,
  warnings,
  confirmed,
  setConfirmed,
  submitError,
  opening,
  live,
  onJump,
}: {
  values: FormValues;
  issues: FieldIssue[];
  warnings: Warning[];
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
  submitError: { message: string; correlationId?: string | undefined } | null;
  opening: string;
  live: React.ReactNode;
  onJump: (field: string) => void;
}) {
  return (
    <>
      {submitError ? <ErrorState message={submitError.message} correlationId={submitError.correlationId} /> : null}
      {issues.length > 0 ? (
        <section className="banner error error-summary" id="error-summary" tabIndex={-1} role="alert" aria-labelledby="err-h">
          <div className="stack-sm" style={{ gap: 4 }}>
            <p className="title" id="err-h">
              {t('review.errorsTitle')}
            </p>
            <ul>
              {issues.map((i) => (
                <li key={`${i.field}:${i.rule}`}>
                  <a
                    href={`#${i.field}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onJump(i.field);
                    }}
                  >
                    {t(`field.${i.field}` as MessageKey)}
                  </a>
                  {': '}
                  {ruleMessage(i.field, i.rule, opening)}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {warnings.length > 0 ? (
        <section className="banner warning" aria-labelledby="warn-h">
          <div className="stack-sm" style={{ gap: 4, flex: 1 }}>
            <p className="title" id="warn-h">
              {t(warnings.length === 1 ? 'warn.title' : 'warn.titlePlural', { count: warnings.length })}
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
              {warnings.map((w) => (
                <li key={w.code}>{warningText(w)}</li>
              ))}
            </ul>
            <Checkbox id="confirm-figures" checked={confirmed} onChange={setConfirmed}>
              {t('warn.confirm')}
            </Checkbox>
          </div>
        </section>
      ) : null}
      {REVIEW_SECTIONS.map((s) => {
        const name = t(STEP_LONG[s.step - 1] as MessageKey);
        const filled = s.fields.filter((f) => {
          const v = values[f];
          return Array.isArray(v) ? v.length > 0 : v.trim() !== '';
        });
        return (
          <section className="card stack-sm" key={s.step} aria-labelledby={`rv-${s.step}`}>
            <div className="review-head">
              <h3 className="h3" id={`rv-${s.step}`}>
                {name}
              </h3>
              <a
                className="link"
                href={`#step-${s.step}`}
                aria-label={t('review.editSection', { section: name })}
                onClick={(e) => {
                  e.preventDefault();
                  onJump(s.fields[0] as string);
                }}
              >
                {t('review.edit')}
              </a>
            </div>
            {filled.length === 0 ? (
              <p className="muted text-sm">{t('review.empty')}</p>
            ) : (
              <dl className="dl">
                {filled.map((f) => (
                  <div key={f} style={{ display: 'contents' }}>
                    <dt>{t(`field.${f}` as MessageKey)}</dt>
                    <dd className={MONEY.has(f) || f === 'bills' ? undefined : 'txt'}>{displayValue(f, values[f])}</dd>
                  </div>
                ))}
              </dl>
            )}
            {s.step === 1 ? live : null}
          </section>
        );
      })}
    </>
  );
}
