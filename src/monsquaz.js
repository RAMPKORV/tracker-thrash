/**
 * MONSQUAZ MODE — a faithful music-reactive recreation of the four-phase
 * Monsquaz CSS/HTML5 loop:
 *
 *   1. green banded background, two huge glossy green up-arrows, bald guy
 *      soars through the frame
 *   2. sunset dance with two side-card dancers
 *   3. blue frame, two pink down-arrows, bald guy falls
 *   4. blue square / yellow-green circles / red flash / giant zoom
 *
 * The figure is the actual monsquazman.png from the upstream repository
 * (images/monsquazman.png), using the canonical censored edition: the same
 * green up-arrow covers the groin, exactly as in the original's censored cut.
 * The uncensored asset is not bundled. Phases are derived from the tracker
 * pattern's row, so the loop is in sync with the module; kicks add jumps and
 * snares add spin/flash.
 */
import { drawSprite, RAT, DOG } from './sprites.js'
import { keyName } from './theory.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const TAU = Math.PI * 2
const SIN = new Float32Array(1024)
for (let i = 0; i < 1024; i++) SIN[i] = Math.sin((i / 1024) * TAU)
const sinT = x => SIN[((x * 162.974) | 0) & 1023]

// The original body gradient, both the long stop list and the greens.
const GREEN_STOPS = [
  [0.0000, '#bbffdd'], [0.0135, '#bbffdd'], [0.0593, '#aaffd5'], [0.0970, '#99ffcc'],
  [0.1375, '#88ffc4'], [0.1752, '#77ffbb'], [0.2210, '#66ffb3'], [0.2615, '#55ffaa'],
  [0.2992, '#44ffa2'], [0.3396, '#33ff99'], [0.3854, '#22ff91'], [0.4259, '#11ff88'],
  [0.4636, '#00ff80'], [0.5040, '#00ee77'], [0.5418, '#00dd6f'], [0.5876, '#00cc66'],
  [0.6280, '#00bb5e'], [0.6658, '#00aa55'], [0.7062, '#00994d'], [0.7520, '#008844'],
  [0.7898, '#00773c'], [0.8302, '#006633'], [0.8706, '#00552b'], [0.9164, '#004222'],
  [0.9542, '#00331a'], [0.9946, '#002111'], [1.0000, '#001109'],
]

export const FRAME = { x: 72, y: 0, w: 336, h: 252 }

function loadAssets() {
  if (typeof Image === 'undefined') return {}
  const names = { up: 'up.png', down: 'down.png', sunset: 'sunset.jpg', arrowUp: 'uparrow.png', arrowDown: 'downarrow.png', gallo: 'd-gallo.gif', man: 'monsquazman.png' }
  const out = {}
  for (const [key, file] of Object.entries(names)) {
    const img = new Image()
    img.src = new URL(`../assets/monsquaz/${file}`, import.meta.url).href
    out[key] = img
  }
  return out
}

function drawCover(ctx, img, x, y, w, h, zoom = 1) {
  if (!img?.complete || !img.naturalWidth) return false
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom
  const sw = w / s, sh = h / s
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  return true
}

function drawArrowAsset(ctx, img, x, y, w, dir = 1) {
  if (!img?.complete || !img.naturalWidth) return false
  const h = w * (img.naturalHeight / img.naturalWidth)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, dir)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
  return true
}

export function monsquazPhase(row, rowCount) {
  const n = Math.max(2, rowCount || 2)
  const progress = (rowCount || 0) <= 1 ? 0 : clamp(((row | 0) + 1) / n, 0, 1)
  const phase = Math.min(3, Math.floor(progress * 4))
  const local = clamp(progress * 4 - phase, 0, 1)
  return { progress, phase, local }
}

