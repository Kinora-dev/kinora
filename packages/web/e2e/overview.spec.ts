import { expect, test } from '@playwright/test'

test('lists every project with branch and tag filters', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Test runs overview' })).toBeVisible()

  for (const name of ['Web App E2E', 'Checkout Flow', 'Mobile Web'])
    await expect(page.getByRole('link', { name })).toBeVisible()

  await expect(page.getByText('All branches')).toBeVisible()
  await expect(page.getByText('All tags')).toBeVisible()
})
