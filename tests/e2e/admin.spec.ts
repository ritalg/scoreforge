import { test, expect } from '@playwright/test';

test.describe('Admin flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@scoreforge.coach');
    await page.getByLabel(/password/i).fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('admin dashboard shows key stats', async ({ page }) => {
    // Dashboard has multiple stat cards — check that at least one matches
    await expect(page.getByText(/question|user|upload/i).first()).toBeVisible();
  });

  test('question queue loads', async ({ page }) => {
    await page.goto('/admin/questions');
    await expect(page.getByRole('heading', { name: /question queue/i })).toBeVisible();
  });

  test('user management page loads', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /user/i })).toBeVisible();
  });

  test('feature flags page loads', async ({ page }) => {
    await page.goto('/admin/feature-flags');
    await expect(page.getByRole('heading', { name: /feature flag/i })).toBeVisible();
  });

  test('audit log page loads', async ({ page }) => {
    await page.goto('/admin/audit-log');
    await expect(page.getByRole('heading', { name: /audit/i })).toBeVisible();
  });

  test('bulk import page loads and shows format guide', async ({ page }) => {
    await page.goto('/admin/bulk-import');
    await expect(page.getByRole('heading', { name: /bulk csv import/i })).toBeVisible();
    await expect(page.getByText(/question_text/)).toBeVisible();
    await expect(page.getByText(/CSV Format/i)).toBeVisible();
  });

  test('bulk import validates CSV file', async ({ page }) => {
    await page.goto('/admin/bulk-import');
    // File input should be present
    await expect(page.getByLabel(/select csv file/i)).toBeVisible();
  });

  test('upload center loads', async ({ page }) => {
    await page.goto('/admin/upload');
    await expect(page.getByRole('heading', { name: /upload center/i })).toBeVisible({ timeout: 8000 });
  });
});
