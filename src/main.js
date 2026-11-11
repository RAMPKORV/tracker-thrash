import { TrackerEngine } from './engine.js'
import { buildSongModel, TrackerAnalysis, lookAhead, previewChords } from './tracker.js'
import { Visualizer } from './visualizer.js'
import { HUD } from './hud.js'
import { GagDirector } from './gags.js'
import { keyName } from './theory.js'

// Safari < 16.4 does not have roundRect; the butt and the coaster need it.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
    this.moveTo(x + q, y)
    this.arcTo(x + w, y, x + w, y + h, q)
    this.arcTo(x + w, y + h, x, y + h, q)
    this.arcTo(x, y + h, x, y, q)
    this.arcTo(x, y, x + w, y, q)
    this.closePath()
    return this
  }
}

const $ = id => document.getElementById(id)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const nowSec = () => performance.now() / 1000

const els = {
  gate: $('gate'),
  app: $('app'),
  gateOpen: $('gate-open'),
  gateSerious: $('gate-serious'),
  gateStatus: $('lib-status'),
  stage: $('stage'),
  file: $('file'),
  fileDrop: $('file-drop'),
  loading: $('loading'),
  loadingText: $('loading-text'),
  help: $('help'),
  btnOpen: $('btn-open'),
  btnMonsquaz: $('btn-monsquaz'),
  monsquazExit: $('monsquaz-exit'),
  btnHelp: $('btn-help'),
  btnPlay: $('btn-play'),
  btnRestart: $('btn-restart'),
  btnSerious: $('btn-serious'),
  btnMusic: $('btn-music'),
  btnNerd: $('btn-nerd'),
  btnHud: $('btn-hud'),
  btnFull: $('btn-full'),
  seek: $('seek'),
  time: $('time'),
  bpm: $('bpm'),
  chaos: $('chaos'),
  chaosVal: $('chaos-val'),
  poop: $('poop-toggle'),
  hud: $('hud'),
  caption: $('caption'),
  toast: $('toast'),
  live: $('live'),
}

const engine = new TrackerEngine()
const viz = new Visualizer(els.stage)
const hud = new HUD()
const gags = new GagDirector({
  layer: $('gag-layer'),
  caption: els.caption,
  toast: els.toast,
})

viz.onCaption = (text, seconds) => gags.caption(text, seconds)

const app = {
  model: null,
  analysis: null,
  meta: null,
  started: false,
  loading: false,
  errors: [],
  lastTimeline: -10,
  timeline: null,
  preview: [],
  spectrum: null,
  waveform: null,
  lastTick: nowSec(),
  lastHud: -10,
  genre: 'chiptune',
  scene: 'plaza',
  sceneSections: 0,
  sceneDeck: ['plaza', 'factory', 'cosmic', 'dungeon', 'office', 'hell'],
  segmentDeck: [],
  segment: null,
  segmentIndex: 0,
  segmentCycle: 0,
  segmentSections: 0,
  lastGenreAt: -10,
  lastGagTick: -10,
  pendingReveal: false,
  monsquazForced: false,
  revealTimer: null,
}

const settings = {
  chaos: 4,
  serious: false,
  gross: true,
  nerd: false,
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
}

function loadSettings() {
  try {
    const rawChaos = localStorage.getItem('tt.chaos')
    const chaos = rawChaos == null ? NaN : Number(rawChaos)
    if (Number.isFinite(chaos) && chaos >= 0 && chaos <= 10) settings.chaos = chaos
    const poop = localStorage.getItem('tt.poop')
    if (poop != null) settings.gross = poop === '1'
    const serious = localStorage.getItem('tt.serious')
    if (serious != null) settings.serious = serious === '1'
    const nerd = localStorage.getItem('tt.nerd')
    if (nerd != null) settings.nerd = nerd === '1'
  } catch { /* private mode, etc. */ }
}

function saveSettings() {
  try {
    localStorage.setItem('tt.chaos', String(settings.chaos))
    localStorage.setItem('tt.poop', settings.gross ? '1' : '0')
    localStorage.setItem('tt.serious', settings.serious ? '1' : '0')
    localStorage.setItem('tt.nerd', settings.nerd ? '1' : '0')
  } catch { /* noop */ }
}

