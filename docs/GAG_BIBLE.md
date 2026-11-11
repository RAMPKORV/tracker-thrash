# THE GAG BIBLE
### A procedural YTP comedy engine for a tracker-music visualizer
*41 bits · 12 cursed characters · 170+ lines · one theory of synchronized stupidity*

---

## 0. The design thesis

**The visualizer is the straight man. The music is the clock. The gags are uninvited guests who think they work here.**

Everything below follows from that:

- The normal visualizer must be genuinely good-looking and calm. A joke only reads if there is a "normal" to violate.
- Every gag is triggered by a musical event and measured in **beats and bars**, never in seconds. The music is the setup and the punchline.
- Recurring characters beat one-off randomness. A running gag is a promise; the payoff is the audience feeling smart.
- The drop is sacred. Either clear the frame one beat before it, or make the gag *be* the drop. Never cover the actual musical payoff with a dialog box.
- Default is flash-safe and family-friendly. Chaos is a slider, not a personality.
- Everything is drawn from primitives, text, and generated noise. No copyrighted sprites, logos, samples, or "remember this exact frame?" references.

Classic YTP gets its energy from familiar footage being re-cut. With no borrowed footage, the "source material" is the visualizer itself: its UI, its characters, its own earlier jokes. The edit is the genre.

**Ranking key:** Ranked by signature value, sync payoff, and laugh-per-effort. **S** = signature identity gag, build the app around it. **A** = reliable workhorse. **B** = spice, rare, or meta. Everything is procedural; the expensive part is polish, not assets.

---

## 1. Event vocabulary

The gag director subscribes to these. A tracker already knows most of them; the rest are cheap analysis.

| Event | Fires when | Best comic use |
|---|---|---|
| `KICK` | kick drum | physical pumps, stamps, breathing, charts |
| `SNARE` | snare / rim | flinches, dialogs, printers, POV violence |
| `HAT` | closed hat | googly eyes, subliminals, tiny movements |
| `BASS` | bass note / sub energy | fog growth, cheek inflation, screen pulse |
| `LEAD` | lead note, with pitch | orb tracking, karaoke, ghost notes |
| `CHORD` | chord change | style takeover, courtroom, color shift |
| `SOLO` | channel solo / mute | spotlight, plugin window, rat scratch |
| `DROP` | section drop | the biggest gags; clear the frame |
| `BREAKDOWN` | low-energy section | waiting room, tutorials, ads, mom |
| `SILENCE` | no events for > 1 bar | DVD logo, EBS, STAPLEY, awkward chat |
| `PATTERN_JUMP` | order-list jump | elevator, channel surf |
| `BPM_CHANGE` | tempo change | speedometer, car falling apart |
| `CLIP` | limiter / clipping | "this is fine" room |
| `DENSITY` | note-density spike | CPU panic, printer jam |
| `END` | song end | credits, post-credits stinger |

**Gag director rules**

- Priority: `0` ambient, `1` text, `2` character, `3` full-screen.
- Budget: max one full-screen gag per 8 bars; max one text gag per 2 bars.
- No full-screen gag in the bar before a drop unless the gag *is* the drop.
- One character speaks at a time. Two simultaneous speech bubbles is visual noise, not comedy.
- Seed all randomness from song + bar + gag ID. A song should produce the same jokes on every play, so callbacks and testing work.
- Every runner has a level `0–3`. Repeat appearances escalate one variable at a time. Reset per song.
- If two gags collide, higher priority wins; the loser gets a consolation micro-expression (a blink, a tiny "ok").

---

# 2. The 41 gags, ranked

## S-tier — the identity gags

### 01. THE FOG METER
**Looks:** A tiny weather widget in the corner: `FOG: 12%`. Behind the UI, a dithered gray-blue mass slowly grows. At 60%, small text whispers `the fog is coming`. At 100%, the entire screen is fog with two tiny eyes and one line: `the fog is here.` The next drop clears it.
**Trigger:** Continuous. Fog level integrates bass/sub energy, rate-limited to ~2% per bar so it peaks near the finale; gains faster during silence; drops 30% on a drop.
**Build:** One 320×180 1-bit noise texture, scrolled in two layers at different speeds; alpha = level; irregular edge made of overlapping circles; whisper text at thresholds. One `drawImage` per frame, no per-pixel work.
**Why:** Slow-burn dread inside a dance track. The audience learns the meter, starts anticipating it, and the eventual whiteout is a screen-wide callback. It is a meme format that becomes a structural device.

### 02. DJ RAT SCRATCHES THE TIMELINE
**Looks:** A scruffy rat in headphones climbs onto the playhead, grabs the waveform like a vinyl record, and scratches. The whole visualizer wobbles, notes reverse, a `REWIND` stencil stamps the screen. On release, everything springs back with overshoot. A scratch mark stays on the timeline for the rest of the song.
**Trigger:** Snare roll (6+ snares in 2 beats) or channel solo.
**Build:** Cache a 3-frame rat (idle, grab, yank). Draw two turntable circles; offset the entire scene's x-position with a damped sine; motion lines; on release, a spring ease. Visual-only: never seek or pause the audio clock. The scratch mark is a persistent decal.
**Why:** Physical comedy plus a tracker-specific idea: the song is a toy and the rat is a bad DJ. The persistent scratch mark is the callback.

### 03. CASCADE OF "ARE YOU SURE?" DIALOGS
**Looks:** Beveled gray dialogs spawn on every snare, cascading across the screen. Titles escalate: `Delete kick?` → `Delete all kicks?` → `Delete the concept of rhythm?` On the drop, all close except one: `Are you sure you want to funk? [Yes] [Yes]`.
**Trigger:** Snare roll into drop.
**Build:** Cache one dialog at three sizes. Spawn at seeded positions with an 8px cascade; dim the background; cap at 24; close with scale-to-zero. The final dialog holds for two beats.
**Why:** Software panic is the opposite of cool. The buttons are useless, the questions are threats, and the last one is a perfect anti-joke.

### 04. THE ORB EATS THE MELODY
**Looks:** A gradient orb with googly eyes floats along the lead line. It inhales and grows on high notes; on the drop it opens a huge mouth, screams a beam, then blushes and looks away.
**Trigger:** Lead/high notes; drop.
**Build:** Radial gradient circle; eye whites and pupils track the lead pitch; mouth is a scaled path; `easeOutBack` on inhale; beam is an additive triangle; two blush circles for the shame frame.
**Why:** Cute plus ominous. Because it visibly reacts to the melody, the audience projects intent onto it. The drop scream is a release, and the blush makes it a character rather than an effect.

### 05. "NOW PLAYING" ABSURD LOWER THIRD
**Looks:** A broadcast chyron slides in: `NOW PLAYING: 3 A.M. at the Airport Food Court (Extended Mix)`. It stays two bars too long, then gets yanked off with a wobble.
**Trigger:** Pattern change or every 8 bars. Title seeded from the song + bar.
**Build:** Rounded rect, accent bar, typewriter text, slide-in with overshoot, two-bar hold, yank exit. Cache the text layout.
**Why:** Format parody: the title is the punchline. Repetition turns it into the app's running frame, and the occasional perfect title gets screenshotted.

### 06. DVD LOGO SCREENSAVER
**Looks:** On a long silence, the visualizer cuts to black. A rectangle with the word `VISUALIZER` bounces around. It narrowly misses the corner. On the drop, it hits the corner exactly and explodes into confetti.
**Trigger:** Silence > 2 bars; drop.
**Build:** AABB collision, velocity, trail. Script the corner hit if the drop is within one bar; otherwise near-miss. Particle burst; return to the visualizer.
**Why:** A universal 90s memory. The near-miss creates real suspense; the corner hit is a perfect payoff. It is also the cleanest "silence is a setup" gag in the book.

### 07. BSOD AT THE DROP
**Looks:** Full-screen blue. `TRACKER OS has detected a vibe and must restart.` STOP code `0x0000BASS`. A progress bar crawls. On the drop, `rebooting...` and the visualizer returns.
**Trigger:** Drop. Once per song; cooldown 999 bars.
**Build:** Full-screen fill, monospace text, fake memory dump as random hex, progress bar. No real OS logo or trade dress; call it `TRACKER OS`.
**Why:** The ultimate anti-hype. The computer cannot handle the music. Rarity makes it an event; using it every drop would be annoying.

### 08. AIRHORN ORCHESTRA
**Looks:** Procedurally drawn airhorns (cone, handle, bulb) pop up from the bottom. One on an offbeat snare. Three during the build. Eight on the drop, fanned out like a brass section. Text: `BWAAAH`.
**Trigger:** Snare/offbeat; build; drop.
**Build:** Cache one horn sprite; spawn with squash; rotate toward center; cluster; 2px screen shake. If the app has audio, a synthesized airhorn is optional; never bundle a sample.
**Why:** The most annoying sound in EDM, visualized. Escalation from one to eight is the joke. The drop becomes a wall of horns, which is both a celebration and a threat.

