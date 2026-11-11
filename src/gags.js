/**
 * DOM gag director. Canvas handles everything physical (butt, turds, mascots);
 * this handles crisp text crimes: dialogs, chyrons, ads, BSODs, stamps.
 */

const NOW_PLAYING = [
  'Music for Arguing with a Printer',
  '3 A.M. at the Airport Food Court (Extended Mix)',
  "My Landlord's Regret (Club Mix)",
  'Four Channels of Unlicensed Emotion',
  'The Snare Is Not Okay',
  'A Cry for Help in 4/4',
  'The Bass Has Filed a Complaint',
  'Please Do Not Perceive the Module',
  'Certified Banger (Unverified)',
  '64 Patterns of Bad Decisions',
  'This Is My Emotional Support Drop',
  'The Brown Note: A Retrospective',
  'I Asked for a Raise and Got a Diminished 7th',
  'Do Not Taunt the Happy Fun Tracker',
  'An Ending in Search of a Tonic',
]

const DIALOGS = [
  { title: 'Delete kick?', msg: 'This action cannot be undone. It also cannot be done. The kick is load-bearing.', buttons: ['Yes', 'Yes'] },
  { title: 'BASS OVERFLOW', msg: 'Too much bass. Windows has opened 14 additional windows to cope. None of them are helpful.', buttons: ['OK', 'OK'] },
  { title: 'FIBER NOT FOUND', msg: 'The module is structurally sound but emotionally loose. Insert more whole grains.', buttons: ['Retry', 'Cry'] },
  { title: 'TRACKER MOM', msg: 'Are you winning, son? Also, why is the snare clipping? I am not angry, I am disappointed.', buttons: ['Sorry', 'Sorry'] },
  { title: 'HR / COMPLIANCE', msg: 'Your module has been reported for excessive groove. Please report to the dance floor.', buttons: ['Comply', 'Comply'] },
  { title: 'EXPORT SETTINGS', msg: 'Exporting to MP3 at 8 kbps for authentic pain. This may take several emotional years.', buttons: ['Cancel', 'Cancel'] },
  { title: 'ERROR 0x0000BASS', msg: 'The bass has escaped containment. Remain calm. Do not make eye contact with the subwoofer.', buttons: ['OK'] },
  { title: 'PLUGIN MANAGER', msg: 'Knob Goblin has stolen the reverb. He says it is “for the vibes.” He will not return it.', buttons: ['Cry', 'OK'] },
  { title: 'CHAT', msg: 'chat is this real? chat: yes. chat: also yes. chat: the fog is coming.', buttons: ['Yes', 'Also yes'] },
  { title: 'MISSING SAMPLE', msg: 'kick_final_FINAL_v7.wav not found. Locate? Skip? Cry? The bass department suggests crying.', buttons: ['Locate', 'Cry'] },
  { title: 'ARE YOU SURE?', msg: 'Are you sure you want to funk? This will permanently alter your relationship with 1994.', buttons: ['Yes', 'Yes'] },
  { title: 'TOILET UPDATE', msg: 'Flush Plus+ would like permission to access your latrine, your contacts, and your soul.', buttons: ['Allow', 'Allow'] },
  { title: 'THE FOG', msg: 'The fog is not a weather event. The fog is a business model. The fog is here.', buttons: ['OK'] },
]

const ADS = [
  { head: 'BIG BASS™', small: 'Now with 40% more sub. Side effects may include furniture loss and spontaneous nodding.', cta: 'FEEL IT NOW' },
  { head: 'MODULE INSURANCE', small: 'Protect your family from unexpected key changes. Coverage starts at one (1) hi-hat.', cta: 'GET COVERED' },
  { head: 'SYNERGY', small: 'We have repurposed your childhood into a quarterly report. The numbers are emotional.', cta: 'LEARN MORE' },
  { head: 'FLUSH PLUS+', small: 'The subscription toilet. Unlimited flushes. Cancel anytime. Please do not cancel.', cta: 'SUBSCRIBE' },
  { head: 'FIBER 9000', small: 'One weird trick. Doctors hate it. The bass department has questions. Results may vary.', cta: 'ORDER NOW' },
  { head: 'TRACKER PREMIUM', small: 'Unlock 5th channel. Unlock happiness. Terms apply. Happiness not guaranteed.', cta: 'UPGRADE' },
]

