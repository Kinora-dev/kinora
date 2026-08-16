// Wrap a desktop app screenshot (renderer-only capturePage) in the macOS traffic-light
// dots, top-anchored cropped to drop empty space below the content. Rounding + shadow are
// applied in CSS by the website (DesktopSection), like the other sections, so the shadow
// is never clipped and stays coherent.
//
//   # capture (dev stack up; from packages/desktop). --force-device-scale-factor=2 is
//   # required for retina (capturePage renders at 1x otherwise); ALL fills the window:
//   KINORA_HOME_PROBE=1 KINORA_EMAIL=market@kinora.dev KINORA_PASSWORD=password123 \
//   KINORA_SERVER=http://localhost:3000 KINORA_WEB_ORIGIN=http://localhost:5173 \
//   KINORA_SHOT=/tmp/shot.png KINORA_SHOT_PROJECT=checkout-api KINORA_SHOT_THEME=dark KINORA_SHOT_FILTER=All \
//   pnpm exec electron . --force-device-scale-factor=2
//
//   # frame it (3rd arg = visible height crop, in CSS px):
//   node packages/web/scripts/frame-window.mjs /tmp/shot.png website/src/assets/screenshots/desktop-dark.png 700
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { chromium } from '@playwright/test'

const [src, out, cropArg] = process.argv.slice(2)
const W = 1100
const H = cropArg ? Number(cropArg) : 760
const dataUrl = `data:image/png;base64,${readFileSync(src).toString('base64')}`

const html = `<!doctype html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
.win{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.win img{display:block;width:${W}px}
.lights{position:absolute;top:18px;left:21px;display:flex;gap:8px}
.lights span{width:12px;height:12px;border-radius:50%}
.r{background:#ff5f57}.y{background:#febc2e}.g{background:#28c840}
</style></head><body>
<div class="win">
  <img src="${dataUrl}"/>
  <div class="lights"><span class="r"></span><span class="y"></span><span class="g"></span></div>
</div></body></html>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
await p.setContent(html)
await p.waitForTimeout(150)
await p.locator('.win').screenshot({ path: out, omitBackground: true })
await b.close()
console.log(`framed -> ${out}`)
