# Demoscene Visual Language for a 60 fps Music Visualizer

Research notes / implementation brief. Target: static frontend, no build step required,
Amiga + PC demoscene vocabulary (Second Reality, Spaceballs, Conspiracy, Farbrausch,
4k/64k intros), ordered dithering as the signature texture.

---

## 0. The look in one paragraph

Everything is drawn at **320x180** into an indexed-color buffer, quantized every frame
against a **fixed 8-16 color palette** with a **4x4 Bayer matrix**, then upscaled
**6x nearest-neighbour** to 1080p. The scene is 2-4 procedural layers (one full-screen
per-pixel layer, plus cheap 1D/sprite layers), one palette, heavy black, and a CRT pass
that is barely there. Information lives in a **static frame around the chaos**, never on
top of it. Motion is beat-quantized: geometry reacts on beats, palette reacts on bars,
scene changes react on 8/16-bar sections.

Non-negotiables that separate "retro effect" from "demoscene beauty":

1. **One palette for the whole frame.** No anti-aliasing, no gradients outside the palette.
2. **Black is a color.** 30-50% of the frame should be near-black.
3. **One accent color reserved for "now"** (playhead, current row, beat dot).
4. **Dither is a texture, not a fallback.** Same screen-space pattern every frame.
5. **One hero motion.** Everything else is slower and lower contrast.
6. **Consistent pixel size.** Text, borders, and effects all live on the same grid.

---

## 1. Ranked catalog (22 modules)

Cost = measured/estimated JS time at 320x180 on a desktop CPU (57,600 px). GPU passes are
cheaper but cost a draw call. "Impact" = perceived production value per unit of work.

| # | Module | Cost @320x180 | Impact | Role |
|---|--------|---------------|--------|------|
| 1 | Ordered dither + palette quantize | 0.4-1.6 ms | ***** | identity layer |
| 2 | Palette-cycled plasma | 1.4 ms | ***** | hero / background |
| 3 | Copper bars (raster bars) | 0.05 ms | ***** | accent / section marker |
| 4 | Feedback / phosphor trails | 0.2 ms GPU | ***** | premium gloss |
| 5 | 3D starfield (+ warp) | 0.2 ms | **** | depth / transitions |
| 6 | Sine scroller / greetz | 0.1 ms | **** | culture signal |
| 7 | Perspective checkerboard floor | 1.5 ms | **** | space / grid |
| 8 | Tunnel (round or dot) | 2.0 ms | **** | drop / build |
| 9 | Rotozoomer | 1.5 ms | **** | texture showcase |
| 10 | Twister | 1.0 ms | **** | classic hero |
| 11 | Wireframe terrain | 0.5-1.5 ms | **** | "Second Reality" vista |
| 12 | Glenz vectors | 0.2 ms GPU | **** | chrome / premium |
| 13 | Dot sphere / vector dots | 0.5 ms | *** | 3D without polygons |
| 14 | Metaballs | 1.5 ms @160x90 | *** | organic builds |
| 15 | Interference / moire | 1.0 ms | *** | 1-bit beauty |
| 16 | XOR texture | 0.5 ms | *** | cheap fractal plaid |
| 17 | Dither pixel-morph | ~0 ms | **** | scene transitions |
| 18 | Extruded 3D text | 0.2 ms | *** | title cards |
| 19 | CRT post (scanline/barrel/mask) | 0.5-1.5 ms GPU | ***** | sells everything |
| 20 | VHS / glitch post | 1.0 ms GPU | *** | breakdowns, drops |
| 21 | Scanline shimmer | ~0 ms | *** | audio link |
| 22 | Palette crossfade / quantization | ~0 ms | **** | mood change |

Budget rule: **one** full-screen per-pixel layer in JS (~1.5-2.5 ms), plus any number of
1D/sprite layers. Two per-pixel layers is fine (3-4 ms). Three or more: move to WebGL.

---

### 1. Ordered dithering + palette quantization

Bayer matrices:

```
B2 = [0 2]      B4 = [ 0  8  2 10]      B8 = 4*B4(x/2,y/2) + B2(x%2,y%2)
     [3 1]           [12  4 14  6]
                     [ 3 11  1  9]
                     [15  7 13  5]
```

Threshold: `t = (B4[y&3][x&3] + 0.5) / 16` in [0,1).

Quantize to N levels per channel:

```
q = floor(c * (N-1) + t) / (N-1)        // c in [0,1]
```

Nearest palette entry with dither bias:

```
c' = c + (t - 0.5) * spread             // spread ~ 24-64 (8-bit units)
idx = argmin_i |c' - pal[i]|^2
```

Fast path (measured fastest, 0.37 ms @320x180): quantize RGB to 6 bits per channel, add
dither as an integer offset, then look up a precomputed **64^3 byte LUT** (262 KB) of
palette indices. LUT build is ~0.1-0.3 s at load; cache it in IndexedDB if needed.

At 1 bit: `on = step(bayer8(p), luma)`; luma = `0.299R + 0.587G + 0.114B`.

**Ordered vs error diffusion**

