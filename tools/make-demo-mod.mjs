#!/usr/bin/env node
/**
 * Generates a little 4-channel ProTracker MOD for the demo / test suite.
 * Pure oldskool: square bass, arpeggiated chords, wobbly lead, drum samples
 * synthesised from first principles at 8363 Hz.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dir, '../assets/demo/dj-rat-severe-groove.mod')
const SR = 8363
const ROWS = 64
const CHANNELS = 4

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const env = (p, power = 1) => Math.pow(Math.max(0, 1 - p), power)

function sample(seconds, fn) {
  const n = Math.max(128, Math.round(seconds * SR))
  const out = new Int8Array(n)
  for (let i = 0; i < n; i++) out[i] = clamp(Math.round(fn(i / SR, i / n) * 127), -128, 127)
  return out
}
const noise = (() => { let s = 0x1234567; return () => (s = (s * 1103515245 + 12345) >>> 0) / 0xffffffff * 2 - 1 })()

// A tiny 1-pole high-pass for hats
function hp(xs, a = 0.92) { let prev = 0, y = 0; return xs.map(x => { y = a * (y + x - prev); prev = x; return y }) }

const samples = []
function addSample(name, data, volume = 64, loop = null) {
  samples.push({ name, data, volume, loop })
}

// 1 kick: pitch-swept sine + click
addSample('kick_but_angry', sample(0.22, (t, p) => {
  const f = 150 * Math.pow(0.22, t / 0.22) + 38
  return Math.sin(2 * Math.PI * f * t) * env(p, 1.7) + (p < 0.012 ? noise() * 0.5 : 0)
}), 64)

// 2 snare: noisy betrayal
addSample('snare_of_betrayal', sample(0.2, (t, p) => {
  return (noise() * 0.8 + Math.sin(2 * Math.PI * 185 * t) * 0.45) * env(p, 2.2)
}), 58)

// 3 hat
const hatN = sample(0.06, () => noise())
addSample('hat_tiny', Int8Array.from(hp(Array.from(hatN)).map(v => v * 0.8)), 42)
// 4 open hat
const ohatN = sample(0.24, () => noise())
addSample('hat_long', Int8Array.from(hp(Array.from(ohatN), 0.95).map(v => v * 0.8)), 38)
// 5 square bass, one C2 cycle looped
addSample('bass_c2', sample(128 / SR, (t) => ((Math.sin(2 * Math.PI * 65.406 * t) > 0 ? 1 : -1) * 0.6)), 60, { start: 0, len: 128 })
// 6 pulse lead C4, looped
addSample('lead_25pct', sample(32 / SR, (t) => ((t * 261.63) % 1 < 0.25 ? 1 : -1) * 0.5), 55, { start: 0, len: 32 })
// 7 pluck C4 (short decay), for arps
addSample('pluck_ouch', sample(0.3, (t, p) => (Math.sin(2 * Math.PI * 261.63 * t) * 0.5 + Math.sin(2 * Math.PI * 523.25 * t) * 0.22) * env(p, 3)), 52)
// 8 pad C3, looped, detuned
addSample('pad_mild_dread', sample(64 / SR, (t) => {
  const a = Math.sin(2 * Math.PI * 130.81 * t)
  const b = Math.sin(2 * Math.PI * 130.81 * 1.006 * t)
  return (a + b) * 0.28
}), 44, { start: 0, len: 64 })
// 9 tom
addSample('tom_regret', sample(0.25, (t, p) => Math.sin(2 * Math.PI * (110 * Math.pow(0.4, p)) * t) * env(p, 2)), 50)
// 10 crash
addSample('crash_final', sample(0.7, (t, p) => (noise() * 0.7 + Math.sin(2 * Math.PI * 90 * t) * 0.2) * env(p, 3)), 45)
// 11 zap
addSample('zap_lol', sample(0.18, (t, p) => (Math.sin(2 * Math.PI * (1800 * Math.pow(0.04, p)) * t) * 0.5) * env(p, 1.2)), 48)
// 12 choir-ish formant
addSample('choir_of_one', sample(0.5, (t, p) => {
  const f = 220
  return (Math.sin(2 * Math.PI * f * t) * 0.35 + Math.sin(2 * Math.PI * f * 2 * t) * 0.15 + Math.sin(2 * Math.PI * f * 3 * t) * 0.08) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5 * t)) * env(p, 1.5)
}), 40)
// 13 reverse cymbal-ish riser
addSample('riser_suspense', sample(0.55, (t, p) => noise() * p * 0.55), 35)
// 14 cowbell of doom
addSample('cowbell_doom', sample(0.25, (t, p) => (Math.sin(2 * Math.PI * 540 * t) + Math.sin(2 * Math.PI * 800 * t)) * 0.28 * env(p, 2)), 42)
// 15 vinyl crackle loop
addSample('vinyl_crackle', sample(128 / SR, () => (Math.random() < 0.01 ? 0.8 : noise() * 0.05)), 14, { start: 0, len: 128 })
// pad out to 31 slots
while (samples.length < 31) addSample('', new Int8Array(0))

// ---- music helpers -------------------------------------------------------
const PERIOD = n => Math.round(428 * Math.pow(2, -n / 12)) // n = semitones from C-3
const NOTE = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 }
const n = (name, oct) => NOTE[name] + (oct - 3) * 12

const patterns = Array.from({ length: 8 }, () => Array.from({ length: ROWS }, () => Array.from({ length: CHANNELS }, () => ({ smp: 0, per: 0, fx: 0, par: 0 }))))
function put(p, row, ch, smp, period, fx = 0, par = 0) {
  if (row < 0 || row >= ROWS) return
  patterns[p][row][ch] = { smp, per: period, fx, par }
}
function note(p, row, ch, smp, semitone, vol = 64) {
  put(p, row, ch, smp, PERIOD(semitone), 0xC, Math.min(64, vol))
}
function fx(p, row, ch, eff, param) { put(p, row, ch, 0, 0, eff, param) }
const cut = (p, row, ch, ticks = 0) => fx(p, row, ch, 0xE, 0xC0 | (ticks & 0xf))

// chord tones in semitones relative to C-3 (for arps)
const CHORDS = {
  Am: [n('A', 2), n('C', 3), n('E', 3), n('A', 3)],
  F:  [n('F', 2), n('A', 2), n('C', 3), n('F', 3)],
  C:  [n('C', 3), n('E', 3), n('G', 3), n('C', 4)],
  G:  [n('G', 2), n('B', 2), n('D', 3), n('G', 3)],
  Em: [n('E', 2), n('G', 2), n('B', 2), n('E', 3)],
  Fmaj7: [n('F', 2), n('A', 2), n('C', 3), n('E', 3)],
  G7: [n('G', 2), n('B', 2), n('D', 3), n('F', 3)],
  A7: [n('A', 2), n('Cs', 3), n('E', 3), n('G', 3)],
}
const BASSROOT = { Am: n('A', 1), F: n('F', 1), C: n('C', 2), G: n('G', 1), Em: n('E', 1), Fmaj7: n('F', 1), G7: n('G', 1), A7: n('A', 1) }

const progression = ['Am', 'F', 'C', 'G']

function drums(p, { four = true, fill = false, intro = 0 } = {}) {
  for (let r = intro; r < ROWS; r++) {
    if (four && r % 4 === 0) note(p, r, 0, 1, 0, 62)
    if (r % 8 === 4) note(p, r, 0, 2, 0, 56)
    if (r % 2 === 0) note(p, r, 0, 3, 0, r % 4 === 0 ? 34 : 46)
    if (r % 16 === 14) note(p, r, 0, 4, 0, 40)
    if (r === 0) note(p, r, 0, 10, 0, 46)
    if (fill && r >= ROWS - 8 && r % 2 === 0) note(p, r, 0, 9, 0, 44 + (r % 4) * 3)
  }
}

function bassline(p, chord, { at = 0, len = 16, rowStep = 4, octave = 0, smp = 5 } = {}) {
  const root = BASSROOT[chord]
  const seq = [0, 0, 7, 12, 0, 7, 0, 5]
  for (let r = 0, i = 0; r < len; r += rowStep, i++) {
    note(p, at + r, 1, smp, root + octave + seq[i % seq.length], i % 2 ? 52 : 60)
  }
}

function arp(p, chord, { at = 0, len = 16, step = 1, vol = 44, smp = 7, pattern = [0, 1, 2, 3] } = {}) {
  const tones = CHORDS[chord]
  for (let r = 0; r < len; r += step) {
    note(p, at + r, 2, smp, tones[pattern[Math.floor(r / step) % pattern.length]], vol)
  }
}

function lead(p, melody, vol = 56) {
  for (const [row, semi, len = 2, v = vol] of melody) {
    note(p, row, 3, 6, semi, v)
    if (len > 1) cut(p, row + len - 1, 3, 0)
  }
}

// ---- actual songs --------------------------------------------------------
// 0 intro: pad + bass, drums creep in
for (let i = 0; i < 4; i++) {
  const ch = progression[i]
  const at = i * 16
  const tones = CHORDS[ch]
  for (let r = 0; r < 16; r += 4) {
    note(0, at + r, 2, 8, tones[(r / 4) % 3], 34)
    note(0, at + r, 1, 5, BASSROOT[ch], 48)
  }
  if (i >= 2) for (let r = 0; r < 16; r += 2) note(0, at + r, 0, 3, 0, 36)
}
drums(0, { four: true, intro: 48 })
lead(0, [[32, n('E', 4), 3, 40], [36, n('D', 4), 3, 38], [40, n('C', 4), 4, 38], [48, n('B', 3), 6, 36], [56, n('A', 3), 8, 36]], 42)

// 1 main
drums(1)
for (let i = 0; i < 4; i++) {
  const ch = progression[i]
  const at = i * 16
  bassline(1, ch, { at, len: 16, rowStep: 4 })
  arp(1, ch, { at, len: 16, step: 1, vol: 42 + i * 2 })
}
lead(1, [
  [0, n('E', 4), 4], [4, n('A', 4), 4], [8, n('C', 5), 2], [10, n('B', 4), 2], [12, n('A', 4), 4],
  [16, n('F', 4), 4], [20, n('A', 4), 2], [22, n('C', 5), 2], [24, n('F', 5), 4], [28, n('E', 5), 4],
  [32, n('E', 4), 4], [36, n('G', 4), 4], [40, n('C', 5), 4], [44, n('B', 4), 4],
  [48, n('D', 4), 4], [52, n('G', 4), 4], [56, n('B', 4), 4], [60, n('D', 5), 4],
])

// 2 variation with fills and a ZAP
drums(2, { fill: true })
for (let i = 0; i < 4; i++) {
  const ch = progression[i]
  const at = i * 16
  bassline(2, ch, { at, len: 16, rowStep: i === 3 ? 2 : 4 })
  arp(2, ch, { at, len: 16, step: 1, vol: 46 })
}
lead(2, [
  [0, n('A', 5), 2], [2, n('G', 5), 2], [4, n('E', 5), 4], [8, n('C', 5), 4], [12, n('A', 4), 4],
  [16, n('C', 6), 2], [18, n('A', 5), 2], [20, n('F', 5), 4], [24, n('C', 5), 4], [28, n('A', 4), 4],
  [32, n('G', 5), 2], [34, n('E', 5), 2], [36, n('C', 5), 4], [40, n('E', 5), 4], [44, n('G', 5), 4],
  [48, n('D', 6), 2], [50, n('B', 5), 2], [52, n('G', 5), 4], [56, n('D', 5), 4], [60, n('B', 4), 4],
])
note(2, 60, 3, 11, n('A', 5), 50)
fx(2, 61, 3, 0xE, 0xC4)

// 3 breakdown: no drums, pad + choir + wandering lead
for (let i = 0; i < 4; i++) {
  const ch = progression[i]
  const at = i * 16
  const tones = CHORDS[ch]
  for (let r = 0; r < 16; r += 8) {
    note(3, at + r, 2, 8, tones[(r / 8) % 3], 40)
    note(3, at + r, 1, 12, BASSROOT[ch], 36)
  }
}
arp(3, 'Am', { at: 0, len: 64, step: 4, smp: 7, vol: 30 })
lead(3, [[0, n('A', 4), 8, 40], [8, n('C', 5), 8, 38], [16, n('E', 5), 12, 38], [32, n('F', 5), 8, 38], [40, n('E', 5), 8, 36], [48, n('D', 5), 16, 34]])
note(3, 56, 3, 12, n('C', 5), 34)

// 4 chorus, key lift-ish F G Am
drums(4)
const chorus = ['F', 'G', 'Am', 'Am']
for (let i = 0; i < 4; i++) {
  const ch = chorus[i]
  const at = i * 16
  for (let r = 0; r < 16; r += 4) {
    const root = BASSROOT[ch] + 12
    note(4, at + r, 1, 5, root + (r % 8 ? 7 : 0), 62)
  }
  const tones = CHORDS[ch]
  for (let r = 0; r < 16; r += 1) {
    const t = tones[[0, 1, 2, 3, 2, 1][r % 6]]
    note(4, at + r, 2, 7, t, 38)
  }
}
lead(4, [
  [0, n('C', 5), 2], [2, n('C', 5), 2], [4, n('F', 5), 4], [8, n('A', 5), 4], [12, n('G', 5), 4],
  [16, n('B', 5), 2], [18, n('B', 5), 2], [20, n('G', 5), 4], [24, n('D', 6), 4], [28, n('B', 5), 4],
  [32, n('C', 6), 4], [36, n('A', 5), 4], [40, n('E', 5), 4], [44, n('G', 5), 4],
  [48, n('A', 5), 4], [52, n('C', 6), 4], [56, n('B', 5), 4], [60, n('A', 5), 4],
])

// 5 chorus variation: lead octave up, more cowbell
drums(5, { fill: true })
for (let i = 0; i < 4; i++) {
  const ch = chorus[i]
  const at = i * 16
  for (let r = 0; r < 16; r += 2) note(5, at + r, 1, 5, BASSROOT[ch] + 12 + ((r / 2) % 2 ? 12 : 0), 58)
  const tones = CHORDS[ch]
  for (let r = 0; r < 16; r += 1) note(5, at + r, 2, 7, tones[[0, 1, 2, 3][r % 4]], 42)
  if (i % 2 === 1) for (let r = 0; r < 16; r += 8) note(5, at + r + 4, 0, 14, 0, 30)
}
lead(5, [
  [0, n('F', 5), 2], [2, n('A', 5), 2], [4, n('C', 6), 4], [8, n('F', 6), 2], [10, n('E', 6), 2], [12, n('C', 6), 4],
  [16, n('G', 5), 2], [18, n('B', 5), 2], [20, n('D', 6), 4], [24, n('G', 6), 4], [28, n('D', 6), 4],
  [32, n('E', 6), 4], [36, n('C', 6), 4], [40, n('A', 5), 4], [44, n('C', 6), 4],
  [48, n('B', 5), 4], [52, n('A', 5), 4], [56, n('E', 5), 8],
])

// 6 cursed jazz bridge: Fmaj7 / G7 / Em7 / A7, half-time
for (let r = 0; r < 8; r++) note(6, r, 0, 1, 0, 58)
for (let r = 8; r < 64; r += 8) note(6, r, 0, 2, 0, 48)
const jazz = [
  { ch: 'Fmaj7', at: 0 }, { ch: 'G7', at: 16 }, { ch: 'Em', at: 32 }, { ch: 'A7', at: 48 },
]
for (const { ch, at } of jazz) {
  const tones = CHORDS[ch] || CHORDS.Em
  for (let r = 0; r < 16; r += 4) {
    note(6, at + r, 2, 8, tones[0], 32)
    note(6, at + r, 1, 5, BASSROOT[ch], 44)
  }
  for (let r = 0; r < 16; r += 1) {
    note(6, at + r, 3, 7, tones[[0, 1, 2, 3, 2, 1][r % 6]], 36)
  }
}
note(6, 8, 0, 14, 0, 22); note(6, 40, 0, 14, 0, 22)
fx(6, 60, 0, 0xE, 0xCC)

// 7 outro: one final chord, delay-ish repeats
note(7, 0, 0, 1, 0, 60)
note(7, 0, 1, 5, BASSROOT.Am, 56)
for (let r = 0; r < 16; r += 4) note(7, r, 2, 8, CHORDS.Am[(r / 4) % 3], 40)
lead(7, [[0, n('A', 4), 8, 46], [8, n('C', 5), 8, 42], [16, n('E', 5), 8, 40], [24, n('A', 5), 16, 38], [40, n('E', 5), 8, 32]])
for (let r = 16; r < 64; r += 8) note(7, r, 3, 12, n('A', 4), 24)

// ---- binary writer -------------------------------------------------------
const u8 = v => [v & 0xff]
const u16be = v => [(v >> 8) & 0xff, v & 0xff]
const str = (s, len) => { const b = Buffer.alloc(len); b.write(s, 0, 'ascii'); return b }
const words = byteLen => Math.ceil(byteLen / 2)

const parts = []
parts.push(str('dj rat severe groove', 20))
for (const s of samples) {
  parts.push(str(s.name, 22))
  parts.push(Buffer.from([...u16be(words(s.data.length)), 0, s.volume]))
  if (s.loop) {
    parts.push(Buffer.from([...u16be(words(s.loop.start)), ...u16be(words(s.loop.len))]))
  } else {
    parts.push(Buffer.from([...u16be(0), ...u16be(1)]))
  }
}
const orders = [0, 1, 1, 2, 3, 4, 4, 5, 6, 7]
// order list is written separately below (tailHead)

// MOD cell: byte 0/1 = sample hi nibble + 12-bit period, byte 2 = sample low
// nibble + effect, byte 3 = parameter.
const patternParts = []
for (const pat of patterns) {
  for (const row of pat) {
    for (const c of row) {
      patternParts.push(Buffer.from([
        ((c.smp & 0xf0) | ((c.per >> 8) & 0x0f)),
        (c.per & 0xff),
        (((c.smp & 0x0f) << 4) | (c.fx & 0x0f)),
        c.par & 0xff,
      ]))
    }
  }
}

const songLen = 1 + 31 * 30 + 2 + 128
const head = Buffer.concat(parts) // title + sample headers
const tailHead = Buffer.from([orders.length, 127, ...Array.from({ length: 128 }, (_, i) => orders[i] ?? 0), 0x4d, 0x2e, 0x4b, 0x2e]) // M.K.
const out = Buffer.concat([head, tailHead, ...patternParts, ...samples.map(s => {
  const d = Buffer.from(s.data)
  return d.length % 2 ? Buffer.concat([d, Buffer.alloc(1)]) : d
})])
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, out)
console.log(`wrote ${OUT} (${(out.length / 1024).toFixed(1)} KiB, ${patterns.length} patterns, ${orders.length} orders)`)
