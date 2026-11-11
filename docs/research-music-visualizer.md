# Music Visualizer Research: Conveying Harmony, Key, and Rhythm from Tracker Module Data

**Scope:** browser-based visualizer for tracker modules (MOD/XM/S3M/IT), with exact pattern data available. The goal is musical legibility for musicians without giving up spectacle.

**Thesis:** A tracker module is already a symbolic score. Do not guess notes from an FFT when the pattern data contains exact note events, instrument numbers, and timing. Build a **symbolic analysis layer** (voices → notes → chords → key → metrics) and drive both the **readable HUD** and the **chaotic scene** from the same event stream. That is the difference between a visualizer that reacts to music and one that explains it.

**Deliverable map:**

| Requested research | Where |
|---|---|
| Real-time note/chord detection from tracker patterns; sounding notes, spelling, finetune, note-offs, retrigger, arpeggios, sustained samples | §1, §2.2–2.4 |
| Chord recognition: weighted templates, Harte syntax, slash chords, inversions, N.C., extensions, ambiguity, Roman numerals | §2 |
| Key detection: Krumhansl–Schmuckler/Temperley, windows, confidence, smoothing | §3 |
| Visualization mappings and legibility, with research/tool citations | §4 |
| Metrics: meaningful vs gimmicky | §5 |
| Toggleable "nerd HUD" and 16:9 layout with chaos visuals | §6 |
| Prior art and open-source repos | §7 |
| Architecture, validation, references, appendices | §8–10, A–D |

**Contents:** 0. Executive recommendations · 1. From tracker patterns to sounding notes · 2. Chord recognition · 3. Key detection · 4. Visualization mappings · 5. Metrics · 6. HUD design · 7. Prior art · 8. Architecture · 9. Validation · 10. References · Appendices A–D.

---

## 0. Executive Recommendations

1. **Use the module data as ground truth.** Audio analysis is only for timbre/energy; notes, chords, key, and rhythm come from the pattern data.
2. **Build a shadow interpreter.** Decode patterns/orders into `NoteEvent[]` and per-channel `Voice` state. Use libopenmpt/WASM for audio; its stable C API exposes transport, pattern commands, and channel VU, but not a per-channel current-note query, so simulate note semantics yourself.
3. **Resolve pitch at the sample level.** XM: pattern note + relative note + finetune/128. IT: note map → mapped note + C5Speed. MOD: period → frequency. Keep `midiFloat` and `cents`; quantize only for pitch-class analysis.
4. **Chord detection:** weighted pitch-class template matching with required/optional degrees, root/bass/key bonuses, complexity penalty, and explicit ambiguity rules. Emit Harte labels plus common lead-sheet labels.
5. **Key detection:** Krumhansl–Schmuckler or Temperley profiles over a 4–8 bar rolling histogram, with HMM/hysteresis smoothing and honest confidence. Never let the displayed key flicker.
6. **Visual core:** piano roll + channel color + beat/bar + chord/key text. Add pitch-class clock, chord-degree wheel, pattern grid, and metrics only in "nerd" mode.
7. **HUD:** three disclosure levels; bottom letterbox or edge-safe panels; `H` cycles; default to the musician level, not the firehose.
8. **Metrics worth showing:** note density, polyphony, register spread, roughness, syncopation/accent, channel activity, harmonic rhythm. Avoid undefined "energy/mood/vibe" scores.
9. **Prior art to steal from:** Music Animation Machine (piano roll + harmonic color), Synthesia (falling notes), Chordino (HMM chord smoothing), OpenMPT (pattern semantics), MilkDrop/projectM (spectacle), WaveRoll (multi-track piano roll).

---

## 1. From Tracker Patterns to Sounding Notes

### 1.1 What the module gives you

A tracker module is a sequence of **orders** (song positions), each pointing to a **pattern**. A pattern is a grid of **rows × channels**. Each cell can contain:

| Field | Meaning |
|---|---|
| Note | Pitch, note-off, note-cut, or note-fade |
| Instrument | Instrument/sample number |
| Volume | Volume column (0–64, or effect-coded) |
| Effect | Command letter + parameter (hex) |

Additional metadata:

- **Instruments/samples:** sample data, loop points, volume/pan envelope, fade-out, finetune, relative note (XM), note map and C5Speed (IT), default volume/pan.
- **Timing:** initial speed (ticks/row), initial tempo (BPM), pattern rows, order list, restart position.
- **Per-pattern:** rows per beat / rows per measure (libopenmpt exposes these; useful for beat grids and odd meters).

For key detection, cap each note's contribution at ~2 bars; otherwise a looped pad or a drone can dominate the histogram. For chord detection, cap the recency/age weight similarly.

The important consequence: **a tracker channel is monophonic at the pattern level**. A chord is normally formed by several channels sounding simultaneously, not by a polyphonic note list on one channel. IT's New Note Action (NNA) can create virtual background voices, but those are an instrument-level exception; track them separately and render them with lower opacity.

### 1.2 Timing model

For MOD/XM/IT-style playback:

```text
tickSeconds = 2.5 / BPM
rowSeconds  = speed * tickSeconds
```

At BPM 125 and speed 6: tick = 20 ms, row = 120 ms, 64 rows = 7.68 s.

Rows per beat in 4/4 (quarter-note beat):

```text
rowsPerBeat    = 60 / (BPM * rowSeconds)
               = 60 / (BPM * speed * 2.5 / BPM)
               = 24 / speed
rowsPerMeasure = rowsPerBeat * beatsPerMeasure
```

So at speed 6, **4 rows per beat**, 16 rows per bar. At speed 3, 8 rows per beat. This is independent of BPM, which is why tracker musicians think in "speed 6, 16 rows per bar" rather than milliseconds.

Timing complications to handle:

- **Pattern delay (`EEx`, `SEx`):** row duration becomes `(x + 1) * speed * tickSeconds`; notes are not retriggered.
- **Note delay (`EDx`, `SDx`):** onset shifts by `x` ticks, but the row boundary does not.
- **Tempo/speed changes (`Fxx`, `Axx`, `Txx`):** recompute `tickSeconds` and `rowSeconds` at the row where the effect occurs.
- **Pattern jumps (`Bxx`, `Dxx`), breaks, loops (`E6x`, `SBx`):** do not assume a linear order; maintain an explicit `(order, row, time)` timeline.
- **Subsongs / restart:** reset voice state and analysis windows.

**Recommended architecture:** use libopenmpt (WASM) for audio and transport (`get_current_order`, `get_current_row`, `get_current_speed`, `get_current_tempo`, `get_pattern_rows_per_beat`, `get_pattern_rows_per_measure`), and a **shadow interpreter** that reads the same pattern cells and maintains note/voice state. The stable libopenmpt C API exposes pattern commands, channel VU, and transport, but not a per-channel "current note" query; the shadow interpreter fills that gap and keeps the analysis portable across players.

### 1.3 Voice state machine

Per channel, maintain a small state machine. A voice is not a MIDI note-on/note-off pair; it is a sample playback instance with pitch, envelope, and loop behavior.

At any time `t`, the **sounding set** is:

```js
const sounding = channels
  .map(c => c.voice)
  .filter(v => v && (v.active || v.releasing));
```

This is the input to chord/key analysis. Keep it per channel; do not flatten it into a single note list until you have applied role/percussion weights.

```text
States: IDLE → ATTACK → SUSTAIN → RELEASE → FADE → IDLE
                    └──────────────→ CUT → IDLE
```

Events:

| Event | Effect |
|---|---|
| Note on (pitched) | Allocate/replace voice; set `midiFloat`, `sample`, `startTime`; enter ATTACK/SUSTAIN |
| Note off (XM 97, IT 255) | Enter RELEASE (envelope release/fade-out) |
| Note cut (IT 254, `ECx`) | Enter CUT (immediate silence) |
| Note fade (IT 253) | Enter FADE (fade-out without key-off) |
| New note on same channel | End previous voice unless NNA = continue; start new voice |
| Sample end (non-looping) | End voice at `start + sampleLength / freq` |
| Envelope end / fade-out zero | End voice |
| NNA = continue | Previous voice becomes a virtual background voice; keep it, lower weight/opacity |

Pseudocode:

```js
function onNoteOn(ch, cell, t) {
  const prev = ch.voice;
  if (prev && prev.active) {
    if (prev.nna === "continue") {
      prev.virtual = true;
      prev.gain *= 0.6;
    } else {
      endVoice(prev, t, prev.nna === "fade" ? "fade" : "cut");
    }
  }
  const resolved = resolveSample(ch, cell); // XM multi-sample / IT note map
  if (!resolved) return;
  ch.voice = {
    channel: ch.index,
    sample: resolved.sample,
    midiFloat: resolved.midiFloat,
    pc: mod12(Math.round(resolved.midiFloat)),
    cents: (resolved.midiFloat - Math.round(resolved.midiFloat)) * 100,
    velocity: resolveVolume(ch, cell), // volume column, default sample volume, or envelope
    start: t,
    end: null,
    releaseStart: null,
    active: true,
    virtual: false,
    nna: resolved.nna,
    looping: resolved.sample.loop,
    env: 1,
    flags: { arp: null, glide: null, vibrato: null, retrig: null, sustained: false }
  };
}
```

For visualization, a releasing voice should fade over its release time, not vanish instantly; a cut voice should end hard. This distinction is visible to musicians and makes the piano roll feel accurate.

**Envelope and lifetime:**

```text
env(t) = interpolate(volumeEnvelope, t)
if envelope sustain loop is active and no note-off: hold at the sustain point
if note-off: release segment + fade-out
voiceAudible = env(t) * fade(t) * channelVolume > ε
```

For a non-looping sample, the voice also ends at `start + sampleLength / freq`. For a looping sample with a sustaining envelope, the voice can last indefinitely; cap the **visual** bar at 8 beats and mark it as sustained, but keep the pitch class active for analysis until note-off/cut/fade. This is the single most common source of wrong note lengths in tracker visualizers.

### 1.4 Pitch resolution: transposition, finetune, note maps

This is where most visualizers get note names wrong. The pattern note is **not always the sounding pitch**.

#### Instrument and sample resolution

The instrument number in a cell is not necessarily the sample that plays. Resolve it first:

| Format | Resolution |
|---|---|
| XM | Instrument → sample map by note range; each sample has `relativeNote` and `finetune` |
| IT | Instrument → 120-entry note map → `{ sample, mappedNote }`; sample has `C5Speed` |
| MOD | Instrument number = sample number; sample has a finetune nibble |
| S3M | Instrument/sample number; sample has a finetune value (format-dependent) |

```js
function resolveSample(ch, cell) {
  if (format === "xm") {
    const inst = instruments[cell.instrument];
    const smp = inst.sampleForNote(cell.note); // multi-sample keymap
    return {
      sample: smp,
      midiFloat: (cell.note - 1) + 12 + smp.relativeNote + smp.finetune / 128,
      nna: "cut"
    };
  }
  if (format === "it") {
    const inst = instruments[cell.instrument];
    const entry = inst.noteMap[cell.note]; // { sample, mappedNote }
    return {
      sample: samples[entry.sample],
      midiFloat: entry.mappedNote,
      nna: inst.nna
    };
  }
  // MOD / S3M: period or note + sample finetune
  return { sample: samples[cell.instrument], midiFloat: periodToMidi(cell.period), nna: "cut" };
}
```

Use the **resolved sample** for:
- pitch (relative note/finetune/note map),
- percussion classification (loop flag, length, name, spectral flatness),
- envelope/release behavior (volume envelope, fade-out),
- channel role inference (bass/melody/pad/drums),
- display labels (sample/instrument names in nerd mode).

#### XM (FastTracker II)

```text
realNote  = (patternNote - 1) + relativeNote      // 0..118, 0 = C-0
midiFloat = realNote + 12 + finetune / 128        // MIDI C0 = 12
```

- `patternNote` 1..96; 97 = key off.
- `relativeNote` is a signed byte per sample.
- `finetune` is signed −128..+127; −128 = −1 semitone, +127 = +127/128 semitone.
- XM C-4 (pattern note 49) with relative 0 and finetune 0 → MIDI 60.
- XM can use linear or Amiga frequency tables (header flag). Static note pitch is unaffected, but portamento/vibrato depth is; for glides, use the player's actual frequency or replicate the table.

#### IT (Impulse Tracker)

In instrument mode, the pattern note selects an entry in the instrument's **note map**:

```text
entry     = noteMap[patternNote]      // { sample, mappedNote }
midiFloat = mappedNote                // IT C-5 = MIDI 60 (middle C)
freq      = sample.C5Speed * 2^((mappedNote - 60) / 12)
```

- Note values 0..119 (C-0..B-9); 255 = note off, 254 = note cut, 253 = note fade (OpenMPT convention; the format doc says "others = note fade").
- The **mapped note**, not the pattern note, determines pitch. If the map is identity, pattern note 60 (C-5) → mapped 60 → MIDI 60 (middle C). If the map transposes down an octave, the same pattern note sounds C-4.
- In sample mode (no instrument note map), use `midiFloat = patternNote`.

#### MOD (ProTracker)

```text
freq      = 7093789.2 / (2 * period)     // PAL Amiga clock; for pitch class/detune
midiFloat = 69 + 12 * log2(freq / 440)
```

- Finetune is a 4-bit signed value (−8..+7) in 1/8-semitone steps; it modifies the period.
- Some modules use the NTSC clock (7159090.5); the ~0.9% difference is under a semitone, but flag it if you care about tuning display.
- **Do not use the absolute frequency to infer the octave.** ProTracker's C-1/C-2/C-3 labels are relative to the Amiga period table, not scientific pitch. Use the tracker's note name/period table plus a fixed offset for display; the frequency formula is for pitch class/detune.

#### S3M (Scream Tracker 3)