function applySettings() {
  if (settings.serious) settings.chaos = Math.min(settings.chaos, 2)
  els.chaos.value = String(settings.chaos)
  els.chaosVal.textContent = String(settings.chaos)
  els.poop.checked = settings.gross
  els.poop.disabled = settings.serious
  els.btnSerious.classList.toggle('on', settings.serious)
  els.btnSerious.textContent = settings.serious ? 'SERIOUS: ON' : 'SERIOUS'
  viz.setSettings(settings)
  gags.setSettings(settings)
  document.body.classList.toggle('serious-mode', settings.serious)
  document.body.classList.toggle('nerd-mode', settings.nerd)
  if (els.btnNerd) els.btnNerd.textContent = settings.nerd ? 'SHOW MODE' : 'PANELS'
  if (els.btnNerd) els.btnNerd.classList.toggle('on', settings.nerd)
}

function setChaos(n) {
  settings.chaos = clamp(Math.round(Number(n) || 0), 0, 10)
  applySettings()
  saveSettings()
}

function setSerious(on) {
  settings.serious = !!on
  if (settings.serious && settings.gross) {
    // remember, but do not show, the butt
    app._poopBeforeSerious = true
  }
  applySettings()
  saveSettings()
  gags.toast(settings.serious
    ? 'SERIOUS MODE: the butt is on administrative leave.'
    : 'BRAINROT RESTORED. the butt has returned from HR.', 3)
}

function setNerd(on = !settings.nerd) {
  settings.nerd = !!on
  applySettings()
  saveSettings()
  if (settings.nerd) gags.toast('MUSIC NERD PANELS: piano roll, pattern grid, channel VU, pitch-class clock.', 3)
}

function setGross(on) {
  settings.gross = !!on
  if (settings.serious) settings.serious = false
  applySettings()
  saveSettings()
}

function showLoading(text = 'parsing possibly illegal amounts of groove…') {
  app.loading = true
  els.loading.hidden = false
  els.loadingText.textContent = text
}

function hideLoading() {
  app.loading = false
  els.loading.hidden = true
}

function toast(text, seconds = 3.2) {
  gags.toast(text, seconds)
}

function updateTransport() {
  const state = engine.state || {}
  const pos = engine.position || 0
  const dur = engine.duration || 0
  els.time.textContent = `${fmt(pos)} / ${fmt(dur)}`
  els.seek.value = String(Math.round((dur ? pos / dur : 0) * 1000))
  els.bpm.textContent = `${Math.round(state.tempo || 125)} BPM · SPD ${state.speed || 6}`
  els.btnPlay.textContent = engine.paused ? '▶' : '❚❚'
  els.btnPlay.setAttribute('aria-label', engine.paused ? 'Play' : 'Pause')
}

const fmt = s => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function setGateStatus(text) {
  els.gateStatus.textContent = text
}

function requestModule(serious = false) {
  settings.serious = !!serious
  if (serious) settings.chaos = Math.min(settings.chaos, 1)
  applySettings()
  // Must happen synchronously inside the click: browsers require a user
  // activation for both AudioContext and the file picker.
  engine.init().catch(err => {
    setGateStatus(`AUDIO ENGINE FAILED: ${err.message}`)
  })
  els.file.value = ''
  els.file.click()
  setGateStatus('SELECT A MODULE. THE SHOW REMAINS HIDDEN UNTIL IT PLAYS.')
  els.gate.classList.remove('working')
}

function revealApp(announce = true) {
  if (!els.gate.classList.contains('gone')) {
    clearTimeout(app.revealTimer)
    els.gate.classList.add('gone')
    setTimeout(() => { els.gate.style.display = 'none' }, 380)
    els.app.setAttribute('aria-hidden', 'false')
    hideLoading()
    if (announce && app.model) {
      const title = app.model.title
      gags.toast(`LOADED: ${title} — ${app.model.artist}`, 4)
      gags.caption(`FORMAT ${app.model.format}. ${app.model.maxChannels} CHANNELS OF UNLICENSED EMOTION.`, 4)
      els.live.textContent = `Loaded ${title} by ${app.model.artist}. ${app.model.format} module, ${app.model.channels.filter(c => c.noteCount).length} active channels.`
      if (app.model.subsongs.length > 1) {
        gags.toast(`THIS MODULE HAS ${app.model.subsongs.length} SUBSONGS. THE FIRST ONE HAS BEEN SELECTED. THE OTHERS ARE EMOTIONAL SUPPORT.`, 5)
      }
      updateTransport()
    }
  } else {
    hideLoading()
  }
}