function greenGradient(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  for (const [at, color] of GREEN_STOPS) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

/** Big glossy beveled arrow, pointing up by default. */
function drawArrow(ctx, x, y, w, h, dir = 1, alpha = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, dir)
  ctx.globalAlpha = alpha
  ctx.lineJoin = 'round'
  // drop shadow
  ctx.save()
  ctx.translate(4, 7)
  ctx.fillStyle = 'rgba(0,0,0,.28)'
  ctx.beginPath()
  ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, -h * 0.05); ctx.lineTo(w * 0.26, -h * 0.05)
  ctx.lineTo(w * 0.26, h / 2); ctx.lineTo(-w * 0.26, h / 2); ctx.lineTo(-w * 0.26, -h * 0.05)
  ctx.lineTo(-w / 2, -h * 0.05); ctx.closePath(); ctx.fill()
  ctx.restore()
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
  g.addColorStop(0, '#8affc2'); g.addColorStop(0.22, '#22ff91'); g.addColorStop(0.52, '#00d66b')
  g.addColorStop(0.78, '#00994d'); g.addColorStop(1, '#006633')
  ctx.fillStyle = g
  ctx.strokeStyle = '#002b16'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, -h * 0.05); ctx.lineTo(w * 0.26, -h * 0.05)
  ctx.lineTo(w * 0.26, h / 2); ctx.lineTo(-w * 0.26, h / 2); ctx.lineTo(-w * 0.26, -h * 0.05)
  ctx.lineTo(-w / 2, -h * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke()
  // bevel + specular
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-w * 0.18, h * 0.36); ctx.lineTo(-w * 0.18, -h * 0.02); ctx.lineTo(-w * 0.32, -h * 0.075)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.18, h * 0.34); ctx.lineTo(w * 0.18, -h * 0.02); ctx.lineTo(w * 0.32, -h * 0.075)
  ctx.stroke()
  ctx.restore()
}

/**
 * The real deal: monsquazman.png, feet-anchored. The asset is 194x401 and
 * already carries the canonical green-arrow censor over the groin, so no
 * explicit pixels are bundled. A small horizontal squash when he turns keeps
 * the flat render feeling like the sprite in the original loop.
 */
function drawMan(ctx, img, x, y, h, rot = 0, yaw = 0, pitch = 0, alpha = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha *= alpha
  if (img?.complete && img.naturalWidth) {
    const w = h * (img.naturalWidth / img.naturalHeight)
    const sx = 0.84 + Math.abs(Math.cos(yaw)) * 0.16
    const sy = 1 + Math.abs(Math.sin(pitch)) * 0.04
    ctx.scale(sx, sy)
    ctx.drawImage(img, -w / 2, -h, w, h)
    ctx.restore()
    return true
  }
  // Asset-free fallback: a neutral silhouette so a failed image load never
  // takes the show down.
  ctx.fillStyle = '#d8a578'
  ctx.strokeStyle = 'rgba(5,5,10,.9)'
  ctx.lineWidth = 1.5
  const u = h / 150
  ctx.beginPath(); ctx.arc(0, -h + 12 * u, 11 * u, 0, TAU); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(-16 * u, -h + 24 * u, 32 * u, 54 * u, 8 * u); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(-14 * u, -h + 78 * u, 12 * u, 62 * u, 6 * u); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(2 * u, -h + 78 * u, 12 * u, 62 * u, 6 * u); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#00e070'
  ctx.fillRect(-12 * u, -h + 66 * u, 24 * u, 18 * u)
  ctx.restore()
  return false
}

function drawManShadow(ctx, x, y, w, alpha = 0.3) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.42, 5, 0, 0, TAU); ctx.fill()
  ctx.restore()
}

function drawDust(ctx, x, y, amount) {
  ctx.save()
  ctx.globalAlpha = clamp(amount, 0, 1) * 0.55
  ctx.fillStyle = '#e8ffdd'
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU
    const r = (1 - amount) * 22 + 4
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, 2 + (k % 3), 0, TAU); ctx.fill()
  }
  ctx.restore()
}

export class MonsquazScene {
  constructor() {
    this.assets = loadAssets()
    this.reset()
  }

  reset() {
    this.t = 0
    this.phase = 0
    this.local = 0
    this.progress = 0
    this.kick = 0
    this.snare = 0
    this.bass = 0
    this.flash = 0
    this.spin = 0
    this.land = 0
    this.intro = 0
    this._lastRow = -1
    this.chord = null
    this.roman = ''
    this.key = null
    this.enabled = false
    this.headYaw = 0
    this.headPitch = 0
  }

  /** Start with the iconic green-arrow / soaring-bald-guy shot. */
  begin() {
    this.enabled = true
    this.intro = 2.2
    this.phase = 0
    this.local = 0
    this.progress = 0
    this.kick = 0
    this.snare = 0
    this.flash = 0
    this.land = 0
    this.spin = 0
    this._lastRow = -1
    this.headYaw = 0
    this.headPitch = 0
  }

  handleEvent(e) {
    if (!this.enabled || !e) return
    if (e.type === 'note') {
      if (e.kind === 'kick') {
        this.kick = 1
        if (this.phase === 2) this.land = 1
      } else if (e.kind === 'snare') {
        this.snare = 1
        this.spin = 1
      } else if (e.kind === 'bass') {
        this.bass = 1
      } else if (e.kind === 'lead') {
        this.kick = Math.max(this.kick, 0.3)
      }
    } else if (e.type === 'chord') {
      this.chord = e.chord
      this.roman = e.roman
      this.flash = Math.max(this.flash, 0.2)
    } else if (e.type === 'section') {
      // Each pattern gets a fresh 4-phase Monsquaz loop.
      this.intro = 0
      this.phase = 0
      this.local = 0
    }
  }

