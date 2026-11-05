// CR-01: Claude's take on a saved report. Never blocks the report itself.
import { useCallback, useEffect, useState } from 'react';
import type { Insight } from '@aluthgama/shared';
import { ApiCallError, callApi } from '../lib/api';
import { Button } from './Button';
import { Skeleton } from './misc';
import { t } from '../i18n';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; insight: Insight }
  | { kind: 'noReport' | 'notConfigured' | 'unavailable' | 'offline' };

const cache = new Map<string, Insight>();
/** Test helper. */
export const clearInsightCache = () => cache.clear();

export function InsightCard({
  date,
  version,
  auto,
  waiting,
}: {
  date: string;
  version?: number;
  auto: boolean;
  waiting?: boolean;
}) {
  const key = `${date}|${version ?? ''}`;
  const cached = cache.get(key);
  const [state, setState] = useState<State>(cached ? { kind: 'ready', insight: cached } : { kind: 'idle' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const r = await callApi('report.insight', { businessDate: date }, { timeoutMs: 60_000 });
      if (r.status === 'ready' && r.insight) {
        cache.set(`${date}|${r.insight.reportVersion}`, r.insight);
        cache.set(`${date}|`, r.insight);
        setState({ kind: 'ready', insight: r.insight });
      } else setState({ kind: r.status === 'ready' ? 'unavailable' : r.status });
    } catch (e) {
      setState({ kind: e instanceof ApiCallError && e.isNetwork ? 'offline' : 'unavailable' });
    }
  }, [date]);

  useEffect(() => {
    if (auto && !waiting && state.kind === 'idle') void load();
  }, [auto, waiting, state.kind, load]);

  return (
    <section
      className="card stack-sm"
      aria-labelledby={`ai-${date}`}
      aria-busy={state.kind === 'loading' || undefined}
    >
      <h2 className="h3" id={`ai-${date}`}>
        {t('insight.title')}
      </h2>
      <div aria-live="polite" className="stack-sm">
        {waiting ? (
          <p className="muted text-sm">{t('insight.waiting')}</p>
        ) : state.kind === 'idle' ? (
          <div>
            <Button variant="secondary" onClick={() => void load()}>
              {t('insight.get')}
            </Button>
          </div>
        ) : state.kind === 'loading' ? (
          <>
            <p className="muted text-sm">{t('insight.loading')}</p>
            <Skeleton rows={1} />
          </>
        ) : state.kind === 'ready' ? (
          <>
            <p className="pre text-sm" data-testid="insight-text">
              {state.insight.text}
            </p>
            <p className="hint">{t('insight.disclaimer')}</p>
          </>
        ) : (
          <>
            <p className="muted text-sm">{t(`insight.${state.kind}`)}</p>
            {state.kind === 'unavailable' || state.kind === 'offline' ? (
              <div>
                <Button variant="secondary" icon="refresh" onClick={() => void load()}>
                  {t('error.retry')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