- Note 255 = note off, 254 = note cut.
- Sample rate is stored as `C2Spd` with a finetune nibble; use the player's frequency calculation rather than hard-coding a period table.
- The same voice/effect logic applies: note-off releases, note-cut stops, retrigger/arpeggio/porta behave like their MOD/XM counterparts.

#### Detune handling

Keep `midiFloat` and `cents`. For pitch-class analysis:

```js
const midi = Math.round(midiFloat);
const pc = ((midi % 12) + 12) % 12;
const cents = (midiFloat - midi) * 100;
const detuned = Math.abs(cents) > 25; // more than a quarter-semitone off
```

If `|cents| > 50`, the note is closer to the neighboring semitone; rounding is still the best guess, but mark it detuned. Do **not** discard detuned notes; tracker music often uses finetune deliberately (chorus, detuned leads, microtonal bends). Display a small tuning needle or `+23¢` in nerd mode.

#### Octave conventions (easy to get wrong)

| Format | Note value | MIDI | Scientific pitch |
|---|---|---|---|
| XM | 1 = C-0 | 12 | C0 |
| XM | 49 = C-4 | 60 | C4 (middle C) |
| IT | 0 = C-0 | 0 | C-1 |
| IT | 60 = C-5 | 60 | C4 (middle C) |
| MOD | period table | varies | depends on period |

Normalize everything to MIDI internally, and choose **one** display convention (scientific pitch, C4 = middle C). The pattern grid can keep the tracker's native note names (usually sharps, `C-4`); the HUD should use key-aware spelling.

**Octave trap:** tracker octave labels are not scientific pitch. XM C-4 and IT C-5 both mean "middle C" in their own conventions, while MOD's C-1/C-2/C-3 are relative to the Amiga period table. Use a fixed per-format offset for display; do not infer the octave from absolute frequency alone. Pitch-class analysis is unaffected, but a piano roll placed by raw frequency will be off by several octaves.

### 1.5 Note spelling

Tracker note names are usually sharp-based (`C-0`, `C#0`). Musicians expect key-aware spelling: in B♭ major, pitch class 10 should read **B♭**, not A♯. Spell at display time; keep pitch classes/MIDI internally.

A robust, simple method: score enharmonic candidates by distance to the key signature on the circle of fifths.

```js
const LETTER_FIFTHS = { F:-1, C:0, G:1, D:2, A:3, E:4, B:5 };
// A sharp adds 7 fifths; a flat subtracts 7.
function fifthsOf(name) {
  const letter = name[0];
  const acc = (name.match(/#/g)||[]).length - (name.match(/b/g)||[]).length;
  return LETTER_FIFTHS[letter] + 7 * acc;
}

function spellPC(pc, keyFifths, preferFlat = false) {
  const candidates = namesForPitchClass(pc); // e.g. ["C","B#","Dbb"]
  return candidates
    .map(n => ({
      n,
      score: Math.abs(fifthsOf(n) - keyFifths)
           + 2 * doubleAccidentalPenalty(n)
           + (preferFlat && n.includes("#") ? 0.5 : 0)
    }))
    .sort((a,b) => a.score - b.score)[0].n;
}
```

Examples:

- C major (0 fifths), pc 10: A♯ (10 fifths) vs B♭ (−2) → B♭.
- E major (4 sharps), pc 10: A♯ (10) vs B♭ (−2); distances 6 and 6 → prefer sharp → A♯.
- F major (−1), pc 10: B♭ (−2) distance 1 → B♭.

For minor keys, `keyFifths` is the **relative major's** signature: A minor = 0, D minor = −1, F♯ minor = 3, B♭ minor = −5. Do not pass the parallel major's signature (A minor is not 3 sharps).

For chord roots, add a function-aware preference:

- Borrowed `bII`, `bIII`, `bV`, `bVI`, `bVII` → flats.
- `#IV`, `#V` → sharps.
- Secondary dominants: spell the root as the dominant of the target (in C: `V/V` = D, `V/ii` = A, `V/vi` = E).
- Minor-key `V` and `vii°` use the raised leading tone; spell it as a sharp, not a flat.

**Pattern grid vs HUD:** keep the tracker's native sharp spelling in the pattern grid (it is the source representation; musicians who read trackers expect it), and use key-aware spelling in the chord/key HUD and piano-roll labels.

### 1.6 Effects that change pitch content

| Effect | What it does | How to handle in analysis |
|---|---|---|
| `0xy` arpeggio | Rapidly cycles base, +x, +y semitones each tick | Add `{base, base+x, base+y}` to the chord candidate with weights `1.0, 0.5, 0.5`; do not emit three chord changes |
| `1xx` / `2xx` porta up/down | Continuous pitch slide | Quantize to nearest semitone for display; mark `glide`; chord analysis uses the current quantized pitch, with lower confidence |
| `3xx` tone porta | Glide to target note | Store `targetMidi`; while gliding, use the current pitch; on arrival, update the voice note |
| `4xy` vibrato | Periodic pitch modulation | Ignore for pitch class; mark `unstable`; display a small wiggle |
| `9xx` sample offset | Changes playback position, not pitch | No pitch effect; may change timbre |
| `E9x` / `Rxy` / `Qxy` retrigger | Re-triggers envelope/volume at intervals | Same pitch; count as onset for rhythm; do not split the note bar unless the envelope reset is visible |
| `EDx` note delay | Delays note by x ticks | Schedule onset at `rowStart + x*tickSeconds` |
| `ECx` note cut | Cuts note after x ticks | Set `endTime = rowStart + x*tickSeconds` |
| `EEx` pattern delay | Repeats row x extra times | Multiply row duration by `(x+1)`; do not retrigger notes |
| `Bxx` / `Dxx` | Position jump / pattern break | Update order/row timeline |
| `E6x` / `SBx` | Pattern loop | Loop rows; timeline must handle it |
| `Fxx` / `Axx` / `Txx` | Tempo/speed changes | Recompute `tickSeconds`, `rowSeconds` |
| `S7x` (IT) | NNA (new note action); duplicate check is an instrument property | Decide whether previous voice continues/cuts/fades |
| `Vxx` / `Gxx` / `Hxx` | Channel/global volume | Weight notes by volume; affects VU, not pitch |

**Arpeggio aliasing:** if you sample the state at 30 Hz, a fast arpeggio may appear as random notes. Compute the pitch-class set over the **last row or last tick window**, not a single instant. Use the base note as the root; add the upper notes as chord tones.

**Sustained samples:** if a sample loops and the envelope sustains, the voice can last indefinitely. For display, cap the bar at e.g. 8 beats and draw an infinity marker or a fading tail; for analysis, keep the pitch class active but decay its weight with age unless it is a bass pedal. Do not draw a 3-minute bar for a looping pad.

**Percussion:** tracker drum samples are often short, non-looping, and noise-like. Do not hard-code channel 9. Classify:

```js
isPercussive(sample) =
  /kick|snare|hat|perc|bd|sd|hh|clap|tom|cym|ride|crash/i.test(sample.name) ||
  (!sample.loop && sample.lengthSeconds < 0.3 && spectralFlatness(sample) > 0.5);
```

Exclude percussive channels from chord/key histograms, but keep them for rhythm, density, and channel activity. If unsure, include with a low role weight and expose a per-channel "harmonic" toggle.

### 1.7 Shadow interpreter pseudocode

```js
function runRow(state, pattern, row, t) {
  const speed = state.speed;
  const tickDur = 2.5 / state.bpm;
  const rowDur = speed * tickDur;

  for (const ch of state.channels) {
    const cell = pattern[row][ch.index];
    if (!cell) continue;

    // 1. Note delay / cut / retrigger scheduling
    if (cell.note === NOTE_OFF) scheduleNoteOff(ch, t);
    else if (cell.note === NOTE_CUT) scheduleCut(ch, t);
    else if (cell.note === NOTE_FADE) scheduleFade(ch, t);
    else if (cell.note != null) {
      const delay = effectNoteDelay(cell); // EDx
      scheduleNoteOn(ch, cell, t + delay * tickDur);
    }

    // 2. Effects that alter ongoing voice
    applyPortamento(ch, cell, t, tickDur);
    applyArpeggio(ch, cell, t, tickDur);
    applyVibrato(ch, cell, t, tickDur);
    applyRetrigger(ch, cell, t, tickDur);

    // 3. Volume / pan / global
    applyVolumeColumn(ch, cell);
    applyChannelVolume(ch, cell);
  }

  // 4. Tick loop: update pitch/volume/envelope per tick
  for (let tick = 1; tick < speed; tick++) {
    for (const ch of state.channels) updateVoicePerTick(ch, t + tick * tickDur);
  }

  // 5. Advance row/order, handling jumps, breaks, loops, pattern delay.
  // Pattern delay is global; read it from the row, not from the last channel.
  const delay = patternDelayForRow(pattern, row);
  state.time += rowDur * (1 + delay);
  advanceOrderRow(state);
}
```

For a produced video, run this over the entire song once, emit `NoteEvent[]`, and analyze offline. For live playback, run it with a lookahead of 1–2 rows and interpolate visuals.

---

## 2. Chord Recognition

### 2.1 Design goals

A chord label must be:

- **Correct**: pitch classes match the sounding harmony, including inversions and extensions.
- **Stable**: no flicker on arpeggios, passing tones, or sustained pads.
- **Explainable**: a musician can see why the label was chosen (root, bass, chord tones).
- **Honest**: show "N.C." or "ambiguous" when the evidence is weak.

Template matching over pitch-class sets is the right level of complexity: it is fast, has no training data, and is easy to debug. Pardo & Birmingham (2002) show that a simple template score plus tie-breaking is competitive; CASSETTE (Odekerken et al. 2020) uses weighted chroma and a 24-chord vocabulary and reaches ~80% WCSR on pop/rock MIDI. For a visualizer, that is more than enough; the goal is musical plausibility, not MIREX victory.

If you only have audio (no pattern data), estimate a chroma vector with a constant-Q transform and feed the same template/HMM pipeline; expect lower accuracy, no exact note lengths, and confusion from drums/partials. The tracker path is strictly better when available.

### 2.2 Salience vector

Build a 12-element weight vector from the currently active voices.

```js
const TAU = 0.6; // seconds; recency decay

function salience(voices, t, mode) { // mode: "chord" | "key"
  const w = new Float32Array(12);
  for (const v of voices) {
    if (!v.active && !v.releasing) continue;
    if (v.role === "drums") continue;

    const age = t - v.start;
    const recency = 0.5 + 0.5 * Math.exp(-age / TAU);
    const release = v.releasing
      ? Math.max(0, 1 - (t - v.releaseStart) / v.releaseTime)
      : 1;
    const vel = clamp(v.velocity, 0, 1);
    const role = roleWeightFor(v, mode); // chord: melody 0.5; key: melody 0.8
    const env = clamp(v.env, 0, 1);

    w[v.pc] += vel * recency * release * role * env;
  }

  // Avoid double-counting octave doublings: compress then normalize.
  for (let i = 0; i < 12; i++) w[i] = Math.sqrt(w[i]);
  normalizeSum(w);
  return w;
}
```

Why `sqrt`? A note doubled in three octaves should not have three times the influence of a single note. `sqrt(sum)` is a cheap compression; alternatively cap each pitch class at `1.5 × max single-note weight`. Temperley (2002) makes the same point for key finding: repeated notes and octave doublings over-weight the original Krumhansl–Schmuckler input; a "flat" presence vector works better.

**Simultaneity is not required.** The recency window (τ ≈ 0.6 s) captures broken chords and slow arpeggios spread across rows; the chord label can stay stable while individual notes enter. This is essential for tracker music, where a "chord" is often an arpeggio or a rolled voicing.

**Role weights** are a soft prior, not a hard classification. Start with:

```text
bass   1.3   (lowest sustained channel, or channel named "bass")
harmony 1.0  (sustained chords/pads)
melody  0.8  (highest active channel, short notes)
drums   0.0  (percussive samples; excluded)
fx      0.5  (short, non-pitched, or sample names like "fx"/"noise")
```

Infer the role from register, sample name, note length, and channel usage over the song. Let the user override per channel ("harmonic" toggle) in nerd mode. A wrong role weight is a soft error; a wrong percussion exclusion is a hard error, so be conservative about excluding.

**Use different weights for chord vs key.** For chord detection, downweight the melody (0.4–0.6) so passing/ornamental notes do not get promoted to chord extensions; for key detection, the melody is useful evidence, so 0.7–0.9 is fine. The same voice can have a different weight in the two analyses. Implement this as `salience(voices, t, mode)` selecting a chord or key weight table, not a single global `roleWeight`.

Bass note:

```js
const bass = minBy(
  voices.filter(v => v.active && v.role !== "drums"),
  v => v.midi
);
```

If the lowest note is a short passing tone, the slash chord may be wrong. Use the lowest **sustained** note (duration > 1/8) for the bass, and keep the absolute lowest as a secondary candidate.

### 2.3 Template vocabulary

Represent each quality as a set of intervals from the root, plus required and optional degrees. The required/optional split is the key to naming omissions correctly.

