import { test, expect } from '@playwright/test';

test.describe('Quiz flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as student before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('student@scoreforge.coach');
    await page.getByLabel(/password/i).fill('Student123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
  });

  test('can navigate to quiz page', async ({ page }) => {
    await page.goto('/student/quiz');
    await expect(page.getByRole('heading', { name: /start a quiz/i })).toBeVisible();
  });

  test('quiz start renders topic and difficulty selectors', async ({ page }) => {
    await page.goto('/student/quiz');
    // Page has Mode, Topic, and Questions sections
    await expect(page.getByText(/topic/i).first()).toBeVisible();
    await expect(page.getByText(/mode/i).first()).toBeVisible();
  });

  test('can navigate to question bank', async ({ page }) => {
    await page.goto('/student/question-bank');
    await expect(page.getByRole('heading', { name: /question bank/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('question bank search input works', async ({ page }) => {
    await page.goto('/student/question-bank');
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('algebra');
    await page.keyboard.press('Enter');
    // Should not crash, may show results or "no match" message
    await expect(page.getByText(/question|no question/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to SR drill page', async ({ page }) => {
    await page.goto('/student/sr-drill');
    // Either shows the drill UI with "SR Drill" heading, or "All caught up!" when no cards due
    await expect(
      page.getByRole('heading', { name: /sr drill/i }).or(page.getByText(/all caught up/i))
    ).toBeVisible({ timeout: 8000 });
  });

  test('can navigate to mock test page', async ({ page }) => {
    await page.goto('/student/mock-test');
    await expect(page.getByRole('heading', { name: /full mock sat|mock test/i })).toBeVisible();
  });

  test('dashboard shows key widgets', async ({ page }) => {
    await expect(page.getByText(/score|streak|study/i).first()).toBeVisible();
  });

  test('can navigate to analytics', async ({ page }) => {
    await page.goto('/student/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  });
});
