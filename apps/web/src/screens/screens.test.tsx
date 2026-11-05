// Screen tests: the whole app in jsdom against the real backend core (fake server).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { installFakeServer, NOW, type FakeServer } from '../test/fakeServer';
import { session } from '../lib/session';
import { outboxState } from '../lib/outbox';
import { conflictState, lastSubmission, online, theme } from '../state/app';
import { db, draftKey } from '../lib/db';
import { emptyForm } from '../lib/formModel';
import type { ReportRecord } from '@aluthgama/shared';

let server: FakeServer;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  server = installFakeServer();
  session.set({ loaded: false, deviceId: null, deviceName: null, token: null, role: null, expiresAt: null });
  outboxState.set({ waiting: 0, failed: 0, items: [] });
  lastSubmission.set(null);
  conflictState.set(null);
  online.set(true);
  theme.set('system');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const go = (path: string) =>
  act(() => {
    window.location.hash = path;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

async function pin(digits: string) {
  const pad = await screen.findByRole('group', { name: 'PIN keypad' });
  for (const d of digits) await userEvent.click(within(pad).getByRole('button', { name: d }));
}

async function startSignedIn(p = '111111') {
  render(<App />);
  await userEvent.type(await screen.findByLabelText('Device name'), 'Outlet phone');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await pin(p);
  await screen.findByRole('heading', { name: "Today's report" });
}

describe('S-01 setup and S-02 PIN', () => {
  it('requires a device name and reports server health', async () => {
    render(<App />);
    expect(await screen.findByText('Connected to the report server.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a device name.')).toBeInTheDocument();
    server.offline = true;
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  });

  it('shows the server-unreachable state with a retry', async () => {
    server.offline = true;
    render(<App />);
    expect(await screen.findByText(/Couldn't reach the server/)).toBeInTheDocument();
    server.offline = false;
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Connected to the report server.')).toBeInTheDocument();
  });

  it('wrong PIN, lockout, offline and success', async () => {
    render(<App />);
    await userEvent.type(await screen.findByLabelText('Device name'), 'Outlet phone');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await pin('000000');
    expect(await screen.findByText('Wrong PIN. Try again.')).toBeInTheDocument();
    for (let i = 0; i < 4; i++) {
      await pin('000000');
      await screen.findByText('Wrong PIN. Try again.');
    }
    await pin('111111');
    expect(await screen.findByText('Too many attempts. Try again in 15 minutes.')).toBeInTheDocument();
    server.s.cache.clear();
    cleanupApp();
    render(<App />);
    server.offline = true;
    await pin('111111');
    expect(
      await screen.findByText("You're offline. Connect to the internet to sign in."),
    ).toBeInTheDocument();
    server.offline = false;
    const crypto = server.s.crypto;
    server.s.crypto = {
      ...crypto,
      hmacSha256B64u: () => {
        throw new Error('boom');
      },
    };
    await pin('111111');
    expect(await screen.findByText('Something went wrong on the server. Try again.')).toBeInTheDocument();
  });
});

function cleanupApp() {
  document.body.innerHTML = '';
}

describe('S-03 Home and S-04/S-05 wizard', () => {
  it('Owner home shows the month strip and last 7 days', async () => {
    await startSignedIn('999999');
    expect(await screen.findByText('November so far')).toBeInTheDocument();
    expect(screen.getByText('361,724.75')).toBeInTheDocument();
    expect(screen.getByText('Tue 3 Nov')).toBeInTheDocument();
    expect(screen.getByTestId('today-state')).toHaveTextContent('Not started');
  });

  it('validates step 1, warns on review, submits, then shares', async () => {
    await startSignedIn();
    go('/report/2026-11-04/1');
    await screen.findByRole('heading', { name: 'Report for Wed 4 Nov' });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findAllByText('Enter a value.')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Step 1.*has errors/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Total net sales/), '148320');
    await userEvent.type(screen.getByLabelText(/Bills/), '0');
    await userEvent.type(screen.getByLabelText(/Uber Eats sales/), '4640');
    await userEvent.type(screen.getByLabelText(/PickMe Food sales/), '4400');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Bills must be at least 1 when there are sales.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Bills/));
    await userEvent.type(screen.getByLabelText(/Bills/), '52');
    await userEvent.type(screen.getByLabelText('Dine-in'), '96500');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Step 2 of 5 · Payments and adjustments');
    await userEvent.type(screen.getByLabelText('Cash'), '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.type(screen.getByLabelText('Opened at'), '07:00');
    fireEvent.change(screen.getByLabelText('Closed at'), { target: { value: '00:30' } });
    expect(screen.getByText('After midnight')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '3pm–6pm' }));
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Busiest periods' })).getByRole('button', { name: '3pm–6pm' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('This period is also marked as busy.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '3pm–6pm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Weather: Evening' })).getByRole('radio', {
        name: 'Light rain',
      }),
    );
    await userEvent.type(screen.getByLabelText('Manager comments'), 'Steady day.');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: 'Submit report' });
    expect(
      screen.getByText(/Dine-in, takeaway, Uber Eats and PickMe are Rs 42,780.00 less/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Payments \(cash \+ card \+ QR\) are Rs 147,320.00 less/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(screen.queryByRole('heading', { name: /saved/ })).toBeNull();
    await userEvent.click(screen.getByLabelText("I've checked these figures."));
    await userEvent.click(screen.getByRole('link', { name: 'Edit Payments and adjustments' }));
    await screen.findByText('Step 2 of 5 · Payments and adjustments');
    await userEvent.click(screen.getByRole('button', { name: /Step 5/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    expect(await screen.findByRole('heading', { name: 'Report for Wed 4 Nov saved.' })).toBeInTheDocument();
    // CR-01: Claude's take loads once the report is saved
    expect(await screen.findByTestId('insight-text')).toHaveTextContent('Sales on 2026-11-04');
    expect(server.s.store.getReport('ALU-01', '2026-11-04')).toMatchObject({
      total: 148320,
      dineIn: 96500,
      cash: 1000,
      wxEvening: 'Light rain',
    });

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Sale - 148,320.00/=\nUber - 4,640.00/='));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    vi.stubGlobal(
      'open',
      vi.fn(() => ({})),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Share to WhatsApp' }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=\*Aluthgama\*%0A%0ADate/),
      '_blank',
      'noopener',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByTestId('today-state')).toHaveTextContent('Saved');
  });

  it('server-side errors on review: summary links jump to the field', async () => {
    await startSignedIn();
    go('/report/2026-11-04/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('Fix the highlighted fields to continue.')).toBeInTheDocument();
    await userEvent.click(
      within(document.getElementById('error-summary') as HTMLElement).getByRole('link', {
        name: 'Total net sales',
      }),
    );
    await screen.findByText('Step 1 of 5 · Sales');
  });

  it('offline submit shows the saved-on-phone state', async () => {
    await startSignedIn();
    go('/report/2026-11-04/1');
    await userEvent.type(await screen.findByLabelText(/Total net sales/), '1000');
    await userEvent.type(screen.getByLabelText(/Bills/), '2');
    await userEvent.type(screen.getByLabelText(/Uber Eats sales/), '0');
    await userEvent.type(screen.getByLabelText(/PickMe Food sales/), '0');
    server.offline = true;
    go('/report/2026-11-04/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    expect(
      await screen.findByRole('heading', { name: 'Report for Wed 4 Nov saved on this phone.' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('button', { name: /Sync status/ })).toHaveTextContent('1 waiting to send');
    expect(screen.getByTestId('today-state')).toHaveTextContent('Waiting to send');
    server.offline = false;
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Sync status/ })).toHaveTextContent('All sent'),
    );
  });

  it('restores a draft and leaving asks for confirmation', async () => {
    await (
      await db()
    ).put('drafts', {
      key: draftKey('2026-11-04'),
      businessDate: '2026-11-04',
      values: { ...emptyForm('2026-11-04'), total: '5000' },
      baseVersion: null,
      updatedAt: NOW,
    });
    await startSignedIn();
    expect(screen.getByTestId('today-state')).toHaveTextContent('Draft');
    await userEvent.click(screen.getByRole('link', { name: 'Continue draft' }));
    expect(await screen.findByText('Draft restored · last edited 21:42')).toBeInTheDocument();
    expect(screen.getByLabelText(/Total net sales/)).toHaveValue('5,000.00');
    await userEvent.type(screen.getByLabelText(/Bills/), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Close report' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave the report?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    act(() => window.dispatchEvent(new Event('app:back')));
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await screen.findByRole('heading', { name: "Today's report" });
  });

  it('existing report: banner, load, and Manager edit window message', async () => {
    await startSignedIn();
    go('/report/2026-11-03/1');
    expect(
      await screen.findByText('A report for Tue 3 Nov is already saved. Submitting replaces it.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load saved report' }));
    expect(screen.getByLabelText(/Total net sales/)).toHaveValue('129,849.85');
    vi.setSystemTime(Date.parse('2026-11-13T10:00:00+05:30'));
    go('/report/2026-11-03/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    expect(
      await screen.findByText('Reports older than 7 days can only be changed by the owner.'),
    ).toBeInTheDocument();
  });

  it('conflict screen: keep saved', async () => {
    await startSignedIn();
    go('/report/2026-11-03/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Load saved report' }));
    server.s.store.putReport({
      ...(server.s.store.getReport('ALU-01', '2026-11-03') as ReportRecord),
      version: 5,
      total: 1,
    });
    go('/report/2026-11-03/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    expect(
      await screen.findByText('This report was changed on another device. Choose which version to keep.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('saved-total')).toHaveTextContent('1');
    await userEvent.click(screen.getByRole('button', { name: 'Keep saved' }));
    expect(await screen.findByTestId('detail-version')).toHaveTextContent('5');
  });

  it('conflict screen: replace with mine', async () => {
    await startSignedIn();
    go('/report/2026-11-03/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Load saved report' }));
    server.s.store.putReport({
      ...(server.s.store.getReport('ALU-01', '2026-11-03') as ReportRecord),
      version: 2,
      total: 1,
    });
    go('/report/2026-11-03/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Replace with mine' }));
    expect(await screen.findByRole('heading', { name: 'Report for Tue 3 Nov saved.' })).toBeInTheDocument();
    expect(server.s.store.getReport('ALU-01', '2026-11-03')).toMatchObject({ version: 3, total: 129849.85 });
  });
});

