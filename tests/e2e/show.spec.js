import { test, expect } from '@playwright/test'

function trackErrors(page) {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}

async function openShow(page, { serious = false } = {}) {
  const errors = trackErrors(page)
  await page.goto('/')
  await expect(page.locator('.gate-title')).toContainText('TRACKER')
  await page.click(serious ? '#gate-serious' : '#gate-enter')
  await page.waitForFunction(() => window.__TT?.model != null, null, { timeout: 35_000 })
  await page.waitForTimeout(1200)
  return errors
}

test.describe('Given a tracker module in a browser', () => {
  test('When the show starts, Then it loads the demo module, plays it, and shows musical information', async ({ page }) => {
    const errors = await openShow(page)
    await test.step('the demo metadata and 4 channels are visible', async () => {
      expect(await page.evaluate(() => __TT.model.title)).toMatch(/dj rat/i)
      expect(await page.evaluate(() => __TT.model.maxChannels)).toBe(4)
      await expect(page.locator('#track-title')).not.toHaveText('NO MODULE LOADED')
      await expect(page.locator('#bc-channels .bc-led')).toHaveCount(4)
    })
    await test.step('audio position advances', async () => {
      await expect.poll(() => page.evaluate(() => __TT.state.pos), { timeout: 12_000 }).toBeGreaterThan(0.5)
      expect(await page.evaluate(() => __TT.engine.playing)).toBe(true)
    })
    await test.step('a chord and key are detected', async () => {
      await expect.poll(() => page.evaluate(() => __TT.analysis.getChord()?.name || ''), { timeout: 12_000 }).not.toBe('')
      const info = await page.evaluate(() => ({
        chord: __TT.analysis.getChord()?.name,
        key: __TT.analysis.getKey(),
        roman: __TT.analysis.getRoman(),
        broadcastChord: document.getElementById('bc-chord').textContent,
      }))
      expect(info.chord).toBeTruthy()
      expect(info.key).toBeTruthy()
      expect(info.broadcastChord).not.toBe('???')
      expect(info.roman).toBeTruthy()
    })
    await test.step('the scene canvas is actually animating', async () => {
      const hash = async () => page.evaluate(() => {
        const c = document.getElementById('stage')
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        let h = 0
        for (let i = 0; i < d.length; i += 101) h = (Math.imul(h, 31) + d[i]) | 0
        return h
      })
      const a = await hash()
      await page.waitForTimeout(450)
      const b = await hash()
      expect(a).not.toBe(b)
    })
    await page.screenshot({ path: 'test-results/shots/01-demo-show.png' })
    expect(errors).toEqual([])
  })

  test('When I pause and resume, Then the transport behaves and the playhead stops', async ({ page }) => {
    await openShow(page)
    await page.click('#btn-play')
    await expect.poll(() => page.evaluate(() => __TT.engine.paused)).toBe(true)
    const p1 = await page.evaluate(() => __TT.state.pos)
    await page.waitForTimeout(400)
    const p2 = await page.evaluate(() => __TT.state.pos)
    expect(Math.abs(p2 - p1)).toBeLessThan(0.25)
    await page.click('#btn-play')
    await expect.poll(() => page.evaluate(() => __TT.engine.paused)).toBe(false)
    await expect.poll(() => page.evaluate(() => __TT.state.pos), { timeout: 8000 }).toBeGreaterThan(p2)
  })

  test('When I enable serious mode, Then gags and the poop engine are removed but the demoscene remains', async ({ page }) => {
    await openShow(page)
    await page.click('#btn-serious')
    await expect.poll(() => page.evaluate(() => __TT.settings.serious)).toBe(true)
    await expect(page.locator('body')).toHaveClass(/serious-mode/)
    await expect.poll(() => page.evaluate(() => __TT.gags.active.length)).toBe(0)
    await expect.poll(() => page.evaluate(() => __TT.viz.turds.length)).toBe(0)
    expect(await page.evaluate(() => document.getElementById('poop-toggle').disabled)).toBe(true)
    await page.evaluate(() => __TT.setSerious(false))
    await expect.poll(() => page.evaluate(() => __TT.settings.serious)).toBe(false)
  })

  test('When I open the music panels, Then the diegetic broadcast gives way to the full music-nerd HUD', async ({ page }) => {
    await openShow(page)
    await page.click('#btn-nerd')
    await expect(page.locator('body')).toHaveClass(/nerd-mode/)
    await expect(page.locator('.broadcast')).toBeHidden()
    await expect(page.locator('#roll')).toBeVisible()
    await expect(page.locator('#grid')).toBeVisible()
    await expect(page.locator('.left-rail')).toBeVisible()
    await expect(page.locator('.right-rail')).toBeVisible()
    await page.screenshot({ path: 'test-results/shots/02-nerd-panels.png' })
    await page.click('#btn-nerd')
    await expect(page.locator('.broadcast')).toBeVisible()
  })

  test('When the director advances, Then the show rotates composing formats, not just palettes', async ({ page }) => {
    const errors = await openShow(page)
    const seen = []
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => __TT.advanceScene())
      await page.waitForTimeout(250)
      seen.push(await page.evaluate(() => __TT.viz.format))
    }
    expect(new Set(seen).size).toBeGreaterThanOrEqual(3)
    expect(seen).toContain('fx')
    expect(errors).toEqual([])
  })

  test('When I seek, Then the module jumps and the analysis resets safely', async ({ page }) => {
    await openShow(page)
    await page.evaluate(() => __TT.seek(15))
    await expect.poll(() => page.evaluate(() => __TT.state.pos), { timeout: 8000 }).toBeGreaterThan(12)
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => __TT.errors.length)).toBe(0)
  })

  test('When I drop an invalid file, Then it fails with a funny, human-readable error and does not leave a spinner', async ({ page }) => {
    await openShow(page)
    await page.setInputFiles('#file', { name: 'not-a-module.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a module. it is a cry for help.') })
    await expect.poll(() => page.locator('#toast').textContent(), { timeout: 10_000 }).toMatch(/refused|left|error|not/i)
    await expect(page.locator('#loading')).toBeHidden()
  })

  test('When chaos is raised, Then the gag layer wakes up and the poop forecast includes a type', async ({ page }) => {
    await openShow(page)
    await page.evaluate(() => __TT.setChaos(8))
    await expect(page.locator('#chaos-val')).toHaveText('8')
    await page.evaluate(() => __TT.gags.bars())
    await expect(page.locator('.gag-bars')).toBeVisible()
    const next = await page.locator('#bc-next').textContent()
    expect(next).toMatch(/NEXT .+ · /)
  })

  test('When chaos is zero, Then the demoscene stays but gags and new turds stop', async ({ page }) => {
    await openShow(page)
    await page.evaluate(() => __TT.setChaos(0))
    await expect.poll(() => page.evaluate(() => __TT.settings.chaos)).toBe(0)
    await page.evaluate(() => __TT.gags.bars())
    await expect(page.locator('.gag-bars')).toHaveCount(0)
    const before = await page.evaluate(() => __TT.viz.turds.length)
    await page.evaluate(() => __TT.viz.spawnTurd('soft', 'CHAOS ZERO', 12))
    expect(await page.evaluate(() => __TT.viz.turds.length)).toBe(before)
  })

  test('When the viewport is a phone, Then the scene and transport still fit and the broadcast remains readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openShow(page)
    const layout = await page.evaluate(() => {
      const t = document.querySelector('.transport').getBoundingClientRect()
      const b = document.querySelector('.broadcast').getBoundingClientRect()
      const play = document.getElementById('btn-play').getBoundingClientRect()
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, tTop: t.top, tBottom: t.bottom, bTop: b.top, bBottom: b.bottom, playTop: play.top, playBottom: play.bottom }
    })
    expect(layout.sw).toBeLessThanOrEqual(layout.iw + 1)
    expect(layout.tBottom).toBeLessThanOrEqual(844)
    expect(layout.playTop).toBeGreaterThanOrEqual(0)
    expect(layout.bBottom).toBeLessThanOrEqual(layout.tTop + 1)
    await page.screenshot({ path: 'test-results/shots/03-mobile.png' })
  })
})