### 09. "GRAPHIC DESIGN IS MY PASSION" TAKEOVER
**Looks:** On a chord change, the sleek UI degrades: rainbow gradient background, WordArt arc, clip-art stars, comic sans, aggressive drop shadows, a spinning 3D word (`PASSION`) that is definitely not 3D, and a fake portfolio frame. It snaps back after eight bars.
**Trigger:** Chord change. 8-bar cooldown.
**Build:** A stack of style layers; gradient fill; per-letter rotation and color; star polygons; cache the static layers. Fake 3D with layered copies and a rotating horizontal scale; no WebGL. Use a bundled OFL comic-style font or a hand-drawn text fallback, not a system font you cannot ship. Limit to eight bars so it stays a joke, not a redesign.
**Why:** Every musician has made this flyer. The contrast with the normal visualizer is the joke, and the specificity ("portfolio") makes it self-deprecating rather than random.

### 10. UNCLE TRACKER EXPLAINS IT WRONG
**Looks:** An old man with tracker rows scrolling across his glasses. A speech bubble: `Now watch closely: this is called a breakdown.` A tooltip arrow points at the wrong part of the UI. He is cut off by the drop.
**Trigger:** Breakdown.
**Build:** Simple sprite (oval head, glasses, cardigan, floppy disk pocket watch); speech bubble with typewriter; arrow; bubble pops on drop; four-bar max.
**Why:** Mansplaining the obvious, with total confidence. The tutorial is wrong, the arrow is wrong, and the drop hangs up on him. Warm boomer energy, not cruelty.

---

## A-tier — the workhorses

### 11. BUSINESS DOG'S KPI DROP
**Looks:** A beige dog in a tiny tie holds a clicker. A slide reads `SYNERGY`. A bar chart grows on every kick. On the drop, the line goes vertical off the top of the screen. The dog, dead-eyed: `numbers.`
**Trigger:** Four-on-floor kick pattern; chord change.
**Build:** Chart axes, bars, line path, slide card, dog sprite (capsule body, circle head, tie, clipboard). Flip slides on chords; clip the vertical line.
**Why:** Corporate Memphis gone wrong. Treating music as quarterly earnings is absurd, and the single word "numbers" is the button. It also makes the kick pattern legible.

### 12. SNARE-RUSH DOT-MATRIX PRINTER
**Looks:** A dot-matrix printer spits out a sheet. Every snare prints one line of tracker pattern data. On the drop, the paper jams and accordions into a zigzag. A tiny caption: `PC LOAD SNARE`.
**Trigger:** Snare roll.
**Build:** Paper rectangle grows per hit; tiny monospace rows; tractor-feed holes; jam as a zigzag path; cache the text strip.
**Why:** Obsolete-tech panic. The snare roll becomes a physical object, and the jam is the punchline. Musicians know the printer energy.

### 13. BUILD-UP CONSTRUCTION SITE → DROP ROLLERCOASTER
**Looks:** During the build: scaffolding, `UNDER CONSTRUCTION`, a worker with a hard hat. On the drop: a rollercoaster car climbs and falls, a hat flies off, impact confetti.
**Trigger:** Build section; drop.
**Build:** Two-phase state machine. Bezier track, cart sprite, parallax, shake, particles. The hat is a separate physics-lite object.
**Why:** Literalizes musical tension and release. The hat is the comedy button; the drop is the physical payoff.

### 14. "THIS IS FINE" CLIPPING ROOM
**Looks:** A corner room with a desk, a stick figure, and cartoon flames. Caption: `this is fine.` Only appears when the limiter is working overtime.
**Trigger:** `CLIP` or sustained dissonance.
**Build:** Room primitives; flame triangles with noise-based flicker; 4-bar limit. Cute flames, no gore.
**Why:** Anyone who has blown out a mix recognizes it. Understatement is the joke; the flames are decorative, not violent.

### 15. BREAKDOWN WAITING ROOM
**Looks:** Beige waiting room, plastic chairs, a fish tank, a `NOW SERVING: 004` sign. Muzak. On the drop, the door kicks open.
**Trigger:** Breakdown or silence.
**Build:** One-point perspective floor, chairs, tank with bubbles synced to hats, sign, door, light change. The door kick is the only fast motion.
**Why:** The breakdown is literally a waiting room. The drop is the appointment. Perfect anti-climax architecture.

### 16. FAKE PLUGIN "KNOB" + KNOB GOBLIN
**Looks:** A VST-style window with one giant knob labeled `MORE`. Preset dropdown: `Init`, `Init (copy)`, `Actually Good`, `my_final_master_v7_FINAL`. A green goblin turns the knob. On the drop, the knob snaps off; `oops.`
**Trigger:** Channel solo; filter sweep; drop.
**Build:** Window chrome, knob arc, pointer, preset list, goblin sprite (blob, one eye, ears, tiny hands), particle "oops."
**Why:** Plugin culture in one knob. The goblin is chaos with a face. The preset names are the musician in-joke; the knob snapping off is the universal punchline.

### 17. CHAT IS THIS REAL
**Looks:** A fake chat column on the right. Messages react to events: `W`, `he just like me fr`, `the fog is coming`, `not the snare rush`. On the drop, the chat floods. On silence, one message: `hello?`
**Trigger:** All events; drop; silence.
**Build:** Message queue, word wrap, fade, scroll, cap 12. Seeded usernames and avatars (colored circles). No real platform branding.
**Why:** Parasocial commentary as a Greek chorus. The flood is the hype; the lonely `hello?` is the anti-joke.

### 18. EMERGENCY FOG ALERT / EBS
**Looks:** Color bars, a scrolling ticker: `THE FOG IS COMING. THIS IS NOT A DRILL. (IT IS A DRILL. THE FOG IS COMING.)` A calm voice in text: `this is a test.` On the drop: `the fog is here.` Clear.
**Trigger:** Silence/breakdown; fog level > 60%.
**Build:** Color bars, scanline overlay, ticker, monospace text, no flashing. Four bars max.
**Why:** Emergency-broadcast aesthetics applied to a weather joke. The fake seriousness is funny, and it ties the fog runner to a format.

### 19. WHOLESOME SUBLIMINAL MESSAGES
**Looks:** One- or two-frame low-opacity text: `DRINK WATER`, `CALL YOUR MOM`, `YOU ARE NOT IMMUNE TO PROPAGANDA`, `THE ORB IS WATCHING`. No strobe.
**Trigger:** Hats/offbeats. Max one per two bars.
**Build:** Queue, 120ms max, 12% opacity, slight positional offset, log for reduced-motion users. Use a fade, not a hard flash.
**Why:** The subliminal message is good advice. Benign conspiracy is a reliable joke, and the low opacity keeps it legal and comfortable.

### 20. CURSOR DUEL / DELETE THE BACKGROUND
**Looks:** An arrow cursor and an I-beam duel. Click ripples. They drag a selection box around the entire visualizer. On the drop, `Delete` reveals a fake desktop; then `Undo` restores everything.
**Trigger:** Snare; drop.
**Build:** Cursor sprites, bezier paths, click ripples, selection rectangle, checkerboard desktop, restore flash (non-strobing).
**Why:** UI violence. The visualizer is a program, and the cursor is a gremlin. The fake desktop makes the whole app feel like a window that can be messed with.

### 21. PATTERN-JUMP ELEVATOR
**Looks:** Elevator doors close. A floor indicator ticks. `Ding` on arrival. A backward jump: `going down.` The doors open onto the new pattern.
**Trigger:** `PATTERN_JUMP`.
**Build:** Two door rectangles, ease, indicator, tiny muzak caption, light spill. The ding is scheduled to the jump.
**Why:** Tracker pattern jumps as floors is a perfect metaphor. The ding is a free sync point, and "going down" is a reliable laugh.

### 22. UNDERWATER LOW-PASS / DESERT HIGH-PASS
**Looks:** Low-pass: blue grade, bubbles, fish, `blub`. High-pass: beige grade, tumbleweed, `dry`. The transition follows the filter cutoff.
**Trigger:** Filter sweep.
**Build:** Color overlay, bubble particles, simple fish, tumbleweed, text. No per-frame blur; fake depth with parallax and tint.
**Why:** Synesthesia: the mix moves the world. The paired opposites set up a callback, and "dry" is funnier than a complicated desert scene.

### 23. SIDECHAIN LUNG
**Looks:** A pair of lungs (or a bellows) in the corner pumps with every kick. A meter reads `BREATHING: YES`. On the drop, hyperventilation.
**Trigger:** Kick; drop.
**Build:** Two ellipses, scale, tube, meter, 2-frame shake. Cap the rate so it never becomes a strobe.
**Why:** The kick is literally breathing. It is a producer in-joke that also reads as a weird little creature. The hyperventilation is the escalation.