const SCENE_LABELS = {
  plaza: 'DEMOSCENE PLAZA', factory: 'BASS FACTORY', dungeon: "SAD WIZARD'S DUNGEON",
  cosmic: 'COSMIC 4D SPLAT REALM', office: 'SYNERGY OFFICE', hell: 'CRT TRACKER HELL',
  coaster: 'TOILET PAPER ROLLERCOASTER',
}

function detectGenre() {
  if (!app.model || !app.analysis) return 'chiptune'
  const state = engine.state
  const stats = app.analysis.getStats()
  const bpm = Number(state.tempo) || 125
  const rate = stats.noteRate || 0
  const chord = app.analysis.getChord()
  const ext = chord && /7|9|11|13|6|sus|dim|aug/.test(chord.suffix || '')
  if (app.model.format === 'MOD' && app.model.maxChannels <= 8 && bpm < 150) return 'chiptune'
  if (bpm >= 148 || rate > 13) return 'rave'
  if (rate < 2.2) return 'ambient'
  if (ext) return 'jazz'
  if (app.model.maxChannels >= 12) return 'orchestral'
  return 'demoscene'
}

function segmentDeckFor(genre) {
  const fx = (scene, effect, camera) => ({ type: 'fx', scene, effect, camera, length: 1 })
  const world = (scene, camera, length = 2) => ({ type: 'world', scene, camera, length })
  const multi = scene => ({ type: 'multiview', scene, camera: 'wide', length: 1 })
  const term = scene => ({ type: 'terminal', scene, length: 1 })
  const bars = () => ({ type: 'bars', scene: 'plaza', length: 1 })
  const mons = () => ({ type: 'monsquaz', scene: 'plaza', length: 1 })
  const decks = {
    chiptune: [
      world('plaza', 'wide'), fx('plaza', 'rotozoom', 'orbit'),
      world('factory', 'closeup'), mons(), multi('plaza'),
      world('cosmic', 'orbit'), fx('plaza', 'onebit', 'dolly'), term('cosmic'),
      world('dungeon', 'dolly'), fx('hell', 'dotTunnel', 'punch'),
      world('office', 'handheld'), fx('cosmic', 'glenz', 'orbit'),
      world('coaster', 'dolly', 1), world('hell', 'punch'), multi('factory'), bars(),
    ],
    rave: [
      world('factory', 'closeup'), fx('hell', 'dotTunnel', 'punch'),
      world('hell', 'punch'), mons(), multi('factory'),
      world('plaza', 'wide'), fx('hell', 'fire', 'handheld'),
      term('hell'), world('office', 'handheld'),
      world('cosmic', 'orbit'), fx('factory', 'rotozoom', 'punch'),
      world('coaster', 'dolly', 1), bars(),
    ],
    jazz: [
      world('dungeon', 'dolly'), fx('cosmic', 'glenz', 'orbit'),
      world('office', 'handheld'), multi('dungeon'),
      world('cosmic', 'orbit'), term('office'),
      world('plaza', 'wide'), fx('dungeon', 'kefrens', 'dolly'),
    ],
    ambient: [
      world('cosmic', 'orbit'), fx('cosmic', 'stars', 'orbit'),
      world('dungeon', 'dolly'), multi('cosmic'),
      world('office', 'handheld'), term('cosmic'),
      world('plaza', 'wide'), fx('cosmic', 'tunnel', 'wide'),
    ],
    orchestral: [
      world('dungeon', 'dolly'), fx('cosmic', 'glenz', 'orbit'),
      world('cosmic', 'orbit'), multi('dungeon'),
      world('office', 'handheld'), term('dungeon'), world('plaza', 'wide'),
    ],
    demoscene: [
      world('plaza', 'wide'), fx('plaza', 'tunnel', 'orbit'),
      world('factory', 'closeup'), mons(), multi('cosmic'),
      world('dungeon', 'dolly'), fx('hell', 'fire', 'punch'),
      world('office', 'handheld'), term('plaza'),
      world('cosmic', 'orbit'), fx('cosmic', 'glenz', 'orbit'), bars(),
    ],
  }
  return (decks[genre] || decks.demoscene).slice()
}