| | Ordered (Bayer) | Floyd-Steinberg | Atkinson |
|---|---|---|---|
| cost @320x180 (16 colors) | 1.57 ms | 2.43 ms | 2.38 ms |
| cost @640x360 | 5.84 ms | 8.57 ms | 8.75 ms |
| animation | stable pattern, no crawl | shimmers/crawls | crawls, high contrast |
| parallel / GPU | yes | no (serial) | no |
| character | retro, graphic | photographic | 1-bit Mac, punchy |

Use **ordered** for anything that moves. Error diffusion only for static screens
(title cards, greetz page, loading screen). If you want diffusion-like softness in
motion, use **blue-noise** threshold (64x64 tiled, generated once) — same cost as Bayer,
no crawling, more "film", less "Amiga".

Cell size rule at 6x upscale: Bayer4 cell = 24 device px (good), Bayer8 = 48 px (chunky,
great for 1-bit, too coarse for 4-color shading). At 480x270 (4x) Bayer8 = 32 px.

---

### 2. Palette-cycled plasma

```
v = sin(x*a + t) + sin(y*b - t*0.7)
  + sin((x+y)*c + t*0.5)
  + sin(sqrt(x*x + y*y)*d - t)
idx = (v * scale + t*cycleSpeed) & 255
```

- Do **not** map v to RGB; map v to a **palette index**, then cycle the palette offset.
  This is the Amiga trick: the math is static-ish, color motion is free.
- 4 sines + 1 sqrt per pixel = 1.4 ms measured including dither and write.
- Replace one sine with `sin(x*y*0.001)` for the classic "interference" warp.
- Add `v += bass * 0.6 * sin(y*0.05)` to make the plasma breathe on bass.
- Best palettes: 32-step fire ramp, 32-step ice ramp, cyan→magenta.

### 3. Copper bars

Amiga copper = change background color per scanline. Emulate exactly:

```
for y in 0..H:
  v = 0
  for each bar b:
    yc = base_b + amp_b * sin(y*freq_b + t + phase_b)
    v += exp(-((y - yc)^2) / (2*w_b^2))
  color = ramp[clamp(v)]
  fillRect(0, y, W, 1)
```

Cost is O(H), i.e. free. Variants:
- **Diagonal copper**: `yc += x*slope`, draw as skewed quads.
- **Raster interrupt**: 3 bars at 120 degrees phase, plus a 1px white core
  (`v > 0.85`) — the "chrome" look.
- **Audio**: `amp`, `w`, and `phase` follow a smoothed bass envelope; hard-sync phase
  reset on bar 1.

### 4. Feedback / phosphor trails

Ping-pong framebuffers:

```
next = prev * decay + scene
```

- decay 0.82-0.94. Below 0.8 it looks like smeared mud; above 0.95 it never clears.
- Offset the previous frame by (0, +1) or a slow zoom (1.004) for a "tunnel of itself"
  look — the cheapest premium effect in existence.
- Canvas2D: `ctx.globalAlpha = 0.9; ctx.drawImage(prev, 0, 1);` then draw the new layer
  with `globalCompositeOperation = 'lighter'`.
- Tint the trail per channel (green phosphor, amber, cyan) by multiplying on read.
- Clear the buffer completely on section changes, otherwise it turns to grey soup.

### 5. Starfield

```
star = {x, y in [-1,1], z in (0,1]}
sx = cx + x / z * f
sy = cy + y / z * f
size = clamp(k / z, 1, 3)
b = (1 - z)^2
z -= speed * dt * (1 + 0.8*bass)
if z < 0.02: respawn(x, y, z=1)
```

Draw 1-3 px rects; on beats draw a streak `fillRect(sx, sy, 1, 1 + speed*40)`.
Three depth layers (600/900/1500 stars) with different palettes give parallax for ~0.2 ms.
For warp: multiply `speed` by 8 and stretch along the projected direction.

### 6. Sine scroller / greetz

Per column, not per character:

```
yOff(col) = round(A * sin(col*f + t))
```

Render a glyph atlas once (1-bit), then blit column by column with the offset. Add a
1px hard shadow at (+1,+1) in the darkest palette color and a per-column palette index
that ramps along x (chrome/scroller gradient). Cost ~0.1 ms for 320 columns.

Greetz page: 3-5 lines, different phases, one line inverted (background fill), one line
in the accent color. This is the strongest "this is a demo" signal available.

### 7. Perspective checkerboard floor

```
for y in horizon+1..H:
  z = 1 / (y - horizon)
  for x:
    u = (x - cx) * z * scale
    v = z * scale + scroll
    c = ((floor(u) + floor(v)) & 1)
```

- One divide per pixel; 1.5 ms with palette+dither.
- Fog: `b = clamp(1 - z*k)`, index into a palette ramp — hides the horizon seam and
  gives the "infinite plane" look.
- Add `u += sin(v*0.3 + t)*0.5` for a warped floor.
- Works beautifully in 1-bit; the dither creates a grey horizon.

### 8. Tunnel

```
dx = (x-cx)/H; dy = (y-cy)/H
r = 1 / sqrt(dx*dx + dy*dy)
u = dx * r * K + t
v = dy * r * K
shade = clamp(r * K2)
```

Variants:
- **Dot tunnel**: `dot = step(0.75, fract(u*8)) * step(0.75, fract(v*8))` — dots on the
  tunnel wall, extremely "demo".
