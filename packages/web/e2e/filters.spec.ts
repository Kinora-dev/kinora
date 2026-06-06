import { expect, test } from '@playwright/test'

// Deterministic mock runId: web-app's latest run (see src/data/mock.ts runIdFor).
const RUN_URL = '/projects/web-app/runs/2026-07-run-30'

test.describe('run page filters persist to the URL', () => {
  test('search writes ?q and clears it back out', async ({ page }) => {
    await page.goto(RUN_URL)

    await page.getByPlaceholder('Filter by title or file...').fill('logout')
    await expect(page).toHaveURL(/[?&]q=logout/)

    await page.getByPlaceholder('Filter by title or file...').fill('')
    await expect(page).toHaveURL(new RegExp(`${RUN_URL}$`))
  })

  test('status tab writes ?status, "All" removes it', async ({ page }) => {
    await page.goto(RUN_URL)

    await page.getByRole('tab', { name: 'Flaky' }).click()
    await expect(page).toHaveURL(/[?&]status=flaky/)

    await page.getByRole('tab', { name: 'All' }).click()
    await expect(page).toHaveURL(new RegExp(`${RUN_URL}$`))
  })

  test('deep link restores tab and search', async ({ page }) => {
    await page.goto(`${RUN_URL}?status=flaky&q=checkout`)

    await expect(page.getByRole('tab', { name: 'Flaky' })).toHaveAttribute('data-state', 'active')
    await expect(page.getByPlaceholder('Filter by title or file...')).toHaveValue('checkout')
  })
})

test.describe('tests page filters persist to the URL', () => {
  test('unstable toggle writes ?unstable=false then removes it at default', async ({ page }) => {
    await page.goto('/projects/web-app/tests')

    await page.getByRole('button', { name: 'Unstable only' }).click()
    await expect(page).toHaveURL(/[?&]unstable=false/)

    await page.getByRole('button', { name: 'All tests' }).click()
    await expect(page).toHaveURL(/\/projects\/web-app\/tests$/)
  })

  test('deep link restores search and unstable toggle', async ({ page }) => {
    await page.goto('/projects/web-app/tests?q=login&unstable=false')

    await expect(page.getByPlaceholder('Filter by title or file...')).toHaveValue('login')
    await expect(page.getByRole('button', { name: 'All tests' })).toBeVisible()
  })
})

test.describe('overview filters persist to the URL', () => {
  test('deep link restores branch and tag selection', async ({ page }) => {
    await page.goto('/?branch=develop&tag=@smoke')

    await expect(page.getByRole('combobox').filter({ hasText: 'develop' })).toBeVisible()
    await expect(page.getByRole('combobox').filter({ hasText: '@smoke' })).toBeVisible()
  })

  test('clear removes branch and tag params', async ({ page }) => {
    await page.goto('/?branch=develop&tag=@smoke')

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('selecting a branch writes ?branch', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'develop' }).click()
    await expect(page).toHaveURL(/[?&]branch=develop/)
  })
})