| Quality | Intervals (semitones) | Required | Optional | Harte shorthand | Common label |
|---|---|---|---|---|---|
| maj | 0,4,7 | 0,4 | 7 | `maj` | C |
| min | 0,3,7 | 0,3 | 7 | `min` | Cm |
| dim | 0,3,6 | 0,3,6 | — | `dim` | Cdim, C° |
| aug | 0,4,8 | 0,4,8 | — | `aug` | Caug, C+ |
| sus2 | 0,2,7 | 0,2,7 | — | `sus2`* | Csus2 |
| sus4 | 0,5,7 | 0,5,7 | — | `sus4` | Csus4 |
| 5 | 0,7 | 0,7 | — | `5`* | C5 |
| 6 | 0,4,7,9 | 0,4,9 | 7 | `maj6` | C6 |
| m6 | 0,3,7,9 | 0,3,9 | 7 | `min6` | Cm6 |
| 7 | 0,4,7,10 | 0,4,10 | 7 | `7` | C7 |
| maj7 | 0,4,7,11 | 0,4,11 | 7 | `maj7` | Cmaj7 |
| m7 | 0,3,7,10 | 0,3,10 | 7 | `min7` | Cm7 |
| dim7 | 0,3,6,9 | 0,3,6,9 | — | `dim7` | Cdim7 |
| hdim7 | 0,3,6,10 | 0,3,6,10 | — | `hdim7` | Cm7♭5 |
| mmaj7 | 0,3,7,11 | 0,3,11 | 7 | `minmaj7` | Cm(maj7) |
| aug7 | 0,4,8,10 | 0,4,8,10 | — | `aug7`* | C7♯5 |
| 7sus4 | 0,5,7,10 | 0,5,10 | 7 | `7sus4`* | C7sus4 |
| add9 | 0,4,7,2 | 0,4,2 | 7 | `(1,3,5,9)` | Cadd9 |
| madd9 | 0,3,7,2 | 0,3,2 | 7 | `(1,b3,5,9)` | Cm(add9) |
| 9 | 0,4,7,10,2 | 0,4,10,2 | 7 | `9` | C9 |
| maj9 | 0,4,7,11,2 | 0,4,11,2 | 7 | `maj9` | Cmaj9 |
| m9 | 0,3,7,10,2 | 0,3,10,2 | 7 | `min9` | Cm9 |
| 11 | 0,4,7,10,2,5 | 0,4,10,2 | 7,5 | `(1,3,5,b7,9,11)` | C11 |
| m11 | 0,3,7,10,2,5 | 0,3,10,2 | 7,5 | `(1,b3,5,b7,9,11)` | Cm11 |
| 13 | 0,4,7,10,2,9 | 0,4,10,2,9 | 7,5 | `13`* | C13 |
| maj13 | 0,4,7,11,2,9 | 0,4,11,2,9 | 7,5 | `maj13`* | Cmaj13 |
| m13 | 0,3,7,10,2,9 | 0,3,10,2,9 | 7,5 | `min13`* | Cm13 |

\* Extensions beyond Harte's original shorthand; encode explicitly with degrees (e.g. `C:(1,2,5)` for sus2, `C:(1,5)` for 5, `C:(1,3,#5,b7)` for aug7), or use the JAMS extended vocabulary (`sus2`, `5`, `aug7`, `11`, `13`).

Practical vocabulary: 24–30 qualities is enough. More templates increase ambiguity and CPU without improving perceived correctness.

**Cost:** 12 roots × 30 qualities × 12 pitch classes ≈ 4,300 operations per analysis frame. At 30 Hz that is ~130k operations/s — negligible. The expensive parts are voice simulation, key HMMs, and rendering, not template matching.

### 2.4 Scoring

Use a Pardo–Birmingham-style score, generalized with weights and required/optional degrees.

For a candidate chord with pitch-class set `T`, required set `R`, root `r`, and salience vector `w` normalized to sum 1:

```text
P = Σ_{p ∈ T} w[p]                    // positive evidence
N = Σ_{p ∉ T} w[p]                    // negative evidence
M = Σ_{p ∈ R} [w[p] < ε]              // missing required degrees (count)
score = P − β·N − λ·M
        + γ·w[r]                       // root salience
        + δ·[bass = r]                 // root position bonus
        + ζ·diatonic(T, key)           // key fit
        − η·|T|                        // complexity penalty
```

Starting parameters for normalized `w`:

```text
β = 0.60   // penalty for notes outside the chord
λ = 0.50   // penalty per missing required degree
γ = 0.35   // root salience bonus
δ = 0.15   // bass-is-root bonus
ζ = 0.05   // diatonic bonus
η = 0.015  // per chord-tone complexity penalty
ε = 0.02   // "present" threshold
```

These are not sacred. Tune on 20–50 modules with hand labels; the ranking of the top 3 matters more than absolute scores.

**Why required vs optional:** a missing fifth is common in jazz/pop voicings and should not kill a `maj7`; a missing third is a much bigger ambiguity. A power chord `{root, fifth}` should be labeled `C5`, not `Cmaj(*3)`. A `C6` without the fifth is still `C6`.

**Dyads are not triads.** For a two-note sonority, prefer `C5` (root+fifth) or `C(no5)` (root+third) and mark it as a dyad unless the context strongly implies the missing tone. Do not display a confident `Cmaj7` from two notes.

**No-chord decision:**

```js
if (activePitchClasses < 2) return NOTE_OR_NC;
if (sum(w) < 0.10) return NC;
if (best.score < 0.05) return NC;
if (best.score - second.score < 0.03 && best.pcs.equals(second.pcs)) {
  // same pitch-class set, different root/name: resolve below
}
```

`N.C.` is a legitimate, musician-respected answer. Silence, drums-only, and single-note lines are not chords.

**Worked example.** Active: C3 (0.9), E4 (0.8), G4 (0.7), B4 (0.6), D5 (0.4). Salience normalized: C 0.9, E 0.8, G 0.7, B 0.6, D 0.4 (sum 3.4 → normalized ~0.26, 0.24, 0.21, 0.18, 0.12).

- `Cmaj9` {0,4,7,11,2}: P ≈ 1.00; N = 0; M = 0; root bonus 0.09; bass bonus 0.15; complexity −0.075 → **≈ 1.17**.
- `Cmaj7` {0,4,7,11}: P ≈ 0.88; N ≈ 0.12 (D); M = 0; root 0.09; bass 0.15; complexity −0.06 → 0.88 − 0.07 + 0.09 + 0.15 − 0.06 ≈ **0.99**.
- `G6` {7,11,2,4}: P ≈ 0.74; N ≈ 0.26 (C); M = 0; root 0.07; bass 0; complexity −0.06 → 0.74 − 0.16 + 0.07 − 0.06 ≈ **0.59**.
- `Am7` {9,0,4,7}: A absent → P ≈ 0.71; N ≈ 0.29 (B,D); M = 1; complexity −0.06 → 0.71 − 0.17 − 0.50 − 0.06 ≈ **−0.02**.

`Cmaj9` wins. If D5 is short/quiet (passing tone), its salience drops and `Cmaj7` can win — which is musically correct.

### 2.5 Ambiguity resolution and naming

Many pitch-class sets have multiple valid names. Use a deterministic ordered rule set, and expose the runner-up in a tooltip.

**Rule order:**

1. **Bass rule.** If the bass is a chord tone and equals a candidate root, prefer that candidate. If the bass is not a chord tone, prefer a slash chord that names the bass (`C/D`), and penalize the non-slash interpretation slightly.
2. **Root salience.** Prefer the candidate whose root has the highest `w[root]` (plus a bass bonus).
3. **Simplicity.** Prefer fewer chord tones and fewer altered/added degrees.
4. **Key fit.** Prefer chords diatonic to the current key; then common borrowed chords (`bVI`, `bVII`, `iv`, `bII`); then chromatic.
5. **Position.** Prefer root position over inversion if the bass is the root; otherwise prefer the inversion that matches the bass.
6. **Prior.** Prefer common qualities in the genre (maj, min, 7, m7, maj7, sus4) over exotic ones.

**Common ambiguous sets:**

| Pitch classes | Competing labels | Rule |
|---|---|---|
| {0,4,7,9} | C6 / Am7 | Bass C → C6; bass A → Am7; if neither, higher root salience; key fit |
| {0,3,7,10} | Cm7 / E♭6 | Bass decides; if bass G, label Cm7/G or E♭6/G depending on root salience |
| {0,3,6,9} | Cdim7 / E♭dim7 / G♭dim7 / Adim7 | Symmetric; choose bass; mark `~` and show "symmetric" |
| {0,4,8} | Caug / Eaug / A♭aug | Symmetric; choose bass; mark `~` |
| {0,2,7} | Csus2 / Gsus4 | Bass decides; if bass C → Csus2; bass G → Gsus4 |
| {0,5,7,10} | C7sus4 / Csus4add♭7 | Root is the bass or the stronger root; usually C7sus4 |
| {0,4,7,2} | Cadd9 / G6sus4? | Cadd9 if C bass; G6sus4 is rare; prefer add9 |
| {0,4,7,10,2} | C9 / C7add9 | Same set; `9` is standard when the 7th is present; `add9` only without 7th |
| {0,4,7,10,5} | C11 / C7add11 | `11` implies 9 and often omits 3; if 3 is present and 9 absent, `C7add11` is clearer |
| {0,3,6,10} | Cm7♭5 / E♭m6 | Bass decides; in jazz, `m7♭5` is preferred when functioning as ii in minor |
| {0,4,7,11,2} | Cmaj9 / Em7(♭6)? | Cmaj9 if C bass/root salience; otherwise consider Em7 |
| {4,7,10,14} (no root) | C9 rootless / Em7♭5 / Gm6 | Use bass/key/context; label `C9(no root)` or the best fit; mark "rootless" |

**Inversion / slash chord detection:**

```text
bassPc = pc(lowest sustained sounding note, excluding drums)
if bassPc == root:
    inversion = "root"
else if bassPc in T:
    inversion = "inversion";  // label C/E or C:maj/3
else:
    inversion = "slash";      // non-chord bass, e.g. C/D; lower confidence
```

For an inversion, the Harte bass degree is the interval from the root to the bass (3, 5, 7, b7, 9, …). For a non-chord bass, label the slash note (`C/D`) and mark it as "slash" rather than pretending it is an inversion. A slash chord with a non-chord bass is often a polychord or a passing bass; show the alternatives in nerd mode.

**Rootless voicings:** jazz/pop often omit the root. If no candidate root is present, use the bass as a proxy; if the bass is also not the root, prefer the interpretation whose root is diatonic to the key or implied by the preceding chord. Label with `(*1)` in Harte, e.g. `C:9(*1)`.

**Symmetric chords:** for dim7 and aug, the root is genuinely ambiguous. Pick the bass note for display and add a `~` marker; in nerd mode, list all equivalent names. Do not pretend there is a unique root.

**Confidence:**

```js
const p = softmax(scores, T=0.08);
const confidence = p[best];
const margin = best.score - second.score;
const stable = confidence > 0.55 && margin > 0.04;
```

Display confidence as a 3-level indicator, not a fake precise percentage:

- `certain`: confidence > 0.75 and margin > 0.10
- `likely`: confidence > 0.55 and margin > 0.04
- `ambiguous`: otherwise

### 2.6 Harte labels

Harte et al. (2005) define a context-independent grammar:

```text
<chord> ::= <note> ":" <shorthand> ["(" <degree-list> ")"] ["/" <degree>]
          | <note> ":" "(" <degree-list> ")" ["/" <degree>]
          | <note> ["/" <degree>]
          | "N"
```

Key points:

- Root note names use `A–G` with `#`/`b`; case-sensitive (`B` vs `b`).
- Degrees are **major/perfect diatonic intervals** 1–13, modified by `b`/`#`; `bb7` is a diminished seventh.
- Shorthand: `maj`, `min`, `dim`, `aug`, `maj7`, `min7`, `7`, `dim7`, `hdim7`, `minmaj7`, `maj6`, `min6`, `9`, `maj9`, `min9`, `sus4`.
- `*` omits a degree: `C:maj7(*5)`.
- Bass is a degree relative to the root: `C:maj/3` (first inversion), `G:7/5` (second inversion), `D:dim7/bb7` (third inversion).
- `N` = no chord; `X` = unknown/out-of-vocabulary (in some corpora).
- A bare root implies major: `C` ≡ `C:maj`.

Examples:

| Sounding | Harte | Common display |
|---|---|---|
| C E G | `C:maj` | C |
| C E♭ G | `C:min` | Cm |
| C E G B♭ | `C:7` | C7 |
| C E G B | `C:maj7` | Cmaj7 |
| C E♭ G♭ B♭ | `C:hdim7` | Cm7♭5 |
| C E♭ G♭ B♭♭ | `C:dim7` | Cdim7 |
| C E G A | `C:maj6` | C6 |
| C E G B♭ D | `C:9` | C9 |
| E G C (first inversion C) | `C:maj/3` | C/E |
| D C E G (C over D bass) | `C:maj/9` or `C/D` | C/D |
| C E G B♭ D F♯ | `C:9(#11)` | C9♯11 |

Use Harte for machine-readable export and for the "nerd" tooltip; use common lead-sheet symbols for the big display. Musicians read `C/E` faster than `C:maj/3`.

**Slash vs extension:** in Harte, `/9` is a **bass degree**, not an added ninth. `C:maj/9` means C major over D, not `Cmaj9`. Use `C/D` in the big display to avoid the ambiguity; reserve `C:maj9` for the ninth chord.

### 2.7 Roman numeral analysis

Given a chord and a key, compute the scale degree and quality.

```js
const MAJOR = [0,2,4,5,7,9,11];
// Harmonic minor for degree mapping: G# in A minor is VII, not #VII.
// The natural seventh (G in A minor) then becomes bVII, which is correct
// for Aeolian/pop/rock usage.
const MINOR = [0,2,3,5,7,8,11];
const ROMAN = ["I","II","III","IV","V","VI","VII"];

function degreeInfo(rootPc, key) {
  const rel = mod12(rootPc - key.tonic);
  const scale = key.mode === "major" ? MAJOR : MINOR;
  const idx = scale.indexOf(rel);
  if (idx >= 0) return { idx, accidental: "" };

  // Chromatic: choose the closest scale degree.
  let best = 0, bestDiff = 99;
  for (let i = 0; i < 7; i++) {
    let d = mod12(rel - scale[i]);
    if (d > 6) d -= 12;
    if (Math.abs(d) < Math.abs(bestDiff)) { best = i; bestDiff = d; }
  }
  return { idx: best, accidental: bestDiff > 0 ? "#".repeat(bestDiff) : "b".repeat(-bestDiff) };
}
```