const STAMPS = ['WTF', 'ROFL', 'CERTIFIED BANGER', 'SKILL ISSUE', 'NO NOTES', 'BASS', 'PLOP', 'THE FOG IS COMING', 'THIS IS FINE', 'SUS', 'LOL', 'OBEY', 'GAS', 'YASS', 'BONK']
const SUBTITLES = [
  'chat is this real',
  'he just like me fr',
  'the fog is coming',
  'this is my emotional support drop',
  'no thoughts just snare',
  'bass boosted to 11',
  'the tritone is not the devil',
  'I am not immune to propaganda',
  "it's giving tracker",
  'the snare has rights',
  'do not perceive the bass',
  'this is not a phase, mom',
  'we are so back (what is back)',
  'my honest reaction: 😐',
]

const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)]

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export class GagDirector {
  constructor(opts = {}) {
    this.layer = opts.layer
    this.captionEl = opts.caption
    this.toastEl = opts.toast
    this.chaos = 4
    this.serious = false
    this.gross = true
    this.reducedMotion = false
    this.viz = null
    this.model = null
    this.seed = 1
    this.rng = mulberry32(1)
    this.active = []
    this.lastDialog = -10
    this.lastAd = -10
    this.lastChyron = -10
    this.lastStamp = -10
    this.lastSub = -10
    this.lastPassion = -10
    this.lastBsod = -10
    this.lastCensored = -10
    this.bsodUsed = false
    this.draws = 0
    this.nextBreakAt = 12
    this.breakIndex = 0
    this.captionTimer = 0
    this.toastTimer = 0
  }

  setSettings({ chaos, serious, gross, reducedMotion }) {
    if (Number.isFinite(chaos)) this.chaos = chaos
    if (typeof serious === 'boolean') this.serious = serious
    if (typeof gross === 'boolean') this.gross = gross
    if (typeof reducedMotion === 'boolean') this.reducedMotion = reducedMotion
    if (this.serious) {
      this.clearGags()
      if (this.captionEl) this.captionEl.classList.remove('on')
    }
  }

  setModel(model) {
    this.model = model
    this.bsodUsed = false
    const seed = [...(model?.title || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0x9e3779b9)
    this.seed = seed >>> 0
    this.rng = mulberry32(this.seed)
  }

  now() { return performance.now() / 1000 }

  clearGags() {
    for (const el of this.active) el.remove()
    this.active = []
  }

  _add(el, ttl = 3000) {
    if (!el) return null
    this.layer.appendChild(el)
    this.active.push(el)
    const max = this.serious ? 0 : 1 + Math.floor(this.chaos / 3)
    while (this.active.length > Math.max(2, max)) {
      const old = this.active.shift()
      old?.remove()
    }
    if (ttl > 0) setTimeout(() => {
      el.remove()
      this.active = this.active.filter(x => x !== el)
    }, ttl)
    return el
  }

  caption(text, seconds = 3) {
    if (!this.captionEl || this.serious) return
    this.captionEl.textContent = text
    this.captionEl.classList.add('on')
    clearTimeout(this.captionTimer)
    this.captionTimer = setTimeout(() => this.captionEl.classList.remove('on'), seconds * 1000)
  }

  toast(text, seconds = 3) {
    if (!this.toastEl) return
    this.toastEl.textContent = text
    this.toastEl.classList.add('on')
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('on'), seconds * 1000)
  }

  dialog(spec = null) {
    if (this.serious || this.chaos < 2) return
    const t = this.now()
    if (t - this.lastDialog < 2.2) return
    this.lastDialog = t
    const d = spec || pick(DIALOGS, this.rng)
    const el = document.createElement('div')
    el.className = 'gag-dialog'
    el.style.left = `${rand(4, 62)}vw`
    el.style.top = `${rand(9, 46)}vh`
    el.style.transform = `rotate(${rand(-1.2, 1.2)}deg)`
    el.innerHTML = `
      <div class="titlebar"><span>${esc(d.title)}</span><span>×</span></div>
      <div class="body"><div class="icon">${d.title.includes('BASS') ? '!' : d.title.includes('FOG') ? '?' : 'i'}</div><div>${esc(d.msg)}</div></div>
      <div class="buttons">${(d.buttons || ['OK']).map(b => `<span>${esc(b)}</span>`).join('')}</div>`
    this._add(el, 3600)
  }

  chyron(kicker = 'NOW PLAYING', line = null) {
    if (this.serious || this.chaos < 2) return
    const t = this.now()
    if (t - this.lastChyron < 5) return
    this.lastChyron = t
    const el = document.createElement('div')
    el.className = 'gag-chyron'
    el.innerHTML = `<div class="kicker">${esc(kicker)}</div><div class="line">${esc(line || pick(NOW_PLAYING, this.rng))}</div>`
    this._add(el, 4800)
  }

  stamp(text = null, small = false) {
    if (this.serious || this.chaos < 3) return
    const t = this.now()
    if (t - this.lastStamp < 1.6) return
    this.lastStamp = t
    const el = document.createElement('div')
    el.className = 'gag-stamp'
    el.textContent = text || pick(STAMPS, this.rng)
    el.style.left = `${rand(5, 62)}vw`
    el.style.top = `${rand(18, 62)}vh`
    el.style.transform = `rotate(${rand(-14, 14)}deg)`
    el.style.fontSize = small ? 'clamp(18px,3.4vw,36px)' : ''
    this._add(el, 1500)
  }

  subtitle(text = null) {
    if (this.serious || this.chaos < 2) return
    const t = this.now()
    if (t - this.lastSub < 4) return
    this.lastSub = t
    this.caption(text || pick(SUBTITLES, this.rng), 3.2)
  }

  ad() {
    if (this.serious || this.chaos < 3) return
    const t = this.now()
    if (t - this.lastAd < 12) return
    this.lastAd = t
    const a = pick(ADS, this.rng)
    this.viz?.showDog?.(7)
    const el = document.createElement('div')
    el.className = 'gag-ad'
    el.style.right = `${rand(3, 8)}vw`
    el.style.top = `${rand(12, 38)}vh`
    el.innerHTML = `<b>${esc(a.head)}</b><div class="ad-small">${esc(a.small)}</div><span class="ad-cta">${esc(a.cta)}</span>`
    this._add(el, 6500)
    this.caption('SPONSORED BY BIG BASS™. the bass has no comment.', 4)
  }

  passion() {
    if (this.serious || this.chaos < 7) return
    const t = this.now()
    if (t - this.lastPassion < 40) return
    this.lastPassion = t
    const el = document.createElement('div')
    el.className = 'gag-passion'
    el.innerHTML = `<div class="wordart">GRAPHIC DESIGN<br>IS MY PASSION</div><div class="wordart stage2">CLIP ART TAKEOVER · 8 BARS ONLY</div>`
    const before = this.active.length
    this._add(el, 3600)
    this.active = this.active.slice(0, Math.max(this.active.length, before))
    this.caption('the design department has breached containment.', 3.5)
  }

  bsod() {
    if (this.serious || this.chaos < 7 || this.bsodUsed) return
    const t = this.now()
    if (t - this.lastBsod < 90) return
    this.lastBsod = t
    this.bsodUsed = true
    const el = document.createElement('div')
    el.className = 'gag-bsod'
    const hex = Array.from({ length: 10 }, () => Math.floor(this.rng() * 0xffff).toString(16).toUpperCase().padStart(4, '0')).join(' ')
    el.innerHTML = `
      <div class="bsod-logo">TRACKER OS</div>
      <div class="bsod-line">A vibe has been detected and TRACKER OS must restart.</div>
      <div class="bsod-line">The system has been funk-deficient since 0x0000BASS.</div>
      <div class="bsod-line">STOP CODE: 0x0000BASS (BASS_OVERFLOW)</div>
      <div class="bsod-line">${hex}</div>
      <div class="bsod-line">Beginning dump of physical groove...</div>
      <div class="bsod-hint">Press any key to continue. There is no key. There is only the bass.</div>`
    this._add(el, 3000)
    this.caption('rebooting the funk. do not turn off the module.', 3)
  }

  censored() {
    if (this.serious || this.chaos < 6) return
    const t = this.now()
    if (t - this.lastCensored < 60) return
    this.lastCensored = t
    const el = document.createElement('div')
    el.className = 'gag-censored'
    el.innerHTML = `
      <div class="bar"><span>⚠ CONTENT MODERATION</span><span>×</span></div>
      <div class="censor-pixels"></div>
      <p>This image has been flagged for excessive cheek. HR has replaced it with 256 polygons. Please enjoy the bass instead.</p>`
    this._add(el, 4200)
    this.caption('the forbidden image has been pixelated by HR. no further questions.', 4)
  }

  bars() {
    if (this.serious || this.chaos < 3) return
    const el = document.createElement('div')
    el.className = 'gag-bars'
    el.innerHTML = '<div class="b"></div><div class="b"></div><div class="b"></div><div class="b"></div><div class="b"></div><div class="b"></div><div class="b"></div><div class="bars-label"><b>THE PIXELS ARE ARGUING</b>SMPTE EMERGENCY BROADCAST · PLEASE REMAIN CALM</div>'
    this._add(el, 1700)
    this.caption('SMPTE EMERGENCY BROADCAST. the pixels are arguing.', 2.4)
  }

  endcard() {
    if (this.serious || this.chaos < 3) return
    const el = document.createElement('div')
    el.className = 'gag-endcard'
    el.innerHTML = `<div class="ec-inner"><h2>THANKS FOR WATCHING</h2><p>TRACKER TRASH</p><p>A PRODUCTION OF NOBODY IN PARTICULAR</p><p>NO MODULES WERE HARMED. SEVERAL WERE JUDGED.</p><div class="tiny">THIS IS NOT THE END. THE BASS HAS NOT BEEN EXPORTED YET.</div></div>`
    this._add(el, 2600)
    this.caption('thank you for watching. please continue watching.', 2.6)
  }

  pirate() {
    if (this.serious || this.chaos < 4) return
    const el = document.createElement('div')
    el.className = 'gag-pirate'
    el.innerHTML = `<div class="p-inner"><h2>⚠ PIRACY IS A COMPLIMENT ⚠</h2><p>YOU WOULDN'T DOWNLOAD A TRACKER MODULE.</p><p>YOU WOULD DOWNLOAD FOUR CHANNELS AND A DREAM.</p><p>WE ARE ALSO WATCHING. WE ARE ALWAYS WATCHING.</p><div class="fine">THIS WARNING CANNOT BE SKIPPED. WE TRIED.</div></div>`
    this._add(el, 2600)
    this.caption('piracy is a compliment. the bass department has been notified.', 2.6)
  }

  player() {
    if (this.serious || this.chaos < 4) return
    const el = document.createElement('div')
    el.className = 'gag-player'
    el.innerHTML = `<div class="ptitle"><span>MODULE_PLAYER_3000.AVI</span><span>×</span></div><div class="video"><div class="buffering">BUFFERING 99%…</div></div><div class="pbar"><i></i></div><div class="pfoot"><span>480p · 1997 kbps</span><span>99:99 / ∞</span></div>`
    this._add(el, 3400)
    this.caption('buffering 99%. this may take several emotional years.', 3)
  }

  achievement(text = null) {
    if (this.serious || this.chaos < 3) return
    const t = this.now()
    if (t - (this.lastAchievement || 0) < 8) return
    this.lastAchievement = t
    const lines = ['survived the snare', 'did not export to mp3', 'heard the brown note and kept going', 'opened the wrong module', 'made eye contact with the butt', 'flushed at the right time', 'recognised a diminished seventh', 'did not touch the tempo']
    const el = document.createElement('div')
    el.className = 'gag-achievement'
    el.innerHTML = `<div class="ak">ACHIEVEMENT UNLOCKED</div><div class="an">${esc(text || pick(lines, this.rng))}</div><div class="ad">+0 gamerscore · +1 emotional damage</div>`
    this._add(el, 3800)
  }

  tick(now, data) {
    if (this.serious || this.chaos < 2) return
    if (!data || data.viz?.format === 'terminal' || data.viz?.format === 'multiview' || data.viz?.format === 'bars') return
    if (now < this.nextBreakAt) return
    this.nextBreakAt = now + 17 + Math.random() * 16
    const r = this.rng()
    if (r < 0.18) this.bars()
    else if (r < 0.36) this.endcard()
    else if (r < 0.54) this.pirate()
    else if (r < 0.72) this.player()
    else if (r < 0.9) this.achievement()
    else this.censored()
  }

  onEvents(events, data) {
    if (!data) return
    this.viz = data.viz || this.viz
    this.model = data.model || this.model
    if (this.serious) return
    const chaos = this.chaos
    if (chaos < 1) return
    const state = data.state || {}
    const stats = data.stats || {}
    const t = this.now()

    for (const e of events) {
      if (e.type === 'section') {
        this.draws++
        const r = this.rng()
        if (chaos >= 3 && r < 0.34) this.chyron('NOW PLAYING', pick(NOW_PLAYING, this.rng))
        else if (chaos >= 4 && r < 0.55) this.dialog()
        else if (chaos >= 5 && r < 0.64) this.ad()
        else if (chaos >= 7 && r < 0.72) this.passion()
        else if (chaos >= 7 && r < 0.75) this.bsod()
        else if (chaos >= 6 && r < 0.79) this.censored()
        if (chaos >= 5 && this.rng() < 0.18) this.achievement()
        if (chaos >= 6 && this.rng() < 0.08) this.endcard()
        if (chaos >= 5 && stats.noteRate > 8) this.stamp('BASS', true)
      } else if (e.type === 'chord') {
        if (chaos >= 4 && this.rng() < 0.12) this.chyron('NEXT UP', `${e.chord?.name || 'a chord'} — ${e.roman || 'function unknown'}`)
        if (chaos >= 5 && this.rng() < 0.08) this.subtitle()
      } else if (e.type === 'silence') {
        this.caption('...', 2.2)
        if (chaos >= 4) this.subtitle('the module has left the chat')
      } else if (e.type === 'note') {
        if (e.kind === 'snare') {
          if (chaos >= 3 && t - this.lastDialog > 2.6) this.dialog()
          if (chaos >= 6 && this.rng() < 0.12) this.stamp(pick(STAMPS, this.rng), true)
        } else if (e.kind === 'kick') {
          if (chaos >= 4 && this.rng() < 0.045) this.stamp(pick(['THUMP', 'BONK', 'THIS IS FINE', 'CERTIFIED BANGER'], this.rng))
        } else if (e.kind === 'bass') {
          if (chaos >= 3 && this.rng() < 0.06) this.caption(pick(['BASS DETECTED. DIGNITY NOT FOUND.', 'the low end has opinions.', 'this is what the floor feels.', 'plop.'], this.rng), 2.2)
          if (chaos >= 5 && this.rng() < 0.04) this.ad()
        } else if (e.kind === 'lead') {
          if (chaos >= 3 && this.rng() < 0.035) this.subtitle(pick(SUBTITLES, this.rng))
        } else if (e.kind === 'hat') {
          if (chaos >= 6 && this.rng() < 0.02) this.subtitle('ts')
        }
      }
      if (state.pos > 0 && chaos >= 4 && Math.random() < 0.0006) this.censored()
    }
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function rand(a, b) { return a + Math.random() * (b - a) }
