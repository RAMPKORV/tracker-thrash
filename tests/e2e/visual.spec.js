import { test, expect } from '@playwright/test'
import { makeTestMod } from '../helpers/test-module.mjs'

async function openShow(page) {
  await page.goto('/')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#gate-open')])
  await chooser.setFiles({ name: 'visual-test.mod', mimeType: 'application/octet-stream', buffer: makeTestMod() })
  await page.waitForFunction(() => window.__TT?.model != null && document.getElementById('gate').classList.contains('gone'), null, { timeout: 35_000 })
  await page.waitForTimeout(1200)
}

test.describe('Visual formats: the show must change shape, not just palette', () => {
  test('captures each format and scene for review', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await openShow(page)

    const shots = [
      ['coaster-world', () => { __TT.viz.setScene('coaster'); __TT.viz.setFormat('world'); __TT.viz.setEffect('stars'); __TT.viz.setCamera('dolly') }],
      ['terminal', () => { __TT.viz.setFormat('terminal') }],
      ['multiview', () => { __TT.viz.setFormat('multiview') }],
      ['onebit-fx', () => { __TT.viz.setScene('plaza'); __TT.viz.setFormat('fx'); __TT.viz.setEffect('onebit'); __TT.viz.setCamera('dolly') }],
      ['glenz-fx', () => { __TT.viz.setScene('cosmic'); __TT.viz.setFormat('fx'); __TT.viz.setEffect('glenz'); __TT.viz.setCamera('orbit') }],
      ['factory-closeup', () => { __TT.viz.setScene('factory'); __TT.viz.setFormat('world'); __TT.viz.setEffect('fire'); __TT.viz.setCamera('closeup') }],
    ]
    for (const [name, fn] of shots) {
      await page.evaluate(fn)
      await page.waitForTimeout(900)
      await page.screenshot({ path: `test-results/shots/fmt-${name}.png` })
    }
    await page.evaluate(() => __TT.gags.bars())
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/shots/gag-bars.png' })
    await page.evaluate(() => __TT.gags.player())
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/shots/gag-player.png' })
    expect(errors).toEqual([])
  })
})
