/**
 * Tracker module model + playback analysis.
 *
 * The worklet gives us exact pattern bytes and the live order/row. This module
 * turns that into notes, channels, chords, a key and a look-ahead/look-behind
 * timeline. No audio decoding happens here.
 */
import {
  detectChord, detectKey, keyCandidates, romanNumeral, rawNoteName, rawToMidi, rowDuration,
  pcName, keyName,
} from './theory.js'

export const CHANNEL_COLORS = [
  '#ff2bd6', '#00f0ff', '#ffe800', '#7dff5a', '#ff7a1a', '#b388ff',
  '#ff5a5a', '#5affd1', '#ffa8f0', '#c6ff4a', '#66aaff', '#ffcf99',
  '#e0e0e0', '#c86bff', '#00c46a', '#ff9e1b',
]
export const channelColor = i => CHANNEL_COLORS[((i % CHANNEL_COLORS.length) + CHANNEL_COLORS.length) % CHANNEL_COLORS.length]

const DRUM_RE = /kick|snare|hi.?hat|open.?hat|(^|[_\s-])hat($|[_\s-])|crash|ride|cym|(^|[_\s-])tom($|[_\s-])|clap|cowbell|perc|shaker|tamb|(^|[_\s-])bd($|[_\s-])|(^|[_\s-])sd($|[_\s-])|drum/i
const KICK_RE = /kick|\bbd\b|bass.?drum|boom/i
const SNARE_RE = /snare|\bsd\b|clap|rim/i
const HAT_RE = /hat|\bhh\b|\boh\b|shaker|tamb/i
const CRASH_RE = /crash|ride|cym/i
const TOM_RE = /tom|conga|bongo/i

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const safeStr = (s, fallback = '') => (typeof s === 'string' ? s : fallback)
const cleanTitle = s => safeStr(s).replace(/\s+/g, ' ').trim()

export function classifyChannel(info, overallMedian = null) {
  if ((info.drumShare || 0) > 0.5 && (info.noteCount || 0) >= 4) return 'drums'
  if (!info.noteCount) return 'aux'
  const m = Number.isFinite(info.medianMidi) ? info.medianMidi : 60
  if (Number.isFinite(overallMedian)) {
    if (m < overallMedian - 3) return 'bass'
    if (m > overallMedian + 3) return 'lead'
    return 'chord'
  }
  if (m < 48) return 'bass'
  if (m > 66) return 'lead'
  return 'chord'
}