function segmentLabel(seg) {
  if (!seg) return 'DEMOSCENE PLAZA'
  if (seg.type === 'fx') return `FULLSCREEN FX: ${(seg.effect || '??').toUpperCase()}`
  if (seg.type === 'multiview') return 'MULTIVIEW FEED'
  if (seg.type === 'terminal') return 'TRACKER OS / TTY1'
  if (seg.type === 'bars') return 'SMPTE EMERGENCY BROADCAST'
  if (seg.type === 'monsquaz') return 'MONSQUAZ MODE · ACTUAL GUY · CENSORED CUT'
  return SCENE_LABELS[seg.scene] || 'DEMOSCENE PLAZA'
}

function applySegment(seg, announce = true) {
  if (!seg) return
  app.segment = seg
  app.segmentSections = 0
  app.scene = seg.scene || 'plaza'
  viz.setScene(app.scene)
  viz.setGenre(app.genre)
  viz.setFormat(seg.type === 'world' ? 'world' : seg.type)
  if (seg.type === 'fx') viz.setEffect(seg.effect)
  else if (seg.type === 'world') viz.setEffect(seg.effect || viz.effectPool[0])
  viz.setCamera(seg.camera || 'wide')
  const isMons = seg.type === 'monsquaz' || app.monsquazForced
  if (isMons) viz.setFormat('monsquaz')
  document.body.classList.toggle('monsquaz-mode', isMons)
  const label = isMons ? 'MONSQUAZ MODE · ACTUAL GUY · CENSORED CUT' : segmentLabel(seg)
  hud.setScene(label, app.genre.toUpperCase())
  if (announce) {
    gags.toast(`SEGMENT ${String(app.segmentIndex + 1).padStart(2, '0')}: ${label}`, 2.6)
    if (seg.type === 'bars') gags.caption('PLEASE REMAIN CALM. THE PIXELS ARE ARGUING.', 2.8)
    if (seg.type === 'terminal') gags.caption('TRACKER OS HAS TAKEN OVER THE VISUALIZER. THIS IS NORMAL.', 2.8)
    if (seg.type === 'multiview') gags.caption('ALL FOUR CHANNELS ARE NOW ON SCREEN. NONE OF THEM ARE OKAY.', 2.8)
  }
}

function advanceSegment() {
  if (!app.segmentDeck.length) app.segmentDeck = segmentDeckFor(app.genre)
  app.segmentIndex++
  if (app.segmentIndex >= app.segmentDeck.length) {
    const deck = segmentDeckFor(app.genre)
    const off = (app.segmentCycle = (app.segmentCycle || 0) + 1) % deck.length
    app.segmentDeck = deck.slice(off).concat(deck.slice(0, off))
    app.segmentIndex = 0
  }
  let seg = app.segmentDeck[app.segmentIndex]
  if (seg && app.segment && seg.type === 'world' && app.segment.type === 'world' && seg.scene === app.segment.scene) {
    app.segmentIndex = (app.segmentIndex + 1) % app.segmentDeck.length
    seg = app.segmentDeck[app.segmentIndex]
  }
  applySegment(seg)
}

function setMonsquazMode(on) {
  app.monsquazForced = !!on
  if (els.btnMonsquaz) {
    els.btnMonsquaz.classList.toggle('on', app.monsquazForced)
    els.btnMonsquaz.textContent = app.monsquazForced ? 'MONSQ: ON' : 'MONSQ'
  }
  if (app.monsquazForced) {
    viz.setFormat('monsquaz')
    viz.monsquaz.begin()
    document.body.classList.add('monsquaz-mode')
    hud.setScene('MONSQUAZ MODE · ACTUAL GUY · CENSORED CUT', app.genre.toUpperCase())
    gags.toast('MONSQUAZ MODE: the actual monsquazman, with the canonical green-arrow censor.', 4)
  } else {
    document.body.classList.remove('monsquaz-mode')
    if (app.segment?.type === 'monsquaz') advanceSegment()
    else applySegment(app.segment, false)
    gags.toast('MONSQUAZ MODE OFF. the guy has left the video.', 3)
  }
}

