import { expect, test } from '@playwright/test'
import { findFailingRun, findTwoRuns, login } from './helpers'

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

test('tests page groups failures into top failure causes', async ({ page }) => {
  const { slug } = await findFailingRun(page)
  await page.goto(`/projects/${slug}/tests`)

  await expect(page.getByText('Top failure causes')).toBeVisible()
  // Expanding a cluster reveals its sample and the tests it hits.
  await page.getByRole('button', { name: /\d+ tests?/ }).first().click()
  await expect(page.getByText(/Affected tests?/).first()).toBeVisible()
})