/** Build a compact, fast model from chiptune3's metadata song dump. */
export function buildSongModel(meta = {}) {
  const song = meta.song || {}
  const rawPatterns = Array.isArray(song.patterns) ? song.patterns : []
  const channelCount = Math.max(
    1,
    (song.channels || []).length,
    rawPatterns.reduce((m, p) => Math.max(m, (p.rows?.[0] || []).length), 0),
  )
  const patterns = rawPatterns.map((p, pi) => {
    const rows = Array.isArray(p.rows) ? p.rows : []
    const ch = Math.max(channelCount, rows.reduce((m, r) => Math.max(m, r.length), 0))
    const n = Math.max(1, rows.length)
    const notes = new Int16Array(n * ch)
    const insts = new Uint8Array(n * ch)
    const vols = new Uint8Array(n * ch)
    const effs = new Uint8Array(n * ch)
    const pars = new Uint8Array(n * ch)
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || []
      for (let c = 0; c < ch; c++) {
        const cell = row[c]
        if (!cell) continue
        const k = r * ch + c
        notes[k] = cell[0] | 0
        insts[k] = cell[1] | 0
        vols[k] = cell[4] | 0
        effs[k] = cell[3] | 0
        pars[k] = cell[5] | 0
      }
    }
    return {
      index: pi, name: cleanTitle(p.name), rowCount: n, channelCount: ch,
      notes, insts, vols, effs, pars,
    }
  })
  if (!patterns.length) {
    patterns.push({
      index: 0, name: '', rowCount: 1, channelCount,
      notes: new Int16Array(channelCount), insts: new Uint8Array(channelCount),
      vols: new Uint8Array(channelCount), effs: new Uint8Array(channelCount),
      pars: new Uint8Array(channelCount),
    })
  }

  const instNames = []
  for (let i = 0; i < Math.max((song.instruments || []).length, (song.samples || []).length, 1); i++) {
    const name = cleanTitle((song.instruments || [])[i]) || cleanTitle((song.samples || [])[i]) || ''
    instNames.push(name)
  }
  const instName = n => instNames[(n - 1 + instNames.length) % Math.max(1, instNames.length)] || ''

  const orderDefs = (song.orders || []).map((o, i) => {
    const pat = o?.pat
    const skip = !Number.isFinite(pat) || pat < 0 || pat >= patterns.length
    return { index: i, pattern: skip ? 0 : pat, skip, name: cleanTitle(o?.name) }
  })
  if (!orderDefs.length) orderDefs.push({ index: 0, pattern: 0, skip: false, name: '' })

  // channel statistics
  const channelStats = Array.from({ length: channelCount }, (_, c) => ({
    index: c, notes: [], insts: new Set(), drumHits: 0, noteCount: 0,
  }))
  for (const p of patterns) {
    for (let r = 0; r < p.rowCount; r++) {
      for (let c = 0; c < channelCount; c++) {
        const k = r * p.channelCount + c
        const note = p.notes[k]
        if (!(note >= 1 && note <= 120)) continue
        const st = channelStats[c]
        st.noteCount++
        st.notes.push(rawToMidi(note))
        if (p.insts[k]) {
          st.insts.add(p.insts[k])
          if (DRUM_RE.test(instName(p.insts[k]))) st.drumHits++
        }
      }
    }
  }
  const medians = channelStats.map(st => {
    if (!st.notes.length) return null
    const s = st.notes.slice().sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  })
  const nonDrumMedians = medians.filter((m, i) => m !== null && !(channelStats[i].drumHits / Math.max(1, channelStats[i].noteCount) > 0.35))
  const overallMedian = nonDrumMedians.length
    ? nonDrumMedians.slice().sort((a, b) => a - b)[Math.floor(nonDrumMedians.length / 2)]
    : null

  const channels = channelStats.map((st, c) => {
    const drumShare = st.noteCount ? st.drumHits / st.noteCount : 0
    const medianMidi = medians[c]
    const role = classifyChannel({ medianMidi: medianMidi ?? 60, drumShare, noteCount: st.noteCount }, overallMedian)
    const names = [...st.insts].map(instName).filter(Boolean)
    return {
      index: c,
      name: cleanTitle((song.channels || [])[c]) || `CH ${String(c + 1).padStart(2, '0')}`,
      color: channelColor(c),
      role,
      medianMidi,
      noteCount: st.noteCount,
      drumShare,
      instNames: names,
      vu: 0,
      voice: null,
    }
  })

  const title = cleanTitle(meta.title) || 'Untitled (a cry for help)'
  let artist = cleanTitle(meta.artist || meta.author) || 'unknown entity'
  if (artist === 'unknown entity' && /dj rat/i.test(title)) artist = 'DJ Rat'
  const format = (cleanTitle(meta.type).split(' ')[0] || 'MOD').toUpperCase()
  const noteRange = {
    min: Math.min(...medians.filter(Number.isFinite), 48),
    max: Math.max(...medians.filter(Number.isFinite), 72),
  }

  const model = {
    title, artist, format,
    tracker: cleanTitle(meta.tracker) || 'unknown tracker',
    message: cleanTitle(meta.message),
    duration: Number(meta.dur) || 0,
    channels, instNames, instName,
    orders: orderDefs, patterns,
    rowsPerBeat: Math.max(1, Number(meta.rowsPerBeat) || 4),
    rowsPerMeasure: Math.max(1, Number(meta.rowsPerMeasure) || 16),
    noteRange,
    totalOrders: orderDefs.length,
    totalPatterns: patterns.length,
    maxChannels: channelCount,
    sampleNames: (song.samples || []).map(s => cleanTitle(s)),
    subsongs: Array.isArray(meta.songs) ? meta.songs.slice() : [],
    cell(pat, row, ch) {
      const p = patterns[pat]
      if (!p) return null
      if (row < 0 || row >= p.rowCount || ch < 0 || ch >= p.channelCount) return null
      const k = row * p.channelCount + ch
      const note = p.notes[k]
      if (!note && !p.insts[k] && !p.vols[k] && !p.effs[k] && !p.pars[k]) return null
      return {
        note, inst: p.insts[k], vol: p.vols[k] || 64,
        eff: p.effs[k], par: p.pars[k],
      }
    },
    rowCells(pat, row) {
      const p = patterns[pat]
      if (!p) return []
      const out = []
      for (let c = 0; c < p.channelCount; c++) out.push(model.cell(pat, row, c))
      return out
    },
    orderPattern(order) {
      const o = orderDefs[((order % orderDefs.length) + orderDefs.length) % orderDefs.length]
      return o && !o.skip ? o.pattern : null
    },
  }
  return model
}