Quality mapping:

| Quality | Case | Suffix |
|---|---|---|
| maj, 7, maj7, aug | Uppercase | ``, `7`, `maj7`, `+` |
| min, m7, m9, madd9 | Lowercase | ``, `7`, `9`, `add9` |
| dim, dim7 | Lowercase | `°`, `°7` |
| hdim7 | Lowercase | `ø7` |
| sus2/sus4 | Uppercase | `sus2`, `sus4` |
| 7sus4 | Uppercase | `7sus4` |

Inversions:

- Classical figured bass: `I6`, `I64`, `V7`, `V65`, `V43`, `V42`.
- Pop/lead-sheet: `I/3`, `I/5`, `V7/7` (the slash is a bass degree; prefer figured bass `V42` when it could be confused with a secondary dominant).
- Pick one style per mode; don't mix. For a HUD, `V7` plus a small inversion caret is enough.

Secondary dominants:

```js
function secondaryDominant(chord, key) {
  if (!["maj","7","aug7"].includes(chord.quality)) return null;
  const target = mod12(chord.root + 5); // root is V of target
  const targetDegree = degreeInfo(target, key);
  if (targetDegree.accidental !== "") return null; // target must be diatonic
  if (isDiatonicChord(chord, key)) return null;    // e.g. G7 in C is just V7
  return `V${chord.quality === "7" ? "7" : ""}/${ROMAN[targetDegree.idx]}`;
}
```

`isDiatonicChord` compares the chord quality to the diatonic quality on that degree, not just the root. In C major, D7 has a diatonic root (D) but a non-diatonic quality (D minor is diatonic), so it is `V7/V`; G7 has both a diatonic root and quality, so it stays `V7`.

Examples in C major:

- D7 → `V7/V`
- E7 → `V7/vi`
- A7 → `V7/ii`
- B7 → `V7/iii`
- C7 → `V7/IV` (or `I7` if it is a blues tonic; context matters)
- E♭ major → `bIII`
- A♭ major → `bVI`
- B♭ major → `bVII`
- F minor → `iv`
- D♭ major → `bII` (Neapolitan)

A common loop in C major:

```text
Am7 → vi7      Fmaj7 → IVmaj7      Cmaj7 → Imaj7      G7 → V7
```

With inversions, `C/E` becomes `I6` (figured bass) or `I/3` (pop slash); pick one style and keep it consistent.

**Minor keys:** use harmonic-minor degree mapping (`MINOR = [0,2,3,5,7,8,11]`); the natural seventh becomes `bVII`. Label the raised leading-tone chords as `V` and `vii°`. Do not write `v` for a major dominant in minor; that would confuse musicians.

**If key confidence is low:** show `—` or omit Roman numerals. A wrong Roman numeral is worse than no Roman numeral.

### 2.8 Temporal smoothing

Chord labels flicker when passing tones, arpeggios, or delayed notes change the pitch-class set for one frame. Use a combination of segmentation and hysteresis, and optionally an HMM.

**Online (live) approach:**

```js
function updateChord(state, candidate, dt) {
  if (candidate.label === state.chord.label) {
    state.chord.score = ema(state.chord.score, candidate.score, 0.25);
    state.chord.hold = 0;
    return;
  }
  state.chord.hold += dt;
  const margin = candidate.score - state.chord.score;
  if (margin > 0.06 && state.chord.hold > 0.12) {
    state.chord = { ...candidate, hold: 0 };
  }
}
```

**Offline (precomputed) approach:** Viterbi over the whole song.

```text
States: chord labels (or pitch-class sets) per row/beat.
Emission: log P(obs | label) ∝ score(label) / T.
Transition: log P(label_j | label_i) =
  log(0.85) if same label
  log(0.10) if labels share ≥ 2 pitch classes
  log(0.03) if diatonic neighbor in the current key
  log(0.002) otherwise
```

This removes one-frame blips and produces a clean chord chart. For live playback, use the forward algorithm (filtered posterior) rather than Viterbi, which lags.

**Segmentation:** chord changes usually align with rows/beats. Compute a candidate per row; only commit a change when the candidate is stable for at least one row (or 100 ms). This is musically safer than frame-by-frame updates.

### 2.9 Full chord pipeline pseudocode

```js
function analyzeChord(voices, t, key) {
  const w = salience(voices, t, "chord");
  const bass = lowestSustainedMidi(voices);
  const activePcs = countPresent(w, 0.02);

  if (activePcs === 0) return { type: "NC", label: "N.C.", confidence: 1 };
  if (activePcs === 1) return { type: "note", label: noteName(onlyPc(w), key), confidence: 0.9 };

  const candidates = [];
  for (let root = 0; root < 12; root++) {
    for (const q of QUALITIES) {
      const T = q.intervals.map(i => mod12(root + i));
      const R = q.required.map(i => mod12(root + i));
      let P = 0, N = 0, M = 0;
      for (let pc = 0; pc < 12; pc++) {
        if (T.includes(pc)) P += w[pc]; else N += w[pc];
      }
      for (const pc of R) if (w[pc] < 0.02) M++;
      let score = P - 0.60*N - 0.50*M
                + 0.35*w[root]
                + (bass != null && mod12(bass) === root ? 0.15 : 0)
                + (isDiatonic(T, key) ? 0.05 : 0)
                - 0.015*T.length;
      candidates.push({ root, quality: q.name, T, score });
    }
  }

  candidates.sort((a,b) => b.score - a.score);
  const best = candidates[0], second = candidates[1];
  if (best.score < 0.05) return { type: "NC", label: "N.C.", confidence: 1 };

  // Ambiguity resolution
  const bassPc = bass != null ? mod12(bass) : null;
  let chosen = resolveAmbiguity(best, second, w, bass, key);
  const conf = confidence(best.score, second.score);

  return {
    type: "chord",
    root: chosen.root,
    quality: chosen.quality,
    bass: bassPc != null ? bassPc : chosen.root,
    pcs: chosen.T,
    label: commonLabel(chosen.root, chosen.quality, bassPc, key),
    harte: harteLabel(chosen.root, chosen.quality, bassPc, key),
    roman: romanLabel(chosen, key),
    confidence: conf,
    alternatives: candidates.slice(0, 3)
  };
}
```

### 2.10 Failure modes

- **Passing tones** become chord extensions. Fix: duration/recency weighting; require extensions to be sustained or on a strong beat.
- **Sustained pads** dominate a new chord. Fix: cap age weight; favor recent onsets for chord changes while keeping sustained notes for key detection.
- **Arpeggios** alias into random chords. Fix: integrate over ticks; add all arpeggio tones with lower weight; hold the base chord.
- **Drums** pollute the chroma. Fix: classify percussive samples; exclude or downweight.
- **Rootless voicings** get the wrong root. Fix: bass/key context; mark `(*1)`; show alternatives.
- **Symmetric chords** get an arbitrary root. Fix: bass rule + `~` marker; list equivalents.
- **Detuned samples** land between semitones. Fix: keep `cents`; round for pitch class; flag.
- **Fast modulations** outrun the smoother. Fix: shorter window; raise transition probability when the pitch-class set changes abruptly.

---

## 3. Key Detection

### 3.1 Pitch-class histogram

For key detection, use a longer window than chord detection: 4–8 bars for local key, 16–32 bars for global key. Weight by **duration**, not recency, because a sustained tonic pedal is evidence.

```js
function keyHistogram(notes, windowStart, windowEnd) {
  const h = new Float32Array(12);
  for (const n of notes) {
    const overlap = Math.max(0, Math.min(n.t1, windowEnd) - Math.max(n.t0, windowStart));
    if (overlap <= 0) continue;
    const dur = overlap;
    const vel = n.velocity;
    const role = n.roleWeight;
    h[n.pc] += Math.sqrt(dur) * vel * role; // sqrt tames long notes
  }
  normalizeSum(h);
  return h;
}
```

Two refinements:

1. **Flat input per segment.** Temperley (2002) found that a binary presence vector (1 if a pitch class occurs in a 1–2 s segment, 0 otherwise) outperforms total-duration weighting, because repeated notes and octave doublings over-weight. For a rolling histogram, sum binary presence over segments, or use `sqrt(duration)` as a compromise.
2. **Chord-root histogram.** For pop/rock, chord roots are strong key evidence. Combine:

```text
h_key = 0.7 * noteHistogram + 0.3 * chordRootHistogram
```

This helps when the accompaniment is arpeggiated and the melody is sparse.

### 3.2 Key profiles

Krumhansl–Kessler (1982/1990) probe-tone profiles, chromatic order from the tonic:

```text
Major: 6.35 2.23 3.48 2.33 4.38 4.09 2.52 5.19 2.39 3.66 2.29 2.88
Minor: 6.33 2.68 3.52 5.38 2.60 3.53 2.54 4.75 3.98 2.69 3.34 3.17
```

Temperley's revised Kostka–Payne profiles (Temperley 2002), chromatic order from the tonic:

```text
Major: 5.0 2.0 3.5 2.0 4.5 4.0 2.0 4.5 2.0 3.5 1.5 4.0
Minor: 5.0 2.0 3.5 4.5 2.0 4.0 2.0 4.5 3.5 2.0 1.5 4.0
```

The Temperley minor profile assumes harmonic minor (raised 7th = 4.0, ♭7 = 1.5). This is a good default for tracker music, which often uses harmonic minor, Phrygian, and modal flavors.

Albrecht & Shanahan (2013) trained profiles on a large pop/rock corpus and improved minor-mode treatment; worth trying if your module corpus is pop/rock rather than classical/demoscene. For chiptune/demoscene, KK or Temperley usually works well; for dark/Phrygian music, add modal profiles.

### 3.3 Scoring

Pearson correlation between the histogram `h` and each rotated profile `P_k`:

```text
r(k) = Σ_p (h[p] − h̄)(P_k[p] − P̄_k)
       / sqrt( Σ_p (h[p] − h̄)² · Σ_p (P_k[p] − P̄_k)² )
```

where `P_k[p] = P[(p − tonic_k) mod 12]`.

Cosine similarity is an alternative if both vectors are normalized; Pearson is standard and scale-invariant.

```js
function keyCandidates(h, profiles) {
  const out = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ["major", "minor"]) {
      const P = profiles[mode];
      const x = [], y = [];
      for (let pc = 0; pc < 12; pc++) {
        x.push(h[pc]);
        y.push(P[mod12(pc - tonic)]);
      }
      out.push({ tonic, mode, r: pearson(x, y) });
    }
  }
  return out.sort((a,b) => b.r - a.r);
}
```

### 3.4 Window sizes and smoothing

| Purpose | Window | Update | Smoothing |
|---|---|---|---|
| Local key (HUD) | 4–8 bars | every bar | HMM / hysteresis |
| Section key | 8–16 bars | every 2 bars | Viterbi over section |
| Global key | 16–32 bars or whole song | once | Viterbi over song |
| Modulation detection | 2–4 bars | every beat | novelty / change-point |

Use exponential decay for a rolling histogram:

```text
h_t = λ·h_{t−1} + (1−λ)·x_t
λ = exp(−Δt / τ),  τ = 4 bars
```

This gives more weight to recent bars without a hard window boundary. For a produced video, compute the global key offline with Viterbi; for live, use the forward algorithm.

### 3.5 Confidence

Correlation values are not probabilities. Calibrate with a softmax over the 24 keys:

```js
const p = softmax(candidates.map(c => c.r), T = 0.05);
const top = candidates[0];
const confidence = p[0];
const margin = candidates[0].r - candidates[1].r;
```

Display as:

- `confident`: `confidence > 0.6` and `margin > 0.10`
- `likely`: `confidence > 0.4` and `margin > 0.05`
- `ambiguous`: otherwise → show `key: ?` or top-2 candidates

Do not display `C major 87.3%`; the number is not calibrated and musicians will not trust it. A three-dot indicator or a thin bar is enough. In nerd mode, show the top-3 candidates with their correlations.

### 3.6 Smoothing so the key does not flicker

Use a 24-state HMM (12 tonics × 2 modes) with a transition matrix that favors stability and closely related keys:

```text
A[i][j] =
  0.90   if i == j
  0.03   if relative major/minor
  0.02   if parallel major/minor
  0.02   if ±1 fifth
  0.002  otherwise
```

Normalize rows. Emission:

```text
log E[i] = r_i / T
```

Forward (live):

```text
α_t[i] = log E_t[i] + logsumexp_j( α_{t−1}[j] + log A[j][i] )
```

Viterbi (offline):

```text
δ_t[i] = log E_t[i] + max_j( δ_{t−1}[j] + log A[j][i] )
```

Add a **minimum dwell** of 2 bars: a key change is only accepted if the new key wins for two consecutive bars. This is the single most effective anti-flicker measure.

**Relative major/minor disambiguation:** the profiles often confuse C major and A minor. Use:

- Bass pitch-class histogram: if the relative minor tonic has more bass weight, prefer minor.
- Final chord: if the piece/section ends on the relative minor, prefer minor.
- Chord root/quality distribution: Am–F–G loops often imply A minor; C–F–G loops imply C major. Use it as a soft prior, not a hard rule.
- If still ambiguous, display `C major / A minor` in nerd mode; in the big HUD use the label supported by the bass/final chord, or the higher-confidence label if still tied.

**Modal music:** after finding the tonic, compare the histogram to modal profiles (Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian). If a mode fits significantly better, display `D Dorian` rather than `D minor`. Tracker music often uses modal scales; forcing major/minor is a credibility killer.

### 3.7 Display

