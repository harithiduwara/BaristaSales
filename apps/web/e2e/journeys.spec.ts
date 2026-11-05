// Critical journeys E2E-01 … E2E-08 (12.2).
import { expect, test } from '@playwright/test';
import {
  fillRequired,
  freezeTime,
  mock,
  mockState,
  OWNER_PIN,
  signIn,
  syncChip,
  toReview,
  enterPin,
  MANAGER_PIN,
} from './helpers';

test.beforeEach(async ({ page, request }) => {
  await mock(request, 'reset');
  await freezeTime(page);
});

test('E2E-01 FR-REP-08 FR-SHR-01 required fields, submit, success, share', async ({ page }) => {
  await page.addInitScript(() => {
    (navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = async (d) => {
      (window as unknown as { __shared: string }).__shared = d.text;
    };
  });
  await signIn(page);
  await page.getByRole('link', { name: 'Start report' }).click();
  await expect(page.getByRole('heading', { name: /Report for Wed 4 Nov/ })).toBeVisible();
  await fillRequired(page, { total: '148,320.00', bills: '52', uber: '4640', pickme: 'Rs 4,400/=' });
  await expect(page.locator('.strip').first()).toContainText('2,852.31');
  await toReview(page);
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByRole('heading', { name: 'Report for Wed 4 Nov saved.' })).toBeVisible();
  // CR-01: Claude's take appears after the report is saved (stub model in the mock API).
  await expect(page.getByRole('heading', { name: "Claude's take" })).toBeVisible();
  await expect(page.getByTestId('insight-text')).toContainText('Sales on 2026-11-04');
  await page.getByRole('button', { name: 'Share to WhatsApp' }).click();
  await expect(page.getByText('Share sheet opened')).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { __shared: string }).__shared);
  expect(shared).toBe(
    '*Aluthgama*\n\nDate - 04/11/2026\nSale - 148,320.00/=\nUber - 4,640.00/=\nPick me - 4,400.00/=\nTicket - 52\nAvg bill - 2,852.31/=',
  );
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('today-state')).toHaveText('Saved');
  await expect(syncChip(page)).toHaveText('All sent');
});

test('E2E-02 full report with every field persists to the detail view', async ({ page, request }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Start report' }).click();
  await fillRequired(page, { total: '148320', bills: '52', uber: '4640', pickme: '4400' });
  await page.getByLabel('Dine-in').fill('96500');
  await page.getByLabel('Takeaway').fill('42780');
  await page.getByLabel('Uber Eats orders').fill('3');
  await page.getByLabel('PickMe Food orders').fill('2');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Cash').fill('61200');
  await page.getByLabel('Card').fill('72620');
  await page.getByLabel('QR / transfer / other').fill('14500');
  await page.getByLabel('Discounts given').fill('1850');
  await page.getByLabel('Complimentary / staff meals').fill('960');
  await page.getByLabel('Voids / refunds').fill('0');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Foreign customers (approx.)').fill('4');
  await page.getByRole('group', { name: 'Busiest periods' }).getByRole('button', { name: '6pm–9pm' }).click();
  await page
    .getByRole('radiogroup', { name: 'Quietest period' })
    .getByRole('radio', { name: '3pm–6pm' })
    .click();
  await page.getByLabel('Top 3 selling items').fill('Cappuccino, iced latte, club sandwich');
  await page.getByLabel('Items out of stock').fill('Almond milk');
  await page.getByLabel('Staff on duty').fill('6');
  await page.getByLabel('Opened at').fill('07:00');
  await page.getByLabel('Closed at').fill('22:10');
  await page.getByRole('button', { name: 'Next' }).click();
  await page
    .getByRole('radiogroup', { name: 'Weather: Morning' })
    .getByRole('radio', { name: 'Sunny' })
    .click();
  await page
    .getByRole('radiogroup', { name: 'Weather: Night' })
    .getByRole('radio', { name: 'Light rain' })
    .click();
  await page
    .getByRole('group', { name: 'Special conditions' })
    .getByRole('button', { name: 'Normal day' })
    .click();
  await page.getByLabel('Other condition').fill('Wedding nearby');
  await page.getByLabel('Promotions running').fill('Buy 2 get 1 on cookies');
  await page.getByLabel('Customer feedback or complaints').fill('Wifi was slow');
  await page.getByLabel('Manager comments').fill('Steady day.');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Payments (cash + card + QR)')).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByRole('heading', { name: 'Report for Wed 4 Nov saved.' })).toBeVisible();

  const saved = (await mockState(request)).reports.find((r) => r.businessDate === '2026-11-04');
  expect(saved).toMatchObject({
    dineIn: 96500,
    cash: 61200,
    quietPeriod: '3pm–6pm',
    busyPeriods: ['6pm–9pm'],
    closeTime: '22:10',
    wxNight: 'Light rain',
    conditionsOther: 'Wedding nearby',
  });

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('link', { name: /Wed 4 Nov/ }).click();
  await expect(page.getByTestId('detail-total')).toHaveText('Rs 148,320.00');
  await expect(page.getByTestId('detail-topItems')).toHaveText('Cappuccino, iced latte, club sandwich');
  await expect(page.getByTestId('detail-busyPeriods')).toHaveText('6pm–9pm');
  await expect(page.getByTestId('detail-wxMorning')).toHaveText('Sunny');
  await expect(page.getByTestId('detail-comments')).toHaveText('Steady day.');
});

