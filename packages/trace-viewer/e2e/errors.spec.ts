import { expect, test } from '@playwright/test'

// error-trace.zip is a failing run: it carries an `error-context` attachment,
// which powers the Errors tab "Copy prompt" button (LLM prompt).
test('Errors tab offers Copy prompt for a trace with error-context', async ({ page }) => {
  await page.goto('/?trace=fixtures/error-trace.zip')
  await expect(page.getByTestId('action').first()).toBeVisible()

  await page.getByRole('button', { name: /^Errors/ }).click()
  await expect(page.getByRole('button', { name: 'Copy prompt' })).toBeVisible()
})
