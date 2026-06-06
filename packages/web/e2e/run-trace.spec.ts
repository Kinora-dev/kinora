import { expect, test } from '@playwright/test'
import { findTracedRun, login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('shows a View trace link wired to the viewer for a traced test', async ({ page }) => {
  const { slug, runId } = await findTracedRun(page)
  await page.goto(`/projects/${slug}/runs/${runId}`)

  const viewTrace = page.getByRole('link', { name: /View trace/i }).first()
  await expect(viewTrace).toBeVisible()

  const href = await viewTrace.getAttribute('href')
  expect(href).toContain('localhost:5174')
  expect(href).toContain('?trace=')
})