### 24. REVERB GHOST NOTES
**Looks:** Note sprites become ghosts with tails, floating up and whispering `hello?`. In a dry section, they fall.
**Trigger:** Long reverb tail / high note; dry section.
**Build:** Note glyphs, alpha decay, sine float, ghost eyes, particle cap. Recycle sprites.
**Why:** Reverb as haunted space. The ghosts are cute, and the lonely `hello?` gives the effect a personality.

### 25. DELAY ECHO TEXT
**Looks:** A word repeats with decreasing size and opacity: `wait... wait... wait... wai... wa... w`. The last echo is `help`.
**Trigger:** Delay/echo notes; snare.
**Build:** Ring buffer of text events, offset, scale, alpha, truncate; max six echoes. Use the actual delay time if available.
**Why:** Audio delay made visible. The truncation is the joke; `help` is the button.

### 26. FOUR-CHORDS COURTROOM
**Looks:** A judge, a gavel, a piano. On the fourth loop of I–V–vi–IV: `ORDER! ORDER!` The gavel slams on the downbeat. The jury holds up a card: `4`.
**Trigger:** Chord-loop detection.
**Build:** Courtroom primitives, gavel, piano keys, speech bubble, impact lines. Detect the loop from the chord sequence; trigger on the fourth repetition.
**Why:** Music-theory crime. Everyone is guilty. The jury is unimpressed. It is affectionate, not snobby.

### 27. JAZZ CHORD DETECTIVE
**Looks:** Noir room. A detective in a fedora points at a chord: `Where were you on the night of the bridge?` The chord label floats in a spotlight. Smoke curls.
**Trigger:** Jazz chord (7th/9th/11th); bridge section.
**Build:** Spotlight, silhouette, chord label, smoke curls, typewriter text. One scene, three beats.
**Why:** Jazz as a suspect. Theory nerds get it; everyone else gets a noir sketch. The chord is innocent.

### 28. THE LITERAL DROP
**Looks:** A single droplet falls from the top of the screen, hits the playhead, and splashes. Label: `the drop`. If the drop is huge, the droplet is tiny and says `ok`. If the drop is small, the splash is enormous.
**Trigger:** Drop.
**Build:** Teardrop path, gravity, splash particles, label. Invert the expected size.
**Why:** Literalism, plus anti-climax or escalation. One of the purest gags in the book because it needs no characters.

### 29. "ARE YOU STILL WATCHING?" RECAP
**Looks:** At the five-minute mark, a streaming-style prompt: `Are you still watching?` A `Continue` button. If idle, a three-clip recap of earlier gags: `previously on...`
**Trigger:** Time > 5 minutes / idle.
**Build:** Overlay, button, montage of cached gag snapshots, timer, return. Cache one frame per major gag.
**Why:** Breaks the fourth wall exactly when attention dips. The recap rewards watching and turns the app's own history into a callback.

### 30. LOADING BAR STUCK AT 99%
**Looks:** During a breakdown, a progress bar crawls to 99% and holds. On the drop, it resets to 0%. At song end, it reaches 100%, then `installing updates`.
**Trigger:** Breakdown; drop; end.
**Build:** Bar, percentage, spinner, hold, reset, final update screen. The percentage can be fake-random but deterministic.
**Why:** Universal tech frustration. The drop as a failed download, and the end as a new beginning. The final "installing updates" is the post-credits button.

### 31. UNSKIPPABLE FAKE SPONSOR
**Looks:** A full-screen ad card with an `AD` badge and a countdown. A skip button dodges the cursor. On the drop, the ad ends.
**Trigger:** Breakdown. Eight-bar maximum.
**Build:** Card, countdown, flee behavior for the button, fake product, no real brand. The button should be catchable after two attempts so it stays playful.
**Why:** Ad culture. The skip button is a tease; the drop is the rescue. Keep it short or it becomes the thing it parodies.

### 32. MISHEARD LYRICS KARAOKE
**Looks:** A bottom karaoke bar. Words highlight on lead notes. The lyrics are absurd: `I left my keys in the fridge again`. On a high note, a word stretches. On the drop: `DROP`.
**Trigger:** Lead notes; high note; drop.
**Build:** Word timings, highlight, bounce, pitch-based scale. No copyrighted lyrics. Use a syllable-splitting approximation.
**Why:** The brain tries to sing along. The wrongness is funny, and the sync makes it feel intentional rather than random.

### 33. TRACKER MOM CHECKS IN
**Looks:** A door frame. Mom in a bathrobe with a mug: `Are you winning, son?` On the drop, the door slams. On silence: `I'm not paying for this.`
**Trigger:** Breakdown; drop; silence.
**Build:** Door, mom sprite (robe, slippers, mug), speech bubble, hallway light, slam. Two frames of expression.
**Why:** A universal mom moment. The drop is embarrassing; the silence is worse. Warm running character, not a caricature.

### 34. HR / COMPLIANCE
**Looks:** A gray suit with a clipboard and a smiley-face mask steps in front of the screen: `We've received a complaint about the fog.` HR lowers the chaos slider, nods, and leaves.
**Trigger:** Chaos > 80, flash violation, or user moves the slider.
**Build:** Silhouette, clipboard, screen dim, slider animation, exit. The smiley mask never changes.
**Why:** Moderation as a character. It is self-aware, gives the app a safety valve, and makes "SERIOUS MODE" funny instead of punitive.

### 35. BASS-BOOSTED TEXT
**Looks:** On a bass note, a word slams into the center: `BASS`. It punches up in scale, splits into red/cyan offsets, and shakes the frame. A tiny disclaimer at the bottom: `this is a subwoofer test.` On the sub drop, the letters stack into `B A S S`, then collapse into a single pixel.
**Trigger:** Bass note / sub drop.
**Build:** Cache the text layout; scale with `easeOutBack`; two tinted copies for chromatic aberration; 2–4px shake; stacked letters; collapse to one pixel. No strobe; the punch is scale, not brightness.
**Why:** The visual equivalent of "louder = funnier." The deadpan disclaimer is the button. It is cheap, high-impact, and works on any track with low end.

### 36. BPM SPEEDOMETER
**Looks:** A car dashboard. The speedometer needle is the BPM. At 200 BPM, parts rattle off. On the drop, a spoiler deploys.
**Trigger:** `BPM_CHANGE`.
**Build:** Gauge arc, needle, dashboard, bolts, particles, speed lines. Map BPM to a readable range, not a literal 1:1.
**Why:** Tempo as speed. The car is the song. Mechanical comedy with a clean visual metaphor.

### 37. STAPLEY THE ASSISTANT
**Looks:** An original bent-staple character with eyes: `It looks like you're making a banger. Would you like help?` Buttons: `[Yes] [Also Yes]`. On the drop, it clips itself to the drop.
**Trigger:** Silence/idle; drop.
**Build:** Wire shape, eyes, speech bubble, buttons, clip animation. Original character; do not draw a paperclip with a face.
**Why:** 90s assistant parody without the copyrighted paperclip. Helpful, useless, and weirdly earnest.

### 38. 404: MELODY NOT FOUND
**Looks:** A browser error page. A sad server with eyes: `The melody you are looking for has been moved.` Buttons: `[Retry] [Cry]`. Retry produces a kazoo note.
**Trigger:** Missing lead / empty channel.
**Build:** Browser chrome, monospace text, sad server face, button, kazoo text. One bar of silence before the page appears.
**Why:** The error page is the breakdown. The missing element is the joke; the kazoo is the pathetic consolation.

### 39. VHS TRACKING ERROR
**Looks:** On a pattern jump or BPM change, the screen warps: tracking lines roll, colors separate, a timecode reads `PLAY ▶ SP 0:03:14`, and a date reads `JAN 01 1996`. A hand-drawn hand reaches in and adjusts a tracking knob. The image snaps clean on the next downbeat.
**Trigger:** `PATTERN_JUMP` / `BPM_CHANGE`.
**Build:** Low-res offscreen buffer; horizontal row displacement with a sine; RGB offset copies; scanlines; timecode text; a simple hand sprite. No brightness strobe; the snap is a hard cut, not a flash.
**Why:** VHS is a period joke and a transition at the same time. The hand adjusting tracking is the physical comedy; the snap disguises a hard visual cut.

### 40. CHANNEL SURF ON PATTERN JUMP
**Looks:** TV static. Three fake channels: weather, golf, cooking. One bar each. Then `we now return you to the visualizer.`
**Trigger:** `PATTERN_JUMP`.
**Build:** Static noise, channel cards, scanlines, remote, hard cuts on bars. Rotate with the VHS tracking error; never both on the same jump.
**Why:** A pattern jump is a channel change. Each channel is a mini-genre parody, and the quick cuts feel like flipping through cable at 2 a.m.

