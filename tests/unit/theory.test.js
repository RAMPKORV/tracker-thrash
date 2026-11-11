import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pcName, rawNoteName, rawToMidi, detectChord, detectKey,
  romanNumeral, chordNotes, rowDuration, keyName, midiToName,
} from '../../src/theory.js'

const weights = (names) => {
  const w = Array(12).fill(0)
  for (const n of names) w[pcOf(n)] += 1
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map(v => v / sum)
}
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
const pcOf = n => PC[n]

test('pitch-class naming respects flat preference', () => {
  assert.equal(pcName(1, false), 'C#')
  assert.equal(pcName(1, true), 'Db')
  assert.equal(pcName(10, false), 'A#')
  assert.equal(pcName(10, true), 'Bb')
})

test('raw tracker note names match libopenmpt convention', () => {
  assert.equal(rawNoteName(37), 'C-3')
  assert.equal(rawNoteName(46), 'A-3')
  assert.equal(rawNoteName(61), 'C-5')
  assert.equal(rawNoteName(120), 'B-9')
  assert.equal(rawNoteName(0), '')
  assert.equal(rawNoteName(254), '')
  assert.equal(rawToMidi(37), 48)
})

test('midi names are scientific', () => {
  assert.equal(midiToName(60), 'C4')
  assert.equal(midiToName(69), 'A4')
})

test('detects major and minor triads', () => {
  assert.equal(detectChord(weights(['C', 'E', 'G'])).name, 'C')
  assert.equal(detectChord(weights(['A', 'C', 'E'])).name, 'Am')
  assert.equal(detectChord(weights(['B', 'D', 'F'])).name, 'Bdim')
  assert.equal(detectChord(weights(['C', 'E', 'G#'])).name, 'Caug')
})

test('detects seventh chords rather than plain triads', () => {
  assert.equal(detectChord(weights(['A', 'C', 'E', 'G']), { bassPc: 9 }).name, 'Am7')
  assert.equal(detectChord(weights(['F', 'A', 'C', 'E']), { bassPc: 5 }).name, 'Fmaj7')
  assert.equal(detectChord(weights(['G', 'B', 'D', 'F']), { bassPc: 7 }).name, 'G7')
  assert.equal(detectChord(weights(['C', 'E', 'G', 'A']), { bassPc: 0 }).name, 'C6')
  assert.equal(detectChord(weights(['B', 'D', 'F', 'A']), { bassPc: 11 }).name, 'Bm7b5')
})

test('detects sus and power chords', () => {
  assert.equal(detectChord(weights(['C', 'D', 'G'])).name, 'Csus2')
  assert.equal(detectChord(weights(['C', 'F', 'G'])).name, 'Csus4')
  assert.equal(detectChord(weights(['A', 'E'])).name, 'A5')
})

test('names inversions with slash bass', () => {
  const c = detectChord(weights(['C', 'E', 'G']), { bassPc: 4 })
  assert.equal(c.name, 'C/E')
  assert.equal(c.root, 0)
})

test('returns no chord for silence or a single pitch', () => {
  assert.equal(detectChord(weights([])), null)
  assert.equal(detectChord(weights(['C'])), null)
})

test('chord notes and intervals', () => {
  const c = detectChord(weights(['A', 'C', 'E', 'G']), { bassPc: 9 })
  assert.deepEqual(c.intervals, [0, 3, 7, 10])
  assert.deepEqual(c.pitchClasses, [9, 0, 4, 7])
  assert.equal(chordNotes(c).join(' '), 'A C E G')
})

test('key detection: A minor', () => {
  const w = weights(['A', 'A', 'A', 'A', 'C', 'C', 'C', 'E', 'E', 'G', 'G', 'F', 'D', 'B'])
  const k = detectKey(w)
  assert.equal(k.tonic, 9)
  assert.equal(k.mode, 'minor')
  assert.equal(keyName(k), 'A minor')
  assert.ok(k.confidence > 0.3)
})

test('key detection: C major', () => {
  const w = weights(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  const k = detectKey(w)
  assert.equal(k.tonic, 0)
  assert.equal(k.mode, 'major')
})

test('roman numerals in major and minor', () => {
  assert.equal(romanNumeral({ root: 0, suffix: '' }, 0, 'major'), 'I')
  assert.equal(romanNumeral({ root: 9, suffix: 'm' }, 0, 'major'), 'vi')
  assert.equal(romanNumeral({ root: 7, suffix: '7' }, 0, 'major'), 'V7')
  assert.equal(romanNumeral({ root: 11, suffix: 'dim' }, 0, 'major'), 'vii°')
  assert.equal(romanNumeral({ root: 9, suffix: 'm' }, 9, 'minor'), 'i')
  assert.equal(romanNumeral({ root: 5, suffix: '' }, 9, 'minor'), 'VI')
  assert.equal(romanNumeral({ root: 7, suffix: '' }, 9, 'minor'), 'VII')
  assert.equal(romanNumeral({ root: 5, suffix: 'maj7' }, 9, 'minor'), 'VImaj7')
  assert.equal(romanNumeral({ root: 1, suffix: '' }, 0, 'major'), 'bII')
})

test('row duration matches tracker maths', () => {
  assert.equal(rowDuration(6, 125), 0.12)
  assert.equal(rowDuration(3, 125), 0.06)
  assert.equal(rowDuration(6, 150), 0.1)
})
