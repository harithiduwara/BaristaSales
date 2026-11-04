// S-06 Success and share (FR-REP-11, FR-SHR-01, FR-SHR-02).
import { useEffect, useState } from 'react';
import { formatDateShort, whatsappSummary, type Report } from '@aluthgama/shared';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { WhatsAppPreview } from '../components/misc';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';
import { copyText, shareText } from '../lib/platform';
import { db } from '../lib/db';
import { navigate } from '../router';
import { lastSubmission, useStore } from '../state/app';
import { t } from '../i18n';

export function Success({ date }: { date: string }) {
  const last = useStore(lastSubmission);
  const [report, setReport] = useState<Report | null>(last?.date === date ? last.report : null);
  const queued = last?.date === date ? last.queued : false;

  useEffect(() => {
    if (report) return;
    void (async () => {
      const d = await db();
      const r =
        (await d.get('reports', date)) ?? (await d.getAllFromIndex('outbox', 'byDate', date))[0]?.report;
      if (r) setReport(r as unknown as Report);
    })();
  }, [date, report]);

  if (!report) return <div className="screen" aria-busy="true" />;
  const text = whatsappSummary(report);

  const share = async () => {
    const r = await shareText(text);
    showToast(
      r === 'shareOpened'
        ? t('success.shareOpened')
        : r === 'copied'
          ? t('success.copied')
          : t('success.copyFailed'),
    );
  };
  const copy = async () => {
    const r = await copyText(text);
    showToast(r === 'copied' ? t('success.copied') : t('success.copyFailed'));
  };

  return (
    <div className="screen">
      <main className="body" style={{ paddingTop: 40, gap: 20 }}>
        <div className="center" style={{ gap: 12 }}>
          <div className="success-mark">
            <Icon name="check" />
          </div>
          <h1 className="h2" aria-live="polite">
            {t(queued ? 'success.queued' : 'success.saved', { date: formatDateShort(date) })}
          </h1>
          {queued ? (
            <Banner tone="warning" icon="offline">
              <p>{t('error.NETWORK')}</p>
            </Banner>
          ) : null}
          <p className="muted text-sm">{t('success.shareHint')}</p>
        </div>
        <section className="stack-sm" aria-labelledby="wa-h">
          <h2 className="section-title" id="wa-h">
            {t('success.whatsapp')}
          </h2>
          <WhatsAppPreview text={text} />
          <p className="hint">{t('success.boldHint')}</p>
        </section>
      </main>
      <div className="actionbar" style={{ flexDirection: 'column', gap: 8 }}>
        <Button block icon="share" onClick={() => void share()}>
          {t('success.share')}
        </Button>
        <div className="row" style={{ gap: 12 }}>
          <Button variant="secondary" icon="copy" style={{ flex: 1 }} onClick={() => void copy()}>
            {t('success.copy')}
          </Button>
          <Button variant="secondary" style={{ flex: 1 }} onClick={() => navigate('/', { replace: true })}>
            {t('success.done')}
          </Button>
        </div>
      </div>
    </div>
  );
}