  update(data, dt) {
    const d = Math.min(0.05, dt || 0.016)
    if (!this.enabled) return
    this.t += d
    this.reduced = !!data?.viz?.settings?.reducedMotion
    if (data?.chord) this.chord = data.chord
    if (data?.roman) this.roman = data.roman
    if (data?.key) this.key = data.key
    const state = data?.state
    const pat = data?.model?.patterns?.[state?.pattern]
    const info = monsquazPhase(state?.row || 0, pat?.rowCount || 64)

    if (this.intro > 0) {
      this.intro = Math.max(0, this.intro - d)
      this.phase = 0
      this.local = clamp(1 - this.intro / 2.2, 0, 1)
      this.progress = this.local * 0.25
    } else if (info.phase !== this.phase || (state?.row || 0) < this._lastRow) {
      if (this.phase === 2 && info.phase !== 2) this.land = 1
      this.phase = info.phase
      this.local = info.local
      this.progress = info.progress
    } else {
      const k = Math.min(1, d * 11)
      this.local += (info.local - this.local) * k
      this.progress += (info.progress - this.progress) * k
    }
    this._lastRow = state?.row || 0
    this.kick = Math.max(0, this.kick - d * 5)
    this.snare = Math.max(0, this.snare - d * 4)
    this.bass = Math.max(0, this.bass - d * 2.2)
    this.flash = Math.max(0, this.flash - d * 4.5)
    this.spin = Math.max(0, this.spin - d * 2)
    this.land = Math.max(0, this.land - d * 2.4)
    const spinSpeed = this.phase === 3 ? 5.5 : 1.2
    this.headYaw += d * spinSpeed * (1 + this.snare * 3)
    this.headPitch = Math.sin(this.t * 1.7) * 0.35
  }

  draw(ctx, data) {
    const phase = this.phase
    const local = this.local
    // The website's body is always this green gradient, even when the 4:3
    // stage inside shows the sunset/down/zoom phases.
    greenGradient(ctx, 0, 0, 480, 270)
    ctx.save()
    ctx.beginPath()
    ctx.rect(FRAME.x, FRAME.y, FRAME.w, FRAME.h)
    ctx.clip()
    if (phase === 0) this.drawUp(ctx, local)
    else if (phase === 1) this.drawSunset(ctx, local)
    else if (phase === 2) this.drawDown(ctx, local)
    else this.drawZoom(ctx, local)
    this.drawActors(ctx, local, phase)
    this.drawHint(ctx, data)
    ctx.restore()
  }

  drawUp(ctx, local) {
    if (!drawCover(ctx, this.assets.up, FRAME.x, 0, FRAME.w, FRAME.h)) greenGradient(ctx, FRAME.x, 0, FRAME.w, FRAME.h)
    const rise = local
    const ay = 210 - rise * 145
    if (!drawArrowAsset(ctx, this.assets.arrowUp, FRAME.x + 70, ay, 74, 1)) drawArrow(ctx, FRAME.x + 70, ay, 74, 112, 1)
    if (!drawArrowAsset(ctx, this.assets.arrowUp, FRAME.x + 232, ay + 24, 74, 1)) drawArrow(ctx, FRAME.x + 232, ay + 24, 74, 112, 1)
    // speed lines
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#aaffd5'
    for (let k = 0; k < 12; k++) {
      const x = FRAME.x + 28 + (k * 31) % (FRAME.w - 56)
      const y = 40 + (k * 53) % 190
      ctx.fillRect(x, y, 2, 8 + (k % 4) * 4)
    }
    ctx.restore()
  }

