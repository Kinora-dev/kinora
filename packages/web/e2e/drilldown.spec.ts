import { expect, test } from '@playwright/test'

test('overview -> project -> run', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Web App E2E' }).click()
  await expect(page).toHaveURL(/\/projects\/web-app$/)
  await expect(page.getByRole('heading', { name: 'Web App E2E' })).toBeVisible()

  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  await rows.first().click()

  await expect(page).toHaveURL(/\/projects\/web-app\/runs\//)
  await expect(page.getByRole('tab', { name: 'All' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Flaky' })).toBeVisible()
})

test('project -> per-test history -> single test timeline', async ({ page }) => {
  await page.goto('/projects/web-app')

  await page.getByRole('link', { name: 'Per-test history' }).click()
  await expect(page).toHaveURL(/\/projects\/web-app\/tests$/)
  await expect(page.getByRole('heading', { name: 'Tests' })).toBeVisible()

  const testLink = page.locator('a[href*="/test?key="]').first()
  await expect(testLink).toBeVisible()
  await testLink.click()

  await expect(page).toHaveURL(/\/projects\/web-app\/test\?key=/)
  await expect(page.getByText('Status timeline')).toBeVisible()
})