- **Square tunnel**: use `max(|dx|,|dy|)` instead of `sqrt` for a cheaper, blockier look.
- **Twisted tunnel**: rotate (u,v) by `r*0.5 + t`.
- Modulate radius with bass: `r *= 1 + 0.15*bass`.

### 9. Rotozoomer

```
u = (dx*cos - dy*sin) * zoom + ox + t*sx
v = (dx*sin + dy*cos) * zoom + oy
```

Texture must be power-of-two and wrap (`& 255`). Add per-scanline wobble
`u += sin(y*0.05 + t) * 8` for the classic "underwater" rotozoom. 1.5 ms.

### 10. Twister

For each scanline y:

```
a  = y*k + t
w  = W*0.5 + sin(a)*W*0.35
for x in [-w, w]:
  u = (x/w + 1) * 0.5
  shade = cos(a + x*0.02)        // cylindrical lighting
  color = ramp[(u*N + shade*M) & 255]
```

The four-face version draws 4 ribbons with phases 0, pi/2, pi, 3pi/2 and back-face
culling by shade sign. Single ribbon is enough and reads instantly as a twister.
Use the accent color for the lit edge, background for the dark side.

### 11. Wireframe terrain

Two options:

**(a) Column heightfield (cheap, "vector mountains")**
```
for x in 0..W:
  h = 0
  for o in octaves: h += noise(x*f_o + scroll, t) / f_o
  y = horizon - h*amp
  line from (x, prevY) to (x, y), fill below with background
```
Hidden-line removal by drawing far slices first and filling below each polyline.

**(b) Grid mesh (more "Second Reality")**
Project `(x, z, h(x,z))` with `sx = cx + x*f/z`, `sy = horizon + (h - camY)*f/z`,
draw horizontal + vertical lines with brightness `1/z`. Draw back-to-front.
~200 lines total: 0.5 ms. Add a sun disc and a 1px horizon line.

### 12. Glenz vectors

Transparent filled polygons, additive:

- Canvas2D: `globalCompositeOperation = 'lighter'`, `fillStyle = rgba(accent, 0.22)`.
- WebGL: `blendFunc(SRC_ALPHA, ONE)`, depth test off, depth sort optional (additive is
  order-independent).
- Use 1px outline in the full accent color at `alpha 1` — that is what makes it read as
  "glenz" instead of "blurry triangles".
- 6-12 faces max; more turns to mush.

### 13. Dot sphere / vector dots

Points on a sphere (fibonacci or lat/long), rotate on 2 axes, project with perspective,
sort by z (or just draw far→near). Size and brightness from z. 500-1500 dots.
Cheapest way to get a rotating 3D object without a depth buffer. Great as a "loading"
or "build" element.

### 14. Metaballs

```
f = sum_i r_i^2 / ((x-xi)^2 + (y-yi)^2)
inside = f > threshold
shade  = f
```

Evaluate at **160x90** and upscale 2x — the blur is free and the dither hides it.
Banded shading (`floor(shade*6)/6`) + Bayer = liquid chrome. 1.5 ms at half res.

### 15. Interference / moire

```
i = sin((x*cosA + y*sinA)*f + t) * sin((x*cosB + y*sinB)*f - t)
on = i > 0
```

Two rotated gratings, thresholded to 1-bit, with a slow rotation of A/B. Produces
curved moire envelopes for free. Add the audio spectrum as the grating frequency:
`f = 20 + bass*40`.

### 16. XOR texture

```
c = ((x*zoom) ^ (y*zoom)) & 255
c = (c + t) & 255
```

One line. With a 256-entry ramp it looks like fractal plaid; with palette cycling it
flows. Scale x/y differently (e.g. `x*8 ^ y*3`) for asymmetry. Great as a background
under glenz or text.

### 17. Dither pixel-morph (transitions)

```
out = bayer(x,y) + (progress - 0.5)*2 < field(x,y) ? B : A
```

`field` can be a radial gradient, a vertical wipe, or low-frequency noise. Because the
threshold is the same Bayer pattern as the rest of the frame, transitions look native
to the aesthetic instead of like a video crossfade. Use for section changes and for
"materializing" text. Zero extra buffers if A and B are already rendered.

### 18. Extruded 3D text

- Pre-render the word to a 1-bit canvas (no AA).
- Draw N copies from back to front with `z` offset, scale `f/(z+d)`, and a palette ramp
  from dark to light. N=8-16 is enough at 320x180.
- Add a 1px accent outline on the front face and a floor shadow (skewed, 30% dither).
- For rotation, do it in 3D with a vector font or an SDF in a shader; for a static site
  the stacked extrusion is indistinguishable at this resolution.

### 19. CRT post

Do it at low res so scanlines survive the upscale:

```
uv  = (uv - 0.5) * (1 + 0.12*dot(d,d)) + 0.5     // barrel
scan = 0.86 + 0.14 * sin(uv.y * H * PI)          // 1 line per low-res row
mask = 0.92 + 0.08 * mod(floor(gl_FragCoord.x), 3.0)
vig  = smoothstep(1.25, 0.25, length(uv-0.5))
col *= scan * mask * vig
```

Optional: chromatic aberration `R at uv+vec2(1/W,0)`, `B at uv-vec2(1/W,0)` — 1 low-res
pixel is 6 device px, which is too much; use 0.3 px. Keep total darkening ≤ 20%; CRTs
are bright in the center.