  drawSunset(ctx, local) {
    if (drawCover(ctx, this.assets.sunset, FRAME.x, 0, FRAME.w, FRAME.h, 1.08)) {
      // actual sunset; side-card dancers are drawn later in drawActors
      return
    }
    const g = ctx.createLinearGradient(0, 0, 0, FRAME.h)
    g.addColorStop(0, '#160722'); g.addColorStop(0.28, '#4a1550'); g.addColorStop(0.52, '#b62e6b')
    g.addColorStop(0.68, '#ff6b35'); g.addColorStop(0.78, '#ffb03a'); g.addColorStop(1, '#2a0d3a')
    ctx.fillStyle = g
    ctx.fillRect(FRAME.x, 0, FRAME.w, FRAME.h)
    // sun
    ctx.save()
    ctx.beginPath(); ctx.arc(FRAME.x + FRAME.w / 2, 128, 44, 0, TAU); ctx.clip()
    const sg = ctx.createLinearGradient(0, 92, 0, 172)
    sg.addColorStop(0, '#fff2d0'); sg.addColorStop(0.55, '#ffb03a'); sg.addColorStop(1, '#d42036')
    ctx.fillStyle = sg
    ctx.fillRect(FRAME.x + 100, 80, 160, 100)
    ctx.fillStyle = 'rgba(25,6,30,.5)'
    for (let k = 0; k < 6; k++) ctx.fillRect(FRAME.x + 100, 136 + k * 7, 160, 3)
    ctx.restore()
    // clouds
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#ffe0a0'
    for (let k = 0; k < 9; k++) {
      const x = FRAME.x + 16 + ((k * 53 + this.t * 4) % (FRAME.w - 32))
      const y = 50 + (k * 19) % 82
      ctx.beginPath(); ctx.ellipse(x, y, 25 + (k % 3) * 8, 4, 0, 0, TAU); ctx.fill()
    }
    ctx.globalAlpha = 1
    // ground
    ctx.fillStyle = '#08040d'
    ctx.fillRect(FRAME.x, 196, FRAME.w, FRAME.h - 196)
    // palms
    for (const px of [FRAME.x + 25, FRAME.x + FRAME.w - 27]) {
      ctx.strokeStyle = '#08040d'; ctx.lineWidth = 7
      ctx.beginPath(); ctx.moveTo(px, 202); ctx.quadraticCurveTo(px + 5, 170, px + 2, 150); ctx.stroke()
      ctx.lineWidth = 3
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(px + 2, 152); ctx.quadraticCurveTo(px + k * 16, 136, px + k * 23, 132); ctx.stroke()
      }
    }
  }

  drawDown(ctx, local) {
    if (!drawCover(ctx, this.assets.down, FRAME.x, 0, FRAME.w, FRAME.h)) {
      const g = ctx.createLinearGradient(0, 0, 0, FRAME.h)
      g.addColorStop(0, '#000010'); g.addColorStop(0.55, '#003070'); g.addColorStop(1, '#1080e8')
      ctx.fillStyle = g
      ctx.fillRect(FRAME.x, 0, FRAME.w, FRAME.h)
      ctx.globalAlpha = 0.18
      for (let y = 0; y < FRAME.h; y += 4) { ctx.fillStyle = '#60c0ff'; ctx.fillRect(FRAME.x, y, FRAME.w, 1) }
      ctx.globalAlpha = 1
    }
    const y = -100 + local * 340
    if (!drawArrowAsset(ctx, this.assets.arrowDown, FRAME.x + 74, y, 72, -1)) drawArrow(ctx, FRAME.x + 74, y, 72, 108, -1)
    if (!drawArrowAsset(ctx, this.assets.arrowDown, FRAME.x + 238, y - 34, 72, -1)) drawArrow(ctx, FRAME.x + 238, y - 34, 72, 108, -1)
  }

  drawZoom(ctx, local) {
    ctx.fillStyle = '#05050a'
    ctx.fillRect(FRAME.x, 0, FRAME.w, FRAME.h)
    ctx.fillStyle = `rgba(0,0,80,${0.55 + local * 0.4})`
    ctx.fillRect(FRAME.x, 0, FRAME.w, FRAME.h)
    for (const [at, col] of [[0.18, '#ffe800'], [0.4, '#00ff80'], [0.62, '#ffe800']]) {
      if (local < at) continue
      const p = clamp((local - at) / 0.18, 0, 1)
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.globalAlpha = 0.85
      ctx.beginPath(); ctx.arc(FRAME.x + FRAME.w / 2, FRAME.h / 2, p * 200, 0, TAU); ctx.stroke()
      ctx.restore()
    }
    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(255,0,30,${Math.min(0.3, this.flash * 0.28)})`
      ctx.fillRect(FRAME.x, 0, FRAME.w, FRAME.h)
    }
    if (local > 0.46) {
      ctx.save()
      ctx.translate(FRAME.x + FRAME.w / 2, FRAME.h / 2)
      ctx.rotate(-0.07)
      const sc = 0.7 + local * 0.7
      ctx.scale(sc, sc)
      ctx.font = '32px "Silkscreen", monospace'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = 0.95
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4
      ctx.strokeText('MONSQUAZ', 0, 0)
      ctx.fillStyle = local > 0.7 ? '#ffe800' : '#fff'
      ctx.fillText('MONSQUAZ', 0, 0)
      ctx.restore()
    }
  }

  drawActors(ctx, local, phase) {
    const man = this.assets.man
    const cx = FRAME.x + FRAME.w / 2
    const ground = 232

    if (phase === 1) {
      const bob = sinT(this.t * 5) * 4
      if (this.assets.gallo?.complete && this.assets.gallo.naturalWidth) {
        const gh = 166, gw = gh * (this.assets.gallo.naturalWidth / this.assets.gallo.naturalHeight)
        ctx.drawImage(this.assets.gallo, FRAME.x + 8, 64 + bob, gw, gh)
        ctx.drawImage(this.assets.gallo, FRAME.x + FRAME.w - 8 - gw, 58 - bob, gw, gh)
      } else {
        const card = (x, sprite, label, dir) => {
          ctx.save(); ctx.translate(x, 118 + bob * dir)
          ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(-30, -92, 60, 116)
          ctx.strokeStyle = 'rgba(255,232,0,.5)'; ctx.strokeRect(-29.5, -91.5, 59, 115)
          drawSprite(ctx, sprite, 0, 12, 1.3, { alpha: 0.96 })
          ctx.fillStyle = '#ffe800'; ctx.font = '6px "Silkscreen", monospace'; ctx.textAlign = 'center'
          ctx.fillText(label, 0, 10); ctx.restore()
        }
        card(FRAME.x + 38, RAT, 'RAT', 1)
        card(FRAME.x + FRAME.w - 38, DOG, 'DOG', -1)
      }
      // The actual guy dances between the two side cards, under the sunset.
      const x = cx + sinT(this.t * 4.2) * 30
      const y = ground - Math.abs(sinT(this.t * 4.2)) * 9 - this.kick * 11
      drawManShadow(ctx, x, ground, 118, 0.34)
      if (this.kick > 0.7) drawDust(ctx, x, ground, this.kick)
      drawMan(ctx, man, x, y, 216, sinT(this.t * 4.2) * 0.05, this.headYaw, this.headPitch)
    } else if (phase === 0) {
      // The website's soaring shot: the actual figure passes through the frame,
      // huge, exactly like the source loop.
      const rise = this.local
      const y = 496 - rise * 528
      for (let k = 2; k >= 1; k--) {
        drawMan(ctx, man, cx + k * 5, y + k * 9, 232, Math.sin(this.t * 3) * 0.02, this.headYaw, this.headPitch, 0.13 * k)
      }
      drawMan(ctx, man, cx, y, 232, Math.sin(this.t * 3) * 0.02 + this.spin * 0.12, this.headYaw, this.headPitch)
      if (this.kick > 0.5) drawDust(ctx, cx, Math.min(ground, y + 6), this.kick)
    } else if (phase === 2) {
      const y = -32 + local * 528
      drawMan(ctx, man, cx + Math.sin(this.t * 2) * 12, y, 216, sinT(this.t * 2.5) * 0.08 + this.spin * 0.4, this.headYaw, this.headPitch)
      if (this.land > 0.02) drawDust(ctx, cx, ground, this.land)
    } else {
      const h = 216 + local * 190
      const x = cx - local * 105
      const y = 232 + local * 12
      for (let k = 2; k >= 1; k--) {
        drawMan(ctx, man, x + k * 7, y + k * 3, h * 0.98, -0.09 + sinT(this.t * 2) * 0.02, this.headYaw, this.headPitch, 0.14 * k)
      }
      drawMan(ctx, man, x, y, h, -0.09 + sinT(this.t * 2) * 0.02, this.headYaw, this.headPitch)
      if (this.kick > 0.5) drawDust(ctx, x, Math.min(ground, y), this.kick)
    }
  }

  drawHint(ctx, data) {
    ctx.save()
    ctx.font = '5px "Silkscreen", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0,0,0,.5)'
    ctx.fillRect(FRAME.x + 6, FRAME.h - 15, 118, 9)
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    const chord = this.chord?.name || ''
    ctx.fillText(`MONSQUAZ · CENSORED CUT${chord ? ' · ' + chord : ''}${this.roman ? ' · ' + this.roman : ''}`, FRAME.x + 9, FRAME.h - 8)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(0,0,0,.5)'
    ctx.fillRect(FRAME.x + FRAME.w - 58, FRAME.h - 15, 52, 9)
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.fillText('Z: EXIT', FRAME.x + FRAME.w - 10, FRAME.h - 8)
    ctx.restore()
  }
}