describe('S-07 History, S-08 detail, S-11 settings', () => {
  it('Owner history by month with filter, then detail and edit', async () => {
    await startSignedIn('999999');
    go('/history');
    expect(await screen.findByText('2 reports')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Poya day' }));
    expect(await screen.findByText('No reports for this period yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'All days' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    go('/view/2026-11-03');
    expect(await screen.findByTestId('detail-total')).toHaveTextContent('Rs 129,849.85');
    expect(screen.getByText('WhatsApp message (backfilled)')).toBeInTheDocument();
    expect(screen.getByText('Weather is added the morning after.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit report' }));
    await waitFor(() => expect(screen.getByLabelText(/Total net sales/)).toHaveValue('129,849.85'));
    go('/view/2026-11-20');
    expect(await screen.findByText("There's no saved report for Fri 20 Nov.")).toBeInTheDocument();
  });

  it('detail shows weather once enriched; Manager history shows 60 days', async () => {
    server.s.store.putWeather({
      date: '2026-11-03',
      avgTempTrading: 28.1,
      maxTemp: 30.4,
      minTemp: 24.8,
      maxFeelsLike: 34.2,
      avgHumidityTrading: 82,
      rainTradingMm: 6.8,
      rainHoursTrading: 4,
      rainDayMm: 9.5,
      source: 'forecast',
      fetchedAt: 'x',
    });
    await startSignedIn();
    go('/view/2026-11-03');
    expect(await screen.findByText('6.8 mm')).toBeInTheDocument();
    expect(screen.getByText('30.4 / 24.8 °C')).toBeInTheDocument();
    go('/history');
    expect(await screen.findByText('Showing the last 60 days.')).toBeInTheDocument();
    server.offline = true;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Offline · showing reports saved on this phone')).toBeInTheDocument();
  });

  it('history error state when nothing is cached', async () => {
    await startSignedIn();
    server.s.props.set('TOKEN_SECRET', '');
    go('/history');
    await screen.findByRole('group', { name: 'PIN keypad' });
  });

  it('settings: device, targets, theme, unsent reports and sign out', async () => {
    await startSignedIn('999999');
    server.offline = true;
    go('/report/2026-11-04/1');
    await userEvent.type(await screen.findByLabelText(/Total net sales/), '1000');
    await userEvent.type(screen.getByLabelText(/Bills/), '2');
    await userEvent.type(screen.getByLabelText(/Uber Eats sales/), '0');
    await userEvent.type(screen.getByLabelText(/PickMe Food sales/), '0');
    go('/report/2026-11-04/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    await screen.findByRole('heading', { name: /saved on this phone/ });
    go('/settings');
    expect(await screen.findByText('Outlet phone')).toBeInTheDocument();
    expect(screen.getByTestId('app-version')).toHaveTextContent('0.1.0-test');
    expect(screen.getAllByText('Wed 4 Nov').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Try sending now' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('Nothing waiting to send.')).toBeInTheDocument();
    server.offline = false;

    const target = screen.getByLabelText('Monthly sales target');
    await userEvent.type(target, 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
    expect(screen.getByText('Enter an amount in rupees, like 1,900.')).toBeInTheDocument();
    await userEvent.clear(target);
    await userEvent.type(target, '4500000');
    await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
    expect(await screen.findByText('Targets saved')).toBeInTheDocument();
    expect(server.s.store.config.MONTHLY_TARGET).toBe(4500000);

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await userEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');

    expect(screen.getByTestId('sync-log')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Enter your PIN' })).toBeInTheDocument();
  });

  it('sign out warns about unsent reports', async () => {
    await startSignedIn();
    server.offline = true;
    go('/report/2026-11-04/1');
    await userEvent.type(await screen.findByLabelText(/Total net sales/), '1000');
    await userEvent.type(screen.getByLabelText(/Bills/), '2');
    await userEvent.type(screen.getByLabelText(/Uber Eats sales/), '0');
    await userEvent.type(screen.getByLabelText(/PickMe Food sales/), '0');
    go('/report/2026-11-04/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    await screen.findByRole('heading', { name: /saved on this phone/ });
    go('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(screen.getByText(/1 report is not sent yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    act(() => online.set(false));
    expect(
      screen.getByText("You're offline. Reports will send when you're back online."),
    ).toBeInTheDocument();
  });
});