### 20. VHS / glitch

- Per-scanline horizontal offset: `x += (hash(y, floor(t*15)) - 0.5) * amt`.
- Tracking band: a 10-20 px window whose y position drifts; inside it, offset by ±8 px
  and boost luma.
- Chroma smear: blur only the U/V (or R/B) channels horizontally.
- Grain: add blue noise at 3-6% before quantize; the palette will clamp it into dither.
- Use for 200-400 ms on drops, not continuously.

### 21. Scanline shimmer

Modulate the CRT scanline amplitude with hi-hat energy:

```
scan = 0.86 + (0.10 + 0.06*hat) * sin(y*PI + t*8)
```

Also useful: shift the whole dither threshold by `hat*0.15` — the image "sizzles" on
hi-hats without changing geometry. Free.

### 22. Palette crossfade / quantization

- Quantize source art offline (median cut or k-means) to the target palette; ship the
  indexed data, not the RGB.
- At runtime, crossfade **palettes**, not images: `pal = lerp(palA, palB, k)` then
  re-quantize. The same plasma becomes a completely different scene for 0 ms.
- Palette LUT rebuild on crossfade: 64^3 entries is too slow per frame in JS. Instead
  crossfade in **palette space at 8-16 entries** and keep nearest-search, or precompute
  8 crossfade LUTs and lerp indices (imperceptible).
- Section change = palette change + dither-morph + 1 px white flash. That is a
  complete "scene change" for ~0 geometry cost.

---

## 2. Palettes (exact hex)

### Amiga Workbench 1.3 (4) — the canonical Amiga screen
```
#000000 #FFFFFF #0055AA #FF8800
```
Reads as poster art, not as gradients. Use for UI chrome, title cards, 1-bit-ish scenes.
Dither only between blue and black; blue↔orange dithering makes muddy grey.

### Amiga chrome (derived, 5)
```
#000000 #0A2A4A #0055AA #4FA8FF #FFFFFF
```
For copper/glenz highlights; not an authentic Workbench ramp.

### Commodore 64 (16) — Pepto-style
```
#000000 #626262 #898989 #ADADAD #FFFFFF
#9F4E44 #CB7E75 #6D5412 #A1683C
#C9D487 #9AE29B #5CAB5E #6ABFC6
#887ECB #50459B #A057A3
```
Great hue variety, weak luminance ladder. Use per-material 2-3 color ramps; cross-hue
dithering (brown↔cyan) goes muddy. Excellent for glenz and logo art.

### EGA / CGA 16 — the 1990 PC look
```
#000000 #0000AA #00AA00 #00AAAA
#AA0000 #AA00AA #AA5500 #AAAAAA
#555555 #5555FF #55FF55 #55FFFF
#FF5555 #FF55FF #FFFF55 #FFFFFF
```
No midtones, maximum saturation. Perfect for copper bars, XOR, glenz; terrible for
photographic gradients. Dithers into clean primaries.

### Game Boy DMG (4) — best 4-color ramp ever made
```
#0F380F #306230 #8BAC0F #9BBC0F
```
Monotonic in luminance, so **any** pair dithers to a usable midtone. The single best
palette for "cheap but beautiful": 4 colors, one hue, infinite perceived shades.
Use Bayer4 at 320x180.

Game Boy Pocket (greys): `#000000 #555555 #AAAAAA #FFFFFF`

### PICO-8 (16)
```
#000000 #1D2B53 #7E2553 #008751 #AB5236 #5F574F #C2C3C7 #FFF1E8
#FF004D #FFA300 #FFEC27 #00E436 #29ADFF #83769C #FF77A8 #FFCCAA
```
Modern, high-contrast, designed for tiny screens. Reads well after dithering because
the bright ramp is monotonic.

### Sweetie 16 (16) — modern pixel-art workhorse
```
#1A1C2C #5D275D #B13E53 #EF7D57 #FFCD75 #A7F070 #38B764 #257179
#29366F #3B5DC9 #41A6F6 #73EFF7 #F4F4F4 #94B0C2 #566C86 #333C57
```
Low-saturation darks + two bright accents. Best choice if the visualizer must look
"designed" rather than "authentic".

### VGA 256 (mode 13h)
Default layout, not 256 hand-picked colors:
- 0-15: EGA 16 above
- 16-31: grayscale ramp (16 steps)
- 32-247: 6x6x6 RGB cube, `idx = 32 + r*36 + g*6 + b`, component `v*51`
- 248-255: black

Fire ramp (22, for plasma/copper):
```
#000000 #1A0000 #330000 #4D0000 #660000 #800000 #990000 #B30000
#CC1A00 #E63300 #FF4D00 #FF6600 #FF8000 #FF9900 #FFB300 #FFCC00
#FFE600 #FFFF00 #FFFF4D #FFFF99 #FFFFCC #FFFFFF
```
Ice ramp (13):
```
#000010 #001030 #002050 #003070 #004090 #0050B0 #0060D0 #1080E8
#30A0FF #60C0FF #90D8FF #C0ECFF #FFFFFF
```
These two ramps + one accent will carry 80% of the visuals.

### Sunset / outrun (8)
```
#140A2B #3B1157 #7A1E6E #D62E6B #FF6B35 #FFB03A #FFE6B0 #2EE6D6
```
Designed for banding: dither only at band edges, 1-2 rows, to fake 3x the colors.
Do not dither across the whole gradient — the bands are the aesthetic.

