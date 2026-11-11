import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import libopenmptPromise from '../../vendor/libopenmpt.worklet.js'

test('demo module is a valid 4-channel ProTracker module', async () => {
  const lib = await libopenmptPromise()
  const buf = readFileSync('assets/demo/dj-rat-severe-groove.mod')
  assert.equal(buf.subarray(1080, 1084).toString('ascii'), 'M.K.')
  const ptr = lib._malloc(buf.length)
  lib.HEAPU8.set(buf, ptr)
  const mod = lib._openmpt_module_create_from_memory(ptr, buf.length, 0, 0, 0)
  assert.ok(mod, 'libopenmpt loads the demo')
  const cstr = p => lib.UTF8ToString(p)
  const meta = k => {
    const kp = lib._malloc(k.length + 1)
    for (let i = 0; i < k.length; i++) lib.HEAP8[kp + i] = k.charCodeAt(i)
    lib.HEAP8[kp + k.length] = 0
    const p = lib._openmpt_module_get_metadata(mod, kp)
    const s = cstr(p)
    lib._openmpt_free_string(p)
    lib._free(kp)
    return s
  }
  assert.equal(meta('title'), 'dj rat severe groove')
  assert.equal(lib._openmpt_module_get_num_channels(mod), 4)
  assert.equal(lib._openmpt_module_get_num_patterns(mod), 8)
  assert.equal(lib._openmpt_module_get_num_orders(mod), 10)
  assert.ok(lib._openmpt_module_get_duration_seconds(mod) > 60)
  const note = lib._openmpt_module_get_pattern_row_channel_command(mod, 1, 0, 1, 0)
  assert.ok(note >= 1 && note <= 120, 'pattern 1 starts with a playable note')
  lib._openmpt_module_destroy(mod)
})