### 41. END CREDITS + POST-CREDITS ORB
**Looks:** Credits roll: `STARRING: THE ORB`, `KEY GRIP: DJ RAT`, `CATERING: ONE GRAPE`. Post-credits: the Orb in a tiny hat. `THE ORB WILL RETURN.`
**Trigger:** `END`.
**Build:** Scrolling text, starfield, credit card, post-credits stinger, fade. Reuse character sprites.
**Why:** Rewards watching to the end, wraps the runners, and turns the app into a "movie." The tiny hat is the button.

---

# 3. Timing and comedy theory for audio-synced jokes

## 3.1 The beat is the straight man

Music creates prediction. A joke creates a violation of prediction. That is why a gag landing on the downbeat feels *written* and a gag landing randomly feels like a bug.

- **Normal visualizer = setup.** The longer the straight face, the funnier the intrusion.
- **Musical event = punchline.** The event is the permission slip. Don't trigger a snare gag on a kick.
- **Bar = sentence.** Four beats is a clause; eight is a sentence; sixteen is a paragraph. A dialog needs two bars. A text pop needs one beat. A runner needs 8–16 bars to breathe.
- **Downbeat = authority.** Start and end gags on downbeats. Syncopate the middle if you want mischief.
- **The pause before = free laugh.** One beat of clean visualizer before a big gag makes it land harder. Do not fill every gap.

## 3.2 Quantization: why bars make jokes funnier

A joke has a setup, a turn, and a button. A bar has the same shape: beat 1 establishes, beats 2–3 develop, beat 4 resolves. Quantizing gags to bars does three things:

1. **It hides the seams.** The audience reads the gag as part of the music, not as a random overlay.
2. **It creates anticipation.** If the fog meter hits 99% on the last beat of a bar, the audience expects the drop. The expectation is the setup.
3. **It makes repetition musical.** The rule of three works better when the three hits are on the same beat of three consecutive bars. The brain locks the pattern and then enjoys the break.

**Practical timing rules**

- Impacts on the exact beat; wind-ups one eighth-note early; holds two to four beats.
- Text needs **4–8 beats** to read. Never flash a paragraph for one beat.
- Dialogs need **2 bars** minimum. A one-bar dialog is a punchline without a setup.
- Big scene changes on bar lines, not mid-phrase.
- If a gag is still funny, hold it one more bar; if not, cut on the next bar. Never let a dead gag linger because the animation is pretty.
- Schedule from the audio clock, not `setTimeout`. Render one frame early; test with Bluetooth latency and offer a calibration offset.

## 3.3 The rule of three, escalation, anti-climax

**Rule of three:** First appearance establishes. Second confirms the pattern. Third breaks it. After the third, retire the bit or promote it to a runner.

Example, airhorns:
1. One airhorn on an offbeat. Small. Funny because it's rude.
2. Three airhorns during the build. The pattern is confirmed.
3. Eight airhorns on the drop, then total silence. The break is the punchline.
4. Later, a single tiny airhorn in the credits. Callback.

**Escalation:** Change one variable at a time. Size, count, duration, who does it, or meta-level. If you change all five, it reads as noise.

**Anti-climax:** Only works if you built real tension. The literal drop is the purest: a huge build, then a single droplet and `ok`. Use it once every two minutes at most. Anti-climaxing the actual drop repeatedly trains the audience that the music doesn't matter, which kills the show.

**The sacred drop:** Either clear the frame one beat before the drop, or make the gag the drop. Never cover the drop with a dialog, an ad, or a character monologue. The drop is the reason people are watching.

## 3.4 Callbacks and running characters

A callback is a joke the audience finishes for you. It requires three things: a clear setup, enough time, and a changed context.

- **Setup early, payoff late.** The fog meter appears at 0:15; the whiteout happens at 3:45. The Orb appears in the intro; it screams the drop and blushes at 4:10.
- **Change the context, not the joke.** DJ Rat scratches the timeline at 1:20. At 4:20 he scratches it again, but now the whole UI is fog and he is scratching fog. Same bit, new meaning.
- **Make it explicit once.** The "previously on" recap at 5:00 is a callback delivery system. It also helps people who joined late.
- **Retire or transform.** A bit repeated ten times is a character; a bit repeated twenty times is a tic. Promote it, mutate it, or let it end.

## 3.5 The mascot reacts to the music

The mascot is the audience's emotional avatar. It gives the music a face and gives the visuals a through-line.

- Assign each character a **home instrument**. DJ Rat = master/transport. The Orb = lead. Sad Wizard = reverb/lead. Business Dog = chords/stabs. Uncle Tracker = pattern data. The Fog = sub/bass. Intern.exe = UI.
- Establish a **contract**: when the bass hits, DJ Rat's cheeks puff. When the lead goes high, the Orb inhales. The audience learns the language in 30 seconds.
- **Break the contract once** for a laugh. The bass hits and DJ Rat does nothing; he's on his phone. The Orb inhales and nothing happens; it looks at the camera.
- The mascot should **want something**. DJ Rat wants to be cool. The Orb wants to be perceived. Sad Wizard wants the drop to work. Business Dog wants a promotion. Want creates stakes, even in a 5-minute visualizer.

## 3.6 Why random is boring

Randomness has no setup, no callback, and no stakes. It feels like a slot machine, not a joke. The fix is not "less chaos"; it is **curated chaos**:

- Use a **curated pool** per event, not a uniform random choice.
- **Context rules**: dialogs only on snare rolls; fog only on bass/silence; courtroom only on chord loops.
- **Cooldowns**: no repeat within 16 bars unless it is an intentional callback.
- **A bit ledger**: track last seen, count, and escalation level. The director should know it already did the printer twice.
- **Deterministic seed**: same song, same jokes. This makes the app testable and makes callbacks reliable.
- **One new thing at a time.** In a 16-bar window, introduce at most one new gag; the rest are variations or reactions.

## 3.7 The five-minute set

A 5-minute visualizer is a short film, not a screensaver. Structure it like a set:

| Time | Section | What happens |
|---|---|---|
| 0:00–0:25 | Cold open | Lower third with an absurd title. Fog meter starts at 4%. The Orb drifts in. |
| 0:25–1:10 | Establish | DJ Rat appears. First snare roll triggers one dialog. Characters establish their contracts. |
| 1:10–1:50 | First escalation | Airhorn orchestra (one → three). Graphic-design takeover on a chord change. |
| 1:50–2:30 | Breather | Breakdown waiting room. Uncle Tracker explains it wrong. Mom checks in. |
| 2:30–3:00 | Build | Construction site. Printer prints the snare rush. Fog meter climbs. |
| 3:00–3:20 | Drop | Clear the frame. Orb screams. BSOD once per song. Fog clears. |
| 3:20–4:05 | Act two | Chat flood. Plugin goblin. Four-chords courtroom. Escalate a runner. |
| 4:05–4:35 | Meta | "Are you still watching?" recap. HR appears if chaos is high. |
| 4:35–5:00 | Finale | Fog hits 100%. DVD corner hit. Credits. Post-credits Orb. |

If the song is shorter, compress by section, not by clock: cold open on intro, establish on first verse, escalate on first build, breathe on breakdown, pay off on drop, callback on outro. If the song is longer, loop the structure with new variations and let the runners age.

**Joke-density curve:** roughly 20% at the start, 60% at the first escalation, 30% during the breakdown, 80% at the drop, 50% in act two, 100% in the finale, 0% after the button. The quiet parts are not filler; they are the setup for the loud parts.

## 3.8 Readability is comedy

- Max **3–7 words** per card. If it can't be read, it isn't a joke.
- One idea per gag. A dialog with a funny title and funny body text and funny buttons is three jokes fighting.
- High contrast; avoid thin fonts over busy visuals; use a solid plate or stroke.
- Don't put text over the lead melody's main visual. Peripheral gags are funnier when the center is clean.
- If the gag requires a hover, a click, or a pause to understand, it is not a visualizer gag; it is an interaction. Save it for a "gag lab."

---

# 4. The cast

All characters are drawable with circles, capsules, triangles, and text. No assets, no copyright, no "remember this guy?" recognition required. The goal is **cursed but lovable**: weird enough to be a meme, specific enough to be a character.

**Reaction matrix**