- **Big HUD:** `C major` or `A minor`, with a 3-level confidence indicator.
- **Nerd HUD:** top-3 candidates, correlation bars, and a 24-key mini-map; highlight the current key; show modulation history as a horizontal strip.
- **Modulation:** when the key changes, flash a small `→ G major` for 2 s, then settle. Do not animate the key label continuously.
- **No key:** if confidence is low (atonal, noise, heavy chromaticism), show `key: —`. This is more honest than a wrong key.
- **Enharmonic spelling:** use the key signature's spelling: `B♭ major`, not `A♯ major`; `F♯ minor`, not `G♭ minor` unless the context is flat.

### 3.8 Failure modes

- **Relative major/minor confusion** → bass/final-chord heuristic; show both if ambiguous.
- **Modal music** → modal profiles; label the mode.
- **Pentatonic/drone music** → low confidence; show `—` or the tonic with "modal".
- **Fast modulation** → shorter window; raise transition probability; show a modulation marker.
- **Repeated notes/octaves** → flat input or `sqrt(duration)`.
- **Detuned/microtonal** → quantize to nearest semitone; flag.
- **Atonal/noise** → low confidence; do not force a key.
- **Covers/transpositions** → key detection still works; spelling follows the detected key.

---

## 4. Visualization Mappings

### 4.1 Principles

1. **Isomorphism beats decoration.** Pitch → vertical position, time → horizontal position, duration → bar length. These mappings are pre-attentive and require no legend.
2. **One primary variable per mark.** A note bar should encode pitch, time, duration, and channel; velocity can be alpha/lightness. Do not also encode chord function in hue.
3. **Color is a secondary channel.** Use hue for channel/voice identity; use saturation/lightness for chord membership, velocity, or consonance. This is consistent with Klemenc et al. (2011), who use hue for harmonic similarity and saturation for consonance/dissonance.
4. **Text for precision, graphics for shape.** Chord names, key names, and Roman numerals need text; contours and rhythm need graphics.
5. **Motion for events, not for continuous data.** Onsets, chord changes, and beat pulses can move; pitch/time should be stable.
6. **Consistency.** The same channel color, note spelling, and layout across the whole song. Musicians notice when a color or spelling changes.
7. **Progressive disclosure.** Show the minimum that explains the music; hide the rest behind a toggle.

The survey by Khulusi et al. (2020) confirms that the piano roll is a dominant visualization family for note data: pitch → y, time → x, length → duration, color → additional information. The Music Animation Machine and Synthesia are the strongest precedents for legibility.

### 4.2 Piano roll

**Mapping:**

```text
x = playheadX + (note.t0 - now) * pxPerSecond
w = note.duration * pxPerSecond
y = top + (maxPitch - note.midi) * rowHeight
h = rowHeight * 0.8
```

**Recommended details:**

- **Horizontal layout** for 16:9: time flows left→right, pitch bottom→top. It uses the screen width and matches the tracker's row-based time.
- **Linear semitone axis, not log frequency.** Equal vertical spacing per semitone preserves interval shapes; a log-frequency axis distorts chords.
- **Vertical range is the hard constraint.** A 190 px strip at 1080p shows only ~2 octaves at 10 px/semitone. Either show a 3–4 octave window centered on the active register (with octave labels and smooth vertical scrolling), or use two tiers: a compressed overview (2–3 px/semitone) plus a zoomed inset for the active register. Do not try to show all 88 keys in a 190 px strip.
- **Fixed playhead at 60–70% width**; notes scroll right→left. Upcoming notes appear on the right as low-alpha "ghosts" from the pattern data.
- **Note bars** with rounded ends; alpha = velocity; a thin outline for sustained/looping notes; a glow on onset.
- **Octave lines** at C; label `C2`, `C3`, `C4` on the left edge. Semitone grid lines are too dense; use them only at high zoom.
- **Beat/bar grid** behind the notes: thin lines at beats, brighter at bars.
- **Chord bracket:** at the playhead, draw a translucent vertical band spanning the active notes, with the chord label above. Alternatively, tint the background by chord quality for the chord's duration.
- **Sustained notes:** cap the bar at 8 beats and draw a small `∞` or a fading tail; do not draw a 3-minute bar.
- **Arpeggios:** draw a single bar with a `~` glyph and a subtle zigzag; do not draw three separate long bars.
- **Portamento:** draw a sloped line between the start and target pitch; do not draw a discrete bar for each intermediate semitone.
- **Vibrato:** draw a slight sine wiggle around the bar; do not change the pitch class.
- **Retrigger:** draw a small tick/glow at each retrigger point; keep the bar continuous unless the envelope reset is visually significant.
- **Channel color:** see below.

**Why it is the most legible mapping:** it preserves the two primary dimensions of music (pitch and time) without arbitrary transformation. The eye can read melody contour, intervallic distance, chord stacking, polyphony, and rhythm from the same marks. It is also the native visualization of DAWs, piano tutorials, and the Music Animation Machine, so musicians already have the schema. Color adds voice identity without competing with pitch/time.

**Falling-notes variant:** for a Synthesia-like mode, swap axes: time flows downward, pitch horizontal. This is intuitive for piano keys but uses the 16:9 screen less efficiently (tall/narrow). Use it as an optional "piano mode", not the default HUD.

### 4.3 Channel color

- **Assign a fixed hue per channel** for the whole song; never recolor by pattern or by chord.
- Use a **color-blind-safe palette** (Okabe–Ito): `#E69F00`, `#56B4E9`, `#009E73`, `#F0E442`, `#0072B2`, `#D55E00`, `#CC79A7`, `#000000`. On a dark background, lighten the black to `#555555`.
- **Limit to 8–10 distinct hues.** The eye tracks ~7±2 categories. For 16+ channel modules, group by role (bass, drums, harmony, melody, FX) and use hue within the group, or add a channel legend/filter.
- **Use saturation for chord membership:** chord tones at full saturation, non-chord tones at 60–70% saturation. This adds harmonic information without adding a new hue. Klemenc et al. use saturation for consonance/dissonance; the same logic applies.
- **Use lightness for velocity:** louder notes brighter, softer notes dimmer. Do not use hue for velocity.
- **Legend:** show channel numbers and instrument/sample names in nerd mode; show a compact color strip in musician mode.
- **Drums:** use a neutral gray or a distinct low-saturation color; do not let drum channels dominate the palette.

### 4.4 Pitch-class clock / harmonic constellation

**Layout:** 12 nodes around a circle. Two orderings:

- **Circle of fifths:** C, G, D, A, E, B, F♯, C♯, G♯, D♯, A♯, F. Adjacent nodes are fifths; major/minor triads form recognizable triangles; harmonic function is spatially coherent.
- **Chromatic circle:** C, C♯, D, … Adjacent nodes are semitones; chords form clusters; dissonance is visible as adjacency.

**Rendering:**

- Active pitch classes: filled nodes; inactive: dim outlines.
- Chord polygon: connect active nodes in circle order; fill with 10–20% opacity; root node larger; bass node with a ring.
- For a major triad, the polygon is a wide triangle; for minor, a different triangle; for dim7, a square; for aug, a large triangle. The shape is a pre-attentive chord-quality cue.
- **Constellation mode:** leave fading trails of recent pitch classes; connect successive chords with thin arcs. This is spectacle-friendly but less precise; use it as a background layer, not the primary readout.
- **Labels:** note names around the circle; chord name in the center; key at the top. In nerd mode, add scale-degree numbers.

**Why it works:** it spatializes harmony. Musicians who know the circle of fifths can see a ii–V–I as a path around the circle; non-musicians see a shape change. It is also visually elegant, which helps the spectacle.

**Caution:** the circle of fifths is not intuitive to everyone; do not make it the only chord display. Pair it with text.

### 4.5 Chord degree wheel

A 12-sector wheel labeled with Roman numerals for the current key (schematic; diatonic degrees highlighted, chromatic degrees dimmed):

```text
        I
   bVII   ii
 bVI        iii
   V   IV  #IV
```

- Highlight the active degree; draw an arc from the previous degree to the current.
- Color by quality: major warm, minor cool, diminished desaturated, augmented bright.
- Center: chord name + inversion; top: key.
- History: a thin ring of past degrees, or a horizontal "progression ribbon" below the wheel.

**Use:** nerd mode / musician mode. It teaches functional harmony and makes progressions legible at a glance. Casual viewers will not parse Roman numerals; keep it behind the toggle.

### 4.6 Chroma / spectral bars

- **12 chroma bars**, one per pitch class, height = salience; label C, C♯, D, …
- Color by channel or chord membership; add a thin line for the bass pitch class.
- This is the easiest "what notes are playing" display for non-musicians: a triad lights up three bars.
- **FFT/spectrum bars:** use 32–64 log-spaced bands as a background texture; do not label them as musical information. A linear FFT with 1024 bins is spectacle, not analysis.
- **Spectrogram:** optional background; log frequency; low opacity. Pretty, but not a substitute for the piano roll.

### 4.7 Envelope / volume

- **Per-channel VU bars**, colored by channel, with peak and RMS. Use the tracker's volume column/envelope when available; use audio RMS for the master.
- **Master waveform** behind the HUD: low opacity, no labels.
- **Note envelope:** draw a thin curve above the piano roll for the lead/pad channel; shows attack/sustain/release and makes the note bars feel alive.
- **Why:** dynamics and arrangement are musical information; VU meters are familiar and readable. But do not make 16 VU meters the centerpiece; they are secondary.

### 4.8 Pattern grid

- Rows × channels; each cell shows note, instrument, volume, effect; current row highlighted; auto-scroll.
- **Song map** above the grid: order list with pattern numbers; repeated patterns colored; current order highlighted.
- **Font:** monospace, 11–13px at 1080p; 16 visible rows is readable, 32 is too small.
- **Color:** notes by channel; effects in a muted color; current row bright.
- **Use:** nerd mode. This is the tracker musician's native view; it builds credibility. Casual viewers see rhythm/structure but not harmony; that is fine because the piano roll and chord label carry the harmony.

### 4.9 Beat / bar indicator

- Four dots for beats; current beat pulses; bar counter `003:2` (order:row) or `bar 7 · beat 3`.
- A thin progress bar for the pattern/order.
- Use `rowsPerBeat`/`rowsPerMeasure` from libopenmpt or `24/speed`; do not assume 4/4. For odd meters, show the actual beats per bar.
- **Pulse:** scale/opacity, not a hard flash; respect `prefers-reduced-motion`.
- **Downbeat:** brighter/larger pulse; helps dancers and musicians lock in.
- **Optional rhythm matrix:** 16 steps × active channels, cells light on onset. This is a step-sequencer view of the groove; it makes syncopation and kick/snare patterns pre-attentive. Keep it small and in nerd mode; the piano roll already carries the full rhythm.

### 4.10 Waveform

- **Oscilloscope:** 20–50 ms window, zero-crossing trigger; draw as a thin line.
- **Spectrum:** log frequency, smoothed; use as a background.
- **Use:** spectacle. It conveys amplitude/timbre, not notes/chords/key. Do not make it the primary visualization if the goal is musical information.

### 4.11 Ranking: legibility vs spectacle

| Mapping | Pitch | Time | Harmony | Rhythm | Legibility | Spectacle | Musician respect |
|---|---|---|---|---|---|---|---|
| Piano roll | ●●● | ●●● | ●● | ●● | High | Medium | High |
| Channel color | — | — | ● | — | High (voice tracking) | Medium | High |
| Chord/key text | — | — | ●●● | — | High (trained) | Low | High |
| Pitch-class clock | ●● | — | ●●● | — | Medium | High | High |
| Chord degree wheel | ● | ● | ●●● | — | Medium (trained) | Medium | High |
| Chroma bars | ●● | — | ●● | — | High | Medium | Medium |
| Pattern grid | ●● | ●●● | ● | ●●● | High (tracker) / Low (casual) | Medium | Very high |
| Song map | — | ●● | — | ●● | High | Medium | High |
| Beat/bar | — | ●●● | — | ●●● | High | High | High |
| Envelope/VU | — | ● | — | ●● | Medium | Medium | Medium |
| FFT bars | — | — | — | — | Low | High | Low |
| Waveform | — | ● | — | — | Low | High | Low |
| Particles | — | ● | — | ● | Low | Very high | Low |

**Recommended stack:**

- **Level 0 (clean):** no text; chord/key via color/geometry; beat pulse.
- **Level 1 (musician):** piano roll + channel color + beat/bar + chord/key text.
- **Level 2 (nerd):** add chroma bars, pitch-class clock, pattern grid, chord degree wheel, metrics, confidence, Roman numerals.
- **Spectacle layer:** waveform/FFT/particles behind, driven by the same events.

### 4.12 Structure / song map

Tracker modules expose structure explicitly: the **order list** is a sequence of pattern IDs. Use it; do not over-engineer structure detection.

- Group orders by pattern index; label repeated patterns `A`, `B`, `C`, …; color the song map by section.
- Per order, compute a small feature vector: note density, mean polyphony, bass pitch-class histogram, chroma, key, channel activity.
- Similarity between orders = cosine similarity of the feature vectors (or Jaccard of active channels). Repeated patterns have high similarity; contrasting sections have low similarity.
- Detect boundaries at pattern changes, density jumps, key changes, and large changes in channel activity.
- Display a horizontal strip of blocks: width proportional to order duration, color = section, current block highlighted; optional key/modulation markers above.

This gives the viewer a sense of **where they are in the song** without a waveform overview. It also drives scene transitions (new section → new palette/camera), which makes the spectacle feel composed.

**Rhythm matrix (optional):** a 16-step × channel grid with onset cells lit; useful for drum-heavy modules and for showing syncopation. Keep it in nerd mode; it is redundant with the piano roll for pitched material.

---

## 5. Metrics

