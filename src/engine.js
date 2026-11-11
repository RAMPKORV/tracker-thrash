import { ChiptuneJsPlayer } from '../vendor/chiptune3.js'

/**
 * Thin, lazy wrapper around chiptune3 / libopenmpt. The AudioContext is only
 * created after a user gesture, which keeps autoplay policies and iOS happy.
 */
export class TrackerEngine {
  constructor() {
    this.ctx = null
    this.player = null
    this.analyser = null
    this.initPromise = null
    this.initialized = false
    this.meta = null
    this.moduleName = ''
    this.playing = false
    this.paused = true
    this.loading = false
    this.loop = true
    this.state = {
      order: 0, row: 0, pattern: 0, speed: 6, tempo: 125, pos: 0, vu: [],
      playingChannels: 0,
    }
    this.onMeta = null
    this.onState = null
    this.onError = null
    this.onEnded = null
    this.onSeek = null
    this._metaWait = null
    this._lastSeekAt = 0
  }

  async init() {
    if (this.initPromise) return this.initPromise
    this.initPromise = (async () => {
      if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error('Web Audio is not available. Your browser is too acoustic.')
      }
      const AC = window.AudioContext || window.webkitAudioContext
      this.ctx = new AC({ latencyHint: 'interactive' })
      // A real gesture unlock, including the iOS silent-buffer trick.
      try { await this.ctx.resume() } catch { /* resumed below */ }
      try {
        const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
        const s = this.ctx.createBufferSource()
        s.buffer = b
        s.connect(this.ctx.destination)
        s.start(0)
      } catch { /* non-fatal */ }

      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.72
      this.analyser.minDecibels = -92
      this.analyser.maxDecibels = -10

      this.player = new ChiptuneJsPlayer({ context: this.ctx })
      await new Promise((resolve, reject) => {
        let done = false
        const timer = setTimeout(() => {
          if (done) return
          done = true
          reject(new Error('The 1.5 MB of pure 1994 did not wake up. Try reloading.'))
        }, 20000)
        this.player.onInitialized(() => {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve()
        })
        this.player.onError(err => {
          this._fail(this._errorText(err))
        })
      })
      // chiptune3 constructs a gain node but does not connect it when a context
      // is supplied. Route it through the analyser ourselves.
      this.player.gain.gain.value = 0.92
      this.player.gain.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)

      this.player.onMetadata(meta => {
        this.meta = meta
        this.loading = false
        this.playing = true
        this.paused = false
        this.moduleName = meta?.title || this.moduleName
        if (meta) {
          this.state.speed = Number(meta.speed) || this.state.speed
          this.state.tempo = Number(meta.tempo) || this.state.tempo
        }
        if (this._metaWait) {
          clearTimeout(this._metaWait)
          this._metaWait = null
        }
        this.onMeta?.(meta)
      })
      this.player.onProgress(pos => {
        if (!pos) return
        this.state = {
          order: pos.order | 0,
          row: pos.row | 0,
          pattern: pos.pattern | 0,
          speed: Number(pos.speed) || this.state.speed || 6,
          tempo: Number(pos.tempo) || this.state.tempo || 125,
          pos: Number(pos.pos) || 0,
          vu: Array.isArray(pos.vu) ? pos.vu : this.state.vu,
          playingChannels: pos.playingChannels | 0,
        }
        this.onState?.(this.state)
      })
      this.player.onEnded(() => {
        this.playing = false
        this.onEnded?.()
      })
      this.initialized = true
    })()
    return this.initPromise
  }

  _errorText(err) {
    const map = {
      Load: 'Could not load that file. Is it a module or a cry for help?',
      ptr: 'libopenmpt refused this file. It has seen things.',
      dur: 'This file has zero duration. It is technically a haiku.',
      Process: 'The audio engine fell over. Dramatic, but unhelpful.',
    }
    return map[err?.type] || 'Something in the tracker dimension broke. Try another module.'
  }

  _fail(message) {
    this.loading = false
    this.playing = false
    this.onError?.(message)
  }

  _guardSize(buffer) {
    if (!buffer || buffer.byteLength < 32) throw new Error('That file is smaller than a tracker module and most regrets.')
    if (buffer.byteLength > 64 * 1024 * 1024) throw new Error('That module is 64 MB. Please, the browser has a family.')
  }

  async loadArrayBuffer(buffer, name = 'module') {
    await this.init()
    this._guardSize(buffer)
    this.moduleName = name
    this.meta = null
    this.loading = true
    this.playing = true
    this.paused = false
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume() } catch { /* noop */ } }
    this.player.play(buffer)
    // If the worklet chokes before metadata, don't leave the spinner forever.
    if (this._metaWait) clearTimeout(this._metaWait)
    this._metaWait = setTimeout(() => {
      if (this.loading) {
        this._metaWait = null
        this._fail('The module is taking too long to parse. It might be a 64-channel cathedral of sadness.')
      }
    }, 30000)
  }

  async loadFile(file) {
    if (!file) return
    const name = file.name || 'module'
    const buf = await file.arrayBuffer()
    await this.loadArrayBuffer(buf, name)
  }

  async loadDemo() {
    const url = new URL('../assets/demo/dj-rat-severe-groove.mod', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Demo module missing (${res.status}). The bass has left the building.`)
    const buf = await res.arrayBuffer()
    await this.loadArrayBuffer(buf, 'dj-rat-severe-groove.mod')
  }

  async play() {
    await this.init()
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    if (this.paused) {
      this.player.unpause()
      this.paused = false
      this.playing = true
    } else if (!this.playing) {
      this.player.setOrderRow(0, 0)
      this.player.unpause()
      this.playing = true
      this.paused = false
    }
  }

  async pause() {
    if (!this.initialized) return
    if (!this.paused) {
      this.player.pause()
      this.paused = true
      this.playing = true
    }
  }

  async togglePause() {
    if (this.paused) await this.play()
    else await this.pause()
    return this.paused
  }

  async resume() {
    if (this.ctx?.state === 'suspended') {
      try { await this.ctx.resume() } catch { /* noop */ }
    }
  }

  restart() {
    if (!this.initialized) return
    this.player.setOrderRow(0, 0)
    if (this.paused) {
      this.player.unpause()
      this.paused = false
    }
    this.playing = true
    this.state = { ...this.state, order: 0, row: 0, pattern: 0, pos: 0 }
    this.onSeek?.(0)
  }

  seek(seconds) {
    if (!this.initialized) return
    const t = Math.max(0, Math.min(Number(seconds) || 0, this.meta?.dur || 1e9))
    this.player.setPos(t)
    this.state = { ...this.state, pos: t }
    this.onSeek?.(t)
  }

  seekFraction(f) {
    if (!this.meta?.dur) return
    this.seek(f * this.meta.dur)
  }

  setLoop(on) {
    this.loop = !!on
    if (this.initialized) this.player.setRepeatCount(this.loop ? -1 : 0)
  }

  selectSubsong(i) {
    if (!this.initialized) return
    this.player.selectSubsong(i)
    this.state = { ...this.state, pos: 0, order: 0, row: 0 }
    this.onSeek?.(0)
  }

  setVolume(v) {
    if (this.player?.gain) this.player.gain.gain.value = Math.max(0, Math.min(1, v))
  }

  get duration() { return Number(this.meta?.dur) || 0 }
  get position() { return Number(this.state.pos) || 0 }

  getLatency() {
    if (!this.ctx) return 0
    return (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)
  }

  getSpectrum(out) {
    if (!this.analyser) return null
    const arr = out && out.length === this.analyser.frequencyBinCount
      ? out
      : new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(arr)
    return arr
  }

  getWaveform(out) {
    if (!this.analyser) return null
    const arr = out && out.length === this.analyser.fftSize
      ? out
      : new Uint8Array(this.analyser.fftSize)
    this.analyser.getByteTimeDomainData(arr)
    return arr
  }
}