| Character | Kick | Snare | Bass / Lead | Drop | Silence |
|---|---|---|---|---|---|
| DJ Rat | head-bob | scratch flinch | cheeks puff / ears perk | crowd-surf | `huh?`, chews cable |
| Sad Wizard | tiny nod | hat over eyes | robe vibrates / sparkle-fall | spell fizzles, `sorry` | `I cast silence.` |
| The Orb | pulse | blink | deepens / inhales | scream beam, blush | whispers fog |
| Business Dog | stamps `APPROVED` | checks box | adjusts tie / confused | `numbers.` | `Let's circle back.` |
| Uncle Tracker | taps foot | wakes | `one channel` / squints | `we didn't have those` | falls asleep |
| The Fog | pulse | ripples | grows / thins | clears | grows, whispers |
| Intern.exe | stamps form | spills coffee | holds desk / looks up | hides | checks phone |
| Caption Pigeon | bobs | drops sign late | puffs / tilts | sign says `W` | sign says `hello?` |
| Knob Goblin | head-bangs | hides | turns knob / covers ears | snaps knob, `oops` | `more.` |
| Tracker Mom | sips | flinches | `that loud?` / `nice, honey` | door slam | `I'm not paying for this.` |
| HR | taps clipboard | writes note | lowers sub / tilts head | leaves | `complaint about the fog` |
| MIDI Frog | throat puff | tongue catches note | belly / misses | eats drop, `sorry` | stares |

## 4.1 DJ RAT
**Draw:** bean-shaped gray body, pink inner ears, buck teeth, oversized headphones, one gold chain, thin tail. Three frames: idle bob, grab, yank. Scribbly outline.
**Home:** master channel / transport bar.
**Personality:** Delusional confidence. Every transition was intentional. Never actually mixes. Wants to be taken seriously.
**Reactions:** Kick = head-bob, ears flap. Snare = flinch into a scratch. Bass = cheeks inflate. High note = ears perk, stands up. Chord = tilts head. Drop = crowd-surfs the waveform. Silence = `huh?`, chews the aux cable, caption `crunch`. Solo = grabs the spotlight.
**Running bit:** Steals the hi-hat. By 3:00 there is a pile of stolen hi-hats in his corner. At the end he returns them; one is missing.
**Catchphrase:** `Trust me, I'm a DJ.` / `That was on purpose.`

## 4.2 SAD WIZARD
**Draw:** small droopy blue robe, hat two sizes too big, thin beard, aux-cable staff. Eyes always wet. Two frames: droop, hopeful lift.
**Home:** reverb / lead channel.
**Personality:** Polite, melancholy, sincere. His magic is real but useless. He studied for this.
**Reactions:** Kick = a tiny nod. Snare = flinch, hat falls over eyes. Bass = robe vibrates. High note = hat lifts, eyes sparkle, then it falls. Minor chord = single tear. Drop = casts a spell; it produces a puff of smoke and a `sorry` caption. Silence = `I cast silence.` (beat) `It worked.` Solo = tries to summon a choir; gets one coughing ghost.
**Running bit:** Tries to summon the drop at 1:30; summons a single snare instead. At the real drop, he is not ready.
**Catchphrase:** `I studied for this.`

## 4.3 THE ORB
**Draw:** perfect circle with a radial gradient, two googly eyes, no mouth until it screams, optional tiny stick arms. Color lerps with the current chord.
**Home:** lead / melody; floats along the pitch contour.
**Personality:** Ancient, ominous, needy. Wants to be perceived. Pretends not to care.
**Reactions:** Kick = pulse. Snare = blink. Bass = deepens color, vibrates. High note = inhales and grows, eyes widen. Chord = color lerp; eyes look toward the chord. Drop = giant mouth, scream beam, then blush. Silence = whispers `the fog is coming` in 8px text. Solo = stares directly at the camera.
**Running bit:** The Orb and the Fog are connected. At the end, the Orb exhales and a tiny fog cloud remains in the corner. It waves.
**Catchphrase:** `I am the orb.` / `perceive me.`

## 4.4 BUSINESS DOG
**Draw:** beige capsule body, circle head, floppy ears, tiny tie, clipboard, clicker. Dead eyes. Thin corporate-Memphis limbs.
**Home:** chord/stab channel; appears during four-on-floor.
**Personality:** Empty optimism. Speaks in KPIs. Never understands music. Wants a promotion.
**Reactions:** Kick = stamps `APPROVED` on a chart. Snare = checks a box. Bass = adjusts tie. High note = looks up, confused. Chord = flips to the next slide; the slide is just `SYNERGY`. Drop = chart goes vertical; `numbers.` Silence = `Let's circle back.` Solo = presents a PowerPoint with one slide: a bone.
**Running bit:** His chart is the song's actual structure, labeled wrong. At the end, the chart is a drawing of a bone.
**Catchphrase:** `Let's circle back to the drop.`

## 4.5 UNCLE TRACKER
**Draw:** oval head, cardigan, glasses with tiny scrolling tracker rows reflected, floppy disk pocket watch. One frame: nodding off; one frame: startled awake.
**Home:** pattern editor / left side.
**Personality:** Nostalgic, warm, confidently wrong. Explains features that don't exist. Wants to be useful.
**Reactions:** Kick = taps foot. Snare = wakes up. Bass = `In my day, this was one channel.` High note = squints. Chord = `We didn't have chords. We had columns.` Drop = `Now this is what I call... a drop.` (beat) `We didn't have those.` Silence = falls asleep; wakes on the next snare. Pattern jump = `Back in my day, we called that a 'goto.'` Solo = `One channel? Luxury.`
**Running bit:** His tutorial tooltips point at the wrong UI. At 4:00 he admits he has never used this software.
**Catchphrase:** `Four channels was enough.`

## 4.6 THE FOG
**Draw:** not a sprite; a screen-space entity. A dithered gray-blue wall with two tiny eyes. Grows from a corner. Edges made of overlapping soft circles; interior is scrolling noise.
**Home:** sub/bass energy and reverb tail.
**Personality:** Patient, inevitable, polite. It knocks. It waits. It is not angry.
**Reactions:** Kick = pulse. Snare = ripples. Bass = grows a little (rate-limited). High note = thins. Chord = shifts hue. Drop = recedes/clears. Silence = grows faster; whispers. Solo = forms a tiny hand and waves. At 100% = covers the screen, one line: `the fog is here.`
**Running bit:** A fog advisory, the Orb's breath, and a tiny fog cloud in the credits. It is the app's weather and its antagonist.
**Catchphrase:** `the fog is coming.`

## 4.7 INTERN.EXE
**Draw:** low-res humanoid, rectangle body, circle head, lanyard, name tag `HI, I'M INTERN`, permanent sweat drop. Two-frame idle: typing, panicking.
**Home:** UI taskbar; the audience surrogate.
**Personality:** Panicked, eager, underqualified. Wants to help. Makes it worse.
**Reactions:** Kick = stamps a form. Snare = spills coffee. Bass = holds the desk. High note = looks up from the manual. Chord = opens the wrong menu. Drop = hides behind the playhead. Silence = checks phone; screen lights face. Solo = holds a spotlight, visibly straining. Error dialog = runs in, clicks OK, spawns more dialogs.
**Running bit:** At 4:30 he quits; HR replaces him; he comes back for the finale with a new name tag that says `HI, I'M BACK`.
**Catchphrase:** `I'm just here to help.`

## 4.8 CAPTION PIGEON
**Draw:** round pigeon, tiny cap, holds a placard with the caption. Placard text changes; occasionally flies in backwards.
**Home:** top-right; delivers text gags diegetically.
**Personality:** Smug, unreliable narrator. Misspells things. Believes it is the main character.
**Reactions:** Kick = bobs. Snare = drops the placard on the beat, slightly late. Bass = puffs up. High note = tilts the sign. Chord = flips the sign. Drop = sign says `W`. Silence = sign says `hello?`. Solo = turns the sign toward the soloist; it says `him?`
**Running bit:** Misspells "skronk" as "skronkk"; Uncle Tracker corrects him; he leaves in disgrace and returns with a new sign.
**Catchphrase:** (placard) `trust me.`

## 4.9 KNOB GOBLIN
**Draw:** green blob, one giant eye, pointed ears, tiny hands. Lives inside fake plugin windows.
**Home:** any fake plugin / filter UI.
**Personality:** Chaotic neutral. Turns knobs. Does not know what they do. Wants more.
**Reactions:** Kick = head-bangs. Snare = hides. Bass = turns the low knob. High note = covers ears. Chord = turns a random knob. Drop = snaps the knob off; `oops.` Silence = whispers `more.` Solo = emerges from the VST window.
**Running bit:** Appears in every fake plugin. By the end, every knob in the UI is gone.
**Catchphrase:** `more.`

