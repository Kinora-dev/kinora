import { expect, test } from '@playwright/test'
import { findTwoRuns, login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('tests page surfaces windowed flakiness stats', async ({ page }) => {
  const { slug } = await findTwoRuns(page)
  await page.goto(`/projects/${slug}/tests`)

  await expect(page.getByText('Newly flaky').first()).toBeVisible()
  await expect(page.getByText('Newly broken').first()).toBeVisible()
  await expect(page.getByText(/Rates over the last \d+ runs/)).toBeVisible()
})