### Demoscene cyan-magenta (10)
```
#000000 #001018 #003A4A #00A6B8 #00F0FF
#FF2BD6 #8A00C8 #3A0060 #FFFFFF #FFE800
```
Complementary pairs average to blue-grey, so plasma dithering looks clean. This is the
"tracker demo" palette: cyan grid, magenta highlight, yellow only for the current row.

### 1-bit variants
```
Pure:    #000000 #FFFFFF
Paper:   #0B0B0F #E8E6D9
Amber:   #140A00 #FFB000   (mid #7A4A00 for 3-level)
Green:   #0A120A #33FF66   (mid #1E7A33)
```
1-bit is the highest-risk/highest-reward option. It only works if the composition has a
strong value structure: 60% black, 30% mid (dithered), 10% white. At 320x180 with
Bayer4 and 6x upscale it looks like a 1991 Amiga slide, not like a filter.

### "1993 PC demo" (16, custom but period-correct)
```
#000000 #0A0A2A #1E2F6B #3E6FB0 #7FB2D9 #FFFFFF
#2B1B0E #5C3A1E #8A5A2B #C08A45 #E8C07A
#1B3B2A #2F6B4A #5FA36B #9AD1A0 #FFE9B0
```
Earthy blues + ochre + sage. Use for landscapes/terrain; it is the Second Reality
"vista" mood without copying anything.

### What survives dithering
- **Monotonic luminance ramps** (GB, Sweetie, ice/fire): dither any pair, always works.
- **Complementary pairs** (cyan/magenta, blue/orange): midpoint is a usable neutral.
- **Analogous hues** (amber ramp): best-looking gradients, lowest risk.
- **C64/EGA**: dither **within** a material ramp only. Cross-hue dithering produces
  grey mud because the midpoint is desaturated.
- On modern screens, 4-6 colors at 320x180 read as "intentional"; 16+ colors read as
  "reduced photo". Fewer colors = more premium, as long as the value structure holds.

---

## 3. Low-res pipeline, upscale, HUD

### Resolution choice

| Buffer | Pixels | 720p | 1080p | 1440p | 2160p |
|---|---|---|---|---|---|
| 320x180 | 57.6k | 4x | **6x** | 8x | 12x |
| 384x216 | 82.9k | 3.33x | 5x | 6.67x | 10x |
| 426x240 | 102k | 2.5x | 4.5x | 6.25x | 9x |
| 480x270 | 129.6k | 2.67x | **4x** | 5.33x | **8x** |
| 640x360 | 230k | 2x | 3x | 4x | 6x |

**320x180 and 640x360 are the integer-scale sweet spots** (4x/6x/8x/12x and 2x/3x/4x/6x
at 720p/1080p/1440p/2160p). 320x180 wins on cost: 57.6k px, so even error diffusion
fits in 2.4 ms. 480x270 is the alternative if text must live inside the buffer
(4x at 1080p, 8x at 4K, but 2.67x at 720p).

Avoid 426x240: 4.5x at 1080p means every second texel is 5 px and the rest 4 px —
visible unevenness on vertical edges.

### Integer scale in device pixels

```js
const dpr = window.devicePixelRatio || 1;
const s = Math.max(1, Math.floor(Math.min(
  innerWidth  * dpr / 320,
  innerHeight * dpr / 180
)));
canvas.width = 320; canvas.height = 180;      // never change this
canvas.style.width  = (320 * s / dpr) + 'px'; // integer device pixels
canvas.style.height = (180 * s / dpr) + 'px';
canvas.style.imageRendering = 'pixelated';
```

Center with flexbox, letterbox with `background:#000`. Do not use `transform: scale()`
with a fractional value and do not let the browser pick the scale — you get shimmering
texels and uneven dither.

CSS: `image-rendering: pixelated;` (Chrome/Safari/Firefox), keep `crisp-edges` as a
fallback. Also `image-rendering: -moz-crisp-edges` is legacy; not needed in 2026.

### HUD: three options

**A. DOM overlay (recommended).** Scene canvas is pixelated and low-res; HUD is a
separate absolutely-positioned `<div>` (or SVG) at full resolution.
- Crisp text at any DPR, selectable, accessible, cheap (no canvas text layout per frame).
- Snap HUD panel edges to multiples of `s` device px so borders align with the pixel grid.
- Keep the HUD's own "pixel size" consistent: either use a pixel font at exact multiples
  of its design size (VT323 16/24/32 px, Silkscreen 8/16/24, PxPlus VGA 16/32), or a
  modern mono at 12-13 px for dense numbers.
- Never blur: no `text-shadow` with blur radius; use a hard 1px offset shadow.

**B. Draw HUD into the low-res buffer.** Maximum coherence, but 5-7 px cap height for
functional text is unreadable. Only for decorative labels ("GREETZ", "64K", fake
tracker chrome).

**C. Hybrid (best of both).** Frames, dividers, meter segments, mini tracker grid, and
scrollers in the low-res buffer; BPM/time/key/note names in DOM. Two visual languages,
one grid: the DOM text sits at 16 px while the buffer pixel is 6 px, and all boxes align
to 6 px multiples — it reads as "crisp vector HUD over pixel art", which is exactly the
modern demoscene UI convention.