function buildFromMeta(meta) {
  app.meta = meta
  app.model = buildSongModel(meta)
  app.analysis = new TrackerAnalysis(app.model)
  app.preview = []
  app.timeline = null
  app.lastTimeline = -10
  viz.setModel(app.model)
  viz.setGenre(app.genre)
  hud.setModel(app.model)
  gags.setModel(app.model)
  engine.setLoop(true)
  app.genre = detectGenre()
  app.segmentDeck = segmentDeckFor(app.genre)
  app.segmentIndex = 0
  app.sceneDeck = app.segmentDeck.filter(x => x.type === 'world').map(x => x.scene)
  applySegment(app.segmentDeck[0], false)
  viz.setGenre(app.genre)
  app.started = true
  const firstLoad = !els.gate.classList.contains('gone')
  if (firstLoad) {
    app.pendingReveal = true
    hideLoading()
    els.gate.classList.remove('working')
    setGateStatus('PLAYBACK STARTING. THE SHOW IS ABOUT TO BE REVEALED…')
    clearTimeout(app.revealTimer)
    app.revealTimer = setTimeout(() => {
      if (app.pendingReveal) {
        app.pendingReveal = false
        setGateStatus('ERROR: AUDIO DID NOT START. THE SHOW WAS NOT REVEALED. TRY OPENING A MODULE AGAIN.')
      }
    }, 8000)
  } else {
    hideLoading()
    const title = app.model.title
    gags.toast(`LOADED: ${title} — ${app.model.artist}`, 4)
    gags.caption(`FORMAT ${app.model.format}. ${app.model.maxChannels} CHANNELS OF UNLICENSED EMOTION.`, 4)
    els.live.textContent = `Loaded ${title} by ${app.model.artist}. ${app.model.format} module, ${app.model.channels.filter(c => c.noteCount).length} active channels.`
    updateTransport()
    if (app.model.subsongs.length > 1) {
      gags.toast(`THIS MODULE HAS ${app.model.subsongs.length} SUBSONGS. THE FIRST ONE HAS BEEN SELECTED. THE OTHERS ARE EMOTIONAL SUPPORT.`, 5)
    }
  }
}

engine.onMeta = meta => buildFromMeta(meta)
engine.onError = msg => {
  hideLoading()
  if (!els.gate.classList.contains('gone')) {
    app.pendingReveal = false
    clearTimeout(app.revealTimer)
    els.gate.classList.remove('working')
    setGateStatus(`ERROR: ${msg} THE SHOW WAS NOT REVEALED.`)
    return
  }
  toast(msg, 7)
  gags.caption('the module has left the chat.', 3)
}
engine.onEnded = () => {
  updateTransport()
  toast('MODULE ENDED. the bass has left the building.', 4)
}
engine.onSeek = () => {
  if (app.analysis) app.analysis.reset(nowSec())
  app.lastTimeline = -10
  viz.flush()
}
engine.onState = () => {
  if (!engine.initialized) return
  if (app.pendingReveal && !engine.paused) {
    app.pendingReveal = false
    clearTimeout(app.revealTimer)
    revealApp(true)
  }
}

function loadFile(file) {
  if (!file) return
  const ok = /\.(mod|xm|s3m|it|mptm|mtm|669|far|med|okt|stm|ult|mo3|umx|dbm|dsm|mdl|amf|ams|c67|cba|digi|dmf|dsm|dsym|dtm|etx|fc|fc13|fc14|fmt|fst|ftm|gdm|gtk|gt2|ice|imf|ims|j2b|m15|mms|mus|nst|plm|psm|pt36|ptm|puma|rtm|sfx|sfx2|smod|st26|stk|stx|stp|symmod|tcb|unic|wow|xmf|oxm|xpk|ppm|mmcmp)$/i.test(file.name || '')
  if (!ok && !/\.(zip|lha|lzh)$/i.test(file.name || '')) {
    // libopenmpt decides in the end; just warn for obvious nonsense.
    if (!file.name) toast('That file has no name. Very mysterious. Very illegal.', 4)
  }
  const firstLoad = !els.gate.classList.contains('gone')
  if (firstLoad) {
    els.gate.classList.add('working')
    setGateStatus(`PARSING ${String(file.name || 'MODULE').toUpperCase()} · THE SHOW IS STILL A SECRET…`)
  } else {
    showLoading('unpacking samples, ego, and one (1) brown note…')
  }
  engine.init()
    .then(() => engine.loadFile(file))
    .catch(err => {
      hideLoading()
      els.gate.classList.remove('working')
      if (firstLoad) {
        app.pendingReveal = false
        setGateStatus(`ERROR: ${err.message || 'Could not load that file.'} THE SHOW WAS NOT REVEALED.`)
      } else {
        toast(err.message || 'Could not load that file.', 7)
      }
    })
}

