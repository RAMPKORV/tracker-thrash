import { drawSprite, RAT, WIZARD, DOG, CRT_UNCLE, MOTH } from './sprites.js'
import { drawTurd, poopTypeForChord, POOP_TYPES } from './poop.js'
import { pcName, keyName, rawNoteName, rawToMidi } from './theory.js'
import { SplatField } from './splats.js'

const W = 480
const H = 270
const BW = 240
const BH = 135
const HORIZON = 156
const FLOOR = 178
const FEET = 172

const TAU = Math.PI * 2
const SIN = new Float32Array(1024)
for (let i = 0; i < 1024; i++) SIN[i] = Math.sin((i / 1024) * TAU)
const sinT = x => SIN[((x * 162.974) | 0) & 1023]
const cosT = x => sinT(x + TAU / 4)

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

const HEX = {
  amiga: ['#05050a', '#081022', '#0c1b46', '#123f8a', '#007a9e', '#00c8d8', '#00f0ff', '#ff2bd6', '#8a00c8', '#ffe800', '#f4f0e4'],
  sunset: ['#0b0618', '#1e0b35', '#3b1157', '#7a1e6e', '#d62e6b', '#ff6b35', '#ffb03a', '#ffe6b0', '#2ee6d6', '#ffffff'],
  c64: ['#050508', '#141420', '#50459b', '#887ecb', '#6abfc6', '#5cab5e', '#9ae29b', '#c9d487', '#a1683c', '#9f4e44', '#cb7e75', '#ffffff'],
  gameboy: ['#0b120b', '#0f381f', '#306230', '#8bac0f', '#9bbc0f', '#e8f0c8'],
  ice: ['#000010', '#001030', '#002050', '#004090', '#0060d0', '#1080e8', '#30a0ff', '#60c0ff', '#90d8ff', '#c0ecff', '#ffffff'],
  ega: ['#05050a', '#0000aa', '#00aaaa', '#00aa00', '#aaaa00', '#aa5500', '#aa0000', '#aa00aa', '#555555', '#5555ff', '#55ffff', '#ffffff'],
  onebit: ['#05050a', '#f4f0e4'],
  dungeon: ['#05050a', '#0c0718', '#1b0f35', '#3a1d6e', '#6b3bb8', '#b388ff', '#ffe800', '#ff8a2b', '#f4f0e4'],
  factory: ['#05050a', '#0d0b0a', '#1b1510', '#3a2414', '#6b3a1a', '#b05a20', '#ff8a2b', '#ffe800', '#00c8d8', '#f4f0e4'],
  office: ['#05050a', '#121218', '#26262e', '#4a4a56', '#8a8a96', '#c8c8b8', '#ff4d5a', '#00c8d8', '#ffe800', '#ffffff'],
  hell: ['#05050a', '#120308', '#2a0610', '#5a0a18', '#a01028', '#ff2b3a', '#ff8a2b', '#c8ff4a', '#00f0ff', '#f4f0e4'],
  fire: ['#05050a', '#1a0000', '#330000', '#660000', '#990000', '#cc1a00', '#ff4d00', '#ff9900', '#ffcc00', '#ffff66', '#ffffff'],
}

const PALETTE_NAMES = ['amiga', 'sunset', 'c64', 'ice', 'sunset', 'amiga', 'ega']
const EFFECTS = ['plasma', 'tunnel', 'stars', 'onebit', 'twister', 'metaballs', 'copper', 'rotozoom', 'dotTunnel', 'kefrens', 'wireframe', 'glenz', 'fire', 'xor']
const SCENE_CAMERAS = {
  plaza: ['wide', 'orbit', 'handheld', 'dolly'],
  factory: ['closeup', 'handheld', 'wide', 'dolly'],
  dungeon: ['dolly', 'orbit', 'wide', 'handheld'],
  cosmic: ['orbit', 'wide', 'dolly', 'handheld'],
  office: ['handheld', 'wide', 'dolly', 'closeup'],
  hell: ['punch', 'handheld', 'wide', 'closeup'],
  coaster: ['dolly', 'handheld', 'orbit', 'punch'],
}
const SCENE_EFFECTS = {
  plaza: ['plasma', 'rotozoom', 'dotTunnel', 'copper', 'twister', 'wireframe'],
  factory: ['copper', 'tunnel', 'metaballs', 'rotozoom', 'fire'],
  dungeon: ['tunnel', 'dotTunnel', 'kefrens', 'plasma', 'wireframe'],
  cosmic: ['stars', 'tunnel', 'metaballs', 'glenz', 'rotozoom'],
  office: ['copper', 'xor', 'plasma', 'stars'],
  hell: ['metaballs', 'dotTunnel', 'glenz', 'fire', 'rotozoom'],
  coaster: ['stars', 'plasma', 'rotozoom', 'twister'],
}

const SCENES = {
  plaza: {
    label: 'DEMOSCENE PLAZA', palette: 'amiga', effect: 'plasma', floor: 'checker', intensity: 0.98,
    rat: [146, 172], wizard: [58, 172], butt: [348, 170], dog: [238, 172], orb: [424, 78], uncle: [218, 172],
  },
  factory: {
    label: 'BASS FACTORY', palette: 'factory', effect: 'copper', floor: 'metal', intensity: 0.72,
    rat: [110, 172], wizard: [62, 172], butt: [304, 168], dog: [228, 172], orb: [430, 72], uncle: [218, 172],
  },
  dungeon: {
    label: "SAD WIZARD'S DUNGEON", palette: 'dungeon', effect: 'tunnel', floor: 'stone', intensity: 0.56,
    rat: [100, 172], wizard: [236, 172], butt: [394, 170], dog: [315, 172], orb: [430, 72], uncle: [218, 172],
  },
  cosmic: {
    label: 'COSMIC 4D SPLAT REALM', palette: 'ice', effect: 'stars', floor: 'void', intensity: 0.92,
    rat: [118, 172], wizard: [62, 172], butt: [388, 168], dog: [315, 172], orb: [186, 100], uncle: [218, 172],
  },
  office: {
    label: 'SYNERGY OFFICE', palette: 'office', effect: 'copper', floor: 'carpet', intensity: 0.6,
    rat: [136, 172], wizard: [60, 172], butt: [404, 168], dog: [300, 172], orb: [432, 72], uncle: [218, 172],
  },
  hell: {
    label: 'CRT TRACKER HELL', palette: 'hell', effect: 'metaballs', floor: 'grid', intensity: 0.64,
    rat: [118, 172], wizard: [58, 172], butt: [394, 168], dog: [312, 172], orb: [432, 72], uncle: [238, 172],
  },
  coaster: {
    label: 'TOILET PAPER ROLLERCOASTER', palette: 'sunset', effect: 'stars', floor: 'coaster', intensity: 0.9,
    rat: [214, 166], wizard: [62, 172], butt: [286, 162], dog: [330, 172], orb: [430, 76], uncle: [218, 172],
  },
}

const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const RGB = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, v.map(hexToRgb)]))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = (a, b) => a + Math.random() * (b - a)
const pick = arr => arr[(Math.random() * arr.length) | 0]

const RAT_LINES = [
  'this slaps. unfortunately.',
  'I have four channels and no future.',
  'DROP IT. I mean the bass.',
  'greetz to my landlord.',
  'the snare is not okay.',
  'I am legally a rodent DJ.',
  'I did not consent to this key change.',
  'no thoughts. just tracker.',
  'this is my emotional support module.',
  'I can hear the sample names.',
  'we are so back. what is back.',
  'turn it up until the concept of Tuesday disappears.',
  'one more pattern and I am calling my mother.',
  'bass is a love language.',
  'I have never seen a MIDI file and I never will.',
]
const WIZARD_LINES = [
  'ah. yes. a chord.',
  'I did not choose the theory life.',
  'this interval is legal in 14 countries.',
  'the tritone is not the devil. the export settings are.',
  'I asked for a raise. they gave me a diminished 7th.',
  'you call it dissonance. I call it Tuesday.',
  'yes, it resolves. eventually. like all things.',
  'the voicing is fine. the voicing is always fine.',
  'I can explain it, but you will not like it.',
  'nobody expects the Neapolitan sixth.',
]
const BUTT_LINES = [
  'BASS DETECTED.',
  'I contain multitudes.',
  'the brown note is a social construct.',
  'flush me if you dare.',
  'fiber: 12%. ambition: 97%.',
  'I am not a phase, mom. I am a subwoofer.',
  'this is what the low end sees.',
  'one turd per note is technically a rhythm.',
  'do not look at me. listen to me.',
  'I have been called “structurally sound.”',
  'the forecast said soft serve.',
]
const DOG_LINES = [
  'SYNERGY.',
  'numbers.',
  'this module is a growth opportunity.',
  'I have repurposed your childhood into a brand.',
  'we are pivoting the bass to B2B.',
  'your chord progression has been monetized.',
  'let us circle back to the drop.',
  'I fired the hi-hat. it was not a team player.',
]
const ORB_LINES = [
  '...',
  'the fog is coming.',
  'I ate the melody.',
  'do not perceive me.',
  'I have seen the pattern grid. it is full of teeth.',
  'the moon is a sample.',
  'I am contractually obliged to say “vibes.”',
]

