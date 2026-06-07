import { expect, test } from '@playwright/test'
import { findTwoRuns, login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('compares two runs of a project', async ({ page }) => {
  const { slug, base, head } = await findTwoRuns(page)
  await page.goto(`/projects/${slug}/compare?base=${base}&head=${head}`)

  await expect(page.getByRole('heading', { name: 'Run comparison' })).toBeVisible()
  await expect(page.getByText('Pass rate')).toBeVisible()
})

test('the Compare button on a run links to the comparison', async ({ page }) => {
  const { slug, head } = await findTwoRuns(page)
  await page.goto(`/projects/${slug}/runs/${head}`)

  await page.getByRole('link', { name: /Compare/ }).click()
  await expect(page).toHaveURL(/\/compare\?/)
  await expect(page.getByRole('heading', { name: 'Run comparison' })).toBeVisible()
})