function noteKind(role, instName) {
  if (KICK_RE.test(instName)) return 'kick'
  if (SNARE_RE.test(instName)) return 'snare'
  if (HAT_RE.test(instName)) return 'hat'
  if (CRASH_RE.test(instName)) return 'crash'
  if (TOM_RE.test(instName)) return 'tom'
  if (role === 'drums') return 'drum'
  if (role === 'bass') return 'bass'
  if (role === 'lead') return 'lead'
  if (role === 'chord') return 'chord'
  return 'note'
}

/**
 * Live analysis. Call update() whenever the worklet reports a new order/row.
 * Everything is timestamped in performance.now()/1000 seconds.
 */
export class TrackerAnalysis {
  constructor(model, opts = {}) {
    this.model = model
    this.chordWindow = opts.chordWindow ?? 1.35
    this.keyHalfLife = opts.keyHalfLife ?? 9
    this.channels = model.channels.map(ch => ({ ...ch, voice: null, vu: 0, peak: 0, lastVu: 0 }))
    this.notes = []
    this.recent = []
    this.events = []
    this.keyHist = new Float32Array(12)
    this.chordRootHist = new Float32Array(12)
    this.chordHistory = []
    this.firstChord = null
    this.key = { tonic: 0, mode: 'major', confidence: 0 }
    this.chord = null
    this.roman = ''
    this.lastChordName = ''
    this.lastKeyAt = -10
    this.lastKeyChordName = ''
    this.lastChordAt = -10
    this.lastChordEventAt = -10
    this.lastUpdate = 0
    this.lastOrder = -1
    this.lastRow = -1
    this.lastPattern = -1
    this.lastPos = 0
    this.started = false
    this.section = 0
    this.noteSeq = 0
    this.lastNoteAt = -10
    this.silence = false
    this.silenceSince = 0
    this.dissonance = 0
    this.noteRate = 0
    this.recentTimes = []
    this.vuRms = 0
    this.flats = false
    this.rowsSeen = 0
  }

  reset(now = 0) {
    this.started = false
    this.lastOrder = -1
    this.lastRow = -1
    this.lastPattern = -1
    this.lastUpdate = now
    this.channels.forEach(ch => { ch.voice = null; ch.vu = 0; ch.peak = 0 })
    this.recent = []
    this.notes = []
    this.keyHist.fill(0)
    this.chordRootHist.fill(0)
    this.chord = null
    this.roman = ''
    this.lastChordName = ''
    this.key = { tonic: 0, mode: 'major', confidence: 0 }
    this.events.length = 0
  }

  _closeVoice(ch, at, addEvent = false) {
    const v = ch.voice
    if (!v) return
    const note = this.notes.find(n => n.id === v.id)
    if (note) note.end = Math.max(note.start, at)
    ch.voice = null
    if (addEvent) this.events.push({ type: 'note-off', channel: ch.index, midi: v.midi, at })
  }

  _releaseAll(at) {
    for (const ch of this.channels) this._closeVoice(ch, at)
  }

