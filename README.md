# TRACKER TRASH

**Open a tracker module. Receive demoscene. Lose dignity.**

There is no demo, no autoplay, and no visualizer preview. The gate stays up until you open a real module and playback begins.

A pure-frontend, GitHub-Pages-friendly music visualizer for tracker modules (`.mod`, `.xm`, `.s3m`, `.it`, `.mptm`, and 60+ more libopenmpt formats). It combines:

- **Actual musical information**: live chord recognition, roman numerals, key detection, note names, channel activity, a look-ahead/look-behind note ribbon, and an optional full piano-roll / pattern-grid / pitch-class-clock HUD.
- **A demoscene show**: indexed low-res frames, ordered dithering, plasma, copper, rotozoom, dot tunnel, Kefrens bars, wireframe, glenz vectors, fire, starfields, 1-bit landscapes, CRT scanlines, scrollers, and absurd scene cards.
- **A 4D Gaussian-splat morph field** that becomes the current chord, a tesseract, a torus, a galaxy, or a turd, with additive glow and spring morphing.
- **Diegetic absurdity**: the chord is a monument, the channel meters are pipes/organ tubes/KPI bars/CRT columns, the notes are physical objects, and the poop forecast is a weather report.
- **A scatological cartoon mascot** (“THE BASS ASS”) whose turd type, size, colour tag, and label are driven by the bass note and the current chord. It piles up, gets flushed on section changes, and is always labelled with the note/chord that caused it.
- **Running characters and gags**: DJ Rat, Bass Ass, Sad Wizard, Business Dog, The Orb, Uncle Tracker, GARY the hidden pixel, fake dialogs, ads, SMPTE emergencies, a fake media player, BSOD, “graphic design is my passion”, scroller hijacks, achievements, fog, and more.
- **Monsquaz mode**: a full-screen, music-synced recreation of the classic four-phase up / sunset dance / down / zoom loop, using the actual Monsquaz up/down backgrounds, glossy arrows, sunset photo, side GIF, and a non-explicit Monsquazman head crop, composited with original art and retrowave zoom effects. The actual head crop spins in 3D ("rotate the potato") during the zoom phase. Press **Z** or the **MONSQ** button. The original NSFW full-body asset is not bundled.
- **A show director** that changes scene, camera, effect, and whole presentation format (world / fullscreen FX / multiview / TRACKER OS terminal / SMPTE) on musical section boundaries. It is not one stage with palette swaps.

Everything runs locally in the browser. No uploads, no accounts, no server-side code.

---

## Quick start

You only need a static server for local development. AudioWorklet requires `http(s)`, not `file://`.

```bash
npm install
npm run dev
# open http://localhost:5173
```

`npm install` is only needed for the test tooling; the site itself has no build step and no runtime dependencies beyond the vendored wasm-embedded libopenmpt build.

---

## Controls

| Input | Action |
|---|---|
| drop a file anywhere | load and play a tracker module |
| `Space` | play / pause |
| `←` / `→` | seek −5s / +5s |
| `R` | restart |
| `O` | open file picker |
| `Z` | toggle Monsquaz mode |
| `M` | toggle the full music-nerd panels |
| `S` | serious mode |
| `H` | hide/show the HUD |
| `G` | toggle gross mode (poop engine) |
| `F` | fullscreen |
| `V` | cycle the background effect manually |
| `?` | help / credits |

On-screen controls: `OPEN`, `DEMO`, `MUSIC PANELS`, `PANELS`, `SERIOUS`, `CHAOS` slider, `POOP` toggle, `HUD`, fullscreen.

---

## Music-reading features

- **Chord detection** over the current measure’s pattern data, using role-weighted notes (bass/chord channels dominate; passing lead notes do not become extensions).
- **Key detection** using Krumhansl–Schmuckler pitch-class profiles plus chord-progression compatibility and a first-chord prior, so relative major/minor ambiguity is resolved sensibly.
- **Roman numerals** relative to the detected key, with common borrowed-chord spellings.
- **Look-ahead** projection of future rows, future notes, and next bars’ chords; the in-world turd forecast and the piano roll’s right side use it.
- **Look-behind** note history, chord track, channel VU, pattern grid, and piano roll.
- **Trackers are treated as symbolic scores**, not just audio: note names use tracker spelling; octaves are the tracker’s, not a fake absolute-pitch claim.
- **Uncertainty is shown**: no chord → `???`; low-confidence key → `detecting…`; the HUD does not invent a confident chord from a single note.

Press **M** for the full panels: channel meters, music facts, piano roll, pattern grid, pitch-class clock, and the forecast.

---

## Accessibility and safety

- Content warning gate (cartoon butt humour, flashing dither, brown note).
- Flash-safe defaults: capped white flashes, no rapid full-screen strobe, shake can be disabled.
- `prefers-reduced-motion` is respected (shake/confetti and CSS animations are reduced).
- Chaos slider from 0 (clean demoscene) to 10 (brainrot).
- **Serious mode** removes gags and the poop engine while keeping the demoscene and the music information.
- **Gross mode** can be turned off independently.
- Keyboard-first controls and labelled buttons.
- All module data stays in the browser.

The cartoon butt is deliberately **cartoon, non-anatomical, and non-sexual**. No explicit anatomy, no sexual content, no copyrighted meme images, no bundled samples. The “banned image” gag is a pixelated HR notice, not a shock image.