Metrics are only meaningful if they are defined, stable, and actionable. Show a metric when it explains something a viewer can hear; hide it when it is just a number.

### 5.1 Note density

```text
density = onsets / seconds        (rolling 4 bars)
densityPerBeat = onsets / beats
```

- Count note-ons and retriggers; do not count sustained notes.
- Show total and per-channel; a sparkline is more readable than a number.
- Meaningful: busyness, build-ups, drops, arrangement density.
- Not meaningful as a single "energy" score; density is not loudness.

### 5.2 Polyphony

```text
polyphony(t) = count of active voices at t
meanPolyphony = time-average
maxPolyphony = peak
```

- Include releasing voices with a weight <1; exclude virtual/NNA background voices or count them separately.
- Show current + a small histogram over the last 8 bars.
- Meaningful: texture, chord size, arrangement thickness.
- Caution: a single pad with a long release can inflate polyphony; use a threshold.

### 5.3 Register spread

```text
spread = p95(pitch) − p5(pitch)
centroid = Σ pitch·weight / Σ weight
```

- Use percentiles, not max/min, to avoid one outlier.
- Show as a vertical band on the piano roll; numeric in nerd mode.
- Meaningful: "width" of the arrangement, bass/treble balance.
- Pair with centroid: spread alone does not tell you if the music is low or high.

### 5.4 Dissonance / roughness

Use a sensory roughness model (Plomp–Levelt / Sethares), not a vague "tension" score.

For two partials at frequencies `f1`, `f2` with amplitudes `a1`, `a2`:

```text
fmin = min(f1, f2)
Δf   = |f1 − f2|
s    = 0.24 / (0.0207·fmin + 18.96)
x    = s·Δf
r    = a1·a2·(e^(−3.5x) − e^(−5.75x))
```

Sum over all partial pairs of all notes. Use 6–8 harmonics per note with amplitude `1/h`. Normalize by the sum of pair amplitudes or by the number of pairs.

```js
function roughnessPair(f1, f2, a1, a2) {
  const fmin = Math.min(f1, f2);
  const df = Math.abs(f1 - f2);
  const s = 0.24 / (0.0207 * fmin + 18.96);
  const x = s * df;
  return a1 * a2 * (Math.exp(-3.5 * x) - Math.exp(-5.75 * x));
}
```

For a fast HUD, precompute a 12×12 interval roughness table at a reference register (e.g., C4) and use:

```text
roughness = Σ_{i<j} w_i·w_j·R[(pc_j − pc_i) mod 12]
```

This is O(144) and stable. It is an approximation: it ignores voicing/register, but it is good enough for a meter. Label it "roughness (sensory)" not "emotion".

**Interpretation:** high roughness = close partials beating; it correlates with dissonance/tension but not with musical quality. A distorted guitar power chord can be rough and musically consonant; a smooth minor 9th can be low-roughness and tense. Show it as one lens, not a verdict.

### 5.5 Groove / velocity

Tracker music has no MIDI velocity, but it has volume columns, envelopes, and precise onsets. Define measurable quantities:

```text
gridDeviation = mean( min(|onset − nearestGrid|, grid/2) / (grid/2) )
swing         = mean( (onset mod beat) / beat ) for offbeat 8ths
accent        = std(volume) / mean(volume)
```

- `gridDeviation`: 0 = perfectly on-grid, 1 = maximally between grid points. It is a cheap proxy for "off-grid" timing, **not** the same as syncopation in the Longuet-Higgins & Lee (1984) sense.
- For a real syncopation score, compare onset salience against a metrical expectation template (strong beats vs weak beats) and measure how much weight falls on weak positions. That is more work and style-dependent; grid deviation is enough for a HUD.
- `swing`: 0.5 = straight, ~0.66 = triplet swing. Only meaningful if the style uses swing.
- `accent`: volume variance; high accent = dynamic playing.
- Show three small bars, labeled "grid deviation", "swing", "accent" — or "syncopation" if you implement the metrical model. Avoid a single "groove score"; "groove" is a family of timing/articulation phenomena, not one number.

### 5.6 Channel activity

```text
activity[ch] = onsets in last 4 bars (or RMS)
```

- Show as a small heatmap or 16 thin bars, colored by channel.
- Meaningful: arrangement, which voices enter/leave, drops.
- Pair with the piano roll: the eye can see the same information spatially.
- Do not show 32 identical VU meters; group by role or show only active channels.

### 5.7 Harmonic rhythm and tension

```text
harmonicRhythm = chordChanges / bars
chromaticRatio = |pitchClasses outside key| / |pitchClasses|
nonChordRatio  = weight of non-chord tones / total weight
```

- `harmonicRhythm`: meaningful; shows how fast the harmony moves.
- `chromaticRatio`: meaningful as "chromaticism"; not the same as dissonance.
- `nonChordRatio`: meaningful for melody vs harmony; requires a chord label.
- A composite "tension" score is tempting but easy to fake. If you show one, publish the weights:

```text
tension = 0.4·roughness + 0.3·chromaticRatio + 0.2·nonChordRatio + 0.1·dominantness
```

Label it "tension (heuristic)" and keep it in nerd mode.

### 5.8 Meaningful vs gimmicky

| Metric | Verdict | Why |
|---|---|---|
| Note density | Meaningful | Directly audible; explains busyness |
| Polyphony | Meaningful | Texture/chord size; visible in piano roll |
| Register spread | Meaningful | Arrangement width; pairs with centroid |
| Roughness | Meaningful (with caveat) | Perceptually motivated; not "emotion" |
| Syncopation / grid deviation | Meaningful | Measurable; explains groove; use the metrical model for true syncopation |
| Accent/velocity variance | Meaningful | Dynamics; tracker volume is exact |
| Channel activity | Meaningful | Arrangement; entry/exit |
| Harmonic rhythm | Meaningful | Harmony speed; chords per bar |
| Chromaticism | Meaningful | Key-distance; not dissonance |
| "Energy" | Gimmicky unless defined as RMS/loudness | People mean different things |
| "Emotion"/"mood" | Gimmicky | No stable mapping; culturally dependent |
| "Complexity" | Gimmicky unless defined as entropy/note count | Too vague |
| "Danceability" | Gimmicky from symbolic data | Requires tempo/beat/rhythm model; genre-dependent |
| 3D FFT | Spectacle | Pretty, not musical information |
| "AI vibe" | Gimmicky | Unfalsifiable |

---

## 6. HUD Design: Nerd Mode Without Overwhelming

### 6.1 Three disclosure levels

| Level | Name | Shows | Default for |
|---|---|---|---|
| 0 | Clean | No text; chord/key encoded in color/geometry; beat pulse | Chaos-first demo, casual stream |
| 1 | Musician | Chord + key + beat/bar + piano roll; optional chroma bars (off by default) | Music visualizer default |
| 2 | Nerd | Adds chroma bars, pattern grid, pitch-class clock, degree wheel, metrics, Roman numerals, confidence, channel legend | Musicians, analysis, tutorials |

**Rule:** Level 1 should be understandable in 3 seconds by a non-musician; Level 2 should reward a musician who looks closer. Do not make Level 2 the default; it reads as a dashboard, not a visualizer.

### 6.2 Layout for 16:9 with chaos visuals

Use a **bottom letterbox** or **edge-safe panels**. The cleanest approach: reserve the bottom 18–22% for the HUD, and render the chaos scene in the remaining 78–82% with a camera offset. This prevents the HUD from covering the art and gives the piano roll a stable home.

```text
┌────────────────────────────────────────────────────────────────────┐
│ KEY  G major · ●●○                         CHORD  Am7  (ii7)      │
│                                                                    │
│                      [ chaos visuals / scene ]                     │
│                                                                    │
│                                          ┌──────────────┐          │
│                                          │ pitch-class  │          │
│                                          │    clock     │          │
│                                          └──────────────┘          │
├────────────────────────────────────────────────────────────────────┤
│  piano roll  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
│  beat ruler  1    2    3    4   |   1    2    3    4               │
└────────────────────────────────────────────────────────────────────┘
```

At 1920×1080:

- Margins: 48 px.
- Top band: 120 px (key left, chord center, metrics right).
- Bottom band: 230–300 px (beat ruler 40 px + piano roll 190–260 px); at 6–8 px/semitone this shows 3–4 octaves. Use a taller band if the music is wide-range.
- Right clock: 280×280 px at x=1600, y=400 (Level 2 only).
- Pattern grid: 480×300 px at x=48, y=520 (Level 2 only; collapsible).
- Center: clear for the scene; no HUD.

**Full-bleed alternative:** if the scene must fill the frame, use a gradient scrim at the bottom (black 0.75 → transparent) and keep the piano roll in the lower 20%. Keep the center 60% free. Do not put text in the middle of a busy particle field without a scrim.

### 6.3 Typography and color

- **Chord:** 64–80 px, semibold, tight tracking; the single largest text element.
- **Key:** 28–32 px, uppercase, wide tracking; secondary.
- **Roman numeral:** 36–44 px, italic serif (contrast with the sans chord); this signals "analysis" vs "now playing".
- **Metrics:** 14–16 px, tabular numerals; labels 10–11 px uppercase.
- **Pattern grid:** 11–13 px monospace.
- **Accidentals:** use `♭`/`♯` if the font supports them, otherwise `b`/`#`; never mix. Avoid `Δ`/`−` for major/minor unless the genre expects it.
- **Text color:** warm white `#F5F2EA`; secondary `#A8A29A`.
- **Scrim:** `rgba(8,10,14,0.72)` with `backdrop-filter: blur(12px)`.
- **Accent:** use one accent per chord quality, and only for a thin underline/glow, not body text:
  - major `#F2B544` (amber)
  - minor `#6FA8DC` (blue)
  - diminished `#B58BD6` (violet)
  - augmented `#5FD3C4` (teal)
  - suspended `#E8D06A` (yellow)
  - no chord `#8A8A8A` (gray)
- **Contrast:** ≥ 4.5:1 for body text, ≥ 3:1 for large text. Do not put white text directly on a bright visual; use a scrim or a dark plate.
- **Color-blind:** do not use red/green to encode chord quality; use hue + text + shape. Test with deuteranopia/protanopia simulation.

### 6.4 Anti-flicker rules

- **Chord label:** hold for at least 250 ms; crossfade 150–200 ms; only switch when the new label wins by a margin and is stable for 2 frames.
- **Key label:** hold for at least 2 bars; require 2 consecutive wins; fade 300–400 ms.
- **Metrics:** update at 5–10 Hz, not 60 Hz; smooth with EMA; use sparklines instead of rapidly changing digits.
- **Beat pulse:** scale/opacity, not a hard flash; no strobing above 3 Hz.
- **Color:** no rapid hue shifts; crossfade palettes over 400–800 ms.
- **Text layout:** reserve space for the longest chord name; do not reflow the layout on every chord change.

### 6.5 Toggle and persistence

- `H` cycles Level 0 → 1 → 2 → 0.
- `Shift+H` hides/shows all HUD.
- `?` opens a help overlay with the key bindings.
- A small button in the bottom-right: `HUD ◐` with three states; `pointer-events: auto` only on the button, not the whole HUD.
- URL params: `?hud=0|1|2`, `?panels=piano,clock,grid,metrics`.
- `localStorage`: persist level and panel choices; `?reset` clears.
- **First-run hint:** show "Press H for the nerd HUD" for 4 s, then fade. Do not show it every session.
- **Auto:** if `prefers-reduced-motion`, default to Level 1; if viewport width < 900 px, default to Level 0 or 1; `?hud` overrides.

### 6.6 Spectacle integration

The HUD and the scene should be two views of the same data, not two unrelated layers.

- **Note onset** → particle burst at the note's pitch height; color = channel.
- **Chord change** → palette shift / shockwave / geometry morph; duration = chord duration.
- **Key change** → slower scene transition; background hue; star color.
- **Bass note** → low-frequency glow / camera push; not a generic "bass reactor".
- **Beat** → pulse ring / grid warp; downbeat stronger.
- **Arpeggio** → trail/zigzag; polyphony → particle density.
- **Pattern/order change** → camera cut or scene change; repeated pattern → return to a variant.
- **Section boundary** → title card / color grade shift.

This makes the visuals feel **composed** rather than randomly reactive. The HUD is the "readable layer"; the scene is the "felt layer". Both are driven by the same `NoteEvent`/`ChordState`/`KeyState`.

### 6.7 Accessibility

- Respect `prefers-reduced-motion`: disable camera shake, reduce particle counts, use fades instead of pulses.
- Provide a high-contrast HUD mode.
- Use color-blind-safe palettes; never rely on hue alone.
- Provide a scalable UI (rem-based) and 720p/1080p/4K layouts.
- Provide a textual "now playing" line (key, chord, section) for stream capture and accessibility; the HUD already does this, so make it readable at a glance.
- Avoid rapid flashing; follow the WCAG 2.3.1 three-flashes rule.

### 6.8 Credibility checklist (what musicians notice)

- **Enharmonic spelling is correct for the key.** B♭ in F major, A♯ in B major; not a single sharp-only spelling everywhere.
- **Chord symbols are standard lead-sheet**, not `Cmajor` or `Cmin7`. Use `Cmaj7`, `Cm7`, `C7`, `Cm7♭5`, `C6`, `C9`, `Csus4`.
- **Inversions and slash chords are labeled** when the bass is not the root. `C/E`, `C:maj/3`, `C/D`.
- **`N.C.` is used when there is no chord.** Silence, drums-only, and single-note lines are not chords.
- **Passing tones are not promoted to chord extensions.** A one-row D over C major is not `Cmaj9` unless it is sustained or accented.
- **Sustained pads do not produce 3-minute note bars.** Cap and mark sustained notes; distinguish release from cut.
- **The pattern grid uses tracker-native spelling and semantics.** Do not "fix" `C#4` to `D♭4` in the grid; fix it in the HUD.
- **The beat/bar grid follows the tracker's rows per beat/measure**, including odd meters; do not force 4/4.
- **Confidence is shown honestly.** `key: ?` and "ambiguous" are acceptable; a wrong confident label is not.
- **No fake metrics.** No "emotion 87%", no "AI vibe", no "danceability" from symbolic data without a defined model.
- **Audio and visuals are in sync.** Target < 50 ms; a late chord label destroys trust faster than a missing label.
- **The colors are stable and legible.** Same channel color throughout; color-blind-safe; no rainbow pitch.