  _voiceFor(ch, cell, at) {
    const raw = cell.note
    const midi = rawToMidi(raw)
    if (midi === null) return null
    const inst = cell.inst || ch.voice?.inst || 0
    const instName = inst ? this.model.instName(inst) : (ch.voice?.instName || '')
    const name = rawNoteName(raw)
    const vel = cell.vol || 64
    const id = ++this.noteSeq
    const kind = noteKind(ch.role, instName)
    return {
      id, channel: ch.index, role: ch.role, midi, rawNote: raw, name,
      pc: midi % 12, inst, instName, vel, start: at, end: null,
      kind, color: ch.color,
    }
  }

  _processRow(order, row, pattern, at) {
    const p = this.model.patterns[pattern]
    if (!p) return
    const cells = []
    for (let c = 0; c < this.channels.length; c++) {
      const cell = this.model.cell(pattern, row, c)
      if (!cell) continue
      const ch = this.channels[c]
      if (!ch) continue
      if (cell.note >= 1 && cell.note <= 120) {
        this._closeVoice(ch, at)
        const voice = this._voiceFor(ch, cell, at)
        if (!voice) continue
        ch.voice = voice
        this.notes.push(voice)
        if (voice.role !== 'drums') {
          const rw = voice.role === 'bass' ? 1.7 : voice.role === 'chord' ? 1.25 : voice.role === 'lead' ? 0.38 : 0.8
          this.recent.push({ pc: voice.pc, time: at, weight: rw * (0.75 + voice.vel / 64), midi: voice.midi, channel: c, role: voice.role })
          this.keyHist[voice.pc] += rw * 1.15
        }
        this.events.push({ ...voice, type: 'note', at })
        this.lastNoteAt = at
        this.recentTimes.push(at)
        cells.push(voice)
      } else if (cell.note > 120) {
        this._closeVoice(ch, at, true)
        ch.voice = null
      } else if (ch.voice && cell.vol) {
        ch.voice.vel = cell.vol
      }
    }
    this.rowsSeen++
    this.notes = this.notes.slice(-700)
    return cells
  }

  _bestKey(hist) {
    const cands = keyCandidates(hist)
    if (!cands.length) return detectKey(hist)
    const majorScale = [0, 2, 4, 5, 7, 9, 11]
    const minorScale = [0, 2, 3, 5, 7, 8, 10]
    const majorQual = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
    const minorQual = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj']
    const kindOf = suffix => {
      if (!suffix) return 'maj'
      if (suffix.includes('dim') || suffix === 'm7b5') return 'dim'
      if (suffix === 'aug' || suffix === 'aug7') return 'aug'
      if (suffix.startsWith('m')) return 'min'
      return 'maj'
    }
    const firstMinor = this.firstChord?.suffix && (this.firstChord.suffix === 'm' || this.firstChord.suffix.startsWith('m') || this.firstChord.suffix.includes('dim'))
    const recent = this.chordHistory.slice(-8)
    for (const c of cands) {
      const scale = c.mode === 'minor' ? minorScale : majorScale
      const qual = c.mode === 'minor' ? minorQual : majorQual
      let chordScore = 0
      for (const ch of recent) {
        const rel = (ch.root - c.tonic + 12) % 12
        const deg = scale.indexOf(rel)
        if (deg < 0) { chordScore -= 0.9; continue }
        const kind = kindOf(ch.suffix)
        if (kind === qual[deg]) chordScore += 1
        else if (c.mode === 'minor' && deg === 4 && kind === 'maj') chordScore += 0.75
        else if (c.mode === 'minor' && deg === 3 && kind === 'maj') chordScore += 0.25
        else if (c.mode === 'major' && deg === 4 && kind === 'min') chordScore += 0.15
        else chordScore += 0.05
      }
      if (recent.length) chordScore /= recent.length
      let total = c.corr * 1.35 + chordScore * 1.25
      if (this.firstChord) {
        if (c.tonic === this.firstChord.root && (c.mode === 'minor') === !!firstMinor) total += 0.42
        else if (firstMinor && c.mode === 'major' && c.tonic === (this.firstChord.root + 3) % 12) total += 0.04
      }
      c.keyScore = total
    }
    cands.sort((a, b) => b.keyScore - a.keyScore)
    const best = cands[0], second = cands[1]
    return {
      tonic: best.tonic,
      mode: best.mode,
      confidence: clamp((best.keyScore - (second?.keyScore ?? 0)) * 0.45 + 0.3, 0.05, 0.92),
    }
  }

