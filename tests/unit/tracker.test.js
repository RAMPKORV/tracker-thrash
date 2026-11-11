import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSongModel, TrackerAnalysis, classifyChannel, channelColor, lookAhead, previewChords } from '../../src/tracker.js'

const raw = (pc, oct) => 1 + oct * 12 + pc
const cell = (note = 0, inst = 0, vol = 64, eff = 0, par = 0) => [note, inst, 0, eff, vol, par]
const empty = () => cell(0, 0, 0, 0, 0)

function makeMeta() {
  const rows = Array.from({ length: 16 }, () => [empty(), empty(), empty(), empty()])
  const put = (r, c, ...args) => { rows[r][c] = cell(...args) }
  // drums on 0
  for (const r of [0, 4, 8, 12]) put(r, 0, raw(0, 4), 1, 60)
  put(2, 0, raw(0, 4), 2, 58) // snare
  put(6, 0, raw(0, 4), 3, 40) // hat
  // bass A on 1
  put(0, 1, raw(9, 1), 4, 62)
  put(8, 1, raw(9, 1), 4, 60)
  // arpeggio A C E A on 2
  const arp = [raw(9, 3), raw(0, 4), raw(4, 4), raw(9, 3)]
  for (let r = 0; r < 16; r++) put(r, 2, arp[r % 4], 7, 42)
  // lead E on 3
  put(0, 3, raw(4, 5), 6, 56)
  put(8, 3, raw(2, 5), 6, 50)
  // note cut on channel 2 at row 5 (after arp note)
  put(5, 2, 254, 0, 0, 0xE, 0xC0)

  return {
    title: 'Test Module', artist: 'unit test', type: 'mod', tracker: 'ProTracker',
    duration: 10,
    song: {
      channels: ['ch0', 'ch1', 'ch2', 'ch3'],
      instruments: [],
      samples: ['kick_but_angry', 'snare', 'hat', 'bass', 'pad', 'lead', 'arp'],
      orders: [{ name: '', pat: 0 }, { name: '', pat: 1 }, { name: '', pat: 255 }],
      patterns: [
        { name: '', rows },
        { name: '', rows: rows.map(r => r.map(c => c.slice())) },
      ],
      numSubsongs: 1,
    },
  }
}

test('buildSongModel normalizes patterns and channel roles', () => {
  const m = buildSongModel(makeMeta())
  assert.equal(m.title, 'Test Module')
  assert.equal(m.format, 'MOD')
  assert.equal(m.channels.length, 4)
  assert.equal(m.channels[0].role, 'drums')
  assert.equal(m.channels[1].role, 'bass')
  assert.equal(m.channels[2].role, 'chord')
  assert.equal(m.channels[3].role, 'lead')
  assert.equal(m.orders[2].skip, true)
  assert.equal(m.cell(0, 0, 0).note, raw(0, 4))
  assert.equal(m.cell(0, 0, 0).inst, 1)
  assert.equal(m.cell(0, 2, 2).note, raw(4, 4))
  assert.equal(m.channels[1].color, channelColor(1))
  assert.equal(m.patterns[0].rowCount, 16)
})

test('analysis emits note events and identifies drum kinds', () => {
  const m = buildSongModel(makeMeta())
  const a = new TrackerAnalysis(m)
  a.update({ order: 0, row: 0, pattern: 0, speed: 6, tempo: 125, pos: 0, vu: [1, 1, 0.4, 1] }, 1000)
  const ev = a.drainEvents()
  assert.ok(ev.some(e => e.kind === 'kick'))
  assert.ok(ev.some(e => e.kind === 'bass'))
  assert.ok(ev.some(e => e.kind === 'chord'))
  assert.ok(ev.some(e => e.kind === 'lead'))
})