## 4.10 TRACKER MOM
**Draw:** tired mom in a bathrobe, slippers, mug. Door frame, hallway light. Two frames: concerned, disappointed.
**Home:** the door; appears during breakdowns.
**Personality:** Supportive but concerned. Does not understand the hobby. Paid for something.
**Reactions:** Kick = sips. Snare = flinches. Bass = `Is that supposed to be that loud?` High note = `That's nice, honey.` Chord = `Is this the one from the commercial?` Drop = door slam. Silence = `I'm not paying for this.` Solo = watches politely, then asks if it's over.
**Running bit:** Brings snacks during the outro; the snack is a single grape.
**Catchphrase:** `Are you winning, son?`

## 4.11 HR / COMPLIANCE
**Draw:** gray suit, clipboard, smiley-face mask. No other features. One frame: standing. One frame: standing slightly closer.
**Home:** the moderation layer; appears when chaos is too high.
**Personality:** Polite, immovable. Enforces the slider. Is not mad, just disappointed.
**Reactions:** Flash violation = steps in front of the screen. Kick = taps clipboard. Snare = writes a note. Bass = lowers the sub. High note = tilts head. Chord = flips a page. Drop = leaves; it's not their department. Silence = `We've received a complaint about the fog.` Solo = `Let's keep it PG, champ.`
**Running bit:** At max chaos, HR becomes the DJ and plays smooth jazz; the visualizer calms; then one airhorn at the end.
**Catchphrase:** `I'm not mad, I'm disappointed.`

## 4.12 MIDI FROG
**Draw:** squat green blob, two big eyes on top, wide mouth, tiny hands, a throat bubble. Two frames: throat deflated, throat fully inflated. Sits directly on the piano roll.
**Home:** bass / MIDI channel.
**Personality:** Gluttonous, chill, ancient. Eats notes. Croaks on the downbeat. Does not elaborate.
**Reactions:** Kick = throat puff. Snare = tongue catches a fly (which is a note). Bass = belly expands; `bworp.` High note = tongue misses. Chord = blinks slowly. Drop = eats the drop; burp; `sorry.` Silence = stares. Solo = eats the solo; `was that yours?`
**Running bit:** Every note it eats disappears from the piano roll; at the end it burps one tiny note back into the pattern.
**Catchphrase:** `bworp.`

---

# 5. Text and caption gags

## 5.1 Formats

Text is the cheapest, most flexible gag engine. Build one layout system and reuse it everywhere.

- **Broadcast lower third:** Slide in, hold two bars, yank. Best for `NOW PLAYING`, fake awards, breaking news.
- **Fake dialog:** Beveled box, title bar, body, two or three buttons. Best for errors, confirmations, ads.
- **Toast notification:** Top-right stack, auto-dismiss. Best for system messages, subliminals, chat.
- **Karaoke bar:** Bottom, word-by-word highlight on lead notes. Best for misheard lyrics.
- **Chat column:** Right side, message per event, flood on drop, lonely message on silence.
- **Scrolling demo text:** Bottom or full-screen, sine-wave scroll. Best for scene greetings and shoutouts.
- **Full-screen poster:** Centered slogan, one image-like shape. Best for propaganda, "this is fine," fake awards.
- **Fake web page:** Browser chrome, error page, 404, terms of service. Best for meta jokes.
- **Fake ad card:** Full-screen, `AD` badge, countdown, fake product. Best for sponsor parodies.
- **Fake subtitles:** `[aggressive keyboard noises]`, `[the fog]`, `[a single tear]`. Best for silence and breakdowns.
- **Fake review:** `★★★★★ — a guy at the bus stop`. Best for credits and transitions.
- **Fake award laurels:** `OFFICIALLY SELECTED BY NOBODY`. Best for the cold open.

**Text rules:** one idea per card; max seven words for a punchline; high contrast; solid plate behind busy visuals; typewriter only when the typing itself is funny; never flash a paragraph for less than four beats.

## 5.2 The line bank

Unmarked lines are PG and safe for `NORMAL`. Lines marked **[FAMILY]** are the gentler default. Lines marked **[CHAOS]** are for the higher intensity tiers. Recurring motifs are allowed to repeat; that is how they become runners.

### NOW PLAYING titles
1. `NOW PLAYING: 3 A.M. at the Airport Food Court (Extended Mix)`
2. `NOW PLAYING: Music for Arguing with a Printer`
3. `NOW PLAYING: Certified Breakdown (46 Minutes)`
4. `NOW PLAYING: The Song That Plays When You Open the Fridge`
5. `NOW PLAYING: 8-Bit Divorce`
6. `NOW PLAYING: Elevator Music for a Falling Elevator`
7. `NOW PLAYING: My Therapist Said to Try Hobbies`
8. `NOW PLAYING: Aggressive Elevator`
9. `NOW PLAYING: The Fog (Radio Edit)`
10. `NOW PLAYING: Four Chords and a Dream (Mostly the Chords)`
11. `NOW PLAYING: Untitled Project 7 (final) (final2) (USE THIS ONE)`
12. `NOW PLAYING: A Very Normal Song About Cheese`
13. `NOW PLAYING: Dial-Up Love Song`
14. `NOW PLAYING: Sad Wizard Hours`
15. `NOW PLAYING: Certified Banger (Uncertified)`
16. `NOW PLAYING: Music to Refinance Your Car To`
17. `NOW PLAYING: The Part Where Nothing Happens`
18. `NOW PLAYING: 10 Hours of Exactly This`
19. `NOW PLAYING: My First Song (I Am 34)`
20. `NOW PLAYING: Bass Boosted Gregorian Chant`

### Fake genres
21. `GENRE: post-ironic elevator core`
22. `GENRE: corporate Memphis breakcore`
23. `GENRE: ambient for people who are not calm`
24. `GENRE: fourth-wave ska (one ska)`
25. `GENRE: dungeon synth but the dungeon is a cubicle`
26. `GENRE: 8-bit sadboy minimal`
27. `GENRE: aggressive furniture music`
28. `GENRE: math rock for people who are bad at math`
29. `GENRE: lo-fi beats to have a mild crisis to`
30. `GENRE: polka-adjacent (legally distinct)`
31. `GENRE: unreleased (it's unreleased for a reason)`
32. `GENRE: soundtrack to a menu screen you'll never leave`
33. `GENRE: neo-soul but the soul is tired`
34. `GENRE: hyperpop for people with low blood pressure`
35. `GENRE: acid jazz (no acid, mild jazz)`

### Fake shoutouts / scene greetings
36. `SHOUTOUT TO: everyone who has exported the same file 14 times`
37. `SHOUTOUT TO: the one person still using .mod in 2026`
38. `SHOUTOUT TO: my CPU, for trying`
39. `SHOUTOUT TO: nobody. this one's for me.`
40. `SHOUTOUT TO: the undo button. MVP.`
41. `SHOUTOUT TO: whoever invented the snare. you know what you did.`
42. `SHOUTOUT TO: the fog. it's coming.`
43. `SHOUTOUT TO: my headphones, still going after the incident`
44. `SHOUTOUT TO: everyone watching at 3 a.m. in a different time zone`
45. `SHOUTOUT TO: the demo scene, still awake`
46. `SHOUTOUT TO: the person who said "just quantize it"`
47. `SHOUTOUT TO: all my enemies (it's the printer)`
48. `SHOUTOUT TO: channel 7 (muted, but present)`
49. `SHOUTOUT TO: the floppy disk that still works`
50. `SHOUTOUT TO: everyone who has ever said "I'll finish it tomorrow"`

**Demo-scroll variants:** `GREETZ TO: everyone still loading samples from a floppy` · `GREETZ TO: the .it file that ruined my week` · `GREETZ TO: the person who invented the pattern break` · `GREETZ TO: all 4 channels` · `GREETZ TO: the demo scene, still awake` · `GREETZ TO: whoever keeps pressing F5`

### Fake errors and dialogs
51. `Error: too much bass. Click OK to continue being overwhelmed.`
52. `kick_final_FINAL_v7.wav not found. [Locate] [Skip] [Cry]`
53. `Your melody has performed an illegal operation and will be shut down.`
54. `SNARE.EXE has stopped responding. [Wait] [Wait More] [Become the Snare]`
55. `Warning: the drop is 2 bars away. Please secure your beverages.`
56. `This pattern contains 0 notes. This is called "minimalism." [Okay]`
57. `Cannot delete the fog: file is in use by THE FOG.`
58. `Your trial of BASS has expired. [Renew for $9.99] [Continue with treble]`
59. `TRACKER OS detected a vibe. [Allow] [Block]`
60. `Are you sure you want to funk? [Yes] [Yes]`
61. `Low disk space: your ego is taking up 98% of the drive.`
62. `Error 404: drop not found. The drop has been moved to a later date.`
63. `MIDI device "Dad's Old Keyboard" disconnected. [Panic] [Panic]`
64. `Rendering: 99% (has been 99% for 11 minutes)`
65. `Illegal chord detected. Please report to the music theory police.`
66. `Your snare is clipping. So is your personality. [Fix] [Ignore]`
67. `Update available: TRACKER OS 96. [Remind me never]`
68. `This dialog is not real. Please stop clicking it. [OK]`
69. `The fog is not responding. [Wait] [Wait] [Join the Fog]`
70. `Autosave failed. Your vibe is gone.`