  /**
   * Harmony for the current measure, read from pattern data (look-ahead is
   * allowed). This is much more stable than trying to infer chords from
   * passing lead notes in a 1-second onset window.
   */
  _measureChord(pattern, row) {
    const p = this.model.patterns[pattern]
    if (!p) return null
    const size = this.model.rowsPerMeasure || 16
    const start = Math.max(0, Math.floor(row / size) * size)
    const end = Math.min(p.rowCount, start + size)
    const collect = (from, to, gain) => {
      const w = new Array(12).fill(0)
      let harmony = 0, bassMidi = null, bassPc = null
      for (let r = from; r < to; r++) {
        for (let c = 0; c < p.channelCount; c++) {
          const ch = this.model.channels[c]
          if (ch?.role === 'drums') continue
          const cell = this.model.cell(pattern, r, c)
          if (!cell || !(cell.note >= 1 && cell.note <= 120)) continue
          const midi = rawToMidi(cell.note)
          const wgt = (ch?.role === 'bass' ? 2.2 : ch?.role === 'chord' ? 1.6 : ch?.role === 'lead' ? 0.16 : 0.7) * gain
          w[midi % 12] += wgt
          harmony++
          if (bassMidi === null || midi < bassMidi) { bassMidi = midi; bassPc = midi % 12 }
        }
      }
      return { w, harmony, bassPc }
    }
    const cur = collect(start, end, 1)
    if (!cur.harmony) return null
    let weights = cur.w
    let bassPc = cur.bassPc
    const distinct = weights.filter(v => v > 0).length
    if (distinct < 3 && start > 0) {
      const prev = collect(Math.max(0, start - size), start, 0.38)
      if (prev.harmony) {
        weights = weights.map((v, i) => v + prev.w[i])
        if (prev.bassPc !== null) bassPc = prev.bassPc
      }
    }
    const chord = detectChord(weights, { bassPc, flats: this.flats })
    return chord
  }

  _bassPc() {
    let lowest = null
    for (const ch of this.channels) {
      const v = ch.voice
      if (!v) continue
      if (!lowest || v.midi < lowest.midi) lowest = v
    }
    if (lowest) return { pc: lowest.pc, midi: lowest.midi }
    return null
  }

  _currentWeights(now) {
    const w = new Array(12).fill(0)
    for (const r of this.recent) {
      const age = now - r.time
      if (age > this.chordWindow) continue
      w[r.pc] += r.weight * Math.exp(-age / 0.72)
    }
    for (const ch of this.channels) {
      const v = ch.voice
      if (!v || now - v.start < 0.25) continue
      // sustained voices keep the harmony alive even after the onset window
      const rw = v.role === 'bass' ? 0.5 : v.role === 'chord' ? 0.42 : v.role === 'lead' ? 0.12 : 0.25
      w[v.pc] += rw * (v.vel / 64) * (ch.vu > 0.02 ? 1.25 : 0.7)
    }
    return w
  }

