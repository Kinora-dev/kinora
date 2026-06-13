import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { login, stubMe } from './helpers'

const resendButton = (page: Page) => page.getByRole('button', { name: 'Resend verification email' })

test('mailer enabled + unverified: shows Not verified badge and resend button', async ({ page }) => {
  await stubMe(page, { mailerEnabled: true, emailVerified: false })
  await login(page)
  await page.goto('/settings')
  await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
  await expect(resendButton(page)).toBeVisible()
})

test('mailer enabled + verified: shows Verified badge, no resend button', async ({ page }) => {
  await stubMe(page, { mailerEnabled: true, emailVerified: true })
  await login(page)
  await page.goto('/settings')
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()
  await expect(resendButton(page)).toHaveCount(0)
})

test('mailer disabled: no verification badge or resend button', async ({ page }) => {
  await stubMe(page, { mailerEnabled: false })
  await login(page)
  await page.goto('/settings')
  await expect(page.getByText(/^(Verified|Not verified)$/)).toHaveCount(0)
  await expect(resendButton(page)).toHaveCount(0)
})
