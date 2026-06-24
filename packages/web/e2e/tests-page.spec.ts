import { expect, test } from '@playwright/test'
import { findTwoRuns, login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('tests page surfaces windowed flakiness stats', async ({ page }) => {
  const { slug } = await findTwoRuns(page)
  await page.goto(`/projects/${slug}/tests`)

  await expect(page.getByText('New flakiness').first()).toBeVisible()
  await expect(page.getByText('New failures').first()).toBeVisible()
  await expect(page.getByText(/over the last \d+ runs/).first()).toBeVisible()
})
