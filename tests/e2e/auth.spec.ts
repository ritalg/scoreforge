import { test, expect } from '@playwright/test';

const STUDENT_EMAIL = 'student@scoreforge.coach';
const STUDENT_PASSWORD = 'Student123!';
const ADMIN_EMAIL = 'admin@scoreforge.coach';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    // Login page shows the app name as heading and has email/password fields
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/login failed|invalid|incorrect/i)).toBeVisible({ timeout: 5000 });
  });

  test('student can log in and sees dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(/scoreforge/i).first()).toBeVisible();
  });

  test('admin can log in and sees admin dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/student/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/register');
    // Register page shows the app name as heading + registration fields
    await expect(page.getByLabel(/first name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('student can log out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
    await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
