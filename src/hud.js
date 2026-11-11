import {
  pcName, rawNoteName, rowDuration, romanNumeral, keyName, rawToMidi,
} from './theory.js'
import { poopTypeForChord, POOP_TYPES } from './poop.js'

const ROLE_LABEL = {
  drums: 'DRUMS', bass: 'BASS', chord: 'CHORDS', lead: 'LEAD', aux: 'AUX',
}
const QUALITY = {
  '': 'MAJOR', m: 'MINOR', dim: 'DIMINISHED', aug: 'AUGMENTED',
  sus2: 'SUS2', sus4: 'SUS4', '5': 'POWER', '6': 'SIXTH', m6: 'MINOR 6',
  '7': 'DOMINANT 7', maj7: 'MAJOR 7', m7: 'MINOR 7', m7b5: 'HALF-DIM',
  dim7: 'DIMINISHED 7', aug7: 'AUGMENTED 7', '9': 'NINTH', maj9: 'MAJOR 9',
  m9: 'MINOR 9', add9: 'ADD9', madd9: 'MINOR ADD9', '7sus4': 'SUS 7',
  '11': 'ELEVENTH', m11: 'MINOR 11', '13': 'THIRTEENTH', '6/9': 'SIX-NINE',
}
const QUALITY_SHORT = {
  '': 'MAJ', m: 'MIN', dim: 'DIM', aug: 'AUG', sus2: 'SUS2', sus4: 'SUS4',
  '5': 'PWR', '6': '6', m6: 'm6', '7': '7', maj7: 'maj7', m7: 'm7',
  m7b5: 'm7b5', dim7: 'dim7', aug7: 'aug7', '9': '9', maj9: 'maj9', m9: 'm9',
  add9: 'add9', madd9: 'madd9', '7sus4': '7sus4', '11': '11', m11: 'm11',
  '13': '13', '6/9': '6/9',
}
const fmtTime = s => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export class HUD {
  constructor() {
    this.el = {
      trackTitle: document.getElementById('track-title'),
      trackSub: document.getElementById('track-sub'),
      meters: document.getElementById('meters'),
      chordName: document.getElementById('chord-name'),
      chordRoman: document.getElementById('chord-roman'),
      chordQuality: document.getElementById('chord-quality'),
      chordNotes: document.getElementById('chord-notes'),
      chordConf: document.getElementById('chord-conf'),
      chordBass: document.getElementById('chord-bass'),
      keyName: document.getElementById('key-name'),
      keyName2: document.getElementById('key-name-2'),
      romanName: document.getElementById('roman-name'),
      nextChords: document.getElementById('next-chords'),
      forecast: document.getElementById('forecast'),
      statPoly: document.getElementById('stat-poly'),
      statRate: document.getElementById('stat-rate'),
      statSpice: document.getElementById('stat-spice'),
      statRange: document.getElementById('stat-range'),
      statSection: document.getElementById('stat-section'),
      time: document.getElementById('time'),
      seek: document.getElementById('seek'),
      seekFill: document.getElementById('seek-fill'),
      bpm: document.getElementById('bpm'),
      patternLabel: document.getElementById('pattern-label'),
      orderLabel: document.getElementById('order-label'),
      rowLabel: document.getElementById('row-label'),
      rollRange: document.getElementById('roll-range'),
      live: document.getElementById('live'),
      hud: document.getElementById('hud'),
      sceneName: document.getElementById('scene-name'),
      genreName: document.getElementById('genre-name'),
      bcChord: document.getElementById('bc-chord'),
      bcRoman: document.getElementById('bc-roman'),
      bcKey: document.getElementById('bc-key'),
      bcNotes: document.getElementById('bc-notes'),
      bcNext: document.getElementById('bc-next'),
      bcChannels: document.getElementById('bc-channels'),
    }
    this.roll = document.getElementById('roll')
    this.grid = document.getElementById('grid')
    this.wheel = document.getElementById('wheel')
    this.rollCtx = this.roll.getContext('2d')
    this.gridCtx = this.grid.getContext('2d')
    this.wheelCtx = this.wheel.getContext('2d')
    this.model = null
    this.meters = []
    this.bcMeters = []
    this.sceneName = 'DEMOSCENE PLAZA'
    this.genreName = 'CHIPTUNE'
    this.lastDom = 0
    this.lastForecast = ''
    this.lastLive = 0
    this.rangeMin = 48
    this.rangeMax = 72
    this.lastNow = 0
    this.frames = 0
    this.spectrum = null
  }

  setModel(model) {
    this.model = model
    if (!model) return
    this.el.trackTitle.textContent = model.title
    this.el.trackSub.textContent = `${model.artist} · ${model.format} · ${model.tracker} · ${model.usedChannels || model.channels.filter(c => c.noteCount).length}ch`
    this.el.meters.textContent = ''
    this.meters = model.channels.map((ch, i) => {
      const row = document.createElement('div')
      row.className = 'meter'
      row.style.setProperty('--ch', ch.color)
      const num = document.createElement('span'); num.className = 'ch'; num.textContent = String(i + 1).padStart(2, '0')
      const role = document.createElement('span'); role.className = 'role'; role.textContent = ROLE_LABEL[ch.role] || ch.role.toUpperCase()
      const bar = document.createElement('span'); bar.className = 'bar'
      const fill = document.createElement('i')
      bar.appendChild(fill)
      const note = document.createElement('span'); note.className = 'note'; note.textContent = '—'
      row.append(num, role, bar, note)
      this.el.meters.appendChild(row)
      return { row, fill, note, role, ch }
    })
    this.el.rollRange.textContent = `${model.rowsPerMeasure || 16} ROWS/BAR`
    this.el.live.textContent = `Loaded ${model.title} by ${model.artist}.`
    this.el.bcChannels.textContent = ''
    this.bcMeters = model.channels.slice(0, 14).map(ch => {
      const el = document.createElement('span')
      el.className = 'bc-led'
      el.style.setProperty('--ch', ch.color)
      el.title = `CH ${ch.index + 1} ${ch.role}`
      const fill = document.createElement('i')
      el.appendChild(fill)
      this.el.bcChannels.appendChild(el)
      return { el, fill, ch }
    })
    this.setScene(this.sceneName, this.genreName)
  }

  setScene(name, genre) {
    this.sceneName = name || this.sceneName
    this.genreName = genre || this.genreName
    if (this.el.sceneName) this.el.sceneName.textContent = this.sceneName
    if (this.el.genreName) this.el.genreName.textContent = this.genreName
  }

  _fit(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    const cw = Number.isFinite(rect.width) ? rect.width : 1
    const ch = Number.isFinite(rect.height) ? rect.height : 1
    const w = Math.max(1, Math.round(cw * dpr))
    const h = Math.max(1, Math.round(ch * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { w: cw, h: ch, dpr }
  }

  update(data) {
    const { model, analysis, state, stats, chord, key, roman, preview, lookahead, duration, now } = data || {}
    if (!model || !analysis) return
    this.model = model
    this.lastNow = now
    this.frames++
    if (now - this.lastDom > 0.05) {
      this.lastDom = now
      this.updateDom(data)
    }
    const showRoll = !this.el.hud.classList.contains('hud-hidden')
    if (!showRoll) return
    this.drawRoll(data)
    this.drawGrid(data)
    if (this.frames % 2 === 0) this.drawWheel(data)
  }

  updateDom(data) {
    const { model, analysis, state, stats, chord, key, roman, preview, duration, playing, paused, now } = data
    if (!state) return
    const pos = state.pos || 0
    const dur = duration || 0
    const pct = dur ? clamp(pos / dur, 0, 1) : 0
    this.el.time.textContent = `${fmtTime(pos)} / ${fmtTime(dur)}`
    this.el.seek.value = String(Math.round(pct * 1000))
    this.el.seekFill.style.width = `${pct * 100}%`
    this.el.bpm.textContent = `${Math.round(state.tempo || 125)} BPM · SPD ${state.speed || 6}`
    this.el.patternLabel.textContent = `PAT ${String(state.pattern ?? 0).padStart(2, '0')}`
    this.el.orderLabel.textContent = `ORDER ${String((state.order ?? 0) + 1).padStart(2, '0')}/${String(model.totalOrders).padStart(2, '0')}`
    this.el.rowLabel.textContent = `ROW ${String(state.row ?? 0).padStart(2, '0')}`

    const channels = analysis.getChannelStates()
    for (let i = 0; i < this.meters.length; i++) {
      const m = this.meters[i], c = channels[i]
      if (!m || !c) continue
      const vu = clamp(c.vu / 1.15, 0, 1)
      m.fill.style.width = `${(vu * 100).toFixed(1)}%`
      m.note.textContent = c.note || '—'
      m.row.classList.toggle('active', !!c.voice)
    }

    const keyTxt = key && key.confidence > 0.02 ? keyName(key, analysis.flats) : 'detecting…'
    const bcChord = chord?.name || '???'
    this.el.bcChord.textContent = bcChord
    this.el.bcRoman.textContent = roman || '—'
    this.el.bcKey.textContent = `KEY ${keyTxt}`
    this.el.bcNotes.textContent = chord ? chord.pitchClasses.map(pc => pcName(pc, chord.flats)).join(' ') : '—'
    const next = (preview || [])[1]
    this.el.bcNext.textContent = next?.name ? `NEXT ${next.name} · ${POOP_TYPES[poopTypeForChord(next.chord)].label}` : 'NEXT —'
    const bcs = analysis.getChannelStates()
    for (let i = 0; i < this.bcMeters.length; i++) {
      const m = this.bcMeters[i], c = bcs[i]
      if (!m || !c) continue
      m.fill.style.height = `${clamp(c.vu / 1.1, 0, 1) * 96 + 4}%`
      m.el.classList.toggle('active', !!c.voice)
    }

    if (chord) {
      this.el.chordName.textContent = chord.name
      this.el.chordRoman.textContent = roman || '—'
      this.el.chordQuality.textContent = `${QUALITY[chord.suffix] || chord.suffix.toUpperCase()}${chord.inversion ? ' · INVERSION' : ''}`
      const notes = chord.pitchClasses.map(pc => pcName(pc, chord.flats)).join('  ')
      this.el.chordNotes.textContent = notes + (chord.intervals.length ? `   (${chord.intervals.map(i => i === 0 ? '1' : i).join('·')})` : '')
      this.el.chordConf.textContent = `${Math.round(chord.confidence * 100)}% SURE`
      const bass = analysis.channels.map(c => c.voice).filter(Boolean).sort((a, b) => a.midi - b.midi)[0]
      this.el.chordBass.textContent = `BASS ${bass ? bass.name : '—'}`
    } else {
      this.el.chordName.textContent = '???'
      this.el.chordRoman.textContent = '—'
      this.el.chordQuality.textContent = 'WAITING FOR NOTES'
      this.el.chordNotes.textContent = 'drop a module, coward'
      this.el.chordConf.textContent = '—'
      this.el.chordBass.textContent = 'BASS —'
    }
    this.el.keyName.textContent = keyTxt
    this.el.keyName2.textContent = `KEY ${keyTxt}`
    this.el.romanName.textContent = roman || '—'
    this.el.statPoly.textContent = String(stats?.polyphony ?? 0)
    this.el.statRate.textContent = (stats?.noteRate ?? 0).toFixed(1)
    this.el.statSpice.textContent = `${Math.round((stats?.dissonance ?? 0) * 100)}%`
    this.el.statRange.textContent = stats?.low != null ? `${rawNoteName(stats.low - 11)}–${rawNoteName(stats.high - 11)}` : '—'
    this.el.statSection.textContent = String((stats?.sections ?? 0) + 1)

    const chips = []
    if (preview && preview.length) {
      for (const p of preview.slice(1, 4)) {
        if (!p?.name) continue
        const chip = document.createElement('span')
        chip.className = 'next-chip'
        chip.textContent = p.name + ' '
        const b = document.createElement('b')
        b.textContent = POOP_TYPES[poopTypeForChord(p.chord)].label
        chip.appendChild(b)
        chips.push(chip)
      }
    }
    if (chips.length) {
      this.el.nextChords.textContent = ''
      const label = document.createElement('span'); label.className = 'next-chip'; label.textContent = 'NEXT'
      this.el.nextChords.appendChild(label)
      chips.forEach(c => this.el.nextChords.appendChild(c))
    } else this.el.nextChords.textContent = ''

    // forecast, look-ahead
    const forecastKey = JSON.stringify((preview || []).map(p => p.name))
    if (forecastKey !== this.lastForecast) {
      this.lastForecast = forecastKey
      this.el.forecast.textContent = ''
      const current = { name: chord?.name || '—', chord }
      const list = [current, ...(preview || []).slice(1, 4)]
      list.forEach((p, i) => {
        if (i > 0 && !p?.name) return
        const type = poopTypeForChord(p.chord)
        const meta = POOP_TYPES[type]
        const row = document.createElement('div')
        row.className = `forecast-row${i === 0 ? ' now' : ''}`
        const icon = document.createElement('span')
        icon.className = `turd-icon ${meta.css}`
        icon.title = meta.blurb
        const chordEl = document.createElement('span'); chordEl.className = 'fc-chord'; chordEl.textContent = p.name || 'N.C.'
        const typeEl = document.createElement('span'); typeEl.className = 'fc-type'; typeEl.textContent = i === 0 ? `now · ${meta.label}` : meta.label
        row.append(icon, chordEl, typeEl)
        this.el.forecast.appendChild(row)
      })
    }

    if (now - this.lastLive > 3.5) {
      this.lastLive = now
      const keyTxt2 = key && key.confidence > 0.02 ? keyName(key, analysis.flats) : 'key unknown'
      this.el.live.textContent = chord ? `Now: ${chord.name}, ${roman || ''}. Key: ${keyTxt2}. ${Math.round(stats?.noteRate || 0)} notes per second.` : `Key: ${keyTxt2}.`
    }
  }

  drawRoll(data) {
    const { w, h } = this._fit(this.roll)
    if (!(w > 10 && h > 10)) return
    const ctx = this.rollCtx
    const now = data.now
    const model = data.model
    const state = data.state || {}
    const analysis = data.analysis
    const lookahead = data.lookahead || []
    const pastSeconds = 4.2
    const futureSeconds = 4.4
    const playX = w * 0.58
    const padL = 26
    const padR = 8
    const padT = 9
    const padB = 15

    // receipt / toilet-paper paper
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#efe6cf')
    g.addColorStop(1, '#d8cdb2')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // perforation
    ctx.fillStyle = 'rgba(70,55,35,.16)'
    for (let x = 4; x < w; x += 13) {
      ctx.beginPath(); ctx.arc(x, 2, 1.3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x, h - 2, 1.3, 0, Math.PI * 2); ctx.fill()
    }
    // faint grid
    ctx.strokeStyle = 'rgba(55,45,30,.16)'
    ctx.lineWidth = 1
    const rowDur = rowDuration(state.speed || 6, state.tempo || 125)
    const beat = rowDur * (model.rowsPerBeat || 4)
    const bar = rowDur * (model.rowsPerMeasure || 16)
    const tMin = -pastSeconds, tMax = futureSeconds
    const timeToX = t => padL + ((t - tMin) / (tMax - tMin)) * (w - padL - padR)
    for (let k = Math.ceil(tMin / beat); k * beat <= tMax; k++) {
      const x = timeToX(k * beat)
      const isBar = Math.abs((k * beat) % bar) < 0.001 || Math.abs((k * beat) % bar - bar) < 0.001
      ctx.strokeStyle = isBar ? 'rgba(30,30,50,.32)' : 'rgba(55,45,30,.13)'
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke()
    }
    for (let x = padL; x < w - padR; x += 18) {
      ctx.strokeStyle = 'rgba(55,45,30,.05)'
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke()
    }

    // notes
    const notes = []
    const nowPerf = now
    for (const n of analysis.getPianoNotes(pastSeconds + 0.5)) {
      const start = n.start - nowPerf
      let end = n.end == null ? 0 : n.end - nowPerf
      if (end < start) end = start + 0.05
      notes.push({ ...n, start, end, future: false })
    }
    for (const r of lookahead) {
      if (r.at <= 0.02) continue
      if (r.at > futureSeconds) continue
      const p = model.patterns[r.pattern]
      if (!p) continue
      for (let c = 0; c < p.channelCount; c++) {
        const cell = model.cell(r.pattern, r.row, c)
        if (!cell || !(cell.note >= 1 && cell.note <= 120)) continue
        const midi = rawToMidi(cell.note)
        notes.push({
          midi, name: rawNoteName(cell.note), channel: c, start: r.at,
          end: r.at + Math.min(0.7, r.delta * 2.5), color: model.channels[c]?.color || '#00f0ff',
          future: true, vel: cell.vol || 64,
        })
      }
    }
    let lo = 48, hi = 72
    if (notes.length) {
      lo = Math.min(...notes.map(n => n.midi)) - 3
      hi = Math.max(...notes.map(n => n.midi)) + 3
    }
    if (hi - lo < 26) { const mid = (lo + hi) / 2; lo = mid - 13; hi = mid + 13 }
    lo = clamp(lo, 12, 96); hi = clamp(hi, lo + 12, 120)
    this.rangeMin += (lo - this.rangeMin) * 0.12
    this.rangeMax += (hi - this.rangeMax) * 0.12
    const yFor = midi => padT + (1 - (midi - this.rangeMin) / (this.rangeMax - this.rangeMin)) * (h - padT - padB)

    // pitch lanes + labels
    ctx.font = '9px "Silkscreen", monospace'
    ctx.textBaseline = 'middle'
    for (let m = Math.ceil(this.rangeMin / 12) * 12; m <= this.rangeMax; m += 12) {
      const y = yFor(m)
      ctx.strokeStyle = 'rgba(30,40,60,.2)'
      ctx.beginPath(); ctx.moveTo(padL, y + 0.5); ctx.lineTo(w - padR, y + 0.5); ctx.stroke()
      ctx.fillStyle = 'rgba(30,35,50,.7)'
      ctx.fillText(rawNoteName(m - 11), 3, y)
    }

    // beat labels
    ctx.fillStyle = 'rgba(40,40,60,.55)'
    ctx.font = '7px "Silkscreen", monospace'
    for (let k = Math.ceil(tMin / bar); k * bar <= tMax; k++) {
      const x = timeToX(k * bar)
      if (x > padL && x < w - padR) ctx.fillText('BAR', x + 2, h - 5)
    }

    // playhead
    const px = timeToX(0)
    ctx.fillStyle = 'rgba(200,30,60,.8)'
    ctx.fillRect(px, padT, 2, h - padT - padB)
    ctx.fillStyle = 'rgba(230,220,200,.9)'
    ctx.fillRect(px - 3, padT, 8, 4)
    ctx.fillStyle = 'rgba(30,30,50,.55)'
    ctx.font = '7px "Silkscreen", monospace'
    ctx.fillText('NOW', px + 5, padT + 4)
    // past/future shading
    ctx.fillStyle = 'rgba(40,30,60,.045)'
    ctx.fillRect(px + 2, padT, w - padR - px - 2, h - padT - padB)

    const laneH = Math.max(2, (h - padT - padB) / Math.max(12, this.rangeMax - this.rangeMin))
    notes.sort((a, b) => a.future - b.future)
    for (const n of notes) {
      const x0 = timeToX(clamp(n.start, tMin, tMax))
      const x1 = timeToX(clamp(n.end, tMin, tMax))
      const y = yFor(n.midi)
      const bh = Math.max(2, Math.min(7, laneH - 0.5))
      ctx.globalAlpha = n.future ? 0.48 : (n.end >= 0 ? 1 : 0.72)
      ctx.fillStyle = n.color || '#00f0ff'
      ctx.fillRect(x0, y - bh / 2, Math.max(2, x1 - x0), bh)
      if (n.future) {
        ctx.strokeStyle = 'rgba(20,20,40,.55)'
        ctx.setLineDash([2, 2])
        ctx.strokeRect(x0 + 0.5, y - bh / 2 + 0.5, Math.max(1, x1 - x0), bh - 1)
        ctx.setLineDash([])
      } else if (n.end == null || n.end >= 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'
        ctx.strokeRect(x0 + 0.5, y - bh / 2 + 0.5, Math.max(1, x1 - x0), bh - 1)
      }
      if (x1 - x0 > 25 && laneH > 4) {
        ctx.globalAlpha = n.future ? 0.65 : 0.95
        ctx.fillStyle = 'rgba(16,16,28,.9)'
        ctx.font = '7px "Silkscreen", monospace'
        ctx.fillText(n.name, x0 + 2, y)
      }
    }
    ctx.globalAlpha = 1
    // edge tears
    ctx.fillStyle = 'rgba(0,0,0,.22)'
    for (let y = 3; y < h; y += 7) { ctx.fillRect(0, y, 2, 2); ctx.fillRect(w - 2, y + 3, 2, 2) }
  }

  drawGrid(data) {
    const { w, h } = this._fit(this.grid)
    if (!(w > 10 && h > 10)) return
    const ctx = this.gridCtx
    const model = data.model
    const state = data.state || {}
    const pat = model.patterns[state.pattern]
    ctx.fillStyle = '#0b0b14'
    ctx.fillRect(0, 0, w, h)
    if (!pat) {
      ctx.fillStyle = '#55556a'
      ctx.font = '9px "Silkscreen", monospace'
      ctx.fillText('NO PATTERN', 6, h / 2)
      return
    }
    const visibleRows = Math.max(8, Math.min(18, Math.floor((h - 12) / 7)))
    const half = Math.floor(visibleRows / 2)
    let start = Math.max(0, state.row - half)
    let rows = visibleRows
    if (start + rows > pat.rowCount) start = Math.max(0, pat.rowCount - rows)
    const channels = Math.min(model.channels.length, 8)
    const labelW = 18
    const cw = (w - labelW - 4) / Math.max(1, channels)
    const rh = (h - 10) / rows
    ctx.font = '7px "Silkscreen", monospace'
    for (let i = 0; i < rows; i++) {
      const r = start + i
      const y = 4 + i * rh
      const isPlay = r === state.row
      if (isPlay) { ctx.fillStyle = 'rgba(255,232,0,.14)'; ctx.fillRect(0, y, w, rh) }
      ctx.fillStyle = isPlay ? '#ffe800' : '#515168'
      ctx.fillText(String(r).padStart(2, '0'), 2, y + rh * 0.75)
      for (let c = 0; c < channels; c++) {
        const cell = model.cell(state.pattern, r, c)
        if (!cell || !(cell.note >= 1 && cell.note <= 120)) continue
        const color = model.channels[c]?.color || '#00f0ff'
        ctx.fillStyle = color
        const ny = y + Math.max(1, rh * 0.22)
        ctx.fillRect(labelW + c * cw + 1, ny, Math.max(2, cw - 2), Math.max(2, rh * 0.52))
      }
      if (isPlay) {
        ctx.fillStyle = 'rgba(255,43,214,.75)'
        ctx.fillRect(0, y + rh - 1, w, 1)
      }
    }
    // channel legend dots
    for (let c = 0; c < channels; c++) {
      ctx.fillStyle = model.channels[c]?.color || '#00f0ff'
      ctx.fillRect(labelW + c * cw + 1, 1, Math.max(2, cw - 2), 2)
    }
  }

  drawWheel(data) {
    const { w, h } = this._fit(this.wheel)
    const ctx = this.wheelCtx
    ctx.clearRect(0, 0, w, h)
    const cx = w / 2, cy = h / 2
    const r = Math.min(w, h) * 0.44
    const chord = data.chord
    const analysis = data.analysis
    const key = data.key
    const weights = analysis.getPitchClasses()
    const maxW = Math.max(0.001, ...weights)
    const flats = analysis.flats
    ctx.save()
    ctx.translate(cx, cy)
    for (let i = 0; i < 12; i++) {
      const a0 = -Math.PI / 2 + (i / 12) * Math.PI * 2
      const a1 = -Math.PI / 2 + ((i + 1) / 12) * Math.PI * 2
      const val = weights[i] / maxW
      const isChord = chord?.pitchClasses?.includes(i)
      const isRoot = chord?.root === i
      const isKey = key && ((i - key.tonic + 12) % 12) === 0
      ctx.beginPath()
      ctx.arc(0, 0, r, a0 + 0.02, a1 - 0.02)
      ctx.arc(0, 0, r * 0.64, a1 - 0.02, a0 + 0.02, true)
      ctx.closePath()
      ctx.fillStyle = isRoot ? 'rgba(255,232,0,.38)' : isChord ? 'rgba(255,43,214,.24)' : `rgba(0,240,255,${0.03 + val * 0.18})`
      ctx.fill()
      if (isChord) {
        ctx.strokeStyle = 'rgba(255,43,214,.65)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      if (isKey) {
        ctx.strokeStyle = 'rgba(255,232,0,.75)'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(0, 0, r + 2.5, a0, a1); ctx.stroke()
      }
      // spokes
      ctx.strokeStyle = 'rgba(0,240,255,.16)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * r * 0.62, Math.sin(a0) * r * 0.62); ctx.stroke()
      // labels
      const am = (a0 + a1) / 2
      ctx.fillStyle = isRoot ? '#ffe800' : isChord ? '#ff2bd6' : '#8b8ba4'
      ctx.font = '8px "Silkscreen", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(pcName(i, flats), Math.cos(am) * r * 0.8, Math.sin(am) * r * 0.8)
    }
    ctx.strokeStyle = 'rgba(0,240,255,.35)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#f2ecdd'
    ctx.font = '9px "Silkscreen", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(chord?.name || '—', 0, -4)
    ctx.fillStyle = key ? '#00f0ff' : '#55556a'
    ctx.font = '7px "Silkscreen", monospace'
    ctx.fillText(key && key.confidence > 0.02 ? keyName(key, flats).toUpperCase() : 'KEY ?', 0, 8)
    ctx.restore()
  }
}