### Fake ads and sponsor reads
71. `This breakdown is brought to you by a single toy keyboard from 1994. It knows what it did.`
72. `Sponsored by Water. Drink it. This is not a joke.`
73. `This drop is sponsored by a mobile game you will never install. It knows.`
74. `Buy BASS. Now with 20% more BASS. Side effects may include BASS.`
75. `This ad is unskippable. The skip button is a drawing of a skip button.`
76. `AD: Are you tired of having free time? Try producing music.`
77. `AD: My new plugin, KNOB, has one knob. It goes to 11. $400.`
78. `AD: Sleep. It's what your brain wants. (Not sponsored, just concerned.)`
79. `AD: This could have been a real ad. You'll never know.`
80. `AD: Buy the fog. It's coming anyway.`
81. `AD: Are you a musician? Then you need this $900 cable. It sounds like a cable.`
82. `AD: Subscribe to my newsletter. It's just me, yelling.`

### Fake reviews / awards
- `★★★★★ — "I have never been more confused." — a guy at the bus stop`
- `"A triumph." — my mom, who did not watch it`
- `"This changed my life." — the printer`
- `OFFICIALLY SELECTED BY NOBODY`
- `WINNER: BEST SONG (in this room)`
- `"I laughed, I cried, I closed the tab." — anonymous`

### Misheard lyrics / karaoke
83. `♪ I left my keys in the fridge again ♪`
84. `♪ this is the part where I sound smart ♪`
85. `♪ baby, I'm a breakdown (I'm a breakdown) ♪`
86. `♪ don't stop the beat, I have nowhere to be ♪`
87. `♪ I'm just a little guy (little guy) ♪`
88. `♪ I am the fog, and I am coming ♪`
89. `♪ I put the snare in the wrong place (on purpose) ♪`
90. `♪ four chords and a dream, and the dream is also four chords ♪`
91. `♪ wake me up before the drop ♪`
92. `♪ I'm not crying, the filter is ♪`
93. `♪ I'm a little teapot, short and stout (this is a hardcore track) ♪`
94. `♪ take me to the bridge (there is no bridge) ♪`
95. `♪ this is my emotional support bassline ♪`

### Fake subtitles / captions for sounds
- `[aggressive keyboard noises]`
- `[the fog]`
- `[a single tear]`
- `[someone's mom]`
- `[the drop, eventually]`
- `[unintelligible rat noises]`
- `[a printer, somewhere]`
- `[silence] [it's awkward]`

### Fake chat
96. `chat is this real`
97. `W visualizer`
98. `he just like me fr`
99. `the fog is coming`
100. `not the snare rush`
101. `BASS`
102. `what is a kilometer`
103. `this is my 14th time watching this`
104. `mom said it's my turn on the tracker`
105. `THE ORB`
106. `why does the wizard look sad`
107. `don't worry he's always like that`
108. `I'm literally the orb`
109. `can we get an F in chat for the kick`
110. `the kick is fine actually`
111. `no way he did the thing`
112. `HE DID THE THING`
113. `I'm calling HR`
114. `hide the fog`
115. `this is better than the original (there is no original)`

### Alerts, notifications, weather
116. `EMERGENCY ALERT: The fog is coming. This is not a drill. (It is a drill. The fog is coming.)`
117. `WEATHER: 100% chance of bass. Scattered snares. Fog advisory in effect.`
118. `LOW BATTERY: 1%. This is your problem now.`
119. `REMINDER: You are not immune to propaganda.`
120. `SYSTEM: Vibe levels critical.`
121. `SUBLIMINAL MESSAGE: drink water.`
122. `SUBLIMINAL MESSAGE: call your mom.`
123. `SUBLIMINAL MESSAGE: the orb is watching.`
124. `TERMS OF SERVICE UPDATED: You now own nothing. This is fine.`
125. `NOTICE: The drop has been delayed due to weather.`
126. `BREAKING: Local man cannot stop the snare rush. (He is the snare rush.)`
127. `UPDATE: The fog has entered the chat.`

### Absurdist one-liners / brainrot
128. `no thoughts, just snare`
129. `we live in a tracker`
130. `the drop is a social construct`
131. `I am the bass now`
132. `WTF is a kilometer` **[CHAOS]** / `what is a kilometer` **[FAMILY]**
133. `the fog is coming` *(runner; use sparingly)*
134. `he just like me fr` *(runner; use sparingly)*
135. `chat is this real` *(runner; use sparingly)*
136. `this is fine`
137. `graphic design is my passion`
138. `you are not immune to propaganda`
139. `no bitches?` **[CHAOS]** / `no treats?` **[FAMILY]**
140. `it's giving: unresolved`
141. `my brother in Christ, that's a tritone`
142. `the kick is late and so am I`
143. `I have no idea what I'm doing and it's working`
144. `this beat is legally distinct from a heartbeat`
145. `the snare is doing its best`
146. `skill issue (I made the app)`
147. `touch grass? I can't, I'm in a canvas`
148. `this is my emotional support drop`
149. `certified skronk moment`
150. `I'm not trapped in the tracker, the tracker is trapped in me`
151. `the orb has been located`
152. `the fog is not a metaphor (it is)`

### Music theory / producer humor
153. `This chord is illegal in 14 states.`
154. `The tritone is not the devil. The devil is the export settings.`
155. `Jazz: the art of playing the wrong note with confidence.`
156. `Four chords: I–V–vi–IV. Four more chords: also I–V–vi–IV.`
157. `The snare rush is just anxiety with a tempo.`
158. `Sidechain: making the kick the main character since 1998.`
159. `The drop is just the build-up's apology.`
160. `This is in 7/8 because I hate the drummer.`
161. `Polyrhythm: two wrongs making a right.`
162. `The mix is perfect. The master is a group project.`
163. `I put the "pro" in "probably shouldn't have released this."`
164. `Nintendo hard: the song is 3 minutes long and you've died 40 times.`
165. `The bass player is the only one having fun. We don't know why.`
166. `"Just add reverb" — me, making it worse, beautifully.`
167. `The intro is 90 seconds. Nobody has ever heard it.`
168. `My DAW crashed and took my vibe with it.`
169. `The client wants it "more better."`
170. `This is a demo. It will always be a demo.`

That is 170 lines. Use the best 90–120 in the first build; keep the rest as a writer's room bank. The joke density should be curated, not exhaustive.

---

# 6. Moderation, portability, and not getting sued

## 6.1 GitHub Pages constraints

- **Static only.** No server, no API keys, no database. Everything runs in the browser.
- **No external assets required.** Self-host fonts if you use them (OFL fonts only), or use system font stacks. Never hotlink a font you don't have rights to.
- **No copyrighted sprites, logos, or trade dress.** Draw generic beveled dialogs, not a pixel-perfect Windows 95 window with the logo. Call the fake OS `TRACKER OS`, not a real product.
- **No real brands in fake ads.** Use fictional products: `KNOB`, `BASS`, `FOG`, `BINGEBOX`, `CLIPHIVE`, `BIG LABEL`.
- **No uncleared audio.** If the app plays user modules, that is the user's file. Do not bundle commercial tracks or sample packs.
- **Relative paths + base path.** GitHub Pages serves under `/<repo>/`; test with a subpath.
- **No service worker requirement.** It should work on a plain static host; offline caching is a bonus.
- **No analytics or tracking.** Keeps it portable and uncreepy.

## 6.2 Content rules

- No slurs, hate speech, or "ironic" bigotry.
- No sexual content; no sexual content involving minors, ever.
- No graphic gore, self-harm, or realistic violence.
- No real-person likeness, impersonation, or defamation.
- No harassment, doxxing, or targeted abuse.
- No copyrighted characters (Pepe, Skibidi Toilet, Clippy, Bonzi, Joker, etc.). Use archetypes and original analogs.
- Meme formats are fine; meme images are not. Use the phrase "this is fine" with an original stick figure, not the original dog-in-fire panel. Same for "no bitches?": text format only, no borrowed image.
- Mild profanity is a tier, not a default. `no bitches?` is **[CHAOS]** only; the family line is `no treats?`.
- Keep the punching direction at tools, institutions, and ourselves. Never at beginners, marginalized groups, or the audience.

## 6.3 The chaos dial

A single `chaos` value from 0 to 100, or four named modes:

| Mode | Chaos | Behavior |
|---|---|---|
| `SERIOUS` | 0 | No gags. Just the visualizer. A "for sharing" mode. |
| `FAMILY` | 25 | Wholesome gags only. No mild profanity, no jump scares, no strobes. Mom, Orb, Pigeon, fog meter. |
| `NORMAL` | 60 | Default. All PG gags, full-screen gags, characters, fake UI. |
| `BRAINROT` | 100 | Max density, meta gags, HR cameo, chaos-tier lines. Still flash-safe. |

**Parameters that scale with chaos:**

- `fullScreenGagBudget`: 0 / 1 per 16 bars / 1 per 8 bars / 1 per 4 bars.
- `textGagRate`: 0 / 1 per 4 bars / 1 per 2 bars / 1 per bar.
- `characterCount`: 0 / 3 / 7 / 11.
- `allowChaosLines`: false / false / false / true.
- `allowStartle`: false / false / true / true.
- `allowScreenShake`: false / false / true / true.
- `allowFogWhiteout`: false / true / true / true.

**Implementation notes:** persist the mode in `localStorage`, support `?chaos=0` for sharing, and let HR announce the change diegetically. The slider should be usable at any time, including mid-gag; HR can walk in and lower it.

## 6.4 Epilepsy-safe defaults

- **No more than three flashes per second.** Avoid full-screen luminance inversions entirely. A "flash" is a large-area change in brightness, not a small blinking cursor.
- **No alternating saturated red/blue.** Avoid the classic "3 Hz red/blue" pattern.
- **Cap screen shake** at a few pixels and disable it under reduced motion.
- **No rapid zoom.** Scale punches should be small and eased, not strobing.
- **Fade, don't strobe.** The VHS glitch is RGB offset and slice displacement, not a brightness flash.
- **Respect `prefers-reduced-motion`.** Disable shake, strobe, rapid zoom, parallax, and auto-scrolling text; keep fades and static gags.
- **Add a photosensitivity toggle** that is on by default, and a "reduce motion" toggle independent of the chaos slider.
- **Test with a luminance analyzer.** Sample frames, compute average luminance, and assert no more than 3 large-area transitions per second. Automate it in the gag lab.
- **Don't rely on flicker for the joke.** The funniest gags here are drawings and timing, not strobes.
- **No jump-scare audio.** If you synthesize an airhorn or kazoo, keep it at the same peak level as the music, never boost it above the track. No "ear rape" clipping jokes; the joke is visual.

## 6.5 Performance and portability

- Render the visualizer to a low-res offscreen buffer (e.g., 320×180 or 480×270) and scale up with nearest-neighbor for the VHS/90s look. It is faster and more stylish.
- Cache static art: dialogs, sprites, text layouts, noise textures, star fields.
- Cap particles (confetti, bubbles, ghosts). Recycle them.
- Avoid per-frame `ctx.filter` and large blurs; fake them with tinted offscreen copies.
- Use `requestAnimationFrame` with the audio clock; never `setTimeout` for musical timing.
- Support portrait and landscape; text should reflow, not clip. No hover-only gags on touch.
- Add a "skip gag" button and a "pause" button. Accessibility is not a mood killer.
- Add a `gag lab` route with buttons for each gag, a seed field, and a chaos slider. This is how you tune comedy without replaying the whole song.

## 6.6 Legal hygiene

- All characters are original. All UI is generic. All brands are fictional.
- Meme *formats* are generally fine; specific meme *characters* and copyrighted images are not. Draw the archetype, not the intellectual property.
- Avoid real logos, real software names in the fake UI, real social platforms, and real person likenesses.
- Keep a `LICENSES.md` for fonts and any code dependencies.
- Add a footer: `All characters are fictional. Any resemblance to your printer is coincidental.`

---

# 7. What musicians find funny vs. annoying

## 7.1 Funny

- **Specific, accurate details.** A real snare rush, a real sidechain pump, a real `my_final_master_v7_FINAL.wav`. Accuracy is affection.
- **Self-deprecation.** The visualizer is the idiot, not the musician. `I have no idea what I'm doing and it's working` is funnier than `your music is bad`.
- **The tools as villains.** The printer, the DAW crash, the CPU overload, the client, the export dialog. Punch at the machinery.
- **Theory jokes that are correct.** A tritone, a 7/8 bar, a Neapolitan chord, a polyrhythm. Get the term right, then take it literally.
- **Tracker culture nods.** `.mod`, `.xm`, `.it`, pattern break, order list, effect column, four channels, channel 7, the demo scene, `greetz`. Gentle, specific, not gatekeeping.
- **The drop as a sacred object.** Let the music win sometimes. The funniest version of "the drop" is one that actually lands.
- **Nintendo hard.** Hard but fair: the gag is surprising in hindsight, not random.

## 7.2 Annoying

- **Genre snobbery.** "This genre is bad" is not a joke; it is a review nobody asked for.
- **Theory gatekeeping.** Using a term to make the audience feel stupid. The visual should work even if you don't know the term.
- **Punching down.** Beginners, bedroom producers, and people with cheap gear are the audience, not the target.
- **Interrupting the music for too long.** A 16-bar ad parody during the best part is not chaos; it is a hostage situation.
- **Random = funny.** Randomness without setup is noise. The audience can feel the difference.
- **Explaining the joke.** A caption that says "get it?" is a laugh killer.
- **Repeating a bit past its expiration date.** The rule of three exists for a reason.
- **Not letting the drop land.** The cardinal sin. Clear the frame.
- **Corporate attempts at slang.** If the app says "skibidi" because a focus group asked for it, the audience can tell. Invent your own slang (`skronk`) and commit.

## 7.3 The balance

- **70% music-literate, 30% universal.** A musician should feel seen; a non-musician should still laugh at the orb.
- **Visual first, text second.** The drawing should be funny with the sound off; the caption is the button.
- **The visualizer is a fan, not a critic.** It loves the music, and that is why its attempts to participate are funny.
- **Let the music be the straight man.** The best joke is the one the song appears to tell on itself.

---

## Appendix A: 15 quickfire gags for the bench

1. **BPM speedometer** — the car falls apart at 200 BPM.
2. **"Is this dubstep?"** — a fake listening app says `No.`
3. **Stock ticker** — `BASS +420%`, `MY WILL TO LIVE -3%`, `SNARE FUTURES CRASH`.
4. **Weather map** — `Scattered snares. Fog advisory.`
5. **Auction** — `One used dominant seventh, lightly gigged.`
6. **Nature documentary** — `The wild kick, in its natural habitat.`
7. **Golf commentary** — whispered, during the quietest section.
8. **Cooking show** — `Add a pinch of reverb.`
9. **Fake ASMR** — `*taps waveform*` during the hats.
10. **Minesweeper** — hats reveal numbers; the drop is a mine (confetti).
11. **Solitaire** — auto-plays during the breakdown; wins on the drop.
12. **Fake "content ID" claim** — `Your note C# has been claimed by BIG LABEL.` The note is muted; the appeal is rejected.
13. **POV: you're the snare** — first-person hands, two bars of shake, then cut.
14. **Infomercial** — `BUT WAIT, THERE'S MORE: it's the same four chords.` A fake studio audience applauds on the downbeat.
15. **Channel-solo talent show** — the soloed channel gets a spotlight and three judges; scores: 10, 3, `who?` The stage collapses on the next snare.

## Appendix B: Trigger index

| Event | Gags |
|---|---|
| `KICK` | 11, 23 |
| `SNARE` | 2, 3, 8, 12, 20, 25 |
| `HAT` | 19 |
| `BASS` | 1, 4, 23, 35 |
| `LEAD / HIGH` | 4, 24, 32 |
| `CHORD` | 9, 11, 26, 27 |
| `SOLO` | 2, 16 |
| `BREAKDOWN` | 10, 15, 18, 30, 31, 33 |
| `DROP` | 3, 4, 6, 7, 8, 13, 16, 17, 20, 23, 28, 30, 31, 32, 33, 35, 37 |
| `SILENCE` | 1, 6, 15, 17, 18, 33, 37 |
| `TIME / IDLE` | 29, 37 |
| `PATTERN_JUMP` | 5, 21, 39, 40 |
| `BPM_CHANGE` | 36, 39 |
| `CLIP` | 14 |
| `DENSITY` | 12 |
| `END` | 30, 41 |

## Appendix C: The one-page checklist

- Does the gag have a musical trigger, not just a timer?
- Does it read in under two beats?
- Is it drawn from primitives/text, with no copyrighted asset?
- Does it escalate or callback something earlier?
- Does it leave the drop alone?
- Is it safe in FAMILY mode, or clearly gated?
- Does it flash? If yes, cut the flash, not the joke.
- Would it be funny with the sound off? If not, is the sync doing the work?
- Does it make the visualizer feel more alive, or just louder?
- Would a musician laugh with it, not at themselves?

---

*End of bible. Now go draw a rat.*
