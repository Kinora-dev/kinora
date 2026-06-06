import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('redirects guests to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('login page offers social and email sign-in', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('rejects invalid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('demo@kinora.dev')
  await page.locator('input[type="password"]').fill('wrong-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('p.text-fail')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('logs in and reaches the overview', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: 'Test runs overview' })).toBeVisible()
})

test('signs out back to login', async ({ page }) => {
  await login(page)
  await page.getByTitle('Demo User').click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