### Canvas 2D vs WebGL

Measured, Chromium 156 headless (no GPU), Linux, single thread, 16-color palette:

| Pipeline | 320x180 | 426x240 | 640x360 | 960x540 | 1280x720 |
|---|---|---|---|---|---|
| RGB → 64³ LUT + Bayer8 | 0.37 ms | 0.61 | 1.37 | 3.09 | 5.51 |
| plasma (4 sines + sqrt) + Bayer + direct palette | 1.41 ms | 2.15 | 4.89 | 11.1 | 19.5 |
| nearest 16-color + Bayer | 1.57 ms | 2.68 | 5.84 | 12.7 | 22.4 |
| Floyd–Steinberg 16-color | 2.43 ms | 3.85 | 8.57 | — | — |
| Atkinson 16-color | 2.38 ms | 4.12 | 8.75 | — | — |

Frame budget 16.67 ms. At 320x180 even the worst case (error diffusion, 2.4 ms) leaves
14 ms. At 960x540 the naive path is already 12.7 ms — too close.

**Canvas 2D is enough** for: plasma, tunnel, rotozoom, twister, floor, terrain, dithering,
scrollers, starfields, glenz via `lighter`, feedback via self-draw. It is a real option,
not a fallback, and it keeps the site dependency-free.

**Use WebGL when** you need: multi-pass feedback at high res, CRT/VHS post with chromatic
aberration, additive glenz with many polys, 3D text with rotation, or 480x270+ with more
than one full-screen pass. A single fullscreen fragment shader at 320x180 is ~0.1-0.3 ms
on any 2015+ GPU; at 640x360 still under 1 ms. GPU cost is a non-issue at these sizes —
the cost is complexity and the extra canvas/texture plumbing.

Notes if WebGL:
- WebGL2 for `texImage3D` palette LUT (64³ RGB8 = 768 KB) and `texelFetch`.
- Or a 512x512 2D atlas encoding the same 64³ LUT (262,144 texels, exact fit).
- Keep the drawing buffer at 320x180; let CSS upscale. Do **not** render at device
  resolution and downsample — that destroys the pixel grid and the dither.
- `gl.drawingBufferWidth` must equal 320; set `canvas.width=320` and CSS size separately.

Browser compositing of a 320x180 canvas to 1920x1080 is a single GPU blit; do not
optimize it. `putImageData` + `drawImage` measurements in headless are deferred/meaningless
— assume <0.5 ms on real hardware.

### Frame loop discipline

- Fixed timestep for animation (`t` from `performance.now()`), audio analysis at
  60 Hz or 30 Hz with smoothing.
- Never allocate in the loop: preallocate `ImageData`, `Float32Array` envelopes, glyph
  atlases, palette LUT.
- Quantize `t` to the music clock (beat phase) when driving geometry; free-run `t` only
  for ambient motion. Otherwise the visuals feel "off" even when technically in sync.
- Render at 60 fps but allow the palette/dither to update at 30 fps on low-end devices
  (`prefers-reduced-motion` and a quality toggle).

---

## 4. Typography

| Font | Vibe | License | CDN | Use at |
|---|---|---|---|---|
| **VT323** | DEC terminal / tracker | OFL 1.1 | `fonts.googleapis.com/css2?family=VT323` | 16/24/32 px |
| **Silkscreen** | clean 5x5 pixel, labels | OFL 1.1 | `...?family=Silkscreen:wght@400;700` | 8/16/24 px |
| **Press Start 2P** | NES title screen | OFL 1.1 | `...?family=Press+Start+2P` | 16/24 px, titles only |
| **Pixelify Sans** | modern pixel sans, variable | OFL 1.1 | `...?family=Pixelify+Sans:wght@400..700` | 16/24 px |
| **Handjet** | variable pixel display | OFL 1.1 | `...?family=Handjet:wght@100..900` | 32 px+ display |
| **Departure Mono** | modern pixel mono, box drawing | OFL 1.1 | `departuremono.com` (self-host woff2) | 11/22 px |
| **PxPlus IBM VGA8** | DOS text mode, CP437 | CC BY-SA 4.0 | `int10h.org/oldschool-pc-fonts` | 8/16/32 px |
| **Perfect DOS VGA 437** | DOS, freeware | freeware (not OFL) | `dafont.com/perfect-dos-vga-437.font` | 16 px |
| **IBM Plex Mono** | crisp modern HUD | OFL 1.1 | `...?family=IBM+Plex+Mono:wght@400;500;600` | 12-14 px |
| **Topaz** | *the* Amiga font | © dMG / t!s^dS! — **not free** | — | avoid shipping |
| **Topaz-8 / Topaz Unicode** | reinterpretations | check repo license | `github.com/rewtnull/amigafonts`, `gitlab.com/Screwtapello/topaz-unicode` | 8/16 px |

Licensing notes:
- Google Fonts OFL: free to embed, keep the license file, don't sell the font itself.
- PxPlus / Ultimate Oldschool PC Font Pack: **CC BY-SA 4.0** — attribution required, and
  modifications of the font must stay share-alike. Embedding unmodified woff2 on a site
  is fine; the site's own code is not affected.
