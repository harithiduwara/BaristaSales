// NFR-A11Y-01: axe on every Phase 2 screen, light and dark. Zero serious or critical violations.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  enterPin,
  fillRequired,
  freezeTime,
  mock,
  MANAGER_PIN,
  OWNER_PIN,
  signIn,
  toReview,
} from './helpers';

async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${name}: ${v.id} – ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
    [],
  );
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.beforeEach(async ({ page, request }) => {
      await mock(request, 'reset');
      await page.emulateMedia({ colorScheme: scheme });
      await freezeTime(page);
    });

    test('S-01, S-02, lockout', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Connected to the report server.')).toBeVisible();
      await audit(page, 'S-01');
      await page.getByLabel('Device name').fill('Outlet phone');
      await page.getByRole('button', { name: 'Continue' }).click();
      await audit(page, 'S-02');
      await enterPin(page, '000000');
      await expect(page.getByText('Wrong PIN. Try again.')).toBeVisible();
      await audit(page, 'S-02 error');
    });

    test('S-03 … S-06, S-08, S-11 as Owner', async ({ page }) => {
      await signIn(page, OWNER_PIN, 'Owner laptop');
      await audit(page, 'S-03');
      await page.getByRole('link', { name: 'Start report' }).click();
      await audit(page, 'S-04 step 1 empty');
      await page.getByRole('button', { name: 'Next' }).click();
      await audit(page, 'S-04 step 1 errors');
      await fillRequired(page, { total: '148320', bills: '52', uber: '4640', pickme: '4400' });
      for (const step of [2, 3, 4]) {
        await page.getByRole('button', { name: 'Next' }).click();
        await audit(page, `S-04 step ${step}`);
      }
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('button', { name: /Step 2/ }).click();
      await page.getByLabel('Cash').fill('100');
      await page.getByRole('button', { name: /Step 5/ }).click();
      await expect(page.getByText(/Check 1 figure/)).toBeVisible();
      await audit(page, 'S-05 warnings');
      await page.getByText("I've checked these figures.").click();
      await page.getByRole('button', { name: 'Submit report' }).click();
      await expect(page.getByRole('heading', { name: /saved/ })).toBeVisible();
      await audit(page, 'S-06');
      await page.goto('/#/history');
      await expect(page.getByTestId('history-list')).toBeVisible();
      await audit(page, 'S-07');
      await page.goto('/#/view/2026-11-03');
      await expect(page.getByTestId('detail-version')).toBeVisible();
      await audit(page, 'S-08');
      await page.goto('/#/settings');
      await audit(page, 'S-11');
      await page.getByRole('button', { name: 'Sign out' }).click();
      await audit(page, 'S-11 dialog');
    });

    test('S-09 conflict and S-12 offline', async ({ page, context, browser }) => {
      await signIn(page, MANAGER_PIN);
      await page.goto('/#/report/2026-11-03/1');
      await page.getByRole('button', { name: 'Load saved report' }).click();
      await page.getByLabel('Total net sales').fill('140000');
      const other = await (
        await browser.newContext({ serviceWorkers: 'block', baseURL: 'http://localhost:4173' })
      ).newPage();
      await freezeTime(other);
      await signIn(other, MANAGER_PIN, 'Second phone');
      await other.goto('/#/view/2026-11-03');
      await other.getByRole('button', { name: 'Edit report' }).click();
      await other.getByLabel('Bills / tickets').fill('47');
      await toReview(other);
      await other.getByRole('button', { name: 'Submit report' }).click();
      await expect(other.getByRole('heading', { name: /saved/ })).toBeVisible();
      await toReview(page);
      await page.getByRole('button', { name: 'Submit report' }).click();
      await expect(page.getByRole('button', { name: 'Keep saved' })).toBeVisible();
      await audit(page, 'S-09');
      await page.goto('/');
      await context.setOffline(true);
      await expect(page.getByText("You're offline.")).toBeVisible();
      await audit(page, 'S-12');
      await context.setOffline(false);
    });
  });
}
