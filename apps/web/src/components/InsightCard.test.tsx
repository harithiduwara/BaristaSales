// CR-01 InsightCard states, against the real backend core.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightCard, clearInsightCache } from './InsightCard';
import { installFakeServer, NOW, type FakeServer } from '../test/fakeServer';
import { signedIn } from '../test/session';
import { callApi } from '../lib/api';

let server: FakeServer;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  clearInsightCache();
  server = installFakeServer();
  await signedIn(server);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('InsightCard (CR-01)', () => {
  it('on demand: button, then text with a disclaimer, then cached', async () => {
    const { unmount } = render(<InsightCard date="2026-11-03" version={1} auto={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask Claude about this day' }));
    expect(await screen.findByTestId('insight-text')).toHaveTextContent('Sales on 2026-11-03');
    expect(screen.getByText(/Written by Claude/)).toBeInTheDocument();
    unmount();
    render(<InsightCard date="2026-11-03" version={1} auto={false} />);
    expect(screen.getByTestId('insight-text')).toBeInTheDocument();
    expect(server.calls.filter((c) => c.action === 'report.insight')).toHaveLength(1);
  });

  it('waits while the report is unsent', () => {
    render(<InsightCard date="2026-11-03" auto waiting />);
    expect(screen.getByText("Claude's take appears once the report is sent.")).toBeInTheDocument();
    expect(server.calls.filter((c) => c.action === 'report.insight')).toHaveLength(0);
  });

  it('explains when Claude is not set up, unavailable, offline or the day has no report', async () => {
    server.s.ai.next = { ok: false, reason: 'notConfigured', detail: '' };
    const { unmount } = render(<InsightCard date="2026-11-03" auto />);
    expect(await screen.findByText(/Claude isn't set up yet/)).toBeInTheDocument();
    unmount();

    server.s.cache.clear();
    server.s.ai.next = { ok: false, reason: 'error', detail: 'HTTP 529' };
    const second = render(<InsightCard date="2026-11-03" auto />);
    expect(await screen.findByText(/Claude couldn't answer just now/)).toBeInTheDocument();
    server.offline = true;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
    second.unmount();

    server.offline = false;
    render(<InsightCard date="2026-11-20" auto />);
    expect(await screen.findByText("There's no saved report for this day yet.")).toBeInTheDocument();
  });

  it('server errors show as unavailable', async () => {
    server.s.props.set('TOKEN_SECRET', 'changed');
    render(<InsightCard date="2026-11-03" auto />);
    expect(await screen.findByText(/Claude couldn't answer just now/)).toBeInTheDocument();
    await expect(callApi('config.get', {})).rejects.toBeTruthy();
  });
});
