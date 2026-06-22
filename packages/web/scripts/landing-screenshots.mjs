// Regenerate the landing app screenshots from the deterministic market seed.
//
//   pnpm --filter @kinora/server db:seed:market   # one-time, gives market@kinora.dev
//   pnpm dev:server & pnpm dev:web & pnpm dev:viewer
//   node packages/web/scripts/landing-screenshots.mjs
//
// Captures each view light + dark at 1440x900 @2x (2880x1800) into the landing assets.
import { chromium } from '@playwright/test'

const WEB = 'http://localhost:5173'
const OUT = new URL('../../../landing/src/assets/screenshots/', import.meta.url).pathname
const VIEWPORT = { width: 1440, height: 900 }
const EMAIL = 'market@kinora.dev'
const PASSWORD = 'password123'

const browser = await chromium.launch()

// 1. Log in once; reuse the session for every capture.
const auth = await browser.newContext({ viewport: VIEWPORT })
const lp = await auth.newPage()
await lp.goto(`${WEB}/login`)
await lp.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
await lp.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
await lp.getByRole('button', { name: 'Sign in' }).click()
await lp.waitForURL(`${WEB}/`)
const storageState = await auth.storageState()
await auth.close()

// 2. Discover the dynamic URLs (test key + trace viewer URL change per reseed).
const disc = await browser.newContext({ viewport: VIEWPORT, storageState })
const dp = await disc.newPage()
await dp.goto(`${WEB}/projects/checkout-api/runs/checkout-api-run-30`)
await dp.waitForLoadState('networkidle')
// A currently-failing test -> its history page shows the red timeline + the error.
const testHref = await dp.getByRole('link', { name: 'refunds an order' }).first().getAttribute('href')
const traceHref = await dp.locator('a:has-text("View trace")').first().getAttribute('href')
await disc.close()
console.log('discovered:', { testHref, traceHref })

const views = [
  { name: 'overview', url: `${WEB}/` },
  { name: 'project', url: `${WEB}/projects/checkout-api` },
  { name: 'tests', url: `${WEB}/projects/checkout-api/tests` },
  { name: 'test-history', url: `${WEB}${testHref}` },
  { name: 'compare', url: `${WEB}/projects/checkout-api/compare?base=checkout-api-run-29&head=checkout-api-run-30` },
  { name: 'trace-viewer', url: traceHref, settle: 3000 },
]

for (const theme of ['light', 'dark']) {
  // kinora apps read `kinora-theme`; the vendored trace viewer themes off prefers-color-scheme.
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: theme, storageState })
  await ctx.addInitScript(`localStorage.setItem('kinora-theme', ${JSON.stringify(theme)})`)
  const page = await ctx.newPage()
  for (const v of views) {
    await page.goto(v.url)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(v.settle ?? 700)
    await page.screenshot({ path: `${OUT}/${v.name}-${theme}.png` })
    console.log(`wrote ${v.name}-${theme}.png`)
  }
  await ctx.close()
}

await browser.close()
console.log('done')
