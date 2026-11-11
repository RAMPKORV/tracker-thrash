/**
 * Music theory for tracker modules: note spelling, chord recognition, key
 * finding and roman numerals. Deliberately dependency-free and fast enough to
 * run on every animation frame.
 */

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
export const PC_NAMES = SHARP

export function pcName(pc, flats = false) {
  const i = ((pc % 12) + 12) % 12
  return (flats ? FLAT : SHARP)[i]
}

/** libopenmpt raw note (1..120, C-0..B-9) -> tracker note name. */
export function rawNoteName(raw) {
  if (!Number.isFinite(raw) || raw < 1 || raw > 120) return ''
  const n = raw - 1
  return `${pcName(n % 12)}-${Math.floor(n / 12)}`
}

/** libopenmpt raw note -> MIDI number (scientific pitch, C4 = 60). */
export function rawToMidi(raw) {
  return Number.isFinite(raw) && raw >= 1 && raw <= 120 ? raw + 11 : null
}

export function midiToName(midi, flats = false) {
  if (!Number.isFinite(midi)) return ''
  return `${pcName(midi % 12, flats)}${Math.floor(midi / 12) - 1}`
}

/** Rows are 16th-ish; one tick is 2.5/BPM seconds. */
export function rowDuration(speed = 6, bpm = 125) {
  return (2.5 * Math.max(1, speed)) / Math.max(20, bpm)
}

// chord templates: suffix, semitone intervals from root, specificity rank
const TEMPLATES = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['5', [0, 7]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['m7b5', [0, 3, 6, 10]],
  ['dim7', [0, 3, 6, 9]],
  ['aug7', [0, 4, 8, 10]],
  ['9', [0, 4, 7, 10, 14]],
  ['maj9', [0, 4, 7, 11, 14]],
  ['m9', [0, 3, 7, 10, 14]],
  ['add9', [0, 4, 7, 14]],
  ['madd9', [0, 3, 7, 14]],
  ['7sus4', [0, 5, 7, 10]],
  ['11', [0, 4, 7, 10, 14, 17]],
  ['m11', [0, 3, 7, 10, 14, 17]],
  ['13', [0, 4, 7, 10, 14, 21]],
  ['6/9', [0, 4, 7, 9, 14]],
]

const isMinorish = s => s.startsWith('m') && s !== 'maj7' && s !== 'maj9' && s !== 'madd9'

/**
 * Chord recognition over a 12-element pitch-class salience array (or a Map).
 * Returns null when there is not enough evidence.
 */
export function detectChord(input, opts = {}) {
  const w = new Array(12).fill(0)
  if (Array.isArray(input)) {
    for (let i = 0; i < 12; i++) w[i] = Math.max(0, Number(input[i]) || 0)
  } else if (input && typeof input === 'object') {
    for (let i = 0; i < 12; i++) w[i] = Math.max(0, Number(input[i]) || 0)
  }
  const total = w.reduce((a, b) => a + b, 0)
  if (total <= 1e-6) return null
  const active = w.map((v, pc) => ({ pc, v })).filter(x => x.v / total > 0.03)
  if (active.length < 2) return null

  const bassPc = Number.isFinite(opts.bassPc) ? ((opts.bassPc % 12) + 12) % 12 : null
  let best = null

  for (let root = 0; root < 12; root++) {
    const rootShare = w[root] / total
    if (rootShare < 0.045) continue
    for (const [suffix, intervals] of TEMPLATES) {
      const tones = [...new Set(intervals.map(i => (root + i) % 12))]
      if (tones.length > active.length + 1) continue
      // Do not promote passing tones to extensions: an extension must actually
      // carry harmonic weight, not just be a one-row melody note.
      let ok = true
      const need = (semi, threshold) => {
        if (w[(root + semi) % 12] / total < threshold) ok = false
      }
      if (['add9', '9', 'maj9', 'm9', 'madd9'].includes(suffix)) need(14, 0.085)
      if (['11', 'm11'].includes(suffix)) need(17, 0.05)
      if (suffix === '13') need(21, 0.05)
      if (['6', 'm6', '6/9'].includes(suffix)) need(9, 0.07)
      if (suffix === 'sus2') need(2, 0.055)
      if (suffix === 'sus4') need(5, 0.055)
      if (['7', 'maj7', 'm7'].includes(suffix)) need(suffix === 'maj7' ? 11 : 10, 0.05)
      if (suffix === 'm7b5') { need(6, 0.05); need(10, 0.05) }
      if (suffix === 'dim7') need(9, 0.05)
      if (!ok) continue
      let covered = 0
      let missing = 0
      for (const pc of tones) {
        if (w[pc] / total > 0.025) covered += w[pc] / total
        else missing++
      }
      let outside = 0
      for (let pc = 0; pc < 12; pc++) if (!tones.includes(pc)) outside += w[pc] / total
      let score = covered
        - outside * 0.6
        - (missing / tones.length) * 0.62
        + rootShare * 0.11
        - Math.max(0, tones.length - 3) * 0.006
      if (missing > 1) score -= 0.18
      if (missing === 0) score += 0.035
      if (bassPc !== null) {
        if (bassPc === root) score += 0.08
        else if (tones.includes(bassPc)) score += 0.035
      }
      // Two notes are a "5" unless the third is genuinely implied.
      if (active.length === 2 && tones.length === 2) score += 0.06
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && root < best.root)) {
        best = { root, suffix, intervals: [...intervals], tones, score }
      }
    }
  }
  if (!best || best.score < 0.42) return null

  const flats = !!opts.flats
  const inversion = bassPc !== null && bassPc !== best.root && best.tones.includes(bassPc)
  const name = `${pcName(best.root, flats)}${best.suffix}${inversion ? `/${pcName(bassPc, flats)}` : ''}`
  const confidence = Math.max(0.05, Math.min(1, (best.score - 0.4) / 0.55))
  return {
    root: best.root,
    suffix: best.suffix,
    name,
    score: best.score,
    confidence,
    pitchClasses: best.tones,
    intervals: best.intervals,
    bassPc,
    inversion,
    flats,
  }
}