test('analysis detects an A minor arpeggio chord and key', () => {
  const m = buildSongModel(makeMeta())
  const a = new TrackerAnalysis(m)
  const vu = [0.8, 1, 0.7, 0.5]
  for (let r = 0; r < 8; r++) {
    // emulate one row = 120 ms
    a.update({ order: 0, row: r, pattern: 0, speed: 6, tempo: 125, pos: r * 0.12, vu }, 1000 + r * 0.12)
  }
  const chord = a.getChord(1000.96)
  assert.ok(chord, 'expected a chord')
  assert.equal(chord.root, 9)
  assert.equal(chord.suffix, 'm')
  assert.equal(a.getKey().tonic, 9)
  assert.equal(a.getKey().mode, 'minor')
  assert.ok(a.getRoman().startsWith('i'))
  assert.ok(a.getPianoNotes(5).length >= 6)
})

test('note cut releases the voice', () => {
  const m = buildSongModel(makeMeta())
  const a = new TrackerAnalysis(m)
  const vu = [0.5, 0.5, 0.7, 0.5]
  for (let r = 0; r <= 5; r++) {
    a.update({ order: 0, row: r, pattern: 0, speed: 6, tempo: 125, pos: r * 0.12, vu }, 2000 + r * 0.12)
  }
  assert.equal(a.channels[2].voice, null)
  const notes = a.getPianoNotes(10)
  assert.ok(notes.some(n => n.channel === 2 && n.end > n.start))
})

test('order changes produce section events and loop jumps reset safely', () => {
  const m = buildSongModel(makeMeta())
  const a = new TrackerAnalysis(m)
  a.update({ order: 0, row: 0, pattern: 0, speed: 6, tempo: 125, pos: 0, vu: [1, 1, 1, 1] }, 0)
  a.drainEvents()
  a.update({ order: 1, row: 0, pattern: 1, speed: 6, tempo: 125, pos: 1.92, vu: [1, 1, 1, 1] }, 1.92)
  const ev = a.drainEvents()
  assert.ok(ev.some(e => e.type === 'section'))
  assert.doesNotThrow(() => a.update({ order: 0, row: 0, pattern: 0, speed: 6, tempo: 125, pos: 0, vu: [0, 0, 0, 0] }, 2.0))
})

test('classifyChannel is stable', () => {
  assert.equal(classifyChannel({ medianMidi: 40, drumShare: 0.9, noteCount: 100 }), 'drums')
  assert.equal(classifyChannel({ medianMidi: 36, drumShare: 0, noteCount: 10 }), 'bass')
  assert.equal(classifyChannel({ medianMidi: 80, drumShare: 0, noteCount: 10 }), 'lead')
  assert.equal(classifyChannel({ medianMidi: 60, drumShare: 0, noteCount: 10 }), 'chord')
})

test('look-ahead projects rows/orders and preview chords', () => {
  const m = buildSongModel(makeMeta())
  const rows = lookAhead(m, { order: 0, row: 0, pattern: 0, speed: 6, tempo: 125 }, 32)
  assert.equal(rows.length, 32)
  assert.ok(rows[1].at > rows[0].at)
  assert.ok(rows.some(r => r.order === 1), 'crosses into the next order')
  const preview = previewChords(m, { order: 0, row: 0, pattern: 0, speed: 6, tempo: 125 }, 4)
  assert.ok(preview.length >= 2)
  assert.ok(preview[0].name, 'the first projected bar has a chord name')
})

test('measure-level harmony ignores passing lead notes', () => {
  const m = buildSongModel(makeMeta())
  const a = new TrackerAnalysis(m)
  const vu = [0.8, 1, 0.7, 0.5]
  for (let r = 0; r <= 4; r++) {
    a.update({ order: 0, row: r, pattern: 0, speed: 6, tempo: 125, pos: r * 0.12, vu }, 3000 + r * 0.12)
  }
  const c = a.getChord(3000.5)
  assert.equal(c.root, 9)
  assert.ok(c.suffix === 'm' || c.suffix === 'm7')
})
