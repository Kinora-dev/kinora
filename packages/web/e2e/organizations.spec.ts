import { expect, test } from '@playwright/test'
import { login, TEAMMATE } from './helpers'

const workspaceButton = /workspace/i

test.describe('organizations', () => {
  test('shows the active workspace in the header', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('button', { name: workspaceButton })).toBeVisible()
  })

  test('switching workspace scopes the overview', async ({ page }) => {
    await login(page)
    // demo's own workspace has the full project set
    await expect(page.getByRole('link', { name: 'Web App' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Marketing Site' })).toBeVisible()

    // switch to the workspace demo is only a member of
    await page.getByRole('button', { name: workspaceButton }).click()
    await page.getByRole('menuitem', { name: /Acme QA/i }).click()

    // lands on the overview, now scoped to Acme: only its project shows
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'API Gateway' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Web App' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Marketing Site' })).toHaveCount(0)
  })

  test('a member gets the read-only team view', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: workspaceButton }).click()
    await page.getByRole('menuitem', { name: /Acme QA/i }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/settings/workspace')
    // demo is a member (not admin) of Acme: no invite form, just the notice
    await expect(page.getByText(/Only admins can invite/i)).toBeVisible()
    await expect(page.getByLabel('Invite by email')).toHaveCount(0)
  })

  test('an owner can invite in their own workspace', async ({ page }) => {
    // teammate owns a single workspace -> owner/admin controls available
    await login(page, TEAMMATE)
    await expect(page.getByRole('button', { name: workspaceButton })).toBeVisible()

    await page.goto('/settings/workspace')
    await expect(page.getByLabel('Invite by email')).toBeVisible()
  })
})
