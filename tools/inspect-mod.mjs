#!/usr/bin/env node
/** Inspect a tracker module through the vendored libopenmpt wasm. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import libopenmptPromise from '../vendor/libopenmpt.worklet.js'

const lib = await libopenmptPromise()
const path = process.argv[2]
if (!path) {
  console.error('usage: node tools/inspect-mod.mjs <module-file>')
  process.exit(1)
}
const buf = readFileSync(resolve(path))
const ptr = lib._malloc(buf.length)
lib.HEAPU8.set(buf, ptr)
const mod = lib._openmpt_module_create_from_memory(ptr, buf.length, 0, 0, 0)
if (!mod) { console.error('failed to load'); process.exit(1) }

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
console.log('title:', meta('title'))
console.log('type:', meta('type'), '| tracker:', meta('tracker'))
console.log('dur:', lib._openmpt_module_get_duration_seconds(mod).toFixed(2), 's')
console.log('channels:', lib._openmpt_module_get_num_channels(mod), 'patterns:', lib._openmpt_module_get_num_patterns(mod), 'orders:', lib._openmpt_module_get_num_orders(mod))
console.log('speed:', lib._openmpt_module_get_current_speed(mod), 'tempo:', lib._openmpt_module_get_current_tempo(mod))
console.log('samples:', Array.from({ length: Math.min(5, lib._openmpt_module_get_num_samples(mod)) }, (_, i) => cstr(lib._openmpt_module_get_sample_name(mod, i))))

const fmt = (pat, row, ch) => {
  const p = lib._openmpt_module_format_pattern_row_channel(mod, pat, row, ch, 0, 0)
  const s = cstr(p); lib._openmpt_free_string(p); return s
}
console.log('\npattern 1, rows 0-8:')
for (let r = 0; r < 9; r++) {
  console.log(String(r).padStart(2, '0'), [0, 1, 2, 3].map(c => fmt(1, r, c).padEnd(8)).join(' | '))
}
console.log('\nraw commands row 0:')
for (let c = 0; c < 4; c++) {
  console.log(c, ['note', 'inst', 'volfx', 'fx', 'vol', 'param'].map((k, i) => `${k}=${lib._openmpt_module_get_pattern_row_channel_command(mod, 1, 0, c, i)}`).join(' '))
}
// play a couple of rows to verify VU exports and note names over time
const left = lib._malloc(4 * 4096), right = lib._malloc(4 * 4096)
const vu = () => Array.from({ length: 4 }, (_, i) => +lib._openmpt_module_get_current_channel_vu_mono(mod, i).toFixed(2))
for (let t = 0; t < 3; t++) {
  const got = lib._openmpt_module_read_float_stereo(mod, 44100, 4096, left, right)
  await new Promise(r => setTimeout(r, 0))
  console.log('block', t, 'frames', got, 'pos', lib._openmpt_module_get_position_seconds(mod).toFixed(2), 'vu', vu())
}
lib._openmpt_module_destroy(mod)
