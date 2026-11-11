/**
 * Generates a tiny valid ProTracker MOD for tests only. This is deliberately
 * There is no show demo; this is a 4-channel test
 * fixture with two chords, generated in memory so nothing is shipped.
 */
const SR = 8363
const ROWS = 64
const CH = 4

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const note = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const n = (name, oct) => note[name] + (oct - 3) * 12
const period = nSemis => Math.round(428 * Math.pow(2, -nSemis / 12))

function pcm(seconds, fn) {
  const len = Math.max(128, Math.round(seconds * SR))
  const out = new Int8Array(len)
  for (let i = 0; i < len; i++) out[i] = clamp(Math.round(fn(i / SR, i / len) * 127), -128, 127)
  return out
}

const samples = [
  { name: 'kick', data: pcm(0.06, (t, p) => Math.sin(2 * Math.PI * (120 * Math.pow(0.2, t / 0.06) + 35) * t) * (1 - p)) },
  { name: 'bass', data: pcm(0.3, (t, p) => ((t * 65.406) % 1 < 0.5 ? 0.6 : -0.6) * (1 - p * 0.35)) },
  { name: 'pad', data: pcm(0.26, (t, p) => (Math.sin(2 * Math.PI * 261.63 * t) * 0.5 + Math.sin(2 * Math.PI * 392 * t) * 0.22) * (1 - p)) },
  { name: 'lead', data: pcm(0.2, (t, p) => ((t * 523.25) % 1 < 0.25 ? 0.5 : -0.5) * (1 - p)) },
]
while (samples.length < 31) samples.push({ name: '', data: new Int8Array(0) })

const patterns = Array.from({ length: 2 }, () => Array.from({ length: ROWS }, () => Array.from({ length: CH }, () => ({ smp: 0, per: 0, fx: 0, par: 0 }))))
const put = (p, row, ch, smp, semis, vol = 60) => {
  patterns[p][row][ch] = { smp, per: period(semis), fx: 0xC, par: vol }
}
const chords = [
  { root: n('A', 2), tones: [n('A', 2), n('C', 3), n('E', 3), n('A', 3)] },
  { root: n('F', 2), tones: [n('F', 2), n('A', 2), n('C', 3), n('F', 3)] },
]
for (let p = 0; p < 2; p++) {
  const c = chords[p]
  for (let r = 0; r < ROWS; r += 8) {
    put(p, r, 0, 1, 0, 58) // kick
    put(p, r, 1, 2, c.root, 62) // bass
  }
  for (let r = 0; r < ROWS; r++) put(p, r, 2, 3, c.tones[r % 4], 42) // chord arp
  for (let r = 0; r < ROWS; r += 16) put(p, r, 3, 4, c.tones[(r / 16) % 3] + 12, 46) // lead
}

const words = bytes => Math.ceil(bytes / 2)
const header = Buffer.alloc(20)
header.write('E2E TEST MODULE', 0, 'ascii')
const sampleHeaders = []
for (const s of samples) {
  const h = Buffer.alloc(30)
  h.write(s.name, 0, 22, 'ascii')
  h.writeUInt16BE(words(s.data.length), 22)
  h[24] = 0 // finetune
  h[25] = 64 // volume
  h.writeUInt16BE(0, 26)
  h.writeUInt16BE(1, 28)
  sampleHeaders.push(h)
}
const orders = [0, 1, 0, 1]
const tail = Buffer.from([orders.length, 127, ...Array.from({ length: 128 }, (_, i) => orders[i] ?? 0), 0x4d, 0x2e, 0x4b, 0x2e])
const patternData = []
for (const pat of patterns) {
  for (const row of pat) {
    for (const c of row) {
      patternData.push(Buffer.from([
        ((c.smp & 0xf0) | ((c.per >> 8) & 0x0f)),
        c.per & 0xff,
        (((c.smp & 0x0f) << 4) | (c.fx & 0x0f)),
        c.par & 0xff,
      ]))
    }
  }
}
const sampleData = samples.map(s => {
  const d = Buffer.from(s.data)
  return d.length % 2 ? Buffer.concat([d, Buffer.alloc(1)]) : d
})

export function makeTestMod() {
  return Buffer.concat([header, ...sampleHeaders, tail, ...patternData, ...sampleData])
}