/* ---------------------------------------------------------------- events */
els.gateOpen.addEventListener('click', () => requestModule(false))
els.gateSerious.addEventListener('click', () => requestModule(true))
els.btnOpen.addEventListener('click', () => els.file.click())
els.btnHelp.addEventListener('click', () => els.help.showModal())
els.help.addEventListener('click', e => {
  if (e.target === els.help) els.help.close()
})
els.file.addEventListener('change', () => {
  const f = els.file.files?.[0]
  if (f) loadFile(f)
  els.file.value = ''
})
els.btnPlay.addEventListener('click', async () => {
  if (!engine.initialized) return
  try {
    await engine.togglePause()
    updateTransport()
    if (engine.paused) gags.caption('paused. the bass is holding its breath.', 2)
  } catch (e) { toast(e.message, 5) }
})
els.btnRestart.addEventListener('click', () => {
  if (!engine.initialized) return
  engine.restart()
  updateTransport()
  gags.toast('REWOUND. the bass has been given another chance.', 3)
})
els.seek.addEventListener('input', () => {
  const frac = Number(els.seek.value) / 1000
  els.time.textContent = `${fmt(frac * (engine.duration || 0))} / ${fmt(engine.duration || 0)}`
})
els.seek.addEventListener('change', () => {
  if (!engine.initialized) return
  engine.seekFraction(Number(els.seek.value) / 1000)
  gags.caption('SEEK. the timeline is a suggestion.', 2)
})
els.chaos.addEventListener('input', () => setChaos(els.chaos.value))
els.chaos.addEventListener('change', () => {
  gags.toast(`CHAOS ${settings.chaos}/10: ${settings.chaos >= 8 ? 'HR has left the building.' : settings.chaos <= 1 ? 'the butt is asleep.' : 'a reasonable amount of nonsense.'}`, 2.5)
})
els.poop.addEventListener('change', () => setGross(els.poop.checked))
els.btnSerious.addEventListener('click', () => setSerious(!settings.serious))
els.btnMonsquaz.addEventListener('click', () => setMonsquazMode(!app.monsquazForced))
els.monsquazExit.addEventListener('click', () => setMonsquazMode(false))
els.btnMusic.addEventListener('click', () => setNerd(true))
els.btnNerd.addEventListener('click', () => setNerd(!settings.nerd))
els.btnHud.addEventListener('click', () => {
  els.hud.classList.toggle('hud-hidden')
  els.btnHud.classList.toggle('on', els.hud.classList.contains('hud-hidden'))
})
els.btnFull.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
  else document.exitFullscreen?.().catch(() => {})
})

document.addEventListener('visibilitychange', () => { if (!document.hidden) engine.resume() })

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (els.help.open) return
  if (e.code === 'Space') { e.preventDefault(); els.btnPlay.click() }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); engine.seek(Math.max(0, engine.position - 5)) }
  else if (e.code === 'ArrowRight') { e.preventDefault(); engine.seek(engine.position + 5) }
  else if (e.key === 'r' || e.key === 'R') els.btnRestart.click()
  else if (e.key === 'o' || e.key === 'O') els.file.click()
  else if (e.key === 'Escape') setMonsquazMode(false)
  else if (e.key === 'z' || e.key === 'Z') {
    if (app.monsquazForced || app.segment?.type === 'monsquaz') setMonsquazMode(false)
    else setMonsquazMode(true)
  }
  else if (e.key === 'm' || e.key === 'M') setNerd(!settings.nerd)
  else if (e.key === 's' || e.key === 'S') setSerious(!settings.serious)
  else if (e.key === 'h' || e.key === 'H') els.btnHud.click()
  else if (e.key === 'g' || e.key === 'G') setGross(!settings.gross)
  else if (e.key === 'f' || e.key === 'F') els.btnFull.click()
  else if (e.key === 'v' || e.key === 'V') {
    viz.effectIndex++
    viz.effect = ['plasma', 'tunnel', 'stars', 'onebit', 'twister', 'metaballs', 'copper'][viz.effectIndex % 7]
    gags.toast(`BACKGROUND: ${viz.effect.toUpperCase()}. art direction by nobody.`, 2)
  } else if (e.key === '?') els.help.showModal()
})

