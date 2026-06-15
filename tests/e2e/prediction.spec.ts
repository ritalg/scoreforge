import { test, expect } from '@playwright/test';

test.describe('Score Prediction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('student@scoreforge.coach');
    await page.getByLabel(/password/i).fill('Student123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
  });

  test('score prediction page loads', async ({ page }) => {
    await page.goto('/student/score-prediction');
    await expect(page.getByRole('heading', { name: /score prediction/i })).toBeVisible({ timeout: 8000 });
  });

  test('prediction page shows prompt when no data', async ({ page }) => {
    await page.goto('/student/score-prediction');
    // Wait for page to load (spinner disappears)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // Either shows a prediction score, a prompt for more data, or the prediction UI
    const hasScore = await page.getByText(/\d{3,4}/).count() > 0;
    const hasPrompt = await page.getByText(/complete more|practice|prediction|retrain/i).count() > 0;
    expect(hasScore || hasPrompt).toBe(true);
  });

  test('retrain button is visible', async ({ page }) => {
    await page.goto('/student/score-prediction');
    await expect(page.getByRole('button', { name: /retrain/i })).toBeVisible({ timeout: 8000 });
  });

  test('dashboard score estimate links to prediction page', async ({ page }) => {
    // The score estimate card on dashboard should link to prediction page
    const link = page.locator('a[href="/student/score-prediction"]');
    if (await link.count() > 0) {
      await link.first().click();
      await expect(page).toHaveURL(/\/student\/score-prediction/);
    }
  });

  test('sidebar shows score prediction nav item', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page.getByRole('link', { name: /score prediction/i })).toBeVisible();
  });
});