- Topaz is the one people ask for and the one you cannot safely ship. Use PxPlus VGA or
  Departure Mono for the same feeling, or a licensed reinterpretation.
- Shadertoy default license is **CC BY-NC-SA** (check per shader) — study, don't paste
  into a commercial site.

### Legibility rules for note names / HUD

- Minimum **8 px cap height** for note names (`C#4`, `A-3`); 6 px only for decorative.
- Monospace only. Note names must align in columns; proportional pixel fonts break the
  tracker grid.
- Avoid 5x5 fonts for `#`/`b`/`8`/`B` — ambiguous at small sizes. Verify the glyph set.
- Uppercase for labels (`BPM`, `PAT`, `CH`), mixed case only for titles.
- Functional text: pure palette white on pure black (or black on white panel), no dither
  behind it. Contrast ratio ≥ 4.5:1.
- One accent (e.g. `#FFE800`) for the *current* row/beat only. Everything else two-tone.
- Letter-spacing must be an integer number of pixels; fractional spacing destroys pixel
  fonts. `letter-spacing: 1px`, never `0.05em`.
- `font-smoothing: none` only works in Safari; elsewhere rely on integer sizes and
  `image-rendering` for canvas-baked text.
- If the HUD is DOM, put it on whole device pixels: `transform: translateZ(0)` and
  integer `top/left`; subpixel positions cause blurry stems.

---

## 5. Composition for an informative visualizer

### Principle

The screen has two languages: **the stage** (chaos, dithered, low contrast, moving) and
**the instrument panel** (static, crisp, high contrast, 1 px rules). They must never
occupy the same pixels. The panel is a frame, not an overlay.

### Layout A — stage-forward, 320x180 (recommended)

```
y   0.. 9   status bar        10 px   PAT 04 · ROW 1F · 128 BPM   |   01:23 · Cmin
y  10..129  STAGE            120 px   hero effect(s)
y 130..141  analyzer strip    12 px   waveform (6 px, mirrored) + 64 log bars
y 142..167  pattern grid      26 px   4 rows x 8 channels, 5x7 font
y 168..179  scroller          12 px   sine scroller / greetz
```

- 1 px separator lines in a dim palette color at y=9, 129, 141, 167. Never pure white.
- Channel meters: 1 px underline under each channel column in the pattern grid +
  8 vertical 8 px bars at the right end of the analyzer strip.
- Current row: invert (white bg, black text) or accent color. Only one row at a time.
- The stage gets 67% of the height and 100% of the width — chaos has room.

### Layout B — tracker-forward, 426x240

```
x   0.. 95   channel meters / mute-solo, 8 rows, 40 px each
y   0.. 11   status bar
y  12..167   STAGE (x 96..425) 330x156
y 168..227   pattern grid, 10-12 rows
y 228..239   scroller
```

Use when the pattern *is* the show (tracker visualizer). Meters at 3 px wide with 1 px
gaps, segmented every 3 px, peak-hold dot in accent.

### Where each element goes (and why)

| Element | Place | Size | Color discipline |
|---|---|---|---|
| Track title / artist | top-left, first 60% of status bar | 8 px | white |
| Time / duration | top-right | 8 px | dim |
| BPM / key / signature | status bar center-right | 8 px | dim, accent on change |
| Piano roll | bottom, above scroller | 20-32 px | 2 colors + accent playhead |
| Spectrum | analyzer strip, log-spaced | 10-12 px tall, 48-64 bars | ramp from dim to accent |
| Waveform | analyzer strip, mirrored | 6 px | one color |
| Tracker pattern | bottom block | 4-12 rows | white text, accent current row |
| Channel meters | right edge of analyzer or left column | 1-3 px | per-channel hue or mono |
| Scroller | very bottom | 10-12 px | accent + 1 px shadow |
| Scene name / "part" | top-left of stage, 2 px inset | 6 px | 40% opacity equivalent |

### Layering chaos without hiding information

1. **Contrast hierarchy, not z-order.** Stage mean luminance 15-40%; panel 90-100%.
   Pure `#FFFFFF` for ≤2% of pixels, always in the panel or the current-row highlight.
2. **One hero per 8 bars.** Crossfade heroes with the dither-morph; never run plasma +
   tunnel + terrain at full strength simultaneously.
3. **Background motion ≤ 0.5 Hz** (period ≥ 2 s). The hero can be fast; the bed cannot.
4. **Reserve one hue for "now".** If the accent appears in the scene, it stops meaning
   anything. Scene uses two hues + black/white; accent only in HUD.
5. **Dither density = depth.** More dither (denser, higher-frequency) reads as
   background; less dither and hard edges read as foreground. Use this instead of blur.
6. **Never put text on a dithered field.** If unavoidable, put a solid 1 px border +
   a 50% checker panel behind it, or a black "label tab" like a tracker UI.
7. **Beat budget:** per beat, one geometry pulse; per bar, one palette shift; per
   8/16 bars, one scene change. More than that and the info becomes unreadable.
8. **Silence is a scene.** On breakdowns, drop to starfield + scroller + HUD. The
   emptiness makes the drop land and gives the eye a rest.
9. **Sync the scroller to BPM**: `pxPerFrame = BPM/60 * 4 * dt * k` so it reads as part
   of the music rather than a marquee.
10. **Safe area:** keep functional text 4 px from buffer edges; CRT barrel/vignette will
    eat the corners.

