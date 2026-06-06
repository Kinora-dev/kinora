import { expect, test } from '@playwright/test'
import { DEMO, login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/settings')
})

test('prefills the current email', async ({ page }) => {
  await expect(page.locator('#settings-email')).toHaveValue(DEMO.email)
})

test('keeps change password disabled until the form is valid', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Change password' })).toBeDisabled()
})

test('creates and deletes an API token', async ({ page }) => {
  const name = `e2e-${Date.now()}`

  await page.locator('#token-name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()

  // Full token revealed once on creation.
  await expect(page.getByText(/it will not be shown again/i)).toBeVisible()

  const row = page.locator('li', { hasText: name })
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Delete token' }).click()
  await expect(page.locator('li', { hasText: name })).toHaveCount(0)
})
