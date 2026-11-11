import test from 'node:test'
import assert from 'node:assert/strict'
import { monsquazPhase } from '../../src/monsquaz.js'

test('Monsquaz phases divide the tracker pattern into up/dance/down/zoom', () => {
  assert.equal(monsquazPhase(0, 64).phase, 0)
  assert.equal(monsquazPhase(14, 64).phase, 0)
  assert.equal(monsquazPhase(15, 64).phase, 1)
  assert.equal(monsquazPhase(30, 64).phase, 1)
  assert.equal(monsquazPhase(31, 64).phase, 2)
  assert.equal(monsquazPhase(46, 64).phase, 2)
  assert.equal(monsquazPhase(47, 64).phase, 3)
  assert.equal(monsquazPhase(63, 64).phase, 3)
  assert.equal(monsquazPhase(0, 1).phase, 0)
  assert.equal(monsquazPhase(999, 64).phase, 3)
  const a = monsquazPhase(0, 64)
  const b = monsquazPhase(32, 64)
  assert.ok(b.progress > a.progress)
  assert.ok(b.local >= 0 && b.local <= 1)
})