/* ----------------------------------------------------------- drag & drop */
let dragDepth = 0
window.addEventListener('dragenter', e => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return
  e.preventDefault()
  dragDepth++
  if (els.gate.classList.contains('gone')) {
    els.fileDrop.classList.add('on')
  } else {
    els.gate.classList.add('dragging')
    setGateStatus('DROP IT. THE SHOW IS STILL A SECRET.')
  }
})
window.addEventListener('dragover', e => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return
  e.preventDefault()
})
window.addEventListener('dragleave', e => {
  e.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) {
    els.fileDrop.classList.remove('on')
    els.gate.classList.remove('dragging')
  }
})
window.addEventListener('drop', e => {
  e.preventDefault()
  dragDepth = 0
  els.fileDrop.classList.remove('on')
  els.gate.classList.remove('dragging')
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
})

/* ------------------------------------------------------------------- loop */
function makeData() {
  const model = app.model
  const analysis = app.analysis
  const state = engine.state
  const now = nowSec()
  const data = {
    model, analysis, state,
    stats: analysis ? analysis.getStats() : null,
    chord: analysis ? analysis.getChord() : null,
    key: analysis ? analysis.getKey() : null,
    roman: analysis ? analysis.getRoman() : '',
    duration: engine.duration,
    playing: engine.playing,
    paused: engine.paused,
    spectrum: app.spectrum,
    waveform: app.waveform,
    now,
    viz,
    genre: app.genre,
    preview: app.preview,
    lookahead: app.timeline,
  }
  return data
}

function frame(ts) {
  const now = ts / 1000
  const dt = clamp(now - app.lastTick, 0, 0.05)
  app.lastTick = now

  if (app.analysis && app.model) {
    if (!engine.paused || !app.started) {
      app.analysis.update(engine.state, now)
      const ev = app.analysis.drainEvents()
      const data = makeData()
      if (ev.length) {
        viz.handleEvents(ev, data)
        gags.onEvents(ev, data)
        if (ev.some(e => e.type === 'section')) {
          app.segmentSections++
          if (app.segmentSections >= (app.segment?.length || 1)) advanceSegment()
        }
      }
    }
    if (now - app.lastGenreAt > 6) {
      app.lastGenreAt = now
      const g = detectGenre()
      if (g !== app.genre) {
        app.genre = g
        viz.setGenre(g)
        hud.setScene(segmentLabel(app.segment), app.genre.toUpperCase())
      }
    }
    if (now - app.lastTimeline > 0.4) {
      app.lastTimeline = now
      app.timeline = lookAhead(app.model, engine.state, 80)
      app.preview = previewChords(app.model, engine.state, 5)
    }
  }

  app.spectrum = engine.getSpectrum(app.spectrum)
  app.waveform = engine.getWaveform(app.waveform)
  const data = makeData()
  if (now - app.lastGagTick > 1) { app.lastGagTick = now; gags.tick(now, data) }
  viz.render(dt, data)
  if (app.model && app.analysis) hud.update(data)
  if (now - app.lastHud > 0.1) {
    app.lastHud = now
    updateTransport()
  }
  requestAnimationFrame(frame)
}

/* ---------------------------------------------------------------- start */
loadSettings()
applySettings()
updateTransport()
els.gateStatus.textContent = 'no module, no show.'
window.__TT = {
  engine, viz, hud, gags,
  get model() { return app.model },
  get analysis() { return app.analysis },
  get state() { return engine.state },
  get settings() { return settings },
  get errors() { return app.errors },
  loadFile,
  requestModule,
  seek: s => engine.seek(s),
  setChaos, setSerious, setGross, setNerd, setMonsquaz: setMonsquazMode,
  get scene() { return app.scene },
  get genre() { return app.genre },
  get segment() { return app.segment },
  advanceScene: advanceSegment,
  toast,
}
window.addEventListener('error', e => app.errors.push(String(e.message)))
window.addEventListener('unhandledrejection', e => app.errors.push(String(e.reason?.message || e.reason)))
requestAnimationFrame(frame)