  update(state, now = performance.now() / 1000) {
    if (!state) return
    const order = Number.isFinite(state.order) ? state.order : 0
    const row = Number.isFinite(state.row) ? state.row : 0
    const pattern = Number.isFinite(state.pattern) ? state.pattern : 0
    const speed = Number(state.speed) || 6
    const tempo = Number(state.tempo) || 125
    const pos = Number(state.pos) || 0
    const dt = clamp(now - (this.lastUpdate || now), 0, 0.4)
    this.lastUpdate = now

    // decay key histogram
    const decay = Math.pow(0.5, dt / this.keyHalfLife)
    for (let i = 0; i < 12; i++) {
      this.keyHist[i] *= decay
      this.chordRootHist[i] *= Math.pow(0.5, dt / 14)
    }

    const vu = Array.isArray(state.vu) ? state.vu : []
    let vuSum = 0
    for (let i = 0; i < this.channels.length; i++) {
      const ch = this.channels[i]
      const v = Number(vu[i]) || 0
      ch.vu = clamp(v, 0, 1.6)
      ch.peak = Math.max(ch.peak * 0.92, ch.vu)
      vuSum += ch.vu
    }
    this.vuRms = this.channels.length ? vuSum / this.channels.length : 0

    let sectionChanged = false
    if (!this.started) {
      this.started = true
      this.lastOrder = order
      this.lastRow = row
      this.lastPattern = pattern
      this.lastPos = pos
      this._processRow(order, row, pattern, now)
    } else if (order !== this.lastOrder) {
      const jump = Math.abs(order - this.lastOrder) > 1 || pos < this.lastPos - 0.25 || pos > this.lastPos + 2
      if (jump || order < this.lastOrder) this._releaseAll(now)
      else this._releaseAll(now)
      this.lastOrder = order
      this.lastRow = row
      this.lastPattern = pattern
      this.lastPos = pos
      this.section++
      sectionChanged = true
      this.events.push({ type: 'section', order, row, pattern, at: now, section: this.section })
      this._processRow(order, row, pattern, now)
    } else if (row !== this.lastRow) {
      // normal forward movement; walk skipped rows so fast modules don't lose notes
      const diff = row - this.lastRow
      if (diff > 0 && diff <= 4) {
        for (let r = this.lastRow + 1; r <= row; r++) this._processRow(order, r, pattern, now)
      } else if (diff < 0 && this.lastRow - row > 4) {
        // pattern wrapped inside one order; restart cleanly
        this._releaseAll(now)
        this._processRow(order, row, pattern, now)
      } else {
        this._processRow(order, row, pattern, now)
      }
      this.lastRow = row
      this.lastPattern = pattern
      this.lastPos = pos
    } else {
      this.lastPattern = pattern
      this.lastPos = pos
    }

    // prune recent notes
    this.recent = this.recent.filter(r => now - r.time < this.chordWindow + 0.3)
    this.recentTimes = this.recentTimes.filter(t => now - t < 3)

    // note rate
    this.noteRate = this.recentTimes.length / 3

    // silence detection
    const active = this.channels.some(c => c.voice)
    if (!active && vuSum < 0.02) {
      if (!this.silence) { this.silenceSince = now; this.silence = true }
      if (now - this.silenceSince > 1.2) this.events.push({ type: 'silence', at: now })
    } else this.silence = false

    // chord, throttled
    if (now - this.lastChordAt > 0.07) {
      this.lastChordAt = now
      const bass = this._bassPc()
      const weights = this._currentWeights(now)
      const measureChord = this._measureChord(pattern, row)
      const chord = (measureChord && measureChord.confidence > 0.22) ? measureChord : detectChord(weights, { bassPc: bass?.pc ?? null, flats: this.flats })
      this.chord = chord
      if (chord) {
        this.roman = romanNumeral(chord, this.key.tonic, this.key.mode)
        if (chord.name !== this.lastChordName && now - this.lastChordEventAt > 0.4 && chord.confidence > 0.25) {
          this.lastChordName = chord.name
          this.lastChordEventAt = now
          this.chordRootHist[chord.root] += 2
          this.events.push({ type: 'chord', chord, roman: this.roman, at: now })
          if (!this.firstChord) this.firstChord = { root: chord.root, suffix: chord.suffix }
          this.chordHistory.push({ root: chord.root, suffix: chord.suffix, at: now })
          if (this.chordHistory.length > 16) this.chordHistory.shift()
        }
      }
    }

    // key, throttled and smoothed
    if (now - this.lastKeyAt > 1.1 || (this.chord && this.chord.name !== this.lastKeyChordName)) {
      this.lastKeyAt = now
      this.lastKeyChordName = this.chord?.name || ''
      const kh = new Array(12)
      for (let i = 0; i < 12; i++) kh[i] = this.keyHist[i] + this.chordRootHist[i] * 1.8
      const k = this._bestKey(kh)
      if (k.confidence > 0.03) {
        // Relative major/minor is genuinely ambiguous from pitch classes alone.
        // The current chord and its bass disambiguate it (Am chord => A minor).
        let tonic = k.tonic, mode = k.mode
        let bestRoot = 0, bestRootVal = 0, rootSum = 0
        for (let i = 0; i < 12; i++) { rootSum += this.chordRootHist[i]; if (this.chordRootHist[i] > bestRootVal) { bestRootVal = this.chordRootHist[i]; bestRoot = i } }
        if (this.chord && rootSum > 0.5 && bestRootVal > rootSum * 0.45 && this.chord.root === bestRoot) {
          const relativeMajor = (bestRoot + 3) % 12
          const isMinorChord = this.chord.suffix === 'm' || this.chord.suffix === 'm7' || this.chord.suffix === 'm9' || this.chord.suffix === 'm6' || this.chord.suffix === 'madd9'
          if (mode === 'major' && k.tonic === relativeMajor && isMinorChord) { tonic = bestRoot; mode = 'minor' }
          else if (mode === 'major' && k.tonic === bestRoot && isMinorChord) mode = 'minor'
          else if (mode === 'minor' && k.tonic === bestRoot && !isMinorChord && this.chord.suffix) mode = 'major'
          else if (mode === 'minor' && k.tonic === relativeMajor && !isMinorChord && this.chord.suffix) { tonic = relativeMajor; mode = 'major' }
        }
        const conf = Math.max(k.confidence, tonic === k.tonic ? 0 : 0.38)
        this.key = { tonic, mode, confidence: conf }
        this.flats = [1, 3, 5, 8, 10].includes(tonic)
        // re-evaluate the current chord spelling/enharmonic name
        if (this.chord) {
          this.chord = this._measureChord(pattern, row) || detectChord(this._currentWeights(now), { bassPc: this._bassPc()?.pc ?? null, flats: this.flats }) || this.chord
          this.roman = romanNumeral(this.chord, tonic, mode)
        }
      }
    }

    // roughness / dissonance estimate from active pitch classes
    const pcs = [...new Set(this.channels.filter(c => c.voice).map(c => c.voice.pc))]
    let rough = 0, pairs = 0
    for (let i = 0; i < pcs.length; i++) for (let j = i + 1; j < pcs.length; j++) {
      const d = Math.abs(pcs[i] - pcs[j]) % 12
      const interval = Math.min(d, 12 - d)
      rough += interval === 1 ? 1 : interval === 2 ? 0.45 : interval === 6 ? 0.8 : 0
      pairs++
    }
    this.dissonance = pairs ? clamp(rough / pairs, 0, 1) : 0

    if (sectionChanged) {
      // a section is a good moment to refresh the key from recent chords
      this.lastKeyAt = now - 0.9
    }
  }