test('E2E-03 NFR-REL-01 offline submit waits, then sends once when back online', async ({
  page,
  context,
  request,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Start report' }).click();
  await fillRequired(page, { total: '148320', bills: '52', uber: '0', pickme: '0' });
  await context.setOffline(true);
  await toReview(page);
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(
    page.getByRole('heading', { name: 'Report for Wed 4 Nov saved on this phone.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(syncChip(page)).toHaveText('1 waiting to send');
  await expect(page.getByTestId('today-state')).toHaveText('Waiting to send');
  await context.setOffline(false);
  await expect(syncChip(page)).toHaveText('All sent', { timeout: 15_000 });
  const st = await mockState(request);
  expect(st.reports.filter((r) => r.businessDate === '2026-11-04')).toHaveLength(1);
  expect(st.log.filter((l) => l.businessDate === '2026-11-04' && l.result === 'created')).toHaveLength(1);
});

test('E2E-04 FR-REP-03 same date twice: banner, load saved, replace; version increments', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/#/report/2026-11-03/1');
  await expect(
    page.getByText('A report for Tue 3 Nov is already saved. Submitting replaces it.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load saved report' }).click();
  await expect(page.getByLabel('Total net sales')).toHaveValue('129,849.85');
  await expect(page.getByLabel('PickMe Food sales')).toHaveValue('1,900.00');
  await page.getByLabel('Total net sales').fill('130000');
  await toReview(page);
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByRole('heading', { name: 'Report for Tue 3 Nov saved.' })).toBeVisible();
  const r = (await mockState(request)).reports.find((x) => x.businessDate === '2026-11-03');
  expect(r).toMatchObject({ version: 2, total: 130000 });
});

test('E2E-05 FR-REP-10 conflict between two devices: keep saved, then replace with mine', async ({
  browser,
  request,
}) => {
  const open = async (name: string) => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', baseURL: 'http://localhost:4173' });
    const page = await ctx.newPage();
    await freezeTime(page);
    await signIn(page, OWNER_PIN, name);
    await page.goto('/#/report/2026-11-03/1');
    await page.getByRole('button', { name: 'Load saved report' }).click();
    await expect(page.getByLabel('Total net sales')).toHaveValue('129,849.85');
    return page;
  };
  const a = await open('Device A');
  const b = await open('Device B');

  await a.getByLabel('Total net sales').fill('131000');
  await toReview(a);
  await a.getByRole('button', { name: 'Submit report' }).click();
  await expect(a.getByRole('heading', { name: 'Report for Tue 3 Nov saved.' })).toBeVisible();

  await b.getByLabel('Total net sales').fill('132000');
  await toReview(b);
  await b.getByRole('button', { name: 'Submit report' }).click();
  await expect(
    b.getByText('This report was changed on another device. Choose which version to keep.'),
  ).toBeVisible();
  await expect(b.getByTestId('mine-total')).toHaveText('132000');
  await expect(b.getByTestId('saved-total')).toHaveText('131000');
  await b.getByRole('button', { name: 'Keep saved' }).click();
  await expect(b.getByTestId('detail-total')).toHaveText('Rs 131,000.00');
  expect((await mockState(request)).reports.find((x) => x.businessDate === '2026-11-03')?.version).toBe(2);

  // B opens the saved copy (version 2); A then changes it again (version 3); B replaces with its own.
  await b.getByRole('button', { name: 'Edit report' }).click();
  await expect(b.getByLabel('Total net sales')).toHaveValue('131,000.00');

  await a.goto('/#/report/2026-11-03/1');
  await a.getByRole('button', { name: 'Load saved report' }).click();
  await a.getByLabel('Total net sales').fill('133000');
  await toReview(a);
  await a.getByRole('button', { name: 'Submit report' }).click();
  await expect(a.getByRole('heading', { name: 'Report for Tue 3 Nov saved.' })).toBeVisible();

  await b.getByLabel('Total net sales').fill('134000');
  await toReview(b);
  await b.getByRole('button', { name: 'Submit report' }).click();
  await expect(b.getByTestId('saved-total')).toHaveText('133000');
  await b.getByRole('button', { name: 'Replace with mine' }).click();
  await expect(b.getByRole('heading', { name: 'Report for Tue 3 Nov saved.' })).toBeVisible();
  const r = (await mockState(request)).reports.find((x) => x.businessDate === '2026-11-03');
  expect(r).toMatchObject({ version: 4, total: 134000 });
});

test('E2E-06 FR-HIS-03 Manager cannot edit a 10-day-old report; Owner can', async ({
  page,
  browser,
  request,
}) => {
  const later = '2026-11-13T10:00:00+05:30';
  await mock(request, 'clock', { now: later });
  await freezeTime(page, later);
  await signIn(page);
  await page.goto('/#/view/2026-11-03');
  await expect(page.getByText('Reports older than 7 days can only be changed by the owner.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit report' })).toHaveCount(0);

  const ctx = await browser.newContext({ serviceWorkers: 'block', baseURL: 'http://localhost:4173' });
  const owner = await ctx.newPage();
  await freezeTime(owner, later);
  await signIn(owner, OWNER_PIN, 'Owner laptop');
  await owner.goto('/#/view/2026-11-03');
  await owner.getByRole('button', { name: 'Edit report' }).click();
  await owner.getByLabel('Total net sales').fill('129900');
  await toReview(owner);
  await owner.getByRole('button', { name: 'Submit report' }).click();
  await expect(owner.getByRole('heading', { name: 'Report for Tue 3 Nov saved.' })).toBeVisible();
});