---

## Tests

The project was built test-first / behaviour-first.

```bash
npm run test:unit     # Node tests: theory, tracker analysis, look-ahead, poop taxonomy, generated test-module validity
npm run test:e2e      # Playwright: real AudioWorklet playback, HUD, formats, pause, seek, invalid file, mobile, gags
npm test              # both
```

Playwright uses system Chromium at `/usr/bin/chromium` when present. Otherwise install Playwright’s browser or point at one:

```bash
npx playwright install chromium
# or
PW_CHROMIUM=/path/to/chrome npm run test:e2e
```

For a human-review screenshot gallery (with the dev server already running):

```bash
npm run shots
# writes test-results/shots-manual/
```

The e2e suite also writes deterministic format screenshots to `test-results/shots/`.

---

## Deployment to GitHub Pages

This is a static site. No build step is required.

### Option A — deploy the branch (simplest)

1. Create a GitHub repository and push this folder to `main`.
2. In the repo: **Settings → Pages → Build and deployment**.
3. Set **Source** to **Deploy from a branch**.
4. Choose **Branch: `main`**, **Folder: `/ (root)`**, and save.
5. Wait for the Pages build. The site will be at:

   `https://<your-user>.github.io/<repo-name>/`

   If the repo is named `<your-user>.github.io`, it will be at `https://<your-user>.github.io/`.

`.nojekyll` is included, so Jekyll will not interfere. All asset paths are relative, so project subpaths work.

### Option B — GitHub Actions

A workflow is included at `.github/workflows/pages.yml`. It stages only the static site files (`index.html`, `styles.css`, `src/`, `vendor/`, `assets/`, `.nojekyll`) and deploys them.

1. Push to `main`.
2. Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. The workflow will deploy on every push.

### Notes

- `vendor/libopenmpt.worklet.js` is a 1.5 MB single-file build with the wasm embedded. It is served as a normal JS module; GitHub Pages’ gzip gets it to ~500 KB.
- AudioWorklet requires a secure context. `https://` (GitHub Pages) and `http://localhost` are fine; `file://` is not.
- No server headers (COOP/COEP) are needed. The site does not use SharedArrayBuffer.
- All fonts are vendored. There is no demo module.

---

## Project layout

```
index.html               gate, diegetic broadcast strip, optional nerd panels, gags, help
styles.css               CRT, dither-era UI, responsive layout, format-break gags
src/main.js              boot, file loading, show director, scene/format deck, settings
src/engine.js            lazy AudioContext + chiptune3/libopenmpt wrapper
src/tracker.js           module model, measure harmony, key/chord analysis, look-ahead
src/theory.js            note spelling, chord templates, Krumhansl key profiles, roman numerals
src/visualizer.js        indexed low-res stage, 14 demoscene effects, scenes, cameras, formats
src/monsquaz.js          music-synced Monsquaz takeover (actual assets + original art)
src/splats.js            4D Gaussian-splat morph field
src/hud.js               diegetic broadcast + full music-nerd panels
src/gags.js              dialogs, chyrons, ads, SMPTE, player, BSOD, achievements
src/sprites.js           pixel mascots
src/poop.js              turd taxonomy + procedural renderer
vendor/                  chiptune3 + libopenmpt wasm build + licenses
assets/fonts/            VT323 + Silkscreen (OFL)
assets/monsquaz/         attributed Monsquaz assets + original head crop
tests/helpers/           in-memory MOD fixture for tests (not shipped)
tests/unit/              Node TDD suites
tests/e2e/               Playwright BDD suites
tools/                   static server and module inspector
```

---

## Credits / licenses

- **libopenmpt** — BSD-3-Clause. See `vendor/LIBOPENMPT-LICENSE.txt`.
- **chiptune3** — MIT. See `vendor/CHIPTUNE3-LICENSE.txt`.
- **VT323** and **Silkscreen** — SIL Open Font License. See `assets/fonts/`.
- Visualizer code, sprites, gags, and all procedural art — MIT (see `LICENSE`), except third-party components above.
- **Monsquaz mode** is a fan recreation of the choreography from [Monsquaz/monsquaz-css3-html5](https://github.com/Monsquaz/monsquaz-css3-html5) (ISC repository metadata). The non-explicit source assets (up/down backgrounds, arrows, sunset photo, side GIF, and a head crop) are bundled under `assets/monsquaz/` with attribution in `ATTRIBUTION.md`. The original full-body NSFW asset is intentionally not included; its role is taken by an original clothed cartoon body with the actual head crop.
- No copyrighted sprites, images, audio samples, or trademarks are bundled. Any resemblance to a real butt is coincidental.

Not affiliated with the OpenMPT project, GitHub, or your childhood.

---

## Known limitations

- Tracker effects that change pitch content (portamento, arpeggio commands, vibrato, retrigger) are interpreted from the pattern data in the measure, not simulated tick-exactly. The chord/key display is a musical summary, not a forensic replay.
- Octave numbering follows tracker conventions; chord pitch classes are what matter for harmony.
- Very large modules can take a moment to parse on load (the worklet parses pattern data before starting audio so it does not glitch the first seconds).
- Mobile portrait stretches the 16:9 stage; the site is happiest in landscape or on a desktop.
- The humours are deliberately scatological and absurd. Use `SERIOUS` mode for meetings, funerals, and music theory exams.
