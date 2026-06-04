import { expect, test } from '@playwright/test'

// Deterministic mock runId: web-app's latest run (see src/data/mock.ts runIdFor).
const RUN_URL = '/projects/web-app/runs/2026-07-run-30'

test('run page filters the test list by title', async ({ page }) => {
  await page.goto(RUN_URL)

  await expect(page.getByRole('heading', { name: '2026-07-run-30' })).toBeVisible()
  await expect(page.getByText('login with valid creds').first()).toBeVisible()

  await page.getByPlaceholder('Filter by title or file...').fill('logout')

  await expect(page.getByText('logout', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('login with valid creds')).toHaveCount(0)
})
