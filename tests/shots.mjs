#!/usr/bin/env node
/**
 * Screenshot gallery for human review. Start the dev server first:
 *   npm run dev
 * Then:
 *   npm run shots
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { makeTestMod } from './helpers/test-module.mjs'

const exe = process.env.PW_CHROMIUM || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const out = 'test-results/shots-manual'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('http://localhost:5173/')
await page.screenshot({ path: `${out}/00-gate.png` })
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#gate-open')])
await chooser.setFiles({ name: 'gallery-test.mod', mimeType: 'application/octet-stream', buffer: makeTestMod() })
await page.waitForFunction(() => window.__TT?.model != null && document.getElementById('gate').classList.contains('gone'), null, { timeout: 35000 })
for (const [i, wait] of [2500, 5000, 5000, 5000, 5000].entries()) {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/10-timeline-${i}.png` })
}
const shots = [
  ['coaster', () => { __TT.viz.setScene('coaster'); __TT.viz.setFormat('world'); __TT.viz.setEffect('stars'); __TT.viz.setCamera('dolly') }],
  ['factory-closeup', () => { __TT.viz.setScene('factory'); __TT.viz.setFormat('world'); __TT.viz.setEffect('fire'); __TT.viz.setCamera('closeup') }],
  ['cosmic', () => { __TT.viz.setScene('cosmic'); __TT.viz.setFormat('world'); __TT.viz.setEffect('stars'); __TT.viz.setCamera('orbit') }],
  ['terminal', () => { __TT.viz.setFormat('terminal') }],
  ['multiview', () => { __TT.viz.setFormat('multiview') }],
  ['onebit-fx', () => { __TT.viz.setScene('plaza'); __TT.viz.setFormat('fx'); __TT.viz.setEffect('onebit') }],
  ['glenz-fx', () => { __TT.viz.setScene('cosmic'); __TT.viz.setFormat('fx'); __TT.viz.setEffect('glenz'); __TT.viz.setCamera('orbit') }],
]
for (const [name, fn] of shots) {
  await page.evaluate(fn)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/20-${name}.png` })
}
await page.evaluate(() => { __TT.setMonsquaz(true) })
await page.waitForTimeout(2200)
await page.screenshot({ path: `${out}/35-monsquaz.png` })
await page.evaluate(() => { __TT.setMonsquaz(false); __TT.viz.setScene('plaza'); __TT.viz.setFormat('world'); __TT.setNerd(true) })
await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/30-nerd.png` })
await page.evaluate(() => { __TT.setNerd(false); __TT.gags.bars() })
await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/40-bars.png` })
await page.evaluate(() => { __TT.gags.player() })
await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/41-player.png` })
console.log(`wrote ${out}`)
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console/page errors')
await browser.close()