  drainEvents() {
    const out = this.events
    this.events = []
    return out
  }

  getChord() { return this.chord }
  getRoman() { return this.roman }
  getKey() { return this.key }
  getKeyName() { return keyName(this.key, this.flats) }
  getPitchClasses() { return this._currentWeights(this.lastUpdate || 0) }

  getPianoNotes(seconds = 8) {
    const now = this.lastUpdate || 0
    return this.notes.filter(n => (n.end ?? now) > now - seconds && n.start < now + 0.05)
  }

  getActiveNotes() {
    return this.channels.map(c => c.voice).filter(Boolean)
  }

  getChannelStates() {
    return this.channels.map(ch => ({
      index: ch.index, name: ch.name, role: ch.role, color: ch.color,
      vu: ch.vu, peak: ch.peak, voice: ch.voice,
      note: ch.voice ? rawNoteName(ch.voice.rawNote) : '',
    }))
  }

  getStats() {
    const active = this.getActiveNotes()
    const voices = this.channels.map(c => c.voice).filter(Boolean)
    const midis = voices.map(v => v.midi)
    return {
      polyphony: active.length,
      noteRate: this.noteRate,
      dissonance: this.dissonance,
      low: midis.length ? Math.min(...midis) : null,
      high: midis.length ? Math.max(...midis) : null,
      spread: midis.length ? Math.max(...midis) - Math.min(...midis) : 0,
      sections: this.section,
      silence: this.silence,
      vuRms: this.vuRms,
    }
  }
}