### 6.9 Level 1 readability

Level 1 should be readable in 3 seconds: the piano roll and beat/bar are intuitive even without training; the chord/key text is a bonus for musicians. If a non-musician cannot tell "the music is going up/down" and "the beat is here" within 3 seconds, the layout is too busy.

---

## 7. Prior Art

### 7.1 Tracker visualizers and players

| Project | What it is | What to borrow | URL |
|---|---|---|---|
| OpenMPT / libopenmpt | Open-source tracker and playback library | Pattern/order semantics, rows per beat/measure, channel VU, effect reference | https://github.com/openmpt/openmpt · https://lib.openmpt.org/libopenmpt/ |
| Furnace | Modern chip tracker | Per-channel oscilloscope, chip names, pattern view | https://github.com/tildearrow/furnace |
| BassoonTracker | Browser MOD/XM tracker in plain JS | JS player state, pattern editor UI | https://github.com/steffest/bassoontracker |
| js-mod-player | MOD player using Web Audio AudioWorklet | Timing/scheduling, channel state | https://github.com/atornblad/js-mod-player |
| chiptune3 | libopenmpt compiled to WASM | Audio engine + transport in the browser | https://github.com/DrSnuggles/chiptune |
| chiptune2.js | Older libopenmpt JS port | Simple integration | https://github.com/deskjet/chiptune2.js |
| MilkyTracker | Open-source tracker | Pattern editor UX, sample view | https://github.com/milkytracker/MilkyTracker |
| Schism Tracker | Open-source IT-compatible tracker | IT semantics, playback accuracy | https://github.com/schismtracker/schismtracker |

**Lesson:** tracker musicians care about rows, channels, effects, and exact timing. A pattern grid with a correct playhead buys credibility; a fake DAW piano roll does not.

### 7.2 Falling-notes / piano-roll visualizers

| Project | What it is | What to borrow | URL |
|---|---|---|---|
| Synthesia | Commercial falling-notes piano tutor | Note bars, keyboard mapping, practice mode | https://synthesiagame.com/ |
| Music Animation Machine | Malinowski's animated graphical scores | Piano roll + color by voice/pitch class; long-form musical legibility | http://www.musanim.com/ |
| Piano Booster | Open-source piano tutor | Score following, note highlighting | https://github.com/pianobooster/PianoBooster |
| Neothesia | Rust MIDI visualizer | Falling notes, rendering performance | https://github.com/PolyMeilex/Neothesia |
| MIDIano | Browser MIDI player/visualizer | JS architecture, falling bars | https://github.com/Bewelge/MIDIano |
| notefall | Browser piano visualizer with live play | Live input, recording, canvas rendering | https://github.com/ekkx/notefall |
| notwaldorf/midi-visualizer | Web component for MIDI visualization | Simple embeddable API | https://github.com/notwaldorf/midi-visualizer |
| WaveRoll | JS library for comparative MIDI piano rolls (ISMIR 2025) | Multi-track alignment, synchronized playback, color | https://arxiv.org/abs/2511.09562 |

**Lesson:** the piano roll is the most legible mapping for pitch/time; falling notes are intuitive but use screen space inefficiently. Add chord/key labels to either to go beyond "note karaoke".

### 7.3 Chord/key detection and theory tools

| Project | What it is | What to borrow | URL |
|---|---|---|---|
| Chordino (NNLS Chroma) | Vamp plugin for chord estimation | Chroma + HMM smoothing; no-chord handling | https://github.com/c4dm/nnls-chroma · https://www.vamp-plugins.org/ |
| Adam Stark Chord Detector | Real-time chroma + template chord recognition | Efficient templates, real-time pipeline | https://github.com/adamstark/Chord-Detector-and-Chromagram |
| akkorder | TypeScript port of Stark's algorithm | Browser-friendly chord detection | https://github.com/stackswithans/akkorder |
| Chordify | Consumer chord app | Chord blocks synced to audio; simple timeline | https://chordify.net |
| Hooktheory / Hookpad | Theory-aware songwriting tool | Roman numerals, chord leads, degree wheel | https://www.hooktheory.com |
| Sonic Visualiser | Research audio visualization | Layered panes, chord/chroma layers, confidence | https://www.sonicvisualiser.org/ |
| Tonal.js | JS music theory library | Chord dictionary, key/scale spelling, note spelling | https://github.com/tonaljs/tonal |
| music21 | Python musicology toolkit | Roman numeral analysis, key/scale spelling | https://github.com/cuthbertLab/music21 |
| Essentia.js | JS/WASM MIR library | Audio key/chord/beat features for the spectacle layer | https://mtg.github.io/essentia.js/ |
| meyda | JS audio feature extraction | RMS, spectral centroid, spectral features for reactive visuals | https://meyda.js.org |

**Lesson:** chord detection research converges on chroma/template matching + temporal smoothing. For symbolic tracker data, skip the chroma estimation and use exact pitch classes; keep the HMM smoothing and no-chord logic.

### 7.4 Demoscene music disks

| Project | What it is | What to borrow | URL |
|---|---|---|---|
| fr-08: .the .product | Farbrausch 64k intro (2000) | Music-driven scene changes, palette discipline, tight sync | http://www.theproduct.de/ · https://www.pouet.net/prod.php?which=1221 |
| .kkrieger | Farbrausch 96k FPS | Procedural content + audio integration; not a visualizer, but a sync reference | https://en.wikipedia.org/wiki/.kkrieger |
| fr_public | Farbrausch demo tools source | Synth/visual sync architecture | https://github.com/farbrausch/fr_public |
| Pouet musicdisks | Demoscene musicdisk archive | Full-screen aesthetic, lyrics/spectrum, scene transitions | https://www.pouet.net/ |
| Andromeda Software Development | Demogroup known for choreographed visuals | Camera/choreography synced to music | https://www.pouet.net/ |

**Lesson:** demoscene visuals are tightly synchronized and palette-disciplined; they feel composed, not random. They rarely show semantic harmony. Borrow the timing and composition, add the symbolic layer.

### 7.5 Winamp / MilkDrop lineage

| Project | What it is | What to borrow | URL |
|---|---|---|---|
| Winamp AVS | Advanced Visualization Studio | Preset system, beat detection, audio-reactive parameters | https://en.wikipedia.org/wiki/Advanced_Visualization_Studio |
| MilkDrop | Geiss's Winamp visualizer (2001) | Per-pixel feedback, motion, preset ecosystem | https://en.wikipedia.org/wiki/MilkDrop |
| projectM | Open-source MilkDrop reimplementation | GLSL/WebGL architecture, preset compatibility | https://github.com/projectM-visualizer/projectm |
| Butterchurn | WebGL MilkDrop for the browser | Browser integration, preset rendering | https://github.com/jberg/butterchurn |
| MilkDrop3 | Modern MilkDrop with any audio source | Preset management, audio routing | https://github.com/milkdrop2077/MilkDrop3 |

**Lesson:** spectacle is a solved problem; semantics is not. MilkDrop can make anything look amazing, but it cannot tell you the chord. Combine the two layers.

### 7.6 Research

| Work | Why it matters | URL |
|---|---|---|
| Khulusi et al., "A Survey on Visualizations for Musical Data," CGF 2020 | Taxonomy of music visualizations; piano roll maps pitch→y, time→x, length→duration; color for extra info | https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.13905 |
| Klemenc et al., "Visual and Aural: Visualization of Harmony in Music with Colour," IPSJ 2011 | Modified piano roll (z=instrument); harmony → color via circle of thirds; saturation = consonance; real-time segmentation at note events | http://tir.ipsitransactions.org/2011/January/Paper%2006.pdf |
| Schmidt, "Meaningful Music Visualizations," Purdue thesis | Argues for meaningful mappings; piano roll as a legible basis | https://hammer.purdue.edu/ndownloader/files/13893941 |
| Heyen & Sedlmair, "Supporting Music Education through Visualizations of MIDI Recordings," 2026 | Proportional durations, standard notation, pre-attentive processing; per-note feedback | https://arxiv.org/abs/2603.23631 |
| "musicolors," 2025 | Synesthetic color mapping for musical ideas | https://arxiv.org/abs/2503.14220 |
| Malinowski / Music Animation Machine | Long-form piano-roll visualization; color by voice/pitch class | http://www.musanim.com/ |
| Harte et al., "Symbolic Representation of Musical Chords," ISMIR 2005 | Harte chord syntax; context-independent labels | https://mtg.upf.edu/files/publications/cc9120-ISMIR-2005-Egomez-v2.pdf |
| Pardo & Birmingham, "Algorithms for Chordal Analysis," 2002 | Template scoring `S = P − (M + N)`; tie-breaking rules | https://interactiveaudiolab.github.io/assets/papers/pardo-birmingham-cmj02.pdf |
| Odekerken et al., DECIBEL/CASSETTE, 2020 | Weighted chroma + template matching; ~80% WCSR on pop MIDI | https://arxiv.org/abs/2002.09748 · https://github.com/DaphneO/DECIBEL |
| Krumhansl & Schmuckler | Key-profile correlation; probe-tone profiles | https://rnhart.net/articles/key-finding/ |
| Temperley, "A Bayesian Approach to Key-Finding," 2002 | Revised Kostka–Payne profiles; flat input vector | https://davidtemperley.com/wp-content/uploads/2015/11/temperley-maai.pdf |
| Albrecht & Shanahan, 2013 | Pop/rock key profiles; improved minor-mode treatment | Journal of Mathematics and Music 7(2) |
| Plomp & Levelt, "Tonal Consonance and Critical Bandwidth," 1965 | Sensory roughness model | https://www.mpi.nl/world/materials/publications/levelt/Plomp_Levelt_Tonal_1965.pdf |
| Sethares, "Relating Tuning and Timbre" | Practical roughness/dissonance calculation | https://sethares.engr.wisc.edu/consemi.html |
| MIREX Audio Chord Estimation / Key Detection | Evaluation conventions and vocabulary | https://www.music-ir.org/mirex/wiki/MIREX_HOME |

---

## 8. Recommended Architecture

### 8.1 Data flow

```text
┌──────────────┐    audio     ┌──────────────────┐
│ module file  │─────────────▶│ libopenmpt (WASM)│──▶ WebAudio
└──────┬───────┘              └────────┬─────────┘
       │ parse                          │ transport: order, row,
       ▼                                │ speed, tempo, rows/beat
┌──────────────┐                       ▼
│ pattern data │──────────────▶┌──────────────────┐
│ (cells)      │               │ Shadow           │
└──────────────┘               │ Interpreter      │
                               └────────┬─────────┘
                                        │ NoteEvent[] / Voice[]
                                        ▼
                               ┌──────────────────┐
                               │ Analysis         │
                               │ chord, key,      │
                               │ metrics          │
                               └────────┬─────────┘
                                        │ MusicalState
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                  ┌─────────────┐               ┌─────────────┐
                  │ Scene (WebGL)│              │ HUD (DOM)   │
                  └─────────────┘               └─────────────┘
```

### 8.2 Precompute vs live

- **Produced video / non-interactive:** parse the whole module, simulate all orders, emit `NoteEvent[]`, run Viterbi chord/key analysis over the full timeline, then render at exact times. This gives perfect sync, clean labels, and no flicker. Strongly recommended for a "music visualizer" piece.
- **Live/interactive:** parse the current pattern/order, simulate a lookahead of 1–2 rows, analyze a rolling window, use hysteresis/forward HMM. Slightly less clean, but responsive to user input (seek, mute channels, change HUD level).

### 8.3 Data structures

```ts
type NoteEvent = {
  t0: number; t1: number | null;
  midi: number; pc: number; cents: number;
  velocity: number;
  channel: number; instrument: number; sample: number;
  roleWeight: number;
  flags: { arp?: [number,number]; glide?: number; vibrato?: boolean;
           retrig?: boolean; sustained?: boolean; release?: boolean };
};

type Voice = {
  channel: number; sample: number;
  midi: number; midiFloat: number; pc: number;
  start: number; end: number | null;
  releaseStart: number | null; releaseTime: number;
  active: boolean; releasing: boolean; virtual: boolean;
  env: number; velocity: number; gain: number;
  nna: "cut" | "continue" | "off" | "fade";
  role: "bass" | "harmony" | "melody" | "drums" | "fx";
  roleWeight: number;
  flags: Record<string, unknown>;
};

type ChordState = {
  root: number; quality: string; bass: number;
  pcs: number[];
  label: string; harte: string; roman: string;
  confidence: number;
  alternatives: { root: number; quality: string; score: number }[];
};

type KeyState = {
  tonic: number;
  mode: "major" | "minor" | "dorian" | "phrygian" | "lydian"
      | "mixolydian" | "aeolian" | "locrian";
  confidence: number;
  candidates: { tonic: number; mode: string; r: number }[];
};
```

### 8.4 Performance

