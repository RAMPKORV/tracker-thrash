/** The turd taxonomy. Used by both the stage and the look-ahead forecast. */

export const POOP_TYPES = {
  soft:   { label: 'SOFT SERVE', blurb: 'a classic', color: '#a06a35', css: 'soft' },
  log:    { label: 'FIRM LOG',   blurb: 'structurally sound', color: '#8a5a2b', css: 'log' },
  pellet: { label: 'PELLETS',    blurb: 'staccato energy', color: '#b47a40', css: 'pellet' },
  spicy:  { label: 'SPICY',      blurb: 'tritone detected', color: '#d13a1e', css: 'spicy' },
  corn:   { label: 'CORN LOG',   blurb: 'extended chord', color: '#b98634', css: 'corn' },
  rainbow:{ label: 'RAINBOW',    blurb: 'unnecessary maj7', color: '#ff2bd6', css: 'rainbow' },
  ghost:  { label: 'GHOST LOG',  blurb: 'a silence appeared', color: '#c9d6ff', css: 'ghost' },
  liquid: { label: 'LIQUID',     blurb: 'too many notes', color: '#7a4b22', css: 'liquid' },
  giant:  { label: 'THE BIG ONE',blurb: 'sub-bass incident', color: '#7a4b22', css: 'giant' },
  gold:   { label: 'GOLD',       blurb: 'augmented, somehow', color: '#e7b73a', css: 'gold' },
}

export function poopTypeForChord(chord, opts = {}) {
  const suffix = chord?.suffix || ''
  const role = opts.role || ''
  const midi = Number.isFinite(opts.midi) ? opts.midi : 60
  const dissonance = Number(opts.dissonance) || 0
  if (dissonance > 0.52) return 'spicy'
  if (suffix.includes('dim') || suffix === 'm7b5') return 'spicy'
  if (suffix === 'aug' || suffix === 'aug7') return 'gold'
  if (suffix === 'maj7' || suffix === 'maj9' || suffix === '6' || suffix === '6/9') return 'rainbow'
  if (suffix === '7' || suffix === '9' || suffix === '11' || suffix === '13') return 'corn'
  if (suffix.startsWith('sus')) return 'soft'
  if (suffix === 'm' || suffix === 'm7' || suffix === 'm9' || suffix === 'm11') return 'log'
  if (role === 'bass') return midi < 46 ? 'giant' : 'log'
  if (role === 'lead') return midi > 76 ? 'pellet' : 'corn'
  if (role === 'chord') return 'soft'
  if (opts.silence) return 'ghost'
  if (opts.rate > 10) return 'liquid'
  return 'soft'
}

function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + q, y)
  ctx.arcTo(x + w, y, x + w, y + h, q)
  ctx.arcTo(x + w, y + h, x, y + h, q)
  ctx.arcTo(x, y + h, x, y, q)
  ctx.arcTo(x, y, x + w, y, q)
  ctx.closePath()
}

/**
 * Draw one stylised, deliberately non-anatomical cartoon turd.
 * `size` is roughly the width in pixels. Label is optional (note/chord).
 */
