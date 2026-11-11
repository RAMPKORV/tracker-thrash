import test from 'node:test'
import assert from 'node:assert/strict'
import { poopTypeForChord, POOP_TYPES } from '../../src/poop.js'

test('poop taxonomy covers chord qualities and channels', () => {
  assert.equal(poopTypeForChord({ suffix: '' }), 'soft')
  assert.equal(poopTypeForChord({ suffix: 'm7' }, { role: 'chord' }), 'log')
  assert.equal(poopTypeForChord({ suffix: 'maj7' }), 'rainbow')
  assert.equal(poopTypeForChord({ suffix: '7' }), 'corn')
  assert.equal(poopTypeForChord({ suffix: 'dim7' }), 'spicy')
  assert.equal(poopTypeForChord({ suffix: 'aug' }), 'gold')
  assert.equal(poopTypeForChord({ suffix: 'sus4' }), 'soft')
  assert.equal(poopTypeForChord(null, { role: 'bass', midi: 40 }), 'giant')
  assert.equal(poopTypeForChord(null, { role: 'lead', midi: 84 }), 'pellet')
  assert.equal(poopTypeForChord(null, { silence: true }), 'ghost')
  assert.equal(poopTypeForChord(null, { dissonance: 0.9 }), 'spicy')
  for (const [k, v] of Object.entries(POOP_TYPES)) {
    assert.ok(v.label && v.blurb && v.color, k)
  }
})
