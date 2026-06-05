import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Trace loads asynchronously once the service worker controls the page.
  await expect(page.getByTestId('action').first()).toBeVisible()
})

test('loads the demo trace into the workbench', async ({ page }) => {
  await expect(page.getByText('playback', { exact: true })).toBeVisible()
  expect(await page.getByTestId('action').count()).toBeGreaterThan(5)
})

test('replays the DOM snapshot in the iframe', async ({ page }) => {
  const frame = page.frameLocator('iframe[name="snapshot"]')
  await expect(frame.getByText('Submitted!')).toBeVisible()
})

test('shows the test source code', async ({ page }) => {
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.getByText('@playwright/test').first()).toBeVisible()
})

test('network tab lists requests and previews a response body', async ({ page }) => {
  await page.getByRole('button', { name: /^Network/ }).click()
  const rows = page.getByTestId('net-row')
  await expect(rows.first()).toBeVisible()
  await rows.filter({ hasText: 'style.css' }).click()
  await expect(page.getByText('Response body')).toBeVisible()
  await expect(page.getByText('font-family')).toBeVisible()
})

test('network copy menu offers cURL and fetch', async ({ page }) => {
  await page.getByRole('button', { name: /^Network/ }).click()
  await page.getByTestId('net-row').first().click()
  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByRole('menuitem', { name: 'Copy as cURL' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Copy as fetch' })).toBeVisible()
})

test('attachments tab previews the screenshot', async ({ page }) => {
  await page.getByRole('button', { name: /^Attachments/ }).click()
  await expect(page.getByText('screenshot', { exact: true })).toBeVisible()
  await expect(page.getByText('note', { exact: true })).toBeVisible()
})

test('filmstrip renders screencast frames', async ({ page }) => {
  await expect(page.locator('img[src*="sha1/"]').first()).toBeVisible()
})

test('play advances the selected action', async ({ page }) => {
  const current = page.getByTestId('current-action')
  const before = await current.textContent()
  await page.getByTestId('play').click()
  await expect(page.getByTestId('play')).toHaveAttribute('title', 'Pause')
  await expect(async () => {
    expect(await current.textContent()).not.toBe(before)
  }).toPass({ timeout: 5000 })
  await page.getByTestId('play').click()
  await expect(page.getByTestId('play')).toHaveAttribute('title', 'Play')
})

test('keyboard navigates between actions', async ({ page }) => {
  const current = page.getByTestId('current-action')
  const before = await current.textContent()
  await page.locator('body').press('k')
  await expect(current).not.toHaveText(before ?? '')
})

test('tooltip shows the full url on a truncated network name', async ({ page }) => {
  await page.getByRole('button', { name: /^Network/ }).click()
  const name = page.getByTestId('net-row').first().locator('span').first()
  await name.hover()
  await expect(page.locator('[data-slot="tooltip-content"]').first()).toContainText('demo.test')
})