export function drawTurd(ctx, x, y, size, type = 'soft', opts = {}) {
  const meta = POOP_TYPES[type] || POOP_TYPES.soft
  const s = Math.max(5, size)
  const t = Number(opts.time) || 0
  const color = opts.color || meta.color
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(opts.rot || 0)
  ctx.globalAlpha = opts.alpha ?? 1
  ctx.lineJoin = 'round'

  const shadow = (dx = 0, dy = s * 0.55) => {
    ctx.fillStyle = 'rgba(0,0,0,.35)'
    ctx.beginPath()
    ctx.ellipse(dx, dy, s * 0.62, s * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  if (type === 'pellet') {
    shadow(0, s * 0.5)
    for (let i = 0; i < 5; i++) {
      const px = (i % 3 - 1) * s * 0.34 + (i > 2 ? s * 0.12 : 0)
      const py = -Math.floor(i / 3) * s * 0.34
      ctx.fillStyle = color
      ctx.beginPath(); ctx.ellipse(px, py, s * 0.2, s * 0.17, 0.3 * i, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.22)'
      ctx.beginPath(); ctx.ellipse(px - s * 0.06, py - s * 0.06, s * 0.06, s * 0.04, 0, 0, Math.PI * 2); ctx.fill()
    }
  } else if (type === 'liquid') {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, s * 0.15, s * 0.85, s * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * s * 0.28
      ctx.beginPath(); ctx.ellipse(px, -s * 0.1 - Math.sin(t * 5 + i) * 2, s * 0.08, s * 0.16, 0.2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    ctx.beginPath(); ctx.ellipse(-s * 0.28, s * 0.08, s * 0.2, s * 0.04, 0, 0, Math.PI * 2); ctx.fill()
  } else if (type === 'ghost') {
    ctx.fillStyle = 'rgba(210,225,255,.5)'
    ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.55, s * 0.3, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(0, -s * 0.48, s * 0.35, s * 0.22, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.42)'
    ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.62, s * 0.16, s * 0.1, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(0, -s * 0.4, s * 0.7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
  } else if (type === 'rainbow') {
    // three stacked pastel rings, highlighter energy
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#ff2bd6', '#ffe800', '#00f0ff'][i]
      ctx.beginPath()
      ctx.ellipse(0, -s * 0.12 - i * s * 0.24, s * (0.62 - i * 0.13), s * (0.3 - i * 0.03), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke()
    }
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.65, s * 0.1, s * 0.05, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    // soft serve / log / spicy / corn / gold / giant share the swirl body
    shadow(0, s * 0.55)
    const layers = type === 'giant' ? 4 : 3
    for (let i = layers - 1; i >= 0; i--) {
      const w = s * (0.72 - i * 0.13)
      const h = s * (0.3 - i * 0.025)
      const yy = -i * s * 0.23
      const grad = ctx.createLinearGradient(-w, yy - h, w, yy + h)
      grad.addColorStop(0, color)
      grad.addColorStop(0.55, type === 'spicy' ? '#ff7a3a' : (type === 'gold' ? '#fff2a1' : color))
      grad.addColorStop(1, 'rgba(0,0,0,.55)')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.ellipse(0, yy, w, h, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.lineWidth = 1; ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.26)'
      ctx.beginPath(); ctx.ellipse(-w * 0.34, yy - h * 0.36, w * 0.22, h * 0.2, -0.4, 0, Math.PI * 2); ctx.fill()
    }
    // swirl tip
    ctx.fillStyle = type === 'spicy' ? '#ff9a4a' : color
    ctx.beginPath(); ctx.ellipse(s * 0.04, -layers * s * 0.23, s * 0.22, s * 0.1, -0.25, 0, Math.PI * 2); ctx.fill()
    if (type === 'corn') {
      ctx.fillStyle = '#ffe24a'
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.arc((i - 2) * s * 0.17, -s * 0.12 - (i % 2) * s * 0.2, s * 0.045, 0, Math.PI * 2); ctx.fill()
      }
    }
    if (type === 'spicy') {
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1
        ctx.fillStyle = 'rgba(255,120,50,.55)'
        ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.4, -s * 0.8 + Math.sin(a) * s * 0.2, s * 0.05, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  if (opts.label) {
    const label = String(opts.label)
    ctx.font = `${Math.max(6, Math.round(s * 0.3))}px "Silkscreen", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width
    const ly = type === 'pellet' ? -s * 0.8 : -s * 0.9 - 4
    ctx.fillStyle = 'rgba(0,0,0,.78)'
    ctx.fillRect(-tw / 2 - 2, ly - 4, tw + 4, 9)
    ctx.fillStyle = opts.labelColor || '#fff'
    ctx.fillText(label, 0, ly + 1)
  }
  if (opts.stink && s > 8) {
    ctx.strokeStyle = 'rgba(190,220,190,.28)'
    ctx.lineWidth = 1
    for (let i = 0; i < 2; i++) {
      ctx.beginPath()
      ctx.moveTo(-s * 0.2 + i * s * 0.4, -s * 1.1)
      ctx.bezierCurveTo(-s * 0.1 + i * s * 0.4, -s * 1.3, -s * 0.3 + i * s * 0.4, -s * 1.45, -s * 0.15 + i * s * 0.4, -s * 1.6)
      ctx.stroke()
    }
  }
  ctx.restore()
}