### Audio → visual mapping (concrete)

| Feature | Drives | Range |
|---|---|---|
| bass (20-120 Hz) envelope | plasma amplitude, tunnel radius, floor scroll | 0..1, smoothed 80 ms |
| low-mid (120-500) | copper bar width/phase | 0..1 |
| mid (500-2k) | twister twist rate, rotozoom zoom | ±15% |
| high (2-8k) | star streak length, dither threshold shimmer | 0..1 |
| onset / transient | 1-frame white flash (2% alpha), star burst | impulse |
| beat phase | geometry pulse, current-row advance | quantized |
| section (8/16 bars) | palette crossfade + hero morph | discrete |
| RMS | global contrast / scanline intensity | slow |

Smooth everything except onsets. Raw FFT values make the image vibrate; a 60-120 ms
attack / 200-400 ms release envelope looks "produced".

---

## 6. References

### Demoscene archives
- pouet.net — https://www.pouet.net/
- Second Reality (Future Crew, 1993) — https://www.pouet.net/prod.php?which=63
- pouet PC demos — https://www.pouet.net/prodlist.php?platform%5B%5D=Windows
- pouet Amiga demos — https://www.pouet.net/prodlist.php?platform%5B%5D=Amiga
- Demozoo (metadata, screenshots) — https://demozoo.org/
- scene.org — https://www.scene.org/ · files — https://files.scene.org/
- Farbrausch — https://www.farbrausch.de/
- Mod Archive (tracker music) — https://modarchive.org/
- in4k wiki (4k intro techniques) — https://in4k.github.io/
- Ultimate Oldschool PC Font Pack — https://int10h.org/oldschool-pc-fonts/
- Amiga fonts (Topaz et al.) — https://github.com/rewtnull/amigafonts

### Technique references
- Lode's Computer Graphics Tutorial — https://lodev.org/cgtutor/ (plasma, tunnel, fire,
  rotozoom, dithering; the single best free reference for these effects)
  - https://lodev.org/cgtutor/plasma.html
  - https://lodev.org/cgtutor/tunnel.html
  - https://lodev.org/cgtutor/fire.html
- Ditherpunk (Surma) — https://surma.dev/things/ditherpunk/
- Ordered dithering (matrix construction) — https://en.wikipedia.org/wiki/Ordered_dithering
- Shadertoy (default license CC BY-NC-SA; check per shader) — https://www.shadertoy.com/
  Search terms: `plasma`, `tunnel`, `rotozoom`, `copper`, `bayer`, `dither`,
  `palette`, `glenz`, `starfield`, `vhs`, `crt`, `kefrens`, `twister`, `dot tunnel`,
  `mode 7`, `metaballs 2d`.
- Palette references — https://lospec.com/palette-list
  (`commodore64`, `ega`, `nintendo-gameboy-bgb`, `pico-8`, `sweetie-16`)
- Copper bar / raster bar tutorials: search `amiga copper bars tutorial`,
  `raster bars demo effect`.

### Reading the canon
Watch, in this order, for vocabulary rather than nostalgia:
1. Second Reality (1993) — scene structure, palette discipline, transitions.
2. State of the Art (Spaceballs) — vector/glenz language.
3. 9 Fingers (Spaceballs) — lighting and technical elegance.
4. Chaos Theory (Conspiracy) — design restraint.
5. fr-08: .the .product (Farbrausch) — 64k pacing, typography.
6. .kkrieger — texture/lighting at 96k.
7. Any recent 4k intro — per-pixel economy.

---

## 7. Appendix — copy-paste snippets

### GLSL Bayer 8 (procedural, no texture)

```glsl
float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
#define bayer4(a) (bayer2(0.5*(a))*0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5*(a))*0.25 + bayer2(a))
```

### GLSL quantize to N levels

```glsl
vec3 quant(vec3 c, float n, float t){
  return floor(c * (n - 1.0) + t) / (n - 1.0);
}
// 1-bit:
float on = step(bayer8(gl_FragCoord.xy), dot(c, vec3(0.299,0.587,0.114)));
```

### Palette lookup in a shader (indexed buffer)

```glsl
uniform sampler2D uPal;      // 256x1, RGBA
uniform float uPalOffset;    // cycling
vec4 pal(float idx){ return texelFetch(uPal, ivec2(int(mod(idx + uPalOffset, 256.0)), 0), 0); }
```

### Canvas2D feedback

```js
// two offscreen canvases, ping-pong
ctx.globalCompositeOperation = 'source-over';
ctx.globalAlpha = 0.9;
ctx.drawImage(prev, 1, 0);          // slight offset = trail smear
ctx.globalAlpha = 1;
ctx.globalCompositeOperation = 'lighter';
drawScene(ctx);
// swap prev/ctx, then blit prev to the visible canvas
```

### Dither morph

```js
const t = bayer4[x & 3][y & 3] / 16;
const useB = (t + (progress - 0.5) * 2) < field[x + y * w];
out = useB ? B : A;
```

### CSS for the pixel canvas

```css
.scene {
  width: 320px; height: 180px;         /* overridden by JS in device px */
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  display: block;
}
.stage { display:flex; align-items:center; justify-content:center; background:#000; }
.hud   { position:absolute; inset:0; pointer-events:none; }
```