/**
 * Project future rows from the current playhead without touching the audio
 * engine. Used for look-ahead piano roll, next-chord HUD and gag scheduling.
 */
export function lookAhead(model, state, count = 32, opts = {}) {
  const out = []
  if (!model || !state) return out
  const speed = Number(state.speed) || 6
  const tempo = Number(state.tempo) || 125
  const rowDur = Number(opts.rowDuration) || rowDuration(speed, tempo)
  let order = Number(state.order) || 0
  let row = Number(state.row) || 0
  let pattern = Number.isFinite(state.pattern) ? state.pattern : model.orderPattern(order)
  let t = 0
  for (let i = 0; i < count; i++) {
    out.push({ order, row, pattern, at: t, delta: rowDur })
    t += rowDur
    row++
    const p = model.patterns[pattern]
    const rows = p ? p.rowCount : model.rowsPerMeasure
    if (row >= rows) {
      row = 0
      order = (order + 1) % model.orders.length
      const next = model.orderPattern(order)
      if (next === null) {
        // skip to the next playable order
        let guard = 0
        do { order = (order + 1) % model.orders.length } while (model.orderPattern(order) === null && ++guard < model.orders.length)
      }
      pattern = model.orderPattern(order) ?? pattern
    }
    const pNext = model.patterns[pattern]
    if (pNext && row >= pNext.rowCount) {
      row = 0
      order = (order + 1) % model.orders.length
      pattern = model.orderPattern(order) ?? pattern
    }
  }
  return out
}

/** Group future rows into bar-ish chunks and name the chords. */
export function previewChords(model, state, bars = 4) {
  if (!model) return []
  const rowsPerMeasure = model.rowsPerMeasure || 16
  const rows = lookAhead(model, state, rowsPerMeasure * bars + 1)
  const chunks = []
  let current = null
  for (const r of rows) {
    if (r.row % rowsPerMeasure === 0 || !current) {
      if (current) chunks.push(current)
      current = { at: r.at, order: r.order, row: r.row, weights: new Array(12).fill(0), notes: [] }
    }
    const p = model.patterns[r.pattern]
    if (!p) continue
    let harmony = 0
    for (let c = 0; c < p.channelCount; c++) {
      const ch = model.channels[c]
      if (ch?.role === 'drums' || ch?.role === 'lead') continue
      const cell = model.cell(r.pattern, r.row, c)
      if (!cell || !(cell.note >= 1 && cell.note <= 120)) continue
      const midi = rawToMidi(cell.note)
      const wgt = ch?.role === 'bass' ? 2 : ch?.role === 'chord' ? 1.5 : 0.8
      current.weights[midi % 12] += wgt
      current.notes.push({ midi, pc: midi % 12, channel: c, at: r.at })
      harmony++
    }
    // A bare melody channel only becomes harmony when nothing else is playing.
    if (!harmony) {
      for (let c = 0; c < p.channelCount; c++) {
        if (model.channels[c]?.role !== 'lead') continue
        const cell = model.cell(r.pattern, r.row, c)
        if (!cell || !(cell.note >= 1 && cell.note <= 120)) continue
        const midi = rawToMidi(cell.note)
        current.weights[midi % 12] += 0.6
        current.notes.push({ midi, pc: midi % 12, channel: c, at: r.at })
      }
    }
  }
  if (current) chunks.push(current)
  return chunks.slice(0, bars).map(ch => {
    const bass = ch.notes.length ? ch.notes.reduce((a, b) => a.midi < b.midi ? a : b) : null
    const chord = detectChord(ch.weights, { bassPc: bass?.pc ?? null })
    return { ...ch, chord, name: chord?.name || '' }
  })
}
