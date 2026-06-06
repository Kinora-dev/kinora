import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('lists the seeded projects', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Web App' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'API Gateway' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Marketing Site' })).toBeVisible()
})

test('filters the overview by tag', async ({ page }) => {
  await page.goto('/?tag=@smoke')
  // Only Web App carries @smoke-tagged tests in the seed.
  await expect(page.getByRole('link', { name: 'Web App' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'API Gateway' })).toHaveCount(0)
  await expect(page.getByText('@smoke / latest')).toBeVisible()
})
