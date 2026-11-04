import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const MOCK = 'http://localhost:8787';
export const NOW = '2026-11-04T21:42:00+05:30';
export const MANAGER_PIN = '111111';
export const OWNER_PIN = '999999';

export async function mock(request: APIRequestContext, name: string, body: object = {}) {
  const r = await request.post(`${MOCK}/__mock/${name}`, { data: JSON.stringify(body) });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

export async function mockState(request: APIRequestContext) {
  return (await (await request.post(`${MOCK}/__mock/state`)).json()) as {
    reports: { businessDate: string; version: number; total: number; [k: string]: unknown }[];
    log: { submissionId: string; businessDate: string; result: string; errorCode: string }[];
    audit: { event: string }[];
  };
}

/** Same "now" in the browser as in the mock API. Timers still run in real time. */
export async function freezeTime(page: Page, iso = NOW) {
  await page.clock.setFixedTime(new Date(iso));
}

export async function enterPin(page: Page, pin: string) {
  for (const d of pin)
    await page
      .getByRole('group', { name: 'PIN keypad' })
      .getByRole('button', { name: d, exact: true })
      .click();
}

/** First run (S-01) and sign-in (S-02). */
export async function signIn(page: Page, pin = MANAGER_PIN, deviceName = 'Outlet phone') {
  await page.goto('/');
  await page.getByLabel('Device name').fill(deviceName);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible();
  await enterPin(page, pin);
  await expect(page.getByRole('heading', { name: "Today's report" })).toBeVisible();
}

export async function fillRequired(
  page: Page,
  v: { total: string; bills: string; uber: string; pickme: string },
) {
  await page.getByLabel('Total net sales').fill(v.total);
  await page.getByLabel('Bills / tickets').fill(v.bills);
  await page.getByLabel('Uber Eats sales').fill(v.uber);
  await page.getByLabel('PickMe Food sales').fill(v.pickme);
}

export async function toReview(page: Page) {
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Submit report' })).toBeVisible();
}

export const syncChip = (page: Page) => page.getByRole('button', { name: /^Sync status/ });
