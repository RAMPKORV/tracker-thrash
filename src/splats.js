/**
 * 4D Gaussian-splat morph field. A cloud of soft additive points that morphs
 * between a 4D tesseract, torus, galaxy, turd, and the current chord name.
 * This is deliberately fake-scientific: cheap, glowy, and musically reactive.
 */

const N = 260
const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const palette = ['#00f0ff', '#ff2bd6', '#ffe800', '#7dff5a', '#ff8a2b', '#b388ff', '#ffffff']

function rot2(a, b, ang) {
  const c = Math.cos(ang), s = Math.sin(ang)
  return [a * c - b * s, a * s + b * c]
}

function makeSprite(color, size = 32) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  const rgb = hexRgb(color)
  g.addColorStop(0, `rgba(${rgb},1)`)
  g.addColorStop(0.22, `rgba(${rgb},.72)`)
  g.addColorStop(0.55, `rgba(${rgb},.22)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

function hexRgb(h) {
  return `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`
}

function sampleText(text) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = 96
  do {
    ctx.font = `700 ${size}px "Silkscreen", monospace`
    if (ctx.measureText(text).width < 470 || size < 28) break
    size -= 4
  } while (true)
  ctx.fillText(text, 256, 82)
  const d = ctx.getImageData(0, 0, 512, 160).data
  const pts = []
  for (let y = 0; y < 160; y += 2) {
    for (let x = 0; x < 512; x += 2) {
      if (d[(y * 512 + x) * 4 + 3] > 100) pts.push([x / 256 - 1, -(y / 160 - 0.5) * 0.8])
    }
  }
  if (!pts.length) return null
  const out = []
  for (let i = 0; i < N; i++) {
    const p = pts[(Math.random() * pts.length) | 0]
    out.push({ x: p[0] * 2.4, y: p[1] * 2.0, z: 0, w: 0 })
  }
  return out
}

function makeShape(kind) {
  const pts = []
  for (let i = 0; i < N; i++) {
    const u = Math.random() * TAU
    const v = Math.random() * TAU
    let x = 0, y = 0, z = 0, w = 0
    if (kind === 'tesseract') {
      const verts = []
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) for (let d = 0; d < 2; d++) verts.push([a, b, c, d])
      for (let k = 0; k < 8; k++) {
        const a = verts[(Math.random() * 16) | 0], b = verts[(Math.random() * 16) | 0]
        const edge = a[0] === b[0] && a[1] === b[1] && a[2] === b[2] || a[3] === b[3]
        const t = Math.random()
        if (edge || Math.random() < 0.2) {
          x = (a[0] * (1 - t) + b[0] * t - 0.5) * 2.6
          y = (a[1] * (1 - t) + b[1] * t - 0.5) * 2.6
          z = (a[2] * (1 - t) + b[2] * t - 0.5) * 2.6
          w = (a[3] * (1 - t) + b[3] * t - 0.5) * 2.6
        } else { x = (Math.random() - 0.5) * 2.4; y = (Math.random() - 0.5) * 2.4; z = (Math.random() - 0.5) * 2.4; w = (Math.random() - 0.5) * 2.4 }
      }
    } else if (kind === 'torus') {
      const R = 1.25, r = 0.46 + Math.random() * 0.1
      x = Math.cos(u) * (R + r * Math.cos(v))
      y = Math.sin(u) * (R + r * Math.cos(v))
      z = r * Math.sin(v)
      w = (Math.random() - 0.5) * 0.12
    } else if (kind === 'galaxy') {
      const arm = (i % 3) * (TAU / 3)
      const rad = Math.pow(Math.random(), 0.55) * 1.8
      const a = rad * 3.3 + arm + (Math.random() - 0.5) * 0.6
      x = Math.cos(a) * rad
      y = Math.sin(a) * rad
      z = (Math.random() - 0.5) * 0.4 * (1.4 - rad * 0.4)
      w = (Math.random() - 0.5) * 0.2
    } else if (kind === 'turd') {
      const t = Math.random()
      const a = t * TAU * 2.2
      const rad = 0.55 - t * 0.28 + (Math.random() - 0.5) * 0.1
      x = Math.cos(a) * rad
      y = (t - 0.5) * 2.6
      z = Math.sin(a) * rad
      w = (Math.random() - 0.5) * 0.18
    } else if (kind === 'butt') {
      const left = Math.random() < 0.5
      const cx = left ? -0.62 : 0.62
      const a = Math.random() * TAU
      const r = Math.sqrt(Math.random())
      x = cx + Math.cos(a) * r * 0.78
      y = Math.sin(a) * r * 0.9 + 0.1
      z = (Math.random() - 0.5) * 0.7
      w = (Math.random() - 0.5) * 0.15
    } else if (kind === 'sphere') {
      const zz = Math.random() * 2 - 1
      const r = Math.sqrt(1 - zz * zz)
      const a = Math.random() * TAU
      x = Math.cos(a) * r * 1.5
      y = Math.sin(a) * r * 1.5
      z = zz * 1.5
      w = (Math.random() - 0.5) * 0.2
    } else {
      x = (Math.random() - 0.5) * 2.4
      y = (Math.random() - 0.5) * 1.6
      z = (Math.random() - 0.5) * 0.3
    }
    pts.push({ x, y, z, w })
  }
  return pts
}

export class SplatField {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 240
    this.canvas.height = 135
    this.ctx = this.canvas.getContext('2d')
    this.sprites = palette.map(c => makeSprite(c, 40))
    this.textSprites = palette.map(c => makeSprite(c, 24))
    this.points = []
    for (let i = 0; i < N; i++) {
      this.points.push({
        x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2, w: (Math.random() - 0.5) * 2,
        vx: 0, vy: 0, vz: 0, vw: 0,
        tx: 0, ty: 0, tz: 0, tw: 0,
        ci: i % palette.length, size: 4 + Math.random() * 5, phase: Math.random() * TAU,
      })
    }
    this.mode = 'sphere'
    this.text = ''
    this.textTarget = null
    this.lastText = ''
    this.t = 0
    this.opacity = 0.6
    this.scale = 1
    this.cx = 120
    this.cy = 64
    this.fontReady = false
    document.fonts?.ready?.then(() => { this.fontReady = true })
    this.setShape('sphere')
  }

  setShape(kind) {
    this.mode = kind
    this.lastText = ''
    const pts = makeShape(kind)
    this.points.forEach((p, i) => { const q = pts[i]; p.tx = q.x; p.ty = q.y; p.tz = q.z; p.tw = q.w })
  }

  setChord(name) {
    if (!name || name === this.lastText) return
    const pts = sampleText(name)
    if (!pts) return
    this.lastText = name
    this.mode = 'text'
    this.textTarget = pts
    this.points.forEach((p, i) => { const q = pts[i]; p.tx = q.x; p.ty = q.y; p.tz = q.z; p.tw = q.w })
  }

  update(dt, t, bass = 0, high = 0) {
    this.t = t
    const k = 17, damp = 5.5
    for (const p of this.points) {
      p.vx += (p.tx - p.x) * k * dt; p.vx *= Math.exp(-damp * dt); p.x += p.vx * dt
      p.vy += (p.ty - p.y) * k * dt; p.vy *= Math.exp(-damp * dt); p.y += p.vy * dt
      p.vz += (p.tz - p.z) * k * dt; p.vz *= Math.exp(-damp * dt); p.z += p.vz * dt
      p.vw += (p.tw - p.w) * k * dt; p.vw *= Math.exp(-damp * dt); p.w += p.vw * dt
    }
    this.scale = 1 + bass * 0.15 + high * 0.08
    this.cx = 120 + Math.sin(t * 0.23) * 5
    this.cy = 62 + Math.cos(t * 0.31) * 3
    this.opacity = this.mode === 'text' ? 0.82 : 0.55
  }

  render(accent = 0) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, 240, 135)
    const modeText = this.mode === 'text'
    const aXW = this.t * (modeText ? 0.08 : 0.62)
    const aYZ = this.t * (modeText ? 0.06 : 0.41)
    const aZW = Math.sin(this.t * 0.17) * (modeText ? 0.08 : 0.55)
    const aXY = this.t * 0.19
    const fov = 3.1
    ctx.globalCompositeOperation = modeText ? 'source-over' : 'lighter'
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i]
      const jx = Math.sin(this.t * 1.7 + p.phase) * 0.025
      const jy = Math.cos(this.t * 1.3 + p.phase * 1.3) * 0.025
      let x = p.x + jx, y = p.y + jy, z = p.z, w = p.w
      ;[x, w] = rot2(x, w, aXW)
      ;[y, z] = rot2(y, z, aYZ)
      ;[x, y] = rot2(x, y, aXY)
      ;[z, w] = rot2(z, w, aZW)
      const persp = fov / (fov + z + w * 0.55)
      const sx = this.cx + x * this.scale * 40 * persp
      const sy = this.cy + y * this.scale * 40 * persp
      if (sx < -20 || sx > 260 || sy < -20 || sy > 155) continue
      const sprite = modeText ? this.textSprites : this.sprites
      const sp = sprite[(p.ci + accent) % sprite.length]
      const size = p.size * persp * (1 + bassHack(this.t) * 0.1)
      ctx.globalAlpha = clamp((modeText ? 0.3 : 0.24) + (1 - z * 0.1) * 0.24 * persp, 0.04, modeText ? 0.55 : 0.7)
      ctx.drawImage(sp, sx - size / 2, sy - size / 2, size, size)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return this.canvas
  }
}

function bassHack(t) { return 0.5 + 0.5 * Math.sin(t * 2) }