const clampText = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    canvas.width = W
    canvas.height = H
    this.ctx.imageSmoothingEnabled = false

    this.bgCanvas = document.createElement('canvas')
    this.bgCanvas.width = BW
    this.bgCanvas.height = BH
    this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false })
    this.bgImage = this.bgCtx.createImageData(BW, BH)
    this.fxCanvas = document.createElement('canvas')
    this.fxCanvas.width = W
    this.fxCanvas.height = H
    this.fxCtx = this.fxCanvas.getContext('2d')

    this.model = null
    this.settings = { chaos: 4, serious: false, gross: true, reducedMotion: false }
    this.scene = 'plaza'
    this.sceneDef = SCENES.plaza
    this.format = 'world'
    this.effectPool = SCENE_EFFECTS.plaza
    this.effectPoolIndex = 0
    this.cameraCycle = 0
    this.confettiParticles = []
    this.camera = { zoom: 1, rot: 0, x: 0, y: 0, targetZoom: 1, targetRot: 0, targetX: 0, targetY: 0, mode: 'wide' }
    this.transition = null
    this.sceneChangedAt = -10
    this.genre = 'chiptune'
    this.channelStates = []
    this.key = null
    this.analysis = null
    this.splats = new SplatField()
    this.splatReturnAt = 0
    this.t = 0
    this.last = 0
    this.paletteName = 'amiga'
    this.palette = RGB.amiga
    this.paletteCss = HEX.amiga
    this.effect = 'plasma'
    this.effectIndex = 0
    this.energy = 0
    this.bass = 0
    this.high = 0
    this.beat = 0
    this.shake = 0
    this.glitch = 0
    this.fog = 0.08
    this.flushing = 0
    this.flushT = 0
    this.scrollerX = W
    this.scroller = 'GREETZ TO EVERYONE WITH A 486 AND A DREAM · TRACKER TRASH · 100% LOCAL · LIBOPENMPT INSIDE · NO UPLOADS, NO MERCY · '
    this.speech = null
    this.onCaption = null
    this.sceneTag = 'SEASON 1'
    this.gary = { x: 200, y: 100 }
    this.lastLine = ''
    this.particles = []
    this.notes = []
    this.turds = []
    this.horns = []
    this.dust = []
    this.landed = 0
    this.lastPoopAt = -10
    this.lastPelletAt = -10
    this.lastChordPoop = -10
    this.lastCaption = ''
    this.captionUntil = 0
    this.dogUntil = 0
    this.uncleUntil = 0
    this.butt = {
      x: 348, y: 170, strain: 0, jiggle: 0, blink: 0,
      lastPush: -10, mood: 'idle',
    }
    this.rat = { x: 146, y: FEET, bounce: 0, headbang: 0 }
    this.wizard = { x: 58, y: FEET, sway: 0 }
    this.dog = { x: 238, y: FEET }
    this.uncle = { x: 218, y: FEET }
    this.orb = { x: 424, y: 78, targetY: 78, blink: 0, baseX: 424, baseY: 78 }
    this.moth = { x: 430, y: 120, phase: 0 }
    this.chord = null
    this.key = null
    this.roman = ''
    this.spectrum = null
    this.waveform = null
    this.preview = []
    this.lookahead = []
    this.paused = true
    this.playing = false
    this.lastState = null
    this.modelSeed = 0
    this.captionQueue = []
    this.brownNote = 0
    this.dvd = null
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false
    this.settings.reducedMotion = this.reducedMotion
  }

  setSettings(s) {
    this.settings = { ...this.settings, ...s }
    if (this.settings.serious) {
      this.turds = []
      this.landed = 0
      this.fog = 0
      this.horns = []
    }
  }

  setGenre(genre) {
    this.genre = genre || this.genre
  }

  setFormat(format) {
    const f = ['world', 'fx', 'multiview', 'terminal', 'bars'].includes(format) ? format : 'world'
    if (f === this.format) return
    this.format = f
    this.sceneChangedAt = this.t
    this.transition = { type: f === 'terminal' ? 'bars' : Math.random() < 0.45 ? 'iris' : 'flash', at: this.t, dur: f === 'terminal' ? 0.34 : 0.28 }
    this.glitch = Math.max(this.glitch, 0.3)
    this.sceneTag = pick(['SEASON 1', 'BANNED IN 3 DIMENSIONS', 'PAL, 50HZ, SPIRITUALLY', 'CERTIFIED 4-CHANNEL', 'NOW WITH 40% MORE', 'CONTAINS REAL DITHER', 'APPROVED BY NOBODY', 'DO NOT PERCEIVE THE BASS'])
    this.confetti(f === 'world' ? 10 : 26)
  }

  setEffect(name) {
    if (name) this.effect = name
  }

  rotateWorldEffect() {
    if (!this.effectPool?.length) return
    this.effectPoolIndex = (this.effectPoolIndex + 1) % this.effectPool.length
    this.effect = this.effectPool[this.effectPoolIndex]
  }

  setCamera(mode = 'wide', opts = {}) {
    this.camera.mode = mode
    const base = {
      wide: [1, 0, 0, 0], dolly: [1.08, 0, 0, 0], orbit: [1.06, 0, 0, 0],
      closeup: [1.38, 0, 0, 22], handheld: [1.04, 0, 0, 0], punch: [1.12, 0, 0, 0],
      fisheye: [1.2, 0, 0, 0],
    }[mode] || [1, 0, 0, 0]
    this.camera.targetZoom = opts.zoom ?? base[0]
    this.camera.targetRot = opts.rot ?? base[3] * 0.002
    this.camera.targetX = opts.x ?? base[2]
    this.camera.targetY = opts.y ?? base[3]
  }

  setScene(name) {
    const def = SCENES[name] || SCENES.plaza
    this.scene = SCENES[name] ? name : 'plaza'
    this.sceneDef = def
    this.sceneChangedAt = this.t
    this.sceneTag = pick(['SEASON 1', 'BANNED IN 3 DIMENSIONS', 'PAL, 50HZ, SPIRITUALLY', 'CERTIFIED 4-CHANNEL', 'NOW WITH 40% MORE', 'CONTAINS REAL DITHER', 'APPROVED BY NOBODY', 'DO NOT PERCEIVE THE BASS'])
    this.transition = { type: 'flash', at: this.t, dur: 0.24 }
    this.paletteName = def.palette
    this.palette = RGB[def.palette] || RGB.amiga
    this.paletteCss = HEX[def.palette] || HEX.amiga
    this.effect = def.effect
    this.effectPool = SCENE_EFFECTS[this.scene] || EFFECTS
    this.effectPoolIndex = 0
    this.cameraCycle = 0
    this.gary = { x: 20 + Math.floor((this.scene.length * 73 + this.modelSeed) % 430), y: 64 + Math.floor((this.scene.length * 37 + this.modelSeed) % 92) }
    this.confetti(28)
    this.rat.x = def.rat[0]; this.rat.y = def.rat[1]
    this.wizard.x = def.wizard[0]; this.wizard.y = def.wizard[1]
    this.butt.x = def.butt[0]; this.butt.y = def.butt[1]
    this.dog.x = def.dog[0]; this.dog.y = def.dog[1]
    this.uncle.x = def.uncle[0]; this.uncle.y = def.uncle[1]
    this.orb.baseX = def.orb[0]; this.orb.baseY = def.orb[1]
    this.orb.x = def.orb[0]; this.orb.y = def.orb[1]; this.orb.targetY = def.orb[1]
    this.dogUntil = this.t + (this.scene === 'office' ? 1e9 : 3.5)
    this.uncleUntil = this.t + (this.scene === 'hell' ? 1e9 : 0)
    this.glitch = Math.max(this.glitch, 0.28)
    this.fog = Math.min(this.fog, 0.25)
    const shape = this.scene === 'cosmic' ? 'tesseract' : this.scene === 'factory' ? 'turd' : this.scene === 'dungeon' ? 'torus' : this.scene === 'office' ? 'sphere' : 'galaxy'
    this.splats.setShape(shape)
    if (this.chord?.name) this.splats.setChord(this.chord.name)
    this.flush()
  }

  showDog(seconds = 7) {
    this.dogUntil = Math.max(this.dogUntil, this.t + seconds)
  }

  setModel(model) {
    this.model = model
    if (!model) return
    this.modelSeed = [...model.title].reduce((a, c) => a + c.charCodeAt(0), 0)
    this.chord = null
    this.key = null
    this.turds = []
    this.particles = []
    this.notes = []
    this.landed = 0
    this.effectIndex = 0
    this.effect = EFFECTS[0]
    this.paletteName = 'amiga'
    this.palette = RGB.amiga
    this.paletteCss = HEX.amiga
    this.fog = 0.08
    this.scrollerX = W
    this.scroller = `GREETZ TO ${model.artist.toUpperCase()} · ${model.title.toUpperCase()} · ${model.format} · ${model.totalOrders} ORDERS · ${model.maxChannels} CHANNELS OF QUESTIONABLE INTENT · 100% LOCAL · LIBOPENMPT INSIDE · NO UPLOADS, NO MERCY · `
    this.say('rat', `now loading: ${clampText(model.title, 36)}`, 3.4)
    this.scene = 'plaza'; this.sceneDef = SCENES.plaza; this.sceneChangedAt = this.t
    this.splats.lastText = ''
    this.splats.setShape('galaxy')
    this.dogUntil = this.t
    this.uncleUntil = this.t
  }

  caption(text, seconds = 2.8) {
    this.lastCaption = text
    this.captionUntil = this.t + seconds
    this.onCaption?.(text, seconds)
  }

  say(who, text, seconds = 2.6, force = false) {
    if (!this.settings.gross && who === 'butt') return
    if (this.settings.serious) return
    if (this.speech && this.speech.until > this.t && !force) return
    if (text === this.lastLine && !force) return
    this.lastLine = text
    this.speech = { who, text: clampText(text, 60), until: this.t + seconds }
  }

  _pickLine(lines, seed = 0) {
    if (!lines.length) return ''
    const i = Math.abs(Math.floor(seed + this.modelSeed + this.t)) % lines.length
    return lines[i]
  }

  _paletteForEffect(effect) {
    if (effect === 'onebit') return RGB.onebit
    if (effect === 'fire') return RGB.fire
    return this.palette
  }

  _setPlayhead(data) {
    if (!data) return
    this.paused = !!data.paused
    this.playing = !!data.playing
    this.spectrum = data.spectrum || this.spectrum
    this.waveform = data.waveform || this.waveform
    this.preview = data.preview || this.preview
    this.lookahead = data.lookahead || this.lookahead
    this.chord = data.chord || this.chord
    this.key = data.key || this.key
    this.roman = data.roman || this.roman
    this.lastState = data.state || this.lastState
    if (data.analysis) {
      this.analysis = data.analysis
      this.channelStates = data.analysis.getChannelStates()
    }
    if (data.key) this.key = data.key
  }

  handleEvents(events, data) {
    if (!events || !events.length) return
    this._setPlayhead(data)
    const now = this.t
    const state = data?.state || {}
    for (const e of events) {
      if (e.type === 'section') {
        this.onSection(e, state)
      } else if (e.type === 'chord') {
        this.onChord(e)
      } else if (e.type === 'silence') {
        this.onSilence()
      } else if (e.type === 'note') {
        this.onNote(e, state)
      }
    }
  }

  onSection(e, state) {
    if (this.settings.serious) return
    if (this.format === 'world') {
      this.rotateWorldEffect()
      const cams = SCENE_CAMERAS[this.scene] || ['wide']
      this.cameraCycle = (this.cameraCycle + 1) % cams.length
      this.setCamera(cams[this.cameraCycle])
    }
    this.confetti(18)
    this.flush()
    this.fog = Math.max(0.04, this.fog - 0.25)
    this.glitch = 0.24
    if (this.settings.chaos >= 2) {
      const shapes = this.scene === 'factory' ? ['turd', 'tesseract'] : this.scene === 'dungeon' ? ['torus', 'tesseract'] : this.scene === 'office' ? ['sphere', 'tesseract'] : ['tesseract', 'galaxy', 'torus']
      this.splats.setShape(shapes[(e.section || 0) % shapes.length])
      this.splatReturnAt = this.t + 1.8
    }
    this.say('rat', this._pickLine(RAT_LINES, e.order * 3.1), 2.5, true)
    if (this.settings.chaos >= 5 && Math.random() < 0.45) this.dogUntil = this.t + 6
    if (this.settings.chaos >= 6 && Math.random() < 0.22) this.uncleUntil = this.t + 3.5
    if (this._energyNow() > 0.6 && this.settings.chaos >= 4) this.dropHorns()
  }

  onChord(e) {
    this.chord = e.chord
    this.roman = e.roman || this.roman
    if (this.chord?.name) this.splats.setChord(this.chord.name)
    if (this.settings.serious) return
    if (this.chord?.name) {
      const line = this._wizardChordLine(this.chord)
      this.say('wizard', line, 2.8)
      if (this.settings.gross && this.settings.chaos >= 2 && this.t - this.lastChordPoop > 0.55) {
        this.lastChordPoop = this.t
        const type = poopTypeForChord(this.chord, { role: 'chord', dissonance: 0.15 })
        this.spawnTurd(type, this.chord.name, 16, 0.1)
      }
    }
  }

  _wizardChordLine(chord) {
    const blunt = {
      '': 'major. brave.',
      m: 'minor. the people are sad.',
      dim: 'diminished. structurally a nugget.',
      aug: 'augmented. nobody asked.',
      sus2: 'suspended. pending approval.',
      sus4: 'suspended. still pending.',
      '5': 'a power chord. the bass department approves.',
      '6': 'a sixth. unnecessarily friendly.',
      m6: 'a minor sixth. wistful and damp.',
      '7': 'dominant seventh. it wants something.',
      maj7: 'major seventh. a trust fund in chord form.',
      m7: 'minor seventh. a loose stool in a good way.',
      m7b5: 'half-diminished. the forbidden nugget.',
      dim7: 'diminished seventh. call your lawyer.',
      aug7: 'augmented seventh. a haunted elevator.',
      '9': 'a ninth. someone has too many fingers.',
      maj9: 'a major ninth. the trust fund has a boat.',
      m9: 'a minor ninth. the loose stool has a boat.',
      add9: 'an add9. glitter on a sandwich.',
      '7sus4': 'seventh suspended. the chord is on hold.',
      '11': 'an eleventh. the voicing is a cry for help.',
      m11: 'a minor eleventh. damp and expansive.',
      '13': 'a thirteenth. please stop.',
      '6/9': 'a six-nine. the chord is twelve.',
    }
    const tail = blunt[chord.suffix] || 'a chord. allegedly.'
    return `${chord.name}: ${tail}`
  }

  onSilence() {
    if (this.settings.serious) return
    this.fog = Math.min(0.9, this.fog + 0.12)
    this.say('orb', pick(ORB_LINES), 3.2, true)
    if (this.settings.chaos >= 4 && !this.dvd) {
      this.dvd = {
        x: rand(40, W - 80), y: rand(80, 160), vx: rand(35, 70), vy: rand(25, 55),
        t: 0, hits: 0,
      }
    }
  }

  onNote(e, state) {
    const t = this.t
    this.addNoteParticle(e)
    if (e.kind === 'kick') {
      this.shake = Math.max(this.shake, this.settings.reducedMotion ? 0 : 2.2)
      this.rat.bounce = 1
      this.butt.jiggle = 1
      this.beat = 1
      this.addOnomatopoeia('THUMP', e, 0.9)
      this.dust.push({ x: 60 + rand(-20, 20), y: FLOOR, vx: rand(-25, 25), vy: rand(-30, -8), life: 0.5, max: 0.5, r: rand(2, 6) })
    } else if (e.kind === 'snare') {
      this.butt.clench = 1
      this.shake = Math.max(this.shake, this.settings.reducedMotion ? 0 : 1.2)
      this.addOnomatopoeia(pick(['SKRRT', 'PAH', 'TSK']), e, 0.8)
      this.puff(this.butt.x, this.butt.y - 22, 5)
    } else if (e.kind === 'hat') {
      this.spark(e)
    } else if (e.kind === 'bass') {
      this.butt.strain = clamp(this.butt.strain + 0.6, 0, 1.4)
      this.rat.headbang = 1
      this.bass = clamp(this.bass + 0.25, 0, 1)
      this.maybeSpawnPoop(e, state)
    } else if (e.kind === 'lead') {
      this.orb.targetY = clamp(160 - ((e.midi - 48) / 60) * 110, 56, 140)
      this.orb.blink = 0
      if (this.settings.chaos >= 5 && t - this.lastPelletAt > 0.35) {
        this.lastPelletAt = t
        this.spawnTurd('pellet', e.name, 8, 0.4)
      }
    } else if (e.kind === 'chord') {
      if (this.chord) this.wizard.sway = 1
    }
    if (e.kind === 'crash') {
      this.glitch = Math.max(this.glitch, 0.3)
      this.dropHorns()
    }
  }

  maybeSpawnPoop(e, state) {
    if (!this.settings.gross || this.settings.serious) return
    if (this.t - this.lastPoopAt < 0.52) return
    this.lastPoopAt = this.t
    const chord = this.chord
    const type = poopTypeForChord(chord, { role: 'bass', midi: e.midi, dissonance: 0.1 })
    const size = 12 + clamp((64 - e.midi) * 0.55, 0, 15) + (e.vel / 64) * 5
    this.spawnTurd(type, e.name || chord?.name || 'BASS', size, 0.3, null, e.color)
    this.butt.lastPush = this.t
    if (type === 'spicy') this.brownNote = 1
  }

  spawnTurd(type, label, size = 14, angle = 0.2, color = null, labelColor = null) {
    if (this.settings.serious || this.settings.chaos < 1) return
    const meta = POOP_TYPES[type] || POOP_TYPES.soft
    const x = this.butt.x + rand(-5, 5)
    const y = this.butt.y - 18
    this.turds.push({
      x, y, vx: Math.sin(angle) * rand(40, 90) + rand(-25, 25), vy: rand(-110, -55),
      size, type, label, color: color || meta.color, labelColor, rot: rand(-0.3, 0.3), vr: rand(-3, 3),
      landed: false, alpha: 1, t: 0, floorY: FLOOR, splat: false,
    })
    this.puff(x, y, 3)
    if (this.turds.length > 32) this.turds.shift()
  }

  puff(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      this.dust.push({
        x, y, vx: rand(-35, 35), vy: rand(-35, 10), life: rand(0.2, 0.55), max: 0.55, r: rand(1, 4),
      })
    }
  }

  dropHorns() {
    if (this.settings.serious || this.settings.chaos < 4) return
    const n = Math.min(8, 2 + Math.floor(this.settings.chaos / 2))
    for (let i = 0; i < n; i++) {
      this.horns.push({
        x: 50 + (i / Math.max(1, n - 1)) * (W - 100),
        y: H + 18 + rand(0, 30), rot: rand(-0.4, 0.4), life: 2.2, max: 2.2, scale: rand(0.7, 1.2),
      })
    }
    this.addOnomatopoeia('BWAAAH', { color: '#ffe800', role: 'bass', name: '' }, 1.4, W / 2, 120)
  }

  addOnomatopoeia(text, e, life = 1, x = null, y = null) {
    if (this.settings.serious) return
    const pos = this._eventAnchor(e)
    this.particles.push({
      kind: 'word', text, x: x ?? pos.x + rand(-14, 14), y: y ?? pos.y - rand(4, 22),
      vx: rand(-12, 12), vy: rand(-50, -24), life, max: life, color: e?.color || '#ffe800', size: rand(10, 14),
    })
  }

  _eventAnchor(e) {
    if (e.kind === 'bass' || e.role === 'bass') return { x: this.butt.x, y: this.butt.y - 48 }
    if (e.kind === 'lead' || e.role === 'lead') return { x: this.orb.x, y: this.orb.y + 6 }
    if (e.role === 'chord') return { x: this.wizard.x + 12, y: this.wizard.y - 44 }
    if (e.role === 'drums') return { x: this.rat.x, y: this.rat.y - 24 }
    return { x: 240, y: 120 }
  }

  addNoteParticle(e) {
    if (this.settings.serious && this.settings.chaos === 0) return
    if (this.settings.chaos < 1) return
    const p = this._eventAnchor(e)
    const life = e.kind === 'kick' || e.kind === 'snare' ? 0.5 : 1.15
    this.notes.push({
      x: p.x + rand(-8, 8), y: p.y + rand(-5, 5),
      vx: rand(-12, 12), vy: rand(-42, -20), life, max: life,
      text: e.name || pcName(e.pc ?? 0), color: e.color || '#00f0ff', kind: e.kind, size: 6,
    })
    if (this.notes.length > 90) this.notes.shift()
  }

  spark(e) {
    const p = this._eventAnchor(e)
    for (let i = 0; i < 2; i++) {
      this.notes.push({
        x: p.x + rand(-15, 15), y: p.y + rand(-6, 10), vx: rand(-20, 20), vy: rand(-30, -10),
        life: 0.4, max: 0.4, text: '', color: e.color || '#ffe800', kind: 'spark', size: 1,
      })
    }
  }

  confetti(n = 24) {
    if (this.settings.serious || this.settings.reducedMotion || this.settings.chaos < 1) return
    for (let i = 0; i < n; i++) {
      const color = [this.paletteCss[6], this.paletteCss[7], this.paletteCss[8], this.paletteCss[5], '#f2ecdd'].filter(Boolean)[i % 5]
      this.confettiParticles.push({
        x: rand(30, W - 30), y: rand(70, 130), vx: rand(-80, 80), vy: rand(-140, -30),
        life: rand(0.8, 2.2), max: 2.2, color, size: rand(1, 3), rot: rand(0, 6.28), vr: rand(-8, 8),
      })
    }
    if (this.confettiParticles.length > 220) this.confettiParticles.splice(0, this.confettiParticles.length - 220)
  }

  flush() {
    if (!this.turds.length) return
    this.flushing = 1
    this.flushT = 0
    this.caption('FLUSHED. the bass department has reset.', 1.6)
  }

  _energyNow() {
    return clamp(this.energy, 0, 1)
  }

  update(dt, data) {
    this._setPlayhead(data)
    this.t += dt
    this.energy = clamp(this.energy * Math.pow(0.08, dt) + (data?.stats?.vuRms || 0) * 0.06, 0, 1)
    const sp = this.spectrum
    let bass = 0, high = 0
    if (sp && sp.length) {
      const n = Math.min(12, sp.length)
      for (let i = 0; i < n; i++) bass += sp[i]
      bass /= n * 255
      const h0 = Math.floor(sp.length * 0.45)
      for (let i = h0; i < sp.length; i += 4) high += sp[i]
      high /= Math.max(1, Math.ceil((sp.length - h0) / 4) * 255)
    } else {
      const chans = data?.analysis?.getChannelStates?.() || []
      const b = chans.find(c => c.role === 'bass')
      bass = b?.vu || 0
    }
    this.bass = clamp(this.bass * 0.8 + bass * 0.2, 0, 1.4)
    this.high = clamp(this.high * 0.85 + high * 0.15, 0, 1.4)
    if (data?.analysis) {
      this.analysis = data.analysis
      this.channelStates = data.analysis.getChannelStates()
    }
    if (data?.key) this.key = data.key
    if (data?.chord?.name && data.chord.name !== this.splats.lastText && this.t > this.splatReturnAt) this.splats.setChord(data.chord.name)
    if (data?.genre) this.genre = data.genre
    if (this.splatReturnAt && this.t > this.splatReturnAt) {
      this.splatReturnAt = 0
      if (this.chord?.name) this.splats.setChord(this.chord.name)
      else this.splats.setShape('tesseract')
    }
    this.splats.update(dt, this.t, this.bass, this.high)
    const cam = this.camera
    const mode = cam.mode
    if (mode === 'orbit' || mode === 'dolly' || mode === 'closeup' || mode === 'handheld' || mode === 'punch') {
      if (mode === 'orbit') { cam.targetRot = Math.sin(this.t * 0.18) * 0.035; cam.targetZoom = 1.06 + Math.sin(this.t * 0.11) * 0.02 }
      if (mode === 'dolly') { cam.targetZoom = 1.07 + Math.sin(this.t * 0.45) * 0.04; cam.targetX = Math.sin(this.t * 0.21) * 3 }
      if (mode === 'closeup') { cam.targetZoom = 1.34 + Math.sin(this.t * 0.3) * 0.025; cam.targetX = (this.butt.x - W / 2) * 0.32; cam.targetY = (this.butt.y - 30 - H / 2) * 0.22 }
      if (mode === 'handheld') { cam.targetX = Math.sin(this.t * 2.7) * 2.2; cam.targetY = Math.cos(this.t * 2.1) * 1.4; cam.targetRot = Math.sin(this.t * 1.3) * 0.004; cam.targetZoom = 1.035 }
      if (mode === 'punch') { cam.targetZoom = 1.1 + this.beat * 0.045; cam.targetX = Math.sin(this.t * 9) * this.butt.jiggle * 1.2 }
    } else {
      cam.targetZoom = 1; cam.targetRot = 0; cam.targetX = 0; cam.targetY = 0
    }
    const k = Math.min(1, dt * 3.1)
    cam.zoom += (cam.targetZoom - cam.zoom) * k
    cam.rot += (cam.targetRot - cam.rot) * k
    cam.x += (cam.targetX - cam.x) * k
    cam.y += (cam.targetY - cam.y) * k
    this.shake *= Math.pow(0.02, dt)
    this.glitch *= Math.pow(0.005, dt)
    this.butt.strain = clamp(this.butt.strain - dt * 1.8, 0, 1.5)
    this.butt.jiggle = clamp(this.butt.jiggle - dt * 4, 0, 1)
    this.rat.bounce = clamp(this.rat.bounce - dt * 6, 0, 1)
    this.rat.headbang = clamp(this.rat.headbang - dt * 5, 0, 1)
    this.orb.blink = clamp(this.orb.blink - dt * 3, 0, 1)
    this.wizard.sway = clamp(this.wizard.sway - dt * 2, 0, 1)
    this.beat = clamp(this.beat - dt * 5, 0, 1)
    this.orb.y += (this.orb.targetY - this.orb.y) * Math.min(1, dt * 5)
    this.orb.x = (this.orb.baseX || 424) + sinT(this.t * 0.7) * 12
    this.moth.phase += dt * 4
    this.moth.x = 430 + sinT(this.t * 0.9 + 1) * 18
    this.moth.y = 116 + sinT(this.t * 1.7) * 12
    if (this.speech && this.speech.until < this.t) this.speech = null
    if (this.captionUntil < this.t) this.lastCaption = ''

    // fog: bass grows it, drops clear it
    const chaosFog = this.settings.serious ? 0 : (this.settings.chaos / 10) * 0.015
    this.fog = clamp(this.fog + dt * (0.002 + this.bass * 0.004 + chaosFog), 0, 1)
    if (this.fog > 0.92) this.fog = 0.92

    // particles
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.kind === 'word' ? -5 : 28) * dt
    }
    this.particles = this.particles.filter(p => p.life > 0)
    for (const n of this.notes) {
      n.life -= dt
      n.x += n.vx * dt
      n.y += n.vy * dt
      n.vy += 8 * dt
    }
    this.notes = this.notes.filter(n => n.life > 0)
    for (const d of this.dust) {
      d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 40 * dt
    }
    this.dust = this.dust.filter(d => d.life > 0)
    for (const c of this.confettiParticles) {
      c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 110 * dt; c.rot += c.vr * dt
    }
    this.confettiParticles = this.confettiParticles.filter(c => c.life > 0)
    for (const h of this.horns) {
      h.life -= dt; h.y -= dt * 7
    }
    this.horns = this.horns.filter(h => h.life > 0)

    // turds
    let landedCount = 0
    for (const p of this.turds) {
      if (p.landed) { landedCount++; continue }
      p.t += dt
      p.vy += 370 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      const floor = FLOOR - Math.min(26, landedCount * 2.6) - p.size * 0.15
      if (p.y >= floor) {
        p.y = floor
        p.landed = true
        p.vx = 0
        p.vy = 0
        p.rot = rand(-0.25, 0.25)
        p.splat = true
        landedCount++
        this.landed++
        this.puff(p.x, p.y + 2, 3)
      }
    }
    if (this.turds.length > 32) this.turds.splice(0, this.turds.length - 32)
    if (this.flushing) {
      this.flushT += dt
      for (const p of this.turds) {
        p.x += (this.butt.x - p.x) * dt * 2.4
        p.y += dt * 30
        p.rot += dt * 4
        p.alpha = Math.max(0, 1 - this.flushT / 1.0)
      }
      if (this.flushT > 1.0) {
        this.turds = []
        this.landed = 0
        this.flushing = 0
        this.flushT = 0
      }
    }

    if (this.dvd) {
      this.dvd.t += dt
      this.dvd.x += this.dvd.vx * dt
      this.dvd.y += this.dvd.vy * dt
      if (this.dvd.x < 12 || this.dvd.x > W - 128) { this.dvd.vx *= -1; this.dvd.hits++ }
      if (this.dvd.y < 70 || this.dvd.y > 190) { this.dvd.vy *= -1; this.dvd.hits++ }
      if (this.dvd.t > 8) this.dvd = null
    }
    this.scrollerX -= dt * (20 + (this.lastState?.tempo || 125) * 0.12)
    if (this.scrollerX < -this.scroller.length * 7) this.scrollerX = W
  }

  render(dt, data) {
    this.update(dt, data)
    const ctx = this.ctx
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#05050a'
    ctx.fillRect(0, 0, W, H)
    const shake = this.settings.reducedMotion ? 0 : this.shake
    if (shake > 0.1) ctx.translate(rand(-shake, shake), rand(-shake, shake))

    this.renderBackground(this.t, this.energy, this.bass)
    if (this.format === 'multiview') {
      this.drawMultiview(ctx)
      this.drawMonument(ctx)
      this.drawNoteRibbon(ctx)
      this.drawParticles(ctx)
      this.drawFormatLabel(ctx)
    } else if (this.format === 'terminal') {
      this.drawTerminal(ctx)
    } else if (this.format === 'bars') {
      this.drawBars(ctx)
    } else {
      const cam = this.camera
      ctx.save()
      ctx.translate(W / 2 + cam.x, H / 2 + cam.y)
      ctx.rotate(cam.rot)
      ctx.scale(cam.zoom, cam.zoom)
      ctx.translate(-W / 2, -H / 2)
      ctx.fillStyle = '#05050a'
      ctx.fillRect(-70, -70, W + 140, H + 140)
      ctx.drawImage(this.bgCanvas, -30, -30, W + 60, H + 60)
      if (this.format === 'world') {
        this.drawSceneBackdrop(ctx)
        this.drawSplats(ctx)
        this.drawFloor(ctx)
        this.drawChannelProps(ctx)
        this.drawCharacters(ctx)
        this.drawTurds(ctx)
        this.drawHorns(ctx)
      } else {
        // full-screen effect: keep only the spectral junk and a few turds
        this.drawSplats(ctx)
        this.drawTurds(ctx)
        this.drawHorns(ctx)
      }
      this.drawParticles(ctx)
      ctx.restore()
      this.drawMonument(ctx)
      this.drawNoteRibbon(ctx)
      this.drawScroller(ctx)
      this.drawFog(ctx)
      this.drawSceneTitle(ctx)
      this.drawFormatLabel(ctx)
      this.drawStageText(ctx)
      this.drawDVD(ctx)
    }
    this.drawTransition(ctx)
    ctx.restore()

    if (this.glitch > 0.02) this.drawGlitch(ctx)
  }

  renderBackground(t, energy, bass) {
    const data = this.bgImage.data
    const pal = this._paletteForEffect(this.effect)
    const n = pal.length - 1
    const effect = this.effect
    const boost = (0.94 + Math.min(0.24, energy * 0.16 + bass * 0.12)) * (this.sceneDef?.intensity ?? 1)
    let i = 0
    for (let y = 0; y < BH; y++) {
      const ny = y / BH - 0.5
      for (let x = 0; x < BW; x++) {
        const nx = x / BW - 0.5
        let v = 0
        if (effect === 'plasma') {
          v = 0.5 + 0.24 * sinT(x * 0.075 + t * 0.9) + 0.2 * sinT(y * 0.11 - t * 0.7)
            + 0.17 * sinT((x + y) * 0.065 + t * 1.3)
        } else if (effect === 'tunnel') {
          const r = Math.sqrt(nx * nx + ny * ny) + 0.01
          const a = Math.atan2(ny, nx)
          v = 0.5 + 0.42 * sinT(9 / r - t * 2.2 + a * 2.5)
          v *= clamp(1.15 - r * 0.8, 0, 1)
        } else if (effect === 'stars') {
          v = 0.12 + 0.2 * sinT(y * 0.1 + t * 0.2) + 0.08 * sinT(x * 0.08 - t * 0.4)
        } else if (effect === 'onebit') {
          const horizon = 82
          const mountains = 82 - 26 * Math.abs(sinT(x * 0.03 + 1.2)) - 14 * Math.abs(sinT(x * 0.07 + 3.4))
          const sun = Math.hypot(x - 164, y - 54) < 30 ? 1 : 0
          v = y > horizon ? 0.15 : (y > mountains ? 0.35 : (sun ? 0.88 : 0.07))
          v += 0.05 * sinT(x * 0.2 + t)
        } else if (effect === 'twister') {
          const band = sinT(y * 0.045 + t * 0.6) * 3
          const w = BW * 0.5 + sinT(y * 0.07 + t * 1.4) * BW * 0.36
          const u = Math.abs(x - BW / 2) / Math.max(1, w)
          v = u < 1 ? 0.55 + 0.4 * sinT(band + u * 6 + t * 1.8) : 0.1
        } else if (effect === 'metaballs') {
          let f = 0
          for (let k = 0; k < 5; k++) {
            const bx = BW * 0.5 + sinT(t * (0.3 + k * 0.07) + k * 2.1) * BW * 0.3
            const by = BH * 0.5 + cosT(t * (0.27 + k * 0.05) + k * 1.7) * BH * 0.28
            const dx = x - bx, dy = y - by
            f += 160 / (Math.sqrt(dx * dx + dy * dy) + 8)
          }
          v = clamp((f - 0.7) * 0.55, 0, 1)
        } else if (effect === 'copper') {
          v = 0.16 + 0.4 * Math.max(0, sinT(y * 0.16 + t * 1.2)) + 0.18 * sinT(x * 0.04 + t * 0.8)
          v *= 0.8 + 0.2 * sinT(y * 0.5)
        } else if (effect === 'rotozoom') {
          const ca = cosT(t * 0.27), sa = sinT(t * 0.27)
          const zz = 1.5 + sinT(t * 0.37) * 0.55
          const u = (nx * ca - ny * sa) * zz * 7
          const w = (nx * sa + ny * ca) * zz * 7
          const tex = (Math.floor(u) + Math.floor(w)) & 1
          v = 0.16 + 0.34 * tex + 0.15 * sinT(u * 0.9 + w * 0.7 + t)
        } else if (effect === 'dotTunnel') {
          const r = Math.sqrt(nx * nx + ny * ny) + 0.01
          const a = Math.atan2(ny, nx)
          const dots = sinT(28 / r + a * 4 - t * 3)
          v = dots > 0.42 ? 0.82 : 0.06 + 0.2 * Math.max(0, 1 - r * 1.5)
        } else if (effect === 'kefrens') {
          const col = Math.floor(x / 3)
          const h = 0.16 * sinT(col * 0.18 + t * 1.4) + 0.12 * sinT(col * 0.07 - t * 0.8)
          v = Math.abs(ny - h) < 0.055 ? 0.88 : 0.1 + 0.13 * (sinT(ny * 30 + t * 2) * 0.5 + 0.5)
        } else if (effect === 'xor') {
          const tex = (((x >> 2) ^ (y >> 2) ^ ((t * 18) | 0)) & 15) / 15
          v = 0.12 + tex * 0.62
        } else if (effect === 'fire') {
          const f = 1 - y / BH
          v = 0.13 + 0.7 * Math.max(0, f * 1.45 - 0.28)
          v += 0.17 * sinT(x * 0.12 + t * 4) + 0.12 * sinT(y * 0.18 - t * 3)
          v *= 0.78 + 0.22 * sinT(x * 0.3 + t)
        } else if (effect === 'wireframe') {
          v = 0.1 + 0.2 * (1 - y / BH) + 0.06 * sinT(x * 0.05 + t)
        } else if (effect === 'glenz') {
          v = 0.06 + 0.12 * (1 - Math.abs(ny)) + 0.05 * sinT(nx * 4 + t)
        }
        const b = BAYER[((y & 3) << 2) | (x & 3)] / 16
        const vig = clamp(1.08 - (nx * nx + ny * ny) * 1.25, 0.12, 1)
        v = clamp((v * boost + b * 0.13 - 0.06) * vig, 0, 0.82)
        const idx = clamp(Math.floor(v * n + b - 0.5), 0, n)
        const c = pal[idx]
        data[i++] = c[0]
        data[i++] = c[1]
        data[i++] = c[2]
        data[i++] = 255
      }
    }
    this.bgCtx.putImageData(this.bgImage, 0, 0)

    if (effect === 'stars') {
      const ctx = this.bgCtx
      for (let k = 0; k < 80; k++) {
        const sx = ((k * 73.13 + t * (12 + (k % 5) * 6)) % (BW + 20)) - 10
        const sy = ((k * 41.77) % BH)
        const tw = 0.4 + 0.6 * Math.abs(sinT(t * 1.5 + k))
        ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`
        ctx.fillRect(sx | 0, sy | 0, k % 11 === 0 ? 2 : 1, 1)
      }
    }
    if (effect === 'copper') {
      const ctx = this.bgCtx
      ctx.fillStyle = 'rgba(255,43,214,.22)'
      for (let k = 0; k < 4; k++) {
        const yy = (BH * 0.2 + k * 15 + sinT(t * 0.8 + k) * 8) | 0
        ctx.fillRect(0, yy, BW, 1)
      }
    }
    if (effect === 'wireframe') {
      const ctx = this.bgCtx
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = this.paletteCss[6] || '#00f0ff'
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 0.7
      const horizon = 76
      for (let row = 0; row < 12; row++) {
        const z = 1 + row * 0.32
        ctx.beginPath()
        for (let sx = 0; sx <= BW; sx += 3) {
          const u = (sx - BW / 2) / (BW / 2) / z
          const y = horizon + (24 / z) + sinT(u * 3.5 + t * 1.2 + row * 0.3) * (5 / z) + row * 4
          if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = this.paletteCss[7] || '#ff2bd6'
      for (let k = -8; k <= 8; k++) {
        ctx.beginPath(); ctx.moveTo(BW / 2, horizon); ctx.lineTo(BW / 2 + k * 26, BH); ctx.stroke()
      }
      ctx.restore()
    }
    if (effect === 'glenz') {
      const ctx = this.bgCtx
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const verts = []
      for (let k = 0; k < 8; k++) {
        const a = t * 0.4 + k / 8 * Math.PI * 2
        const b = t * 0.23 + k * 1.7
        verts.push([Math.cos(a) * Math.cos(b) * 70, Math.sin(b) * 48, Math.sin(a) * Math.cos(b) * 70 + 120])
      }
      const proj = v => {
        const s = 180 / (180 + v[2])
        return [BW / 2 + v[0] * s, BH / 2 + v[1] * s]
      }
      const colors = [this.paletteCss[6], this.paletteCss[7], this.paletteCss[8]].filter(Boolean)
      for (let k = 0; k < 8; k++) {
        const a = proj(verts[k]), b = proj(verts[(k + 1) % 8]), c = proj(verts[(k + 3) % 8])
        ctx.fillStyle = colors[k % colors.length]
        ctx.globalAlpha = 0.13 + 0.1 * Math.abs(sinT(t + k))
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill()
        ctx.strokeStyle = colors[(k + 1) % colors.length]
        ctx.globalAlpha = 0.5
        ctx.stroke()
      }
      ctx.restore()
    }
    if (effect === 'fire') {
      const ctx = this.bgCtx
      ctx.globalCompositeOperation = 'lighter'
      for (let k = 0; k < 30; k++) {
        const ex = (k * 31 + t * 18) % BW
        const ey = (k * 17 + t * 22) % BH
        ctx.fillStyle = k % 2 ? 'rgba(255,200,80,.6)' : 'rgba(255,80,20,.5)'
        ctx.fillRect(ex | 0, ey | 0, 1, 1)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  drawSceneBackdrop(ctx) {
    const t = this.t
    ctx.save()
    if (this.scene === 'plaza') {
      ctx.globalAlpha = 0.62
      for (let k = 0; k < 16; k++) {
        const h = 16 + ((k * 37) % 44)
        const x = k * 32 - 8
        ctx.fillStyle = '#070712'
        ctx.fillRect(x, HORIZON - h, 26, h + 4)
        ctx.strokeStyle = k % 3 === 0 ? 'rgba(255,43,214,.38)' : 'rgba(0,240,255,.28)'
        ctx.strokeRect(x + 0.5, HORIZON - h + 0.5, 25, h + 3)
        ctx.fillStyle = k % 2 ? 'rgba(0,240,255,.35)' : 'rgba(255,232,0,.26)'
        for (let wy = HORIZON - h + 5; wy < HORIZON - 4; wy += 6) {
          for (let wx = x + 4; wx < x + 23; wx += 6) if ((wx + wy + k) % 3 === 0) ctx.fillRect(wx, wy, 1, 2)
        }
      }
      // a suspicious monolith / TV tower
      ctx.globalAlpha = 0.8
      ctx.fillStyle = 'rgba(0,0,0,.8)'
      ctx.fillRect(228, 48, 24, 110)
      ctx.strokeStyle = 'rgba(0,240,255,.5)'
      ctx.strokeRect(228.5, 48.5, 23, 109)
      ctx.fillStyle = 'rgba(255,43,214,.4)'
      ctx.fillRect(234, 58, 12, 2)
      ctx.fillRect(234, 66, 12, 2)
    } else if (this.scene === 'factory') {
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = 'rgba(255,138,43,.28)'
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.moveTo(0, 36); ctx.lineTo(W, 36); ctx.stroke()
      for (let x = 28; x < W; x += 72) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HORIZON); ctx.stroke()
        ctx.strokeStyle = 'rgba(255,138,43,.12)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x - 28, 36); ctx.lineTo(x + 28, 118); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x + 28, 36); ctx.lineTo(x - 28, 118); ctx.stroke()
        ctx.strokeStyle = 'rgba(255,138,43,.28)'; ctx.lineWidth = 5
      }
      // pipes and tanks
      ctx.fillStyle = 'rgba(10,8,7,.9)'
      for (let k = 0; k < 5; k++) {
        const x = 20 + k * 105
        ctx.fillRect(x, 88, 62, 68)
        ctx.strokeStyle = 'rgba(0,200,216,.28)'; ctx.lineWidth = 2
        ctx.strokeRect(x + 1, 89, 60, 66)
        ctx.beginPath(); ctx.arc(x + 31, 120, 15, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = k % 2 ? 'rgba(255,138,43,.18)' : 'rgba(0,200,216,.12)'
        ctx.fillRect(x + 7, 96, 8, 50)
        ctx.fillStyle = 'rgba(10,8,7,.9)'
      }
      // steam
      ctx.globalAlpha = 0.24
      for (let k = 0; k < 8; k++) {
        const x = (k * 71 + t * 7) % (W + 60) - 30
        const y = 96 + Math.sin(t * 0.4 + k) * 18
        const g = ctx.createRadialGradient(x, y, 2, x, y, 28 + (k % 3) * 10)
        g.addColorStop(0, 'rgba(190,210,200,.7)'); g.addColorStop(1, 'rgba(190,210,200,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill()
      }
    } else if (this.scene === 'dungeon') {
      const stone = 'rgba(38,28,52,.86)'
      ctx.fillStyle = stone
      for (const x of [2, 430]) {
        ctx.fillRect(x, 22, 48, 150)
        ctx.strokeStyle = 'rgba(141,91,255,.18)'; ctx.lineWidth = 1
        for (let y = 30; y < 168; y += 14) {
          ctx.strokeRect(x + 2, y, 44, 14)
          ctx.beginPath(); ctx.moveTo(x + 2, y + 7); ctx.lineTo(x + 46, y + 7); ctx.stroke()
        }
      }
      // arches
      ctx.strokeStyle = 'rgba(141,91,255,.2)'; ctx.lineWidth = 8
      ctx.beginPath(); ctx.arc(240, 150, 150, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke()
      // torches
      for (const x of [54, 426]) {
        ctx.fillStyle = '#2b1a12'; ctx.fillRect(x - 2, 100, 4, 28)
        const fl = 6 + Math.sin(t * 13 + x) * 2 + this.bass * 5
        const g = ctx.createRadialGradient(x, 94, 1, x, 94, fl * 2)
        g.addColorStop(0, '#fff2a1'); g.addColorStop(0.35, '#ff8a2b'); g.addColorStop(1, 'rgba(255,80,20,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, 94, fl * 2, 0, Math.PI * 2); ctx.fill()
      }
      // floating runes
      ctx.globalAlpha = 0.28
      ctx.fillStyle = '#b388ff'
      for (let k = 0; k < 14; k++) {
        const x = 60 + ((k * 47) % 360)
        const y = 64 + ((k * 29) % 66) + Math.sin(t * 0.8 + k) * 3
        ctx.fillRect(x, y, 2, 2)
      }
    } else if (this.scene === 'coaster') {
      // sunset sky + a suspiciously musical rollercoaster
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
      sky.addColorStop(0, '#180a2b'); sky.addColorStop(0.6, '#4a1550'); sky.addColorStop(1, '#ff6b35')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, HORIZON)
      const ground = ctx.createLinearGradient(0, HORIZON, 0, H)
      ground.addColorStop(0, 'rgba(25,8,30,.35)'); ground.addColorStop(1, 'rgba(8,4,12,.92)')
      ctx.fillStyle = ground
      ctx.fillRect(0, HORIZON, W, H - HORIZON)
      const sun = ctx.createRadialGradient(360, 120, 4, 360, 120, 54)
      sun.addColorStop(0, 'rgba(255,232,180,.9)'); sun.addColorStop(0.4, 'rgba(255,107,53,.55)'); sun.addColorStop(1, 'rgba(255,43,214,0)')
      ctx.fillStyle = sun
      ctx.beginPath(); ctx.arc(360, 120, 54, 0, Math.PI * 2); ctx.fill()
      for (let k = 0; k < 40; k++) {
        ctx.fillStyle = k % 5 ? 'rgba(255,255,255,.5)' : 'rgba(255,232,0,.8)'
        ctx.fillRect((k * 67) % W, 30 + (k * 37) % 100, k % 9 === 0 ? 2 : 1, 1)
      }
      // track
      ctx.save()
      ctx.strokeStyle = this.paletteCss[6] || '#00f0ff'
      ctx.lineWidth = 2.2
      const trackPts = []
      for (let i = 0; i <= 54; i++) {
        const x = -20 + i * 9
        const y = 204 - i * 1.35 + sinT(i * 0.27 + t * 0.7) * 13
        trackPts.push([x, y])
      }
      const drawRail = offset => {
        ctx.beginPath()
        trackPts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y + offset); else ctx.lineTo(x, y + offset) })
        ctx.stroke()
      }
      drawRail(-3); drawRail(3)
      ctx.strokeStyle = 'rgba(255,43,214,.45)'; ctx.lineWidth = 1
      for (let i = 2; i < trackPts.length; i += 2) {
        const [x, y] = trackPts[i]
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke()
        if (i % 8 === 0) { ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 4, 220); ctx.stroke() }
      }
      // loop
      ctx.strokeStyle = this.paletteCss[7] || '#ff2bd6'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(316, 156, 27, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = 'rgba(0,240,255,.45)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(316, 156, 32, 0, Math.PI * 2); ctx.stroke()
      // cart
      ctx.fillStyle = '#1a1420'
      ctx.beginPath(); ctx.roundRect(190, 148, 138, 22, 6); ctx.fill()
      ctx.strokeStyle = '#ffe800'; ctx.lineWidth = 1
      ctx.strokeRect(190.5, 148.5, 137, 21)
      ctx.fillStyle = '#ff2bd6'
      ctx.fillRect(198, 150, 122, 4)
      for (const wx of [210, 300]) {
        ctx.fillStyle = '#0a0a0f'; ctx.beginPath(); ctx.arc(wx, 170, 5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#8b8ba4'; ctx.beginPath(); ctx.arc(wx, 170, 5, 0, Math.PI * 2); ctx.stroke()
      }
      // NO BRAKES sign
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(28, 106, 86, 23)
      ctx.strokeStyle = '#ffe800'; ctx.strokeRect(28.5, 106.5, 85, 22)
      ctx.fillStyle = '#ffe800'; ctx.font = '7px "Silkscreen", monospace'; ctx.textAlign = 'center'
      ctx.fillText('NO BRAKES', 71, 116); ctx.font = '5px "Silkscreen", monospace'; ctx.fillStyle = '#ff2bd6'
      ctx.fillText('PAPER ROLL COASTER', 71, 124)
      // toilet paper roll
      ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(430, 124, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#c9bfa7'; ctx.beginPath(); ctx.arc(430, 124, 5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(239,230,207,.55)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(430, 106); ctx.bezierCurveTo(400, 80, 452, 60, 404, 44); ctx.stroke()
      // note cars ahead
      for (let i = 0; i < 8; i++) {
        const x = 250 + i * 22
        const y = 186 - i * 2 + sinT(i * 0.6 + t) * 5
        ctx.fillStyle = i % 2 ? '#00f0ff' : '#ffe800'
        ctx.fillRect(x, y, 5, 3)
      }
      ctx.restore()
    } else if (this.scene === 'cosmic') {
      // big ringed planet
      const px = 386, py = 66, pr = 34
      const g = ctx.createRadialGradient(px - 10, py - 12, 4, px, py, pr)
      g.addColorStop(0, 'rgba(255,255,255,.9)')
      g.addColorStop(0.25, 'rgba(120,200,255,.8)')
      g.addColorStop(0.7, 'rgba(70,30,150,.65)')
      g.addColorStop(1, 'rgba(10,5,30,.2)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(255,215,150,.55)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(px, py, 58, 16, -0.35, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,43,214,.22)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(px, py, 66, 21, -0.35, 0, Math.PI * 2); ctx.stroke()
      // nebula wash
      ctx.globalAlpha = 0.12
      const ng = ctx.createRadialGradient(180, 70, 8, 180, 70, 150)
      ng.addColorStop(0, '#ff2bd6'); ng.addColorStop(0.5, '#5a2bd6'); ng.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = ng
      ctx.fillRect(0, 0, W, H)
    } else if (this.scene === 'office') {
      ctx.globalAlpha = 0.9
      // fluorescent ceiling
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = 'rgba(240,238,220,.16)'
        ctx.fillRect(20 + k * 120, 24, 72, 4)
        ctx.fillStyle = 'rgba(240,238,220,.08)'
        ctx.fillRect(16 + k * 120, 28, 80, 10)
      }
      // cubicle walls
      for (let k = 0; k < 6; k++) {
        const x = k * 82 - 12
        ctx.fillStyle = 'rgba(85,82,76,.72)'
        ctx.fillRect(x, 92, 70, 68)
        ctx.strokeStyle = 'rgba(190,190,180,.18)'; ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, 92.5, 69, 67)
        ctx.fillStyle = 'rgba(220,220,200,.18)'
        ctx.fillRect(x + 8, 100, 28, 18)
        ctx.fillRect(x + 40, 108, 20, 26)
      }
      // whiteboard
      ctx.fillStyle = 'rgba(230,228,215,.85)'
      ctx.fillRect(24, 46, 92, 38)
      ctx.strokeStyle = 'rgba(60,60,70,.5)'
      ctx.strokeRect(24.5, 46.5, 91, 37)
      ctx.fillStyle = 'rgba(60,60,70,.42)'
      ctx.font = '5px "Silkscreen", monospace'
      ctx.fillText('SYNERGY', 32, 57)
      ctx.fillText('Q3 CHORD GROWTH', 32, 67)
    } else if (this.scene === 'hell') {
      // wall of CRTs showing pattern data
      const cols = 12, rows = 5
      const cw = 36, chh = 17
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 12 + c * (cw + 2), y = 42 + r * (chh + 3)
          ctx.fillStyle = 'rgba(8,8,10,.9)'
          ctx.fillRect(x, y, cw, chh)
          ctx.strokeStyle = (c + r) % 5 === 0 ? 'rgba(255,43,58,.28)' : 'rgba(0,240,255,.16)'
          ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, chh - 1)
          ctx.fillStyle = (c + r) % 3 === 0 ? 'rgba(125,255,90,.5)' : 'rgba(0,240,255,.3)'
          for (let k = 0; k < 3; k++) ctx.fillRect(x + 3, y + 3 + k * 4, 8 + ((r * 7 + c * 3 + k * 5) % 22), 1)
        }
      }
      // hanging cables
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2
      for (let k = 0; k < 5; k++) {
        ctx.beginPath(); ctx.moveTo(k * 100 + 20, 0); ctx.bezierCurveTo(k * 100 + 10, 50, k * 100 + 50, 80, k * 100 + 30, 140); ctx.stroke()
      }
    }
    ctx.restore()
  }

  drawSplats(ctx) {
    const sc = this.splats.render(this.scene === 'cosmic' ? 2 : this.scene === 'factory' ? 4 : 0)
    ctx.save()
    ctx.globalCompositeOperation = this.splats.mode === 'text' ? 'source-over' : 'screen'
    ctx.globalAlpha = this.scene === 'cosmic' ? 0.95 : this.scene === 'dungeon' ? 0.55 : this.scene === 'plaza' ? 0.58 : 0.48
    const y = this.scene === 'cosmic' ? -42 : -16
    ctx.drawImage(sc, 0, y, W, H)
    ctx.restore()
  }

  drawChannelProps(ctx) {
    const chs = (this.channelStates || []).slice(0, 14)
    if (!chs.length) return
    const n = chs.length
    const usable = W - 88
    const step = usable / Math.max(1, n - 1)
    const base = 151
    ctx.save()
    for (let i = 0; i < n; i++) {
      const ch = chs[i]
      const vu = clamp(ch.vu / 1.1, 0, 1)
      const x = 44 + i * step
      const h = 7 + vu * (this.scene === 'office' ? 42 : 34)
      const color = ch.color || '#00f0ff'
      if (this.scene === 'factory') {
        ctx.fillStyle = 'rgba(8,10,10,.9)'
        ctx.fillRect(x - 4, base - h - 3, 8, h + 3)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.58
        ctx.fillRect(x - 2, base - h, 4, h)
        ctx.globalAlpha = 1
        ctx.fillStyle = 'rgba(200,210,200,.16)'
        ctx.beginPath(); ctx.arc(x, base - h - 5, 2 + vu * 2, 0, Math.PI * 2); ctx.fill()
      } else if (this.scene === 'office') {
        ctx.fillStyle = 'rgba(30,30,36,.9)'
        ctx.fillRect(x - 7, base - h, 14, h)
        ctx.strokeStyle = color; ctx.globalAlpha = 0.7
        ctx.strokeRect(x - 6.5, base - h + 0.5, 13, h - 1)
        ctx.globalAlpha = 1
      } else if (this.scene === 'hell') {
        ctx.fillStyle = 'rgba(8,8,10,.9)'
        ctx.fillRect(x - 6, base - h - 5, 12, h + 5)
        ctx.fillStyle = color
        for (let y = base - h; y < base; y += 3) ctx.fillRect(x - 3, y, 6, 1)
      } else if (this.scene === 'dungeon') {
        ctx.fillStyle = 'rgba(30,20,45,.9)'
        ctx.fillRect(x - 5, base - h, 10, h)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.42
        ctx.fillRect(x - 3, base - h + 2, 6, h - 4)
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(255,232,0,.28)'
        ctx.strokeRect(x - 4.5, base - h + 0.5, 9, h - 1)
    } else if (this.scene === 'cosmic') {
        ctx.fillStyle = color
        for (let k = 0; k < 6; k++) {
          ctx.globalAlpha = 0.25 + (k / 6) * vu
          ctx.fillRect(x - 1, base - 4 - k * 6, 2, 2)
        }
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = 'rgba(8,8,16,.9)'
        ctx.fillRect(x - 5, base - h, 10, h)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.5
        ctx.fillRect(x - 3, base - h + 1, 6, h - 2)
        ctx.globalAlpha = 1
        ctx.fillStyle = 'rgba(255,255,255,.25)'
        ctx.fillRect(x - 5, base - h, 10, 2)
      }
      if (ch.voice && n <= 8) {
        ctx.font = '5px "Silkscreen", monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = color
        ctx.fillText(ch.voice.name, x, base - h - 4)
      }
    }
    ctx.restore()
  }

  drawMonument(ctx) {
    const chord = this.chord
    const name = chord?.name || '—'
    const roman = this.roman || '—'
    const key = this.key ? keyName(this.key, chord?.flats) : 'KEY ?'
    const notes = chord ? chord.pitchClasses.map(pc => pcName(pc, chord.flats)).join(' ') : 'no chord, no problem'
    const next = this.preview?.[1]?.name
    const t = this.t
    const glow = 0.18 + (chord?.confidence || 0) * 0.28
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (this.scene === 'factory') {
      ctx.fillStyle = 'rgba(11,8,5,.92)'
      ctx.fillRect(154, 34, 172, 58)
      ctx.fillStyle = 'rgba(255,232,0,.9)'
      ctx.fillRect(154, 34, 172, 5); ctx.fillRect(154, 87, 172, 5)
      ctx.fillStyle = 'rgba(255,43,214,.18)'
      for (let x = 154; x < 326; x += 12) ctx.fillRect(x, 34, 6, 5)
      ctx.fillStyle = '#ffe800'
      ctx.font = '7px "Silkscreen", monospace'
      ctx.fillText('HARMONIC OUTPUT · LOT 04', 240, 47)
      ctx.font = '20px "Silkscreen", monospace'
      ctx.fillStyle = '#f2ecdd'
      ctx.fillText(name, 240, 63)
      ctx.font = '7px "Silkscreen", monospace'
      ctx.fillStyle = '#ff8a2b'
      ctx.fillText(`${roman} · ${key.toUpperCase()} · ${notes}`, 240, 78)
      if (next) { ctx.fillStyle = 'rgba(255,232,0,.8)'; ctx.fillText(`NEXT: ${next}`, 240, 86) }
    } else if (this.scene === 'dungeon') {
      ctx.strokeStyle = `rgba(255,232,0,${glow + 0.25})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(240, 64, 39, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(240, 64, 44, 0, Math.PI * 2); ctx.stroke()
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + t * 0.05
        ctx.fillStyle = k % 3 === 0 ? '#ffe800' : 'rgba(179,136,255,.65)'
        ctx.fillRect(240 + Math.cos(a) * 41 - 1, 64 + Math.sin(a) * 41 - 1, 2, 2)
      }
      ctx.fillStyle = 'rgba(8,4,16,.8)'
      ctx.beginPath(); ctx.arc(240, 64, 35, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffe800'
      ctx.font = '19px "Silkscreen", monospace'
      ctx.fillText(name, 240, 59)
      ctx.font = '6px "Silkscreen", monospace'
      ctx.fillStyle = '#b388ff'
      ctx.fillText(`${roman} · ${notes}`, 240, 72)
      ctx.fillStyle = 'rgba(179,136,255,.7)'
      ctx.fillText(key.toUpperCase(), 240, 82)
      if (next) { ctx.fillStyle = 'rgba(255,232,0,.7)'; ctx.fillText(`NEXT ${next}`, 240, 90) }
    } else if (this.scene === 'office') {
      ctx.fillStyle = 'rgba(232,230,218,.96)'
      ctx.fillRect(146, 30, 188, 66)
      ctx.fillStyle = '#26315c'
      ctx.fillRect(146, 30, 188, 12)
      ctx.fillStyle = '#fff'
      ctx.font = '6px "Silkscreen", monospace'
      ctx.textAlign = 'left'
      ctx.fillText('Q3 HARMONIC OUTLOOK.PPT', 152, 37)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#26315c'
      ctx.font = '7px "Silkscreen", monospace'
      ctx.fillText('CHORD SYNERGY / KEY DELIVERABLE', 240, 50)
      ctx.font = '19px "Silkscreen", monospace'
      ctx.fillStyle = '#11121a'
      ctx.fillText(name, 240, 65)
      ctx.font = '6px "Silkscreen", monospace'
      ctx.fillStyle = '#7a4b22'
      ctx.fillText(`${roman} · ${notes} · ${key}`, 240, 77)
      ctx.fillStyle = '#d42036'
      ctx.fillText(next ? `NEXT: ${next} (CIRCA BACK LATER)` : 'NUMBERS.', 240, 87)
    } else if (this.scene === 'hell') {
      ctx.fillStyle = 'rgba(4,5,4,.92)'
      ctx.fillRect(164, 38, 152, 52)
      ctx.strokeStyle = 'rgba(125,255,90,.65)'; ctx.lineWidth = 1
      ctx.strokeRect(164.5, 38.5, 151, 51)
      ctx.fillStyle = '#7dff5a'
      ctx.font = '6px "Silkscreen", monospace'
      ctx.textAlign = 'left'
      ctx.fillText('> OPEN_TRACKER.EXE --CHORD', 170, 46)
      ctx.font = '16px "Silkscreen", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(name, 240, 60)
      ctx.font = '6px "Silkscreen", monospace'
      ctx.fillStyle = '#c8ff4a'
      ctx.fillText(`${roman} · ${notes}`, 240, 73)
      ctx.fillStyle = 'rgba(125,255,90,.7)'
      ctx.fillText(`${key} · ${next ? 'NEXT ' + next : 'END OF LINE'}`, 240, 83)
      ctx.fillStyle = 'rgba(0,240,255,.15)'
      for (let y = 40; y < 88; y += 3) ctx.fillRect(164, y, 152, 1)
    } else if (this.scene === 'cosmic') {
      ctx.fillStyle = `rgba(180,220,255,${0.55 + glow})`
      ctx.font = '8px "Silkscreen", monospace'
      ctx.fillText('HARMONIC CONSTELLATION', 240, 44)
      ctx.font = '22px "Silkscreen", monospace'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(name, 240, 59)
      ctx.font = '7px "Silkscreen", monospace'
      ctx.fillStyle = 'rgba(160,220,255,.8)'
      ctx.fillText(`${roman} · ${key.toUpperCase()} · ${notes}`, 240, 74)
      if (next) { ctx.fillStyle = 'rgba(255,43,214,.8)'; ctx.fillText(`NEXT: ${next}`, 240, 84) }
    } else {
      // plaza neon sign
      ctx.fillStyle = 'rgba(5,5,12,.72)'
      ctx.fillRect(150, 36, 180, 58)
      ctx.strokeStyle = 'rgba(0,240,255,.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(150.5, 36.5, 179, 57)
      ctx.strokeStyle = 'rgba(255,43,214,.35)'
      ctx.strokeRect(154.5, 40.5, 171, 49)
      ctx.fillStyle = '#ff2bd6'
      ctx.font = '7px "Silkscreen", monospace'
      ctx.fillText('★ CHORD MONUMENT ★', 240, 45)
      ctx.font = '21px "Silkscreen", monospace'
      ctx.fillStyle = '#f2ecdd'
      ctx.fillText(name, 240, 60)
      ctx.font = '7px "Silkscreen", monospace'
      ctx.fillStyle = '#00f0ff'
      ctx.fillText(`${roman} · ${notes}`, 240, 73)
      ctx.fillStyle = 'rgba(242,236,221,.65)'
      ctx.fillText(`${key.toUpperCase()}${next ? ' · NEXT ' + next : ''}`, 240, 83)
    }
    ctx.restore()
  }

  drawNoteRibbon(ctx) {
    const a = this.analysis
    if (!a || !this.model) return
    const t = this.t
    const now = a.lastUpdate || (performance.now() / 1000)
    const events = []
    for (const n of a.getPianoNotes(2.4)) {
      events.push({ rel: n.start - now, midi: n.midi, name: n.name, color: n.color || '#00f0ff', future: false, end: n.end == null ? 0 : n.end - now })
    }
    for (const r of (this.lookahead || [])) {
      if (r.at <= 0.06 || r.at > 2.4) continue
      const p = this.model.patterns[r.pattern]
      if (!p) continue
      for (let c = 0; c < p.channelCount; c++) {
        if (this.model.channels[c]?.role === 'drums') continue
        const cell = this.model.cell(r.pattern, r.row, c)
        if (!cell || !(cell.note >= 1 && cell.note <= 120)) continue
        const midi = rawToMidi(cell.note)
        events.push({ rel: r.at, midi, name: rawNoteName(cell.note), color: this.model.channels[c]?.color || '#00f0ff', future: true, end: r.at + 0.25 })
      }
    }
    if (!events.length) return
    const yC = 111
    ctx.save()
    ctx.fillStyle = 'rgba(3,3,8,.34)'
    ctx.fillRect(46, yC - 19, W - 92, 40)
    // staff lines / ribbon
    ctx.globalAlpha = 0.42
    ctx.strokeStyle = this.scene === 'office' ? 'rgba(220,220,200,.55)' : 'rgba(0,240,255,.72)'
    ctx.lineWidth = 1
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(56, yC + k * 5); ctx.lineTo(W - 56, yC + k * 5); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.font = '5px "Silkscreen", monospace'
    ctx.fillStyle = 'rgba(255,255,255,.5)'
    ctx.textAlign = 'left'
    ctx.fillText('LOOK BEHIND', 58, yC + 15)
    ctx.textAlign = 'right'
    ctx.fillText('LOOK AHEAD', W - 58, yC + 15)
    // playhead
    ctx.fillStyle = 'rgba(255,232,0,.75)'
    ctx.fillRect(240, yC - 15, 1, 31)
    ctx.fillStyle = 'rgba(255,232,0,.45)'
    ctx.fillRect(239, yC - 16, 3, 2)
    // notes
    for (const ev of events) {
      if (ev.rel < -2.4 || ev.rel > 2.4) continue
      const x = 240 + (ev.rel / 2.4) * 176
      const y = clamp(yC - (ev.midi - 60) * 0.38, yC - 14, yC + 14)
      ctx.globalAlpha = ev.future ? 0.38 : 0.92
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = ev.color
      ctx.fillRect(-2, -2, 4, 4)
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 0.7
      ctx.strokeRect(-2, -2, 4, 4)
      ctx.restore()
      if (Math.abs(ev.rel) < 0.9) {
        ctx.globalAlpha = ev.future ? 0.45 : 0.95
        ctx.font = '5px "Silkscreen", monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = ev.future ? 'rgba(255,255,255,.65)' : '#f2ecdd'
        ctx.fillText(ev.name, x, y - 5)
      }
    }
    ctx.restore()
  }

  drawSceneTitle(ctx) {
    const age = this.t - this.sceneChangedAt
    if (age < 0 || age > 3.2) return
    const fade = clamp(1 - (age - 2.2) / 1, 0, 1)
    ctx.save()
    ctx.globalAlpha = fade * 0.92
    ctx.fillStyle = 'rgba(0,0,0,.7)'
    ctx.fillRect(0, 186, W, 24)
    ctx.strokeStyle = 'rgba(255,43,214,.6)'
    ctx.beginPath(); ctx.moveTo(0, 186); ctx.lineTo(W, 186); ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const title = this.format === 'world' ? this.sceneDef.label
      : this.format === 'fx' ? `FULLSCREEN FX · ${this.effect.toUpperCase()}`
      : this.format === 'multiview' ? 'MULTIVIEW FEED'
      : this.format === 'terminal' ? 'TRACKER OS / TTY1'
      : this.format === 'bars' ? 'SMPTE EMERGENCY BROADCAST' : this.sceneDef.label
    ctx.font = '10px "Silkscreen", monospace'
    ctx.fillStyle = '#ffe800'
    ctx.fillText(title, W / 2, 194)
    ctx.font = '5px "Silkscreen", monospace'
    ctx.fillStyle = '#8b8ba4'
    ctx.fillText(`SCENE ${String(['plaza', 'factory', 'dungeon', 'cosmic', 'office', 'hell', 'coaster'].indexOf(this.scene) + 1).padStart(2, '0')} · ${this.sceneTag} · ${this.genre.toUpperCase()}`, W / 2, 204)
    ctx.restore()
  }

  drawFloor(ctx) {
    ctx.save()
    const pal = this.paletteCss
    const dark = pal[1] || '#081022'
    const accent = pal[6] || '#00f0ff'
    const accent2 = pal[7] || '#ff2bd6'
    const floor = this.sceneDef?.floor || 'checker'
    if (floor === 'coaster') { ctx.restore(); return }
    ctx.fillStyle = dark
    ctx.fillRect(0, HORIZON, W, H - HORIZON)
    if (floor === 'void') {
      ctx.fillStyle = 'rgba(0,0,0,.35)'
      ctx.fillRect(0, HORIZON, W, H - HORIZON)
      ctx.globalAlpha = 0.4
      ctx.strokeStyle = accent2
      ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke()
      ctx.globalAlpha = 0.22
      for (let k = 0; k < 40; k++) {
        const x = (k * 97 + this.t * (2 + k % 3)) % W
        const y = HORIZON + (k * 23) % (H - HORIZON)
        ctx.fillStyle = k % 5 ? '#8b8ba4' : '#00f0ff'
        ctx.fillRect(x, y, 1, 1)
      }
      ctx.restore()
      return
    }
    if (floor === 'stone') {
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = 'rgba(179,136,255,.35)'
      for (let k = 0; k < 8; k++) {
        const y = HORIZON + Math.pow(k / 8, 1.7) * (H - HORIZON)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      for (let k = -5; k <= 5; k++) {
        ctx.beginPath(); ctx.moveTo(W / 2, HORIZON); ctx.lineTo(W / 2 + k * 62, H); ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    if (floor === 'metal') {
      ctx.globalAlpha = 0.4
      ctx.strokeStyle = 'rgba(255,138,43,.3)'
      for (let k = 0; k < 7; k++) {
        const y = HORIZON + k * 17
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
        for (let x = 20 + (k % 2) * 24; x < W; x += 48) {
          ctx.fillStyle = 'rgba(255,232,0,.16)'
          ctx.fillRect(x, y - 1, 2, 2)
        }
      }
      ctx.globalAlpha = 1
    }
    if (floor === 'carpet') {
      ctx.fillStyle = 'rgba(62,62,68,.55)'
      ctx.fillRect(0, HORIZON, W, H - HORIZON)
      ctx.globalAlpha = 0.16
      ctx.strokeStyle = 'rgba(220,220,200,.5)'
      for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, HORIZON); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = HORIZON; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
      ctx.globalAlpha = 1
    }
    const grad = ctx.createLinearGradient(0, HORIZON, 0, H)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,.62)')
    ctx.fillStyle = grad
    ctx.fillRect(0, HORIZON, W, H - HORIZON)

    // horizon glow
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke()
    ctx.globalAlpha = 0.2
    ctx.strokeStyle = accent2
    ctx.beginPath(); ctx.moveTo(0, HORIZON + 2); ctx.lineTo(W, HORIZON + 2); ctx.stroke()
    ctx.globalAlpha = 1

    // sun / portal
    if (this.effect === 'onebit' || this.effect === 'copper' || this.effect === 'stars') {
      const cx = 240, cy = HORIZON - 16, r = 42 + this.bass * 6
      const g = ctx.createLinearGradient(0, cy - r, 0, cy + r)
      g.addColorStop(0, accent2); g.addColorStop(1, accent)
      ctx.globalAlpha = 0.22
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 0.5
      ctx.fillStyle = dark
      for (let k = 0; k < 6; k++) ctx.fillRect(cx - r, cy - 4 + k * 6, r * 2, 3)
      ctx.globalAlpha = 1
    }

    // perspective grid
    const speed = (this.t * (0.4 + this.bass * 1.8)) % 1
    ctx.globalAlpha = 0.32
    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    for (let k = 0; k < 12; k++) {
      const f = (k + speed) / 12
      const y = HORIZON + f * f * (H - HORIZON)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    ctx.globalAlpha = 0.22
    for (let k = -8; k <= 8; k++) {
      ctx.beginPath()
      ctx.moveTo(W / 2, HORIZON)
      ctx.lineTo(W / 2 + k * 70, H)
      ctx.stroke()
    }
    // checker shimmer
    ctx.globalAlpha = 0.08 + this.bass * 0.12
    ctx.fillStyle = accent2
    for (let k = 0; k < 12; k++) {
      const f0 = (k + speed) / 12
      const f1 = (k + speed + 0.5) / 12
      const y0 = HORIZON + f0 * f0 * (H - HORIZON)
      const y1 = HORIZON + f1 * f1 * (H - HORIZON)
      if (k % 2 === 0) ctx.fillRect(0, y0, W, Math.max(1, y1 - y0))
    }
    ctx.restore()
  }

  drawScroller(ctx) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,.45)'
    ctx.fillRect(0, 20, W, 14)
    ctx.globalAlpha = 0.6
    ctx.fillStyle = this.paletteCss[7] || '#ff2bd6'
    ctx.fillRect(0, 33, W, 1)
    ctx.globalAlpha = 1
    ctx.font = '8px "Silkscreen", monospace'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = this.paletteCss[8] || '#ffe800'
    const phase = this.t % 43
    const base = (phase > 6 && phase < 9)
      ? '*** SCROLLER HIJACKED BY THE BASS DEPARTMENT *** NORMAL SCROLLING WILL RESUME AFTER THE BASS SOLO *** IF YOU CAN READ THIS YOU ARE MORE BASS THAN USUAL *** '
      : this.scroller
    const text = base + base
    let x = this.scrollerX
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (x > -8 && x < W + 8) {
        const y = 27 + sinT(x * 0.045 + this.t * 3) * 2.2
        ctx.fillStyle = i % 17 === 0 ? (this.paletteCss[6] || '#00f0ff') : (this.paletteCss[8] || '#ffe800')
        ctx.fillText(ch, x, y)
      }
      x += 6
    }
    ctx.restore()
  }

  drawCharacters(ctx) {
    const t = this.t
    // orb behind
    this.drawOrb(ctx)
    // wizard
    if (!this.settings.serious) {
      drawSprite(ctx, WIZARD, this.wizard.x, this.wizard.y, 2.2, { alpha: 0.98 })
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,.35)'
      ctx.beginPath(); ctx.ellipse(this.wizard.x, this.wizard.y + 2, 22, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    // rat + record
    if (!this.settings.serious) {
      const bounce = this.rat.bounce * 2 + Math.abs(sinT(t * 2.2)) * 0.7
      const rot = -0.05 - this.rat.headbang * 0.22
      ctx.save()
      ctx.translate(this.rat.x, this.rat.y)
      ctx.rotate(rot)
      drawSprite(ctx, RAT, 0, -bounce, 2.35, {})
      ctx.restore()
      this.drawRecord(ctx, this.rat.x + 38, this.rat.y - 28 + bounce)
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,.35)'
      ctx.beginPath(); ctx.ellipse(this.rat.x, this.rat.y + 2, 24, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    // dog on ad breaks
    if (!this.settings.serious && this.dogUntil > t) {
      drawSprite(ctx, DOG, this.dog.x, this.dog.y, 2.2, {})
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,.35)'
      ctx.beginPath(); ctx.ellipse(this.dog.x, this.dog.y + 2, 20, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    // uncle tracker on breakdown
    if (!this.settings.serious && this.uncleUntil > t) {
      drawSprite(ctx, CRT_UNCLE, this.uncle.x, this.uncle.y, 2.1, {})
    }
    // the bass department
    if (!this.settings.serious && this.settings.gross) this.drawButt(ctx)
    // moth
    if (!this.settings.serious) {
      ctx.save()
      ctx.globalAlpha = 0.8
      drawSprite(ctx, MOTH, this.moth.x, this.moth.y, 1.2, {})
      ctx.restore()
    }
    this.drawSpeech(ctx)
  }

  drawRecord(ctx, x, y) {
    const r = 13
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = '#0b0b12'
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(0,240,255,.35)'; ctx.lineWidth = 1
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, r * k / 4, 0, Math.PI * 2); ctx.stroke() }
    ctx.rotate(this.t * 3)
    ctx.fillStyle = this.paletteCss[6] || '#00f0ff'
    ctx.fillRect(-1, -5, 2, 5)
    ctx.fillStyle = this.paletteCss[7] || '#ff2bd6'
    ctx.fillRect(-1, 0, 2, 5)
    ctx.restore()
  }

  drawOrb(ctx) {
    const o = this.orb
    const r = 16 + Math.sin(this.t * 3) * 1.5 + this.bass * 4
    ctx.save()
    ctx.translate(o.x, o.y)
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.22, this.paletteCss[6] || '#00f0ff')
    g.addColorStop(0.7, this.paletteCss[7] || '#ff2bd6')
    g.addColorStop(1, 'rgba(0,0,0,.85)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.stroke()
    // eyes
    const blink = o.blink > 0.5
    ctx.fillStyle = '#fff'
    for (const dx of [-6, 6]) {
      ctx.beginPath(); ctx.ellipse(dx, -3, 4, blink ? 1 : 4, 0, 0, Math.PI * 2); ctx.fill()
    }
    if (!blink) {
      ctx.fillStyle = '#000'
      const look = clamp((240 - o.x) * 0.02, -2, 2)
      for (const dx of [-6, 6]) {
        ctx.beginPath(); ctx.arc(dx + look, -3, 1.8, 0, Math.PI * 2); ctx.fill()
      }
    }
    // mouth
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(0, 5, 4, 0.1, Math.PI - 0.1); ctx.stroke()
    ctx.restore()
  }

  drawButt(ctx) {
    const b = this.butt
    const t = this.t
    const strain = clamp(b.strain, 0, 1.5)
    const jig = Math.sin(t * 9) * b.jiggle * 3 + Math.sin(t * 2.1) * 0.8
    const scale = 1 + strain * 0.06
    const x = b.x
    const y = b.y + Math.abs(jig) * 0.4
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, 1 + strain * 0.03)
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.45)'
    ctx.beginPath(); ctx.ellipse(0, 8, 42, 7, 0, 0, Math.PI * 2); ctx.fill()
    // legs
    ctx.fillStyle = '#d9a06a'
    ctx.beginPath(); ctx.roundRect(-27, -12, 13, 20, 5); ctx.fill()
    ctx.beginPath(); ctx.roundRect(14, -12, 13, 20, 5); ctx.fill()
    ctx.fillStyle = '#11121a'
    ctx.beginPath(); ctx.roundRect(-31, 3, 19, 8, 3); ctx.fill()
    ctx.beginPath(); ctx.roundRect(12, 3, 19, 8, 3); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.25)'
    ctx.fillRect(-28, 5, 6, 2); ctx.fillRect(15, 5, 6, 2)

    // arms
    ctx.strokeStyle = '#c98a56'; ctx.lineWidth = 6; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-31, -33); ctx.lineTo(-42, -23 + Math.sin(t * 3) * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(31, -33); ctx.lineTo(42, -23 - Math.sin(t * 3) * 2); ctx.stroke()
    ctx.fillStyle = '#f0e6d2'
    ctx.beginPath(); ctx.arc(-43, -22, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(43, -22, 4, 0, Math.PI * 2); ctx.fill()

    // cheeks
    const cheek = (cx, hueShift) => {
      const g = ctx.createRadialGradient(cx - 8, -42, 2, cx, -30, 30)
      g.addColorStop(0, hueShift ? '#ffd3a1' : '#f4c08a')
      g.addColorStop(0.45, hueShift ? '#d99a62' : '#dc9b63')
      g.addColorStop(0.8, '#9b6438')
      g.addColorStop(1, '#5b341b')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(cx, -28, 25 + strain * 1.2, 31 + strain * 1.5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke()
      // specular
      ctx.fillStyle = 'rgba(255,255,255,.22)'
      ctx.beginPath(); ctx.ellipse(cx - 9, -44, 7, 11, -0.4, 0, Math.PI * 2); ctx.fill()
      // rim light
      ctx.strokeStyle = hueShift ? 'rgba(255,43,214,.35)' : 'rgba(0,240,255,.3)'
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.arc(cx, -28, 27, -0.9, 1.2); ctx.stroke()
    }
    cheek(-18, false)
    cheek(18, true)

    // crack / shadow (no explicit anatomy)
    ctx.fillStyle = 'rgba(30,12,6,.82)'
    ctx.beginPath(); ctx.ellipse(0, -26, 5 + strain * 2, 28 + strain * 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,220,190,.18)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(-1, -26, 6 + strain * 2, 29 + strain * 2, 0, 0, Math.PI * 2); ctx.stroke()

    // chain + pendant
    ctx.strokeStyle = '#f3c94b'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, -43, 27, 0.15, Math.PI - 0.15); ctx.stroke()
    ctx.fillStyle = '#f3c94b'
    ctx.beginPath(); ctx.roundRect(-13, -33, 26, 11, 2); ctx.fill()
    ctx.fillStyle = '#3a2208'
    ctx.font = '7px "Silkscreen", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('BASS', 0, -27)

    // googly eyes on top
    for (const [ex, ph] of [[-20, 0], [20, 1.7]]) {
      const blink = Math.abs(sinT(t * 0.7 + ph + 2)) > 0.985
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.ellipse(ex, -58, 6, blink ? 1 : 6, 0, 0, Math.PI * 2); ctx.fill()
      if (!blink) {
        ctx.fillStyle = '#0a0a0f'
        const look = clamp((240 - (x + ex)) * 0.03, -2.5, 2.5)
        ctx.beginPath(); ctx.arc(ex + look, -57, 2.4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(ex, -58, 7, blink ? 1.4 : 7, 0, 0, Math.PI * 2); ctx.stroke()
    }

    // sweat
    if (strain > 0.5) {
      ctx.fillStyle = 'rgba(160,230,255,.8)'
      for (let k = 0; k < 3; k++) {
        const sx = (k % 2 ? 1 : -1) * (30 + k * 4)
        const sy = -52 + Math.sin(t * 5 + k) * 4
        ctx.beginPath(); ctx.ellipse(sx, sy, 1.5, 3, 0, 0, Math.PI * 2); ctx.fill()
      }
    }
    // steam / puffs around the crack on push
    if (strain > 0.8) {
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#c8dbb8'
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc((k - 1) * 7, -8 - k * 3 + Math.sin(t * 7 + k) * 2, 3 + k, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    // "censored" bar only if the user asked for max chaos? no explicit anatomy, skip.
    ctx.restore()
  }

  drawSpeech(ctx) {
    const s = this.speech
    if (!s || s.until < this.t) return
    const anchor = {
      rat: { x: this.rat.x, y: this.rat.y - 54, color: '#00f0ff' },
      wizard: { x: this.wizard.x + 12, y: this.wizard.y - 54, color: '#ffe800' },
      butt: { x: this.butt.x, y: this.butt.y - 86, color: '#ff8a2b' },
      dog: { x: this.dog.x, y: this.dog.y - 46, color: '#ff2bd6' },
      orb: { x: this.orb.x, y: this.orb.y - 24, color: '#8d5bff' },
    }[s.who] || { x: 240, y: 100, color: '#00f0ff' }
    ctx.save()
    ctx.font = '7px "Silkscreen", monospace'
    const maxChars = 30
    const words = s.text.split(' ')
    const lines = []
    let line = ''
    for (const w of words) {
      if ((line + ' ' + w).trim().length > maxChars && line) { lines.push(line); line = w }
      else line = (line + ' ' + w).trim()
    }
    if (line) lines.push(line)
    let tw = 0
    for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width)
    const bw = Math.min(180, tw + 10)
    const bh = lines.length * 9 + 8
    const preferRight = s.who === 'wizard' || s.who === 'rat'
    let bx = preferRight ? anchor.x + 24 : anchor.x - bw - 8
    bx = clamp(bx, 6, W - bw - 6)
    let by = clamp(anchor.y - bh, 40, H - bh - 20)
    ctx.fillStyle = 'rgba(4,4,10,.9)'
    ctx.strokeStyle = anchor.color
    ctx.lineWidth = 1
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)
    // tail
    const tailX = preferRight ? bx + 6 : bx + bw - 6
    ctx.beginPath()
    ctx.moveTo(tailX - 3, by + bh)
    ctx.lineTo(anchor.x + (preferRight ? -3 : 3), anchor.y + (preferRight ? -4 : -2))
    ctx.lineTo(tailX + 5, by + bh)
    ctx.closePath()
    ctx.fillStyle = 'rgba(4,4,10,.9)'
    ctx.fill()
    ctx.strokeStyle = anchor.color
    ctx.stroke()
    ctx.fillStyle = '#f2ecdd'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    lines.forEach((l, i) => ctx.fillText(l, bx + 5, by + 5 + i * 9))
    ctx.restore()
  }

  drawTurds(ctx) {
    if (!this.settings.gross || this.settings.serious) return
    for (const p of this.turds) {
      const alpha = p.alpha ?? 1
      drawTurd(ctx, p.x, p.y, p.size, p.type, {
        time: this.t, rot: p.rot, alpha, label: p.label, color: p.color, labelColor: p.labelColor,
        stink: this.settings.chaos >= 3 && (p.type === 'spicy' || p.type === 'soft' || p.type === 'giant'),
      })
    }
    // pile glow / flies
    if (this.landed > 9 && !this.flushing) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,.75)'
      for (let k = 0; k < Math.min(6, this.landed / 3); k++) {
        const fx = this.butt.x - 26 + Math.sin(this.t * 2 + k * 2.3) * 30
        const fy = FLOOR - 12 - Math.abs(cosT(this.t * 2.7 + k)) * 20
        ctx.fillRect(fx | 0, fy | 0, 1, 1)
      }
      ctx.restore()
    }
    if (this.flushing) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0,240,255,.7)'
      ctx.lineWidth = 1
      const cx = this.butt.x, cy = FLOOR - 10
      for (let k = 1; k < 4; k++) {
        ctx.beginPath()
        ctx.ellipse(cx, cy, k * 14 + this.flushT * 20, 4 + k * 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  drawHorns(ctx) {
    if (!this.horns.length) return
    for (const h of this.horns) {
      ctx.save()
      ctx.translate(h.x, h.y)
      ctx.rotate(h.rot)
      ctx.scale(h.scale, h.scale)
      ctx.globalAlpha = clamp(h.life / h.max, 0, 1)
      ctx.fillStyle = '#ffe800'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-10, 8); ctx.lineTo(0, 0); ctx.lineTo(10, 8); ctx.lineTo(4, 12); ctx.lineTo(-4, 12)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#ff8a2b'
      ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(3, 4); ctx.lineTo(1, 14); ctx.lineTo(-2, 14); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#111'
      ctx.fillRect(-1, 12, 2, 5)
      ctx.restore()
    }
  }

  drawParticles(ctx) {
    ctx.save()
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1)
      ctx.globalAlpha = a
      ctx.font = `${p.size}px "Silkscreen", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,.8)'
      ctx.fillText(p.text, p.x + 1, p.y + 1)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
    }
    for (const n of this.notes) {
      const a = clamp(n.life / n.max, 0, 1)
      ctx.globalAlpha = a
      if (n.kind === 'spark') {
        ctx.fillStyle = n.color
        ctx.fillRect(n.x | 0, n.y | 0, 1, 1)
        continue
      }
      ctx.save()
      ctx.translate(n.x, n.y)
      ctx.rotate(sinT(this.t * 3 + n.x) * 0.12)
      ctx.fillStyle = 'rgba(0,0,0,.7)'
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = n.color; ctx.lineWidth = 1; ctx.stroke()
      ctx.fillStyle = n.color
      ctx.font = '6px "Silkscreen", monospace'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(n.text, 0, 0)
      ctx.restore()
    }
    for (const d of this.dust) {
      const a = clamp(d.life / d.max, 0, 1)
      ctx.globalAlpha = a * 0.45
      ctx.fillStyle = '#c8d3b6'
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill()
    }
    for (const c of this.confettiParticles) {
      const a = clamp(c.life / c.max, 0, 1)
      ctx.save()
      ctx.globalAlpha = a
      ctx.translate(c.x, c.y); ctx.rotate(c.rot)
      ctx.fillStyle = c.color
      ctx.fillRect(-c.size, -c.size, c.size * 2, c.size)
      ctx.restore()
    }
    ctx.restore()
  }

  drawFog(ctx) {
    if (this.settings.serious || this.fog < 0.1) return
    ctx.save()
    ctx.globalAlpha = clamp(this.fog * 0.35, 0, 0.42)
    for (let k = 0; k < 8; k++) {
      const x = (k * 67 + this.t * (4 + k)) % (W + 100) - 50
      const y = 110 + sinT(this.t * 0.3 + k) * 30 + (k % 3) * 18
      const r = 45 + (k % 4) * 18
      const g = ctx.createRadialGradient(x, y, 2, x, y, r)
      g.addColorStop(0, 'rgba(220,230,225,.65)')
      g.addColorStop(1, 'rgba(220,230,225,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    if (this.fog > 0.72) {
      ctx.globalAlpha = 0.7
      ctx.font = '10px "Silkscreen", monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#d9e2dd'
      ctx.fillText('THE FOG IS HERE.', W / 2, 62)
    }
    ctx.restore()
  }

  drawStageText(ctx) {
    if (this.brownNote > 0.01) {
      ctx.save()
      ctx.globalAlpha = clamp(this.brownNote, 0, 1)
      ctx.font = '10px "Silkscreen", monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffe800'
      ctx.fillText('BROWN NOTE DETECTED', W / 2, 50)
      ctx.restore()
      this.brownNote = Math.max(0, this.brownNote - 0.02)
    }
    if (!this.settings.serious && this.settings.chaos >= 3) {
      ctx.save()
      ctx.fillStyle = 'rgba(122,75,34,.9)'
      ctx.fillRect(this.gary.x, this.gary.y, 2, 2)
      if (this.settings.chaos >= 7) {
        ctx.fillStyle = 'rgba(255,232,0,.5)'
        ctx.font = '4px "Silkscreen", monospace'
        ctx.fillText('GARY', this.gary.x - 2, this.gary.y - 2)
      }
      ctx.restore()
    }
    if (this.paused) {
      ctx.save()
      ctx.font = '10px "Silkscreen", monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(0,0,0,.55)'
      ctx.fillRect(W / 2 - 45, 104, 90, 18)
      ctx.fillStyle = '#ffe800'
      ctx.fillText('PAUSED, COWARD', W / 2, 116)
      ctx.restore()
    }
    // fog widget
    if (!this.settings.serious && this.settings.chaos >= 2) {
      ctx.save()
      ctx.font = '6px "Silkscreen", monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(0,0,0,.5)'
      ctx.fillRect(6, 208, 82, 11)
      ctx.fillStyle = this.fog > 0.7 ? '#ffe800' : '#9fb0b8'
      ctx.fillText(`FOG ${Math.round(this.fog * 100)}%`, 9, 216)
      ctx.fillRect(48, 212, 35 * this.fog, 3)
      ctx.restore()
    }
  }

  drawDVD(ctx) {
    if (!this.dvd) return
    ctx.save()
    ctx.font = '14px "Silkscreen", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#00f0ff'
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2
    const label = 'VISUALIZER'
    ctx.strokeText(label, this.dvd.x, this.dvd.y)
    ctx.fillText(label, this.dvd.x, this.dvd.y)
    ctx.strokeStyle = 'rgba(0,240,255,.4)'
    ctx.strokeRect(this.dvd.x - 4, this.dvd.y - 14, ctx.measureText(label).width + 8, 20)
    ctx.restore()
  }

  drawMultiview(ctx) {
    const fx = ['plasma', 'dotTunnel', 'stars', 'rotozoom']
    const labels = ['PLASMA', 'DOT TUNNEL', 'STARFIELD', 'ROTOZOOM']
    const old = this.effect
    const gap = 4
    const cw = (W - gap * 3) / 2
    const chh = (H - gap * 3) / 2
    ctx.save()
    ctx.fillStyle = '#05050a'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 4; i++) {
      const x = gap + (i % 2) * (cw + gap)
      const y = gap + Math.floor(i / 2) * (chh + gap)
      this.effect = fx[i]
      this.renderBackground(this.t + i * 0.7, this.energy, this.bass)
      ctx.drawImage(this.bgCanvas, 0, 0, BW, BH, x, y, cw, chh)
      ctx.strokeStyle = i === 0 ? 'rgba(255,232,0,.8)' : 'rgba(0,240,255,.38)'
      ctx.lineWidth = i === 0 ? 2 : 1
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, chh - 1)
      ctx.fillStyle = 'rgba(0,0,0,.62)'
      ctx.fillRect(x + 4, y + 4, 58, 10)
      ctx.font = '6px "Silkscreen", monospace'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = i === 0 ? '#ffe800' : '#00f0ff'
      ctx.fillText(`CH${i + 1} ${labels[i]}`, x + 7, y + 9)
      // fake VU in the corner
      const ch = this.channelStates[i]
      if (ch) {
        ctx.fillStyle = ch.color
        ctx.fillRect(x + cw - 10, y + chh - 8 - Math.min(30, ch.vu * 26), 4, Math.min(30, ch.vu * 26) + 2)
      }
    }
    this.effect = old
    // central bug
    ctx.fillStyle = 'rgba(0,0,0,.72)'
    ctx.fillRect(W / 2 - 36, H / 2 - 6, 72, 12)
    ctx.strokeStyle = 'rgba(255,43,214,.6)'
    ctx.strokeRect(W / 2 - 35.5, H / 2 - 5.5, 71, 11)
    ctx.fillStyle = '#ff2bd6'
    ctx.font = '7px "Silkscreen", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('MULTIVIEW', W / 2, H / 2 + 1)
    ctx.restore()
  }

  drawTerminal(ctx) {
    const t = this.t
    const green = '#7dff5a'
    const amber = '#ffe800'
    const dim = 'rgba(125,255,90,.45)'
    ctx.save()
    ctx.fillStyle = '#020602'
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.18
    for (let y = 0; y < H; y += 2) { ctx.fillStyle = '#000'; ctx.fillRect(0, y, W, 1) }
    ctx.globalAlpha = 1
    ctx.fillStyle = '#0a1a0a'
    ctx.fillRect(8, 20, W - 16, H - 44)
    ctx.strokeStyle = 'rgba(125,255,90,.5)'
    ctx.strokeRect(8.5, 20.5, W - 17, H - 45)
    // header
    ctx.fillStyle = '#123312'
    ctx.fillRect(9, 21, W - 18, 12)
    ctx.fillStyle = green
    ctx.font = '7px "Silkscreen", monospace'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('TRACKER OS 0.9  ·  TTY1  ·  80x25  ·  NO REFUNDS', 14, 27)
    const st = this.lastState || {}
    const chord = this.chord
    const key = this.key ? keyName(this.key, chord?.flats) : '?'
    const notes = chord ? chord.pitchClasses.map(pc => pcName(pc, chord.flats)).join(' ') : '--'
    const next = this.preview?.[1]?.name || '??'
    const lines = [
      [38, `$ mount /dev/mod0 /mnt/vibes`, green],
      [46, `> module..... ${(this.model?.title || 'UNTITLED').slice(0, 40)}`, '#f2ecdd'],
      [54, `> format..... ${this.model?.format || '???'}   tracker: ${(this.model?.tracker || '?').slice(0, 18)}`, dim],
      [62, `> order ${String((st.order || 0) + 1).padStart(2, '0')}/${String(this.model?.totalOrders || 0).padStart(2, '0')}   pattern ${String(st.pattern || 0).padStart(2, '0')}   row ${String(st.row || 0).padStart(2, '0')}   bpm ${Math.round(st.tempo || 125)}   spd ${st.speed || 6}`, dim],
      [74, `> CHORD ...... ${chord?.name || 'N.C.'}`, amber],
      [82, `> ROMAN ...... ${this.roman || '--'}        KEY: ${key}`, amber],
      [90, `> NOTES ...... ${notes}`, green],
      [98, `> NEXT ....... ${next}`, 'rgba(255,43,214,.85)'],
      [106, `> CHANNELS ... ${this.channelStates.slice(0, 8).map((c, i) => `${i + 1}:${c.role}/${c.note || '--'}`).join('  ')}`, dim],
    ]
    for (const [y, text, color] of lines) {
      ctx.fillStyle = color
      ctx.font = '6px "Silkscreen", monospace'
      ctx.fillText(text.slice(0, 78), 14, y)
    }
    // pattern ASCII
    const p = this.model?.patterns[st.pattern]
    if (p) {
      ctx.fillStyle = 'rgba(125,255,90,.25)'
      ctx.fillRect(14, 112, W - 28, 88)
      ctx.fillStyle = dim
      ctx.font = '6px "Silkscreen", monospace'
      ctx.fillText('PATTERN DATA  [look-behind / now / look-ahead]', 18, 118)
      const rows = 11
      const start = Math.max(0, (st.row || 0) - 5)
      for (let i = 0; i < rows; i++) {
        const r = start + i
        if (r >= p.rowCount) break
        const yy = 125 + i * 7
        ctx.fillStyle = r === (st.row || 0) ? amber : dim
        ctx.fillText(String(r).padStart(2, '0'), 18, yy)
        for (let c = 0; c < Math.min(6, p.channelCount); c++) {
          const cell = this.model.cell(st.pattern, r, c)
          const x = 34 + c * 72
          if (cell && cell.note >= 1 && cell.note <= 120) {
            ctx.fillStyle = this.model.channels[c]?.color || green
            ctx.fillText(`${rawNoteName(cell.note).padEnd(4)} ${String(cell.inst).padStart(2, '0')}`, x, yy)
          } else {
            ctx.fillStyle = 'rgba(125,255,90,.2)'
            ctx.fillText('... ..', x, yy)
          }
        }
      }
    }
    // ASCII turd + log
    ctx.fillStyle = green
    ctx.font = '6px "Silkscreen", monospace'
    ctx.fillText('  .-~~~-.     LOG: damp, sincere, 4 channels', 250, 198)
    ctx.fillText(' ( ( o ) )    WARNING: bass overflow in sector 7', 250, 206)
    ctx.fillText('  `-...-`     HR: please stop printing the butt', 250, 214)
    const blink = (t * 2) % 1 < 0.5
    if (blink) { ctx.fillStyle = green; ctx.fillRect(14, 222, 5, 2) }
    ctx.fillStyle = 'rgba(125,255,90,.6)'
    ctx.fillText('> press any key to continue being perceived_', 24, 223)
    ctx.restore()
  }

  drawBars(ctx) {
    const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']
    ctx.save()
    const w = W / 7
    for (let i = 0; i < 7; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(i * w, 0, w + 1, H * 0.66) }
    ctx.fillStyle = '#101010'; ctx.fillRect(0, H * 0.66, W, H * 0.34)
    ctx.fillStyle = '#181818'
    for (let i = 0; i < 7; i++) ctx.fillRect(i * w, H * 0.7, w - 4, H * 0.08)
    ctx.fillStyle = '#202020'
    for (let i = 0; i < 7; i++) ctx.fillRect(i * w, H * 0.82, w - 4, H * 0.08)
    ctx.fillStyle = 'rgba(0,0,0,.75)'
    ctx.fillRect(60, 92, 360, 54)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1
    ctx.strokeRect(60.5, 92.5, 359, 53)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '8px "Silkscreen", monospace'; ctx.fillStyle = '#ffe800'
    ctx.fillText('THE PIXELS ARE ARGUING', 240, 107)
    ctx.font = '18px "Silkscreen", monospace'; ctx.fillStyle = '#fff'
    ctx.fillText(this.chord?.name || 'N.C.', 240, 124)
    ctx.font = '6px "Silkscreen", monospace'; ctx.fillStyle = '#8b8ba4'
    ctx.fillText(`${this.roman || '--'} · ${this.key ? keyName(this.key, this.chord?.flats).toUpperCase() : 'KEY ?'} · SMPTE EMERGENCY BROADCAST`, 240, 138)
    ctx.restore()
  }

  drawFormatLabel(ctx) {
    const label = {
      world: 'WORLD', fx: 'FULLSCREEN FX', multiview: 'MULTIVIEW', terminal: 'TERMINAL', bars: 'SMPTE',
    }[this.format] || this.format.toUpperCase()
    ctx.save()
    ctx.font = '6px "Silkscreen", monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(0,0,0,.5)'
    ctx.fillRect(W - 94, 40, 84, 10)
    ctx.fillStyle = this.format === 'world' ? 'rgba(0,240,255,.7)' : '#ffe800'
    ctx.fillText(`FMT ${label}`, W - 14, 47)
    ctx.restore()
  }

  drawTransition(ctx) {
    const tr = this.transition
    if (!tr) return
    const age = this.t - tr.at
    if (age < 0 || age > tr.dur) { this.transition = null; return }
    const p = age / tr.dur
    if (tr.type === 'flash') {
      ctx.save()
      ctx.globalAlpha = (1 - p) * (this.settings.reducedMotion ? 0.05 : 0.2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    } else if (tr.type === 'bars') {
      ctx.save()
      ctx.fillStyle = '#000'
      const h = (1 - p) * H * 0.55
      ctx.fillRect(0, 0, W, h)
      ctx.fillRect(0, H - h, W, h)
      ctx.restore()
    } else if (tr.type === 'iris') {
      ctx.save()
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      const r = p * Math.hypot(W, H) * 0.58
      ctx.arc(W / 2, H / 2, Math.max(0.01, r), 0, Math.PI * 2, true)
      ctx.fill()
      ctx.restore()
    }
  }

  drawGlitch(ctx) {
    const amount = clamp(this.glitch, 0, 1)
    if (amount < 0.02) return
    const f = this.fxCtx
    f.clearRect(0, 0, W, H)
    f.drawImage(ctx.canvas, 0, 0)
    const slices = 4
    for (let i = 0; i < slices; i++) {
      if (Math.random() > amount * 1.5) continue
      const sy = Math.random() * H
      const sh = 3 + Math.random() * 16
      const dx = (Math.random() - 0.5) * 26 * amount
      ctx.globalAlpha = 0.6 + Math.random() * 0.4
      ctx.drawImage(f.canvas, 0, sy, W, sh, dx, sy, W, sh)
    }
    ctx.globalAlpha = 1
    if (amount > 0.15) {
      ctx.fillStyle = `rgba(255,43,214,${amount * 0.08})`
      ctx.fillRect(0, 0, W, H)
    }
  }
}