export function chordNotes(chord) {
  if (!chord) return []
  return chord.pitchClasses.map(pc => pcName(pc, chord.flats))
}

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function pearson(x, y) {
  const n = x.length
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i] }
  const mx = sx / n, my = sy / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my
    num += a * b; dx += a * a; dy += b * b
  }
  if (dx < 1e-12 || dy < 1e-12) return 0
  return num / Math.sqrt(dx * dy)
}

/** All 24 key candidates with their Krumhansl correlation. */
export function keyCandidates(input) {
  const h = new Array(12).fill(0)
  if (Array.isArray(input)) for (let i = 0; i < 12; i++) h[i] = Math.max(0, input[i] || 0)
  const total = h.reduce((a, b) => a + b, 0)
  if (total < 1e-6) return []
  const scores = []
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor']) {
      const profile = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE
      const rotated = new Array(12)
      for (let i = 0; i < 12; i++) rotated[i] = h[(tonic + i) % 12]
      scores.push({ tonic, mode, corr: pearson(rotated, profile) })
    }
  }
  return scores
}

/** Key finding over a pitch-class histogram (Krumhansl-Schmuckler). */
export function detectKey(input) {
  const h = new Array(12).fill(0)
  if (Array.isArray(input)) for (let i = 0; i < 12; i++) h[i] = Math.max(0, input[i] || 0)
  const total = h.reduce((a, b) => a + b, 0)
  if (total < 1e-6) return { tonic: 0, mode: 'major', confidence: 0 }
  const scores = keyCandidates(h).sort((a, b) => b.corr - a.corr)
  const best = scores[0], second = scores[1]
  const topShare = Math.max(...h) / total
  const confidence = Math.max(0, Math.min(1, (best.corr - second.corr) * 2.2 + topShare * 0.35 + 0.12))
  return { tonic: best.tonic, mode: best.mode, confidence }
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
// conventional spellings for chromatic roots, by semitone above the tonic
const CHROMATIC_MAJOR = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']
const CHROMATIC_MINOR = ['i', 'bII', 'ii', 'III', '#III', 'iv', '#IV', 'v', 'VI', '#VI', 'VII', '#VII']

/** Roman-numeral analysis of a recognised chord in a key. */
export function romanNumeral(chord, tonic = 0, mode = 'major') {
  if (!chord) return ''
  const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE
  const root = ((chord.root % 12) + 12) % 12
  const rel = (root - tonic + 12) % 12
  let numeral
  const exact = scale.indexOf(rel)
  if (exact >= 0) numeral = ROMAN[exact]
  else numeral = (mode === 'minor' ? CHROMATIC_MINOR : CHROMATIC_MAJOR)[rel]
  const accidental = numeral.match(/^[b#]/)?.[0] || ''
  let letters = numeral.slice(accidental.length)
  const suffix = chord.suffix || ''
  let tail = suffix
  if (suffix === 'dim') { letters = letters.toLowerCase(); tail = '°' }
  else if (suffix === 'dim7') { letters = letters.toLowerCase(); tail = '°7' }
  else if (suffix === 'm7b5') { letters = letters.toLowerCase(); tail = 'ø7' }
  else if (suffix === 'aug') { tail = '+' }
  else if (suffix === 'm') { letters = letters.toLowerCase(); tail = '' }
  else if (suffix === 'm6') { letters = letters.toLowerCase(); tail = '6' }
  else if (suffix === 'm7') { letters = letters.toLowerCase(); tail = '7' }
  else if (suffix === 'm9') { letters = letters.toLowerCase(); tail = '9' }
  else if (suffix === 'm11') { letters = letters.toLowerCase(); tail = '11' }
  else if (suffix === 'madd9') { letters = letters.toLowerCase(); tail = 'add9' }
  return accidental + letters + tail
}

export function keyName(key, flats = false) {
  if (!key) return ''
  return `${pcName(key.tonic, flats)} ${key.mode}`
}

/** Scale pitch classes for the key. */
export function keyScale(key) {
  if (!key) return []
  const scale = key.mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE
  return scale.map(d => (key.tonic + d) % 12)
}