- Use typed arrays for salience/histograms; avoid per-frame allocations.
- Cache chord templates by root/quality; precompute `T`, `R`, and `isDiatonic`.
- Precompute a 12×12 roughness table; update at 10–20 Hz, not 60.
- Render note bars with WebGL instancing; text in DOM/SVG (crisper, easier to style).
- Pattern grid in Canvas2D if small; DOM if interactive.
- Target 60 fps at 1080p with 32 channels and 10k visible notes; measure with `performance.now()` and GPU timers.
- Run module parsing and symbolic analysis in a Web Worker; keep the audio thread free. Send transport/note events at row boundaries, not per sample.
- Use `AudioWorklet` for the audio engine (or libopenmpt WASM's audio callback); do not do DSP on the main thread.
- Audio-visual latency target: < 50 ms; use `AudioContext.currentTime` as the master clock; schedule visual events with lookahead.

### 8.5 Build order

1. Module parsing + shadow interpreter + `NoteEvent[]` from a known XM/IT file; verify against OpenMPT.
2. Piano roll + channel color + beat/bar; sync to audio.
3. Chord templates + labels + confidence; test on synthetic chords.
4. Key detection + smoothing; test on known progressions.
5. HUD levels + layout + toggle.
6. Pitch-class clock + degree wheel + pattern grid.
7. Metrics + sparklines.
8. Spectacle layer driven by the same events.
9. Precompute pipeline for produced videos.
10. User testing with musicians.

---

## 9. Validation Plan

### 9.1 Corpus

- 50+ modules across MOD/XM/S3M/IT, genres: chiptune, demoscene, drum & bass, orchestral, jazz/fusion, ambient.
- Include edge cases: tempo changes, pattern jumps/loops, subsongs, detuned samples, arpeggios, NNA, odd meters, 16+ channels.
- Hand-annotate chords and keys for 20 modules (2 annotators; report agreement).

### 9.2 Metrics

- **Chord:** weighted chord symbol recall (WCSR) against Harte labels; also top-3 accuracy.
- **Key:** MIREX-style weighted key score; relative major/minor accuracy; modulation detection.
- **Notes:** if comparing to audio, onset/pitch F1; for symbolic, exact match against the shadow interpreter.
- **Latency:** audio-to-visual delay; target < 50 ms.
- **Performance:** FPS, CPU/GPU time, memory at 32 channels/1080p.
- **Legibility:** task-based user study (identify chord changes, key, instrument entries, structure); time and accuracy; SUS.

### 9.3 User study

- 8–12 musicians (tracker users and non-tracker musicians) + 8–12 non-musicians.
- Conditions: Level 0, Level 1, Level 2; with/without piano roll; with/without clock.
- Tasks: "When does the chord change?", "What key is it in?", "Which channel has the melody?", "Where does the section change?"
- Measures: accuracy, time, confidence, preference; think-aloud.
- Test at 1080p and 720p; test color-blind simulation; test reduced motion.

### 9.4 Edge-case tests

- Note map transposition (IT) and relative note (XM).
- Finetune −128..+127 and detuned samples.
- Arpeggio at speed 1–3; ensure no chord flicker.
- Note delay/cut/retrigger; ensure note bars match audio.
- Sustained looping pad; ensure cap/infinity marker.
- Pattern jump/loop; ensure timeline and labels stay in sync.
- Tempo change; ensure beat grid updates.
- Drums-only section; ensure `N.C.`.
- Atonal/noise; ensure `key: —`.

---

## 10. References

1. Harte, C., Sandler, M., Abdallah, S., Gómez, E. "Symbolic Representation of Musical Chords: A Proposed Syntax for Text Annotations." ISMIR 2005. https://mtg.upf.edu/files/publications/cc9120-ISMIR-2005-Egomez-v2.pdf
2. Pardo, B., Birmingham, W. "Algorithms for Chordal Analysis." Computer Music Journal 26(2), 2002. https://interactiveaudiolab.github.io/assets/papers/pardo-birmingham-cmj02.pdf
3. Odekerken, D., Koops, H. V., Volk, A. "DECIBEL: Improving Audio Chord Estimation for Popular Music by Alignment and Integration of Crowd-Sourced Symbolic Representations." 2020. https://arxiv.org/abs/2002.09748
4. Krumhansl, C. L. *Cognitive Foundations of Musical Pitch.* Oxford University Press, 1990.
5. Temperley, D. "A Bayesian Approach to Key-Finding." ICMAI 2002. https://davidtemperley.com/wp-content/uploads/2015/11/temperley-maai.pdf
6. Albrecht, J., Shanahan, D. "The Use of Large Corpora to Train a New Type of Key-Finding Algorithm: An Improved Treatment of the Minor Mode." Journal of Mathematics and Music 7(2), 2013.
7. Plomp, R., Levelt, W. J. M. "Tonal Consonance and Critical Bandwidth." JASA 38(4), 1965. https://www.mpi.nl/world/materials/publications/levelt/Plomp_Levelt_Tonal_1965.pdf
8. Sethares, W. A. "Relating Tuning and Timbre." https://sethares.engr.wisc.edu/consemi.html
9. Khulusi, R., Kusnick, J., Meinecke, C., Gillmann, C., Focht, J., Jänicke, S. "A Survey on Visualizations for Musical Data." Computer Graphics Forum 39(6), 2020. https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.13905
10. Klemenc, B., Ciuha, P., Šubelj, L., Bajec, M. "Visual and Aural: Visualization of Harmony in Music with Colour." IPSJ Transactions, 2011. http://tir.ipsitransactions.org/2011/January/Paper%2006.pdf
11. Schmidt, K. "Meaningful Music Visualizations." Purdue University thesis. https://hammer.purdue.edu/ndownloader/files/13893941
12. Heyen, F., Sedlmair, M. "Supporting Music Education through Visualizations of MIDI Recordings." 2026. https://arxiv.org/abs/2603.23631
13. Park, H., Jeong, D. "WaveRoll: JavaScript Library for Comparative MIDI Piano-Roll Visualization." ISMIR 2025. https://arxiv.org/abs/2511.09562
14. Malinowski, S. "Music Animation Machine." http://www.musanim.com/
15. OpenMPT / libopenmpt. https://github.com/openmpt/openmpt · https://lib.openmpt.org/libopenmpt/
16. BassoonTracker. https://github.com/steffest/bassoontracker
17. chiptune3. https://github.com/DrSnuggles/chiptune
18. Furnace. https://github.com/tildearrow/furnace
19. Synthesia. https://synthesiagame.com/
20. Chordino / Sonic Visualiser. https://www.vamp-plugins.org/ · https://www.sonicvisualiser.org/
21. Adam Stark Chord Detector. https://github.com/adamstark/Chord-Detector-and-Chromagram
22. Tonal.js. https://github.com/tonaljs/tonal
23. music21. https://github.com/cuthbertLab/music21
24. Essentia.js. https://mtg.github.io/essentia.js/
25. projectM. https://github.com/projectM-visualizer/projectm
26. Butterchurn. https://github.com/jberg/butterchurn
27. Farbrausch fr_public. https://github.com/farbrausch/fr_public
28. fr-08: .the .product. http://www.theproduct.de/ · https://www.pouet.net/prod.php?which=1221
29. MIREX Audio Chord Estimation / Key Detection. https://www.music-ir.org/mirex/wiki/MIREX_HOME
30. XM format specification. https://github.com/lclevy/unmo3/blob/master/spec/xm.txt
31. IT format specification. https://ftp.modland.com/pub/documents/format_documentation/Impulse%20Tracker%20v2.04%20%28.it%29.html
32. JAMS chord namespace (Harte grammar and extensions). https://jams.readthedocs.io/en/stable/namespaces/chord.html

---

## Appendix A: Quick Parameter Cheatsheet

| Parameter | Recommended default | Notes |
|---|---|---|
| Chord analysis rate | 20–30 Hz | 10 Hz is enough for labels; 30 Hz for note bars |
| Chord recency τ | 0.6 s | Longer for pads, shorter for fast music |
| Chord required threshold ε | 0.02 | Normalized salience |
| Chord β (outside penalty) | 0.60 | Raise to reduce extensions |
| Chord λ (missing required) | 0.50 | Raise to prefer complete chords |
| Chord γ (root bonus) | 0.35 | Raise to favor bass-root labels |
| Chord δ (bass=root) | 0.15 | Lower for jazz/inversions |
| Chord η (complexity) | 0.015 | Raise to prefer triads |
| Chord hold | 250 ms | Crossfade 150–200 ms |
| Key window | 8 bars | 4 bars for fast modulation |
| Key decay τ | 4 bars | Exponential histogram |
| Key profile | Temperley | KK alternative; Albrecht–Shanahan for pop |
| Key softmax T | 0.05 | Calibrate on your corpus |
| Key HMM same | 0.90 | Normalize rows |
| Key HMM related | 0.02–0.03 | Relative/parallel/±fifth |
| Key min dwell | 2 bars | Anti-flicker |
| Piano roll playhead | 65% width | Notes scroll left |
| Note bar height | 0.8 × row height | Rounded ends |
| HUD Level 1 font | 64–80 px chord | 28–32 px key |
| HUD update | 5–10 Hz | Text only; canvas at 60 fps |

## Appendix B: Chord Template Generation

```js
const QUALITIES = [
  { name: "maj",    intervals: [0,4,7],        required: [0,4],        optional: [7] },
  { name: "min",    intervals: [0,3,7],        required: [0,3],        optional: [7] },
  { name: "dim",    intervals: [0,3,6],        required: [0,3,6],      optional: [] },
  { name: "aug",    intervals: [0,4,8],        required: [0,4,8],      optional: [] },
  { name: "sus2",   intervals: [0,2,7],        required: [0,2,7],      optional: [] },
  { name: "sus4",   intervals: [0,5,7],        required: [0,5,7],      optional: [] },
  { name: "5",      intervals: [0,7],          required: [0,7],        optional: [] },
  { name: "6",      intervals: [0,4,7,9],      required: [0,4,9],      optional: [7] },
  { name: "m6",     intervals: [0,3,7,9],      required: [0,3,9],      optional: [7] },
  { name: "7",      intervals: [0,4,7,10],     required: [0,4,10],     optional: [7] },
  { name: "maj7",   intervals: [0,4,7,11],     required: [0,4,11],     optional: [7] },
  { name: "m7",     intervals: [0,3,7,10],     required: [0,3,10],     optional: [7] },
  { name: "dim7",   intervals: [0,3,6,9],      required: [0,3,6,9],    optional: [] },
  { name: "hdim7",  intervals: [0,3,6,10],     required: [0,3,6,10],   optional: [] },
  { name: "mmaj7",  intervals: [0,3,7,11],     required: [0,3,11],     optional: [7] },
  { name: "aug7",   intervals: [0,4,8,10],     required: [0,4,8,10],   optional: [] },
  { name: "7sus4",  intervals: [0,5,7,10],     required: [0,5,10],     optional: [7] },
  { name: "add9",   intervals: [0,4,7,2],      required: [0,4,2],      optional: [7] },
  { name: "madd9",  intervals: [0,3,7,2],      required: [0,3,2],      optional: [7] },
  { name: "9",      intervals: [0,4,7,10,2],   required: [0,4,10,2],   optional: [7] },
  { name: "maj9",   intervals: [0,4,7,11,2],   required: [0,4,11,2],   optional: [7] },
  { name: "m9",     intervals: [0,3,7,10,2],   required: [0,3,10,2],   optional: [7] },
  { name: "11",     intervals: [0,4,7,10,2,5], required: [0,4,10,2],   optional: [7,5] },
  { name: "m11",    intervals: [0,3,7,10,2,5], required: [0,3,10,2],   optional: [7,5] },
  { name: "13",     intervals: [0,4,7,10,2,9], required: [0,4,10,2,9], optional: [7,5] },
  { name: "maj13",  intervals: [0,4,7,11,2,9], required: [0,4,11,2,9], optional: [7,5] },
  { name: "m13",    intervals: [0,3,7,10,2,9], required: [0,3,10,2,9], optional: [7,5] },
];
```

Generate templates for each root:

```js
function templatesForRoot(root, key) {
  return QUALITIES.map(q => ({
    root,
    quality: q.name,
    T: [...new Set(q.intervals.map(i => mod12(root + i)))],
    R: [...new Set(q.required.map(i => mod12(root + i)))],
    optional: [...new Set(q.optional.map(i => mod12(root + i)))],
    diatonic: isDiatonic(q.intervals.map(i => mod12(root + i)), key)
  }));
}
```

`required` drives the missing-degree penalty; `optional` drives naming/omission logic (`C6` without the fifth is still `C6`, `C:maj7(*5)`), not the base score.

## Appendix C: Key Profiles

```js
const KK_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KK_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

const TEMPERLEY_MAJOR = [5.0,2.0,3.5,2.0,4.5,4.0,2.0,4.5,2.0,3.5,1.5,4.0];
const TEMPERLEY_MINOR = [5.0,2.0,3.5,4.5,2.0,4.0,2.0,4.5,3.5,2.0,1.5,4.0];
```

Index order: chromatic from the tonic (0 = tonic, 1 = ♭2, 2 = 2, 3 = ♭3, 4 = 3, 5 = 4, 6 = ♭5, 7 = 5, 8 = ♭6, 9 = 6, 10 = ♭7, 11 = 7).

## Appendix D: Glossary

- **Salience:** weighted evidence for a pitch class at a moment.
- **Template:** a set of intervals defining a chord quality.
- **WCSR:** weighted chord symbol recall; duration-weighted chord accuracy.
- **HMM:** hidden Markov model; used to smooth chord/key sequences.
- **Viterbi:** finds the most likely state sequence; good for offline analysis.
- **Forward algorithm:** computes filtered state probabilities; good for live display.
- **NNA:** New Note Action (IT); cut/continue/off/fade for the previous voice.
- **N.C.:** no chord.
- **Rootless voicing:** a chord without its root, common in jazz.
- **Symmetric chord:** dim7/aug; no unique root.
- **Roughness:** sensory dissonance from close partials; not the same as musical tension.