test('E2E-07 FR-AUTH-03 lockout after 5 wrong PINs', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Device name').fill('Outlet phone');
  await page.getByRole('button', { name: 'Continue' }).click();
  for (let i = 0; i < 5; i++) {
    await enterPin(page, '000000');
    await expect(page.getByText('Wrong PIN. Try again.')).toBeVisible();
  }
  // The 6th attempt is refused even with the correct PIN.
  await enterPin(page, MANAGER_PIN);
  await expect(page.getByText('Too many attempts. Try again in 15 minutes.')).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'PIN keypad' }).getByRole('button', { name: '1', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await enterPin(page, MANAGER_PIN);
  await expect(page.getByText('Too many attempts. Try again in 15 minutes.')).toBeVisible();
});

test('E2E-08 FR-REP-07 draft survives an app reload', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Start report' }).click();
  await page.getByLabel('Total net sales').fill('98765.40');
  await page.getByLabel('Bills / tickets').fill('33');
  await page.getByLabel('Bills / tickets').blur();
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByText('Draft restored · last edited 21:42')).toBeVisible();
  await expect(page.getByLabel('Total net sales')).toHaveValue('98,765.40');
  await expect(page.getByLabel('Bills / tickets')).toHaveValue('33');
  await page.goto('/');
  await expect(page.getByTestId('today-state')).toHaveText('Draft');
});
