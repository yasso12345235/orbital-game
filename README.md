# ORBITAL — Space Mission Lab

An educational space-mission game: design a spacecraft, pick a launcher, tune an orbit, fly the
launch, operate the mission in real time, and get scored + debriefed — with the real physics shown
at every step. Standalone app (no backend, no network, no accounts); bilingual Arabic/English.
The visible shell is branded **ORBITAL — Space Mission Lab**; the in-world mission name remains
the "Mission Architect Program" and save keys stay stable across versions (`ma_save_v1` is still
read; new saves live in `ma_save_v2`).

```bash
npm install         # once
npm run dev         # http://localhost:5174
npm run build       # production bundle in dist/ (typecheck + build)
npm test            # 127 unit + integration tests
npm run typecheck   # strict TypeScript
npm run test:visual # scripted EN/RTL/reduced-motion walkthrough (+ screenshots)
npm run verify      # typecheck + unit tests + visual walkthrough
npm run preview     # serve the production build locally
```

Everything ships in the bundle: fonts (`@fontsource`), procedural planet textures drawn on canvas,
synthesized Web Audio sounds, and JSON game data — so the game runs fully offline.

### What's new in 1.5 — continuity (save v2, backup, verifiable builds)

* **The mission survives a reload** — the run is persisted, not just the campaign: design, builder
  placement, mission, orbit tuning and the live operations snapshot. Reloading mid-flight reopens
  Simulation where you left off (a reload during the launch cinematic resumes in operations instead
  of replaying it); Home's primary action becomes **Resume operations**.
* **Versioned, defensive saves** — schema `v2` with `ma_save_v1` still migrated on read. Every value
  is sanitised (unknown component/launcher/mission ids, impossible screens, malformed simulations,
  out-of-range numbers), validation is always recomputed instead of trusted, and the persisted event
  log is capped at 300 rows.
* **Nothing is lost to a bad write** — the previous known-good save rotates into a backup key, an
  unreadable primary is quarantined and the backup is restored with a visible on-screen notice.
* **Coalesced autosave** — writes are throttled to one per ~0.9 s under the 10 Hz simulation tick and
  flushed synchronously on `pagehide` / tab hide, so neither performance nor a hard close loses the run.
* **Export / import** — Hangar → System exports the whole campaign (and run) as pretty JSON and
  restores it from a file; corrupt, oversized (> 2 MB) and newer-schema files are rejected with a
  readable message instead of crashing.
* **Automation you can run** — `npm run test:visual` drives the real UI in Chrome (portable paths,
  auto-starts Vite, deterministic storage, machine-readable `artifacts/visual-check/summary.json`,
  non-zero exit on console errors) and now asserts mid-mission reload/resume and the export→import
  roundtrip. Verification: **127/127 tests**, typecheck and build green, **18/18** visual checks,
  **25** screenshots, zero console errors.

### What's new in 1.4 — ORBITAL "Space Mission Lab" shell upgrade

* **One identity, all screens** — the UI is unified on a deep-space palette (midnight navy,
  electric cyan `#3DE0FF`, ice `#BFE9FF`, violet nebula accent), glass panels, thin technical
  dimension lines and the 40-glyph vector icon family (`Icon` / `Glyph`) — emoji removed from
  Mission Select and the Tech Tree.
* **Main menu** — cinematic planet hero (now with a signature accent **orbit ring** hugging the
  limb), the ORBITAL wordmark, a glass command rail with real mission/stats items, a quick bar,
  a featured-target card with real status chips (completed / available / locked), and a live
  readiness dial driven by actual XP.
* **Mission Select — holographic console** — the briefing now shows the star-derived class
  (CLASS I…V), the genuine status, objectives straight from the mission spec (science goal,
  endurance, Δv, budget), the **real access node** from `tech.ts` (with tier + cost), and the
  eerily honest payout panel: leftover budget × 25% + score × 8,000 (the exact `endMission`
  formula), plus a not-to-scale route strip where the selected target is the hotspot.
* **Tech Tree** — glowing circular icon nodes (what a node unlocks decides its glyph), an energy
  flow only on unlocked branches, a pulse halo on genuinely affordable nodes, dimmed locked
  states, an unlock flash animation, keyboard focus + Enter support and a live count/percent
  completion bar.
* **Ops HUD (Simulation)** — radial gauges (battery / science / Δv) with tone tiers, sparkline
  histories sampled from the real sim tick, a mono telemetry strip (altitude, inclination,
  range, delay, rate, day, in human units: Gbps / ms / km), an orbit-map hotspot with the real
  day marker and severity-tinted event ticks, and framed warning panels (critical state goes
  red without hiding content).
* **Hangar** — blueprint-style bay with dimension annotations bound to the resolved design
  (mass / Δv), real performance stat bars (Δv ratio, thrust/mass, reliability, propellant),
  and a **what-if refit preview** that runs the same engine resolver read-only before you
  install a propulsion upgrade.
* **Audio** — three independent buses (Master / Effects / Ambience) with their own sliders on
  Home and in the Hangar system tab; short deliberate cues, nothing looping loudly.
* **Accessibility & performance** — reduced motion degrades every new animation to static
  states (the official walkthrough re-verifies it), quality Low/Medium/High is respected, all
  new visuals come from real store data, and `three` stays a lazy chunk.
  Verification: typecheck clean, **95/95 tests**, production build green, and the scripted
  desktop walkthrough (EN + RTL + reduced motion) finished with **zero console errors**.

### What's new in 1.3 — "Aurora" look layer + control redesign

* **The whole look was rebuilt (v3)** — a layered aurora backdrop, glass panels, a floating glass
  top bar, gradient display type and HUD tags, a gradient/ghost button system, glass form controls,
  global keyboard focus rings, themed scrollbars and text selection.
* **Control system redesigned (v3)** — the pixel Command Deck is gone. Mission commands are now
  contextual glass chips that appear inside the operations screen (each printing the player's live
  keybinding), telemetry moved to a slim status rail, and a Keys chip in the top bar opens the full
  shortcut sheet. Keyboard + gamepad stay first-class; screens own their actions.
* **Core scene architecture** — every scene now composes one contract: **`SceneShell`**
  (canvas + post + context-loss handling) wrapping **`Environment`** (nebula washes, drifting
  dust, holo grid floor, optional fog) and a **`CameraRig`** (breathing drift + pointer parallax,
  pinned static under reduced motion) — or drag-orbit controls.
* **Cinematic grade** — the post stack gains saturation/contrast grading (skipped on Low tier).
* **Shape library (16 procedural shapes)** — planet, orbit rings, holo sphere, glass crystals,
  iridescent knots, instanced asteroids, wireframe polyhedra, particle fields, energy ribbons,
  warp streaks, holo floor, nebula, data nodes, spacecraft kit, shield bubble and rocket —
  all quality-scaled, accent-driven and reduced-motion aware.
* **Visual-layer step 3 — Home scene + wormhole transition** — the Home hero now runs on the
  `SceneShell` contract: a planetary limb (the peek target's real surface texture), a constant-size
  deep starfield, the spacecraft kit on a flyby and drifting meteors, all with drift + pointer
  parallax (pointer tracked from the document so the `pointer-events-none` hero keeps its parallax).
  Leaving Home plays a full-viewport **wormhole transition** (procedural tunnel shader on a rAF
  timeline, uAccent-lit, ≤2 Hz oscillations) that degrades to a short veil dip under reduced motion.
  Review it in the Style Guide → **"HOME SCENE + WORMHOLE · 3D"** (live embed + replay button).
* **Visual-layer step 5 — Mission Select + Builder scenes** — the Mission Select “live planet”
  panel is now an R3F scene (target planet with in-place texture swaps, orbit rings + dust), and
  the Builder's 3D bay runs on the `SceneShell` contract with drag-orbit inspection: the preview
  is fed by the real design — solar wings deploy (with eased folding in the kit) when an array is
  fitted and the RTG boom appears when the nuclear unit is (`outputPowerW > 0`, the same field the
  engine's power model reads). Review both in the Style Guide → **"MISSION SELECT + BUILDER · 3D"**.
* **Visual-layer step 6 — Mission Ops scene** — the Simulation's orbit view and the Orbit designer
  now share one R3F scene on `SceneShell`: the dashed ring maps the mission window, the travelling
  spacecraft marker is “today” (eased toward the real `elapsedDays`, snapped under reduced motion),
  and labelled `DataNode`s sit at their event-log days in severity colours — matching the DOM
  timeline below. The designer variant maps the tuned altitude onto the ring radius (0.6…1.6 × at
  800 km) and tilts the plane by the real inclination; drag-orbit inspection everywhere. Review in
  the Style Guide → **"MISSION OPS · 3D"** (live board + local demo sliders).
* **Visual-layer step 7 — Launch cinematic** — the legacy vanilla launch scene is replaced by an
  R3F cinematic: a shader sky dome blends dawn into space on a single timeline, the pad/mast/ground
  fall away while the vehicle stays framed, ignition smoke and a flickering plume are lit by a
  point light, and the stack height derives from the launcher's real LEO capacity. Progress starts
  at T-0 (`useLaunchProgress`, moved into the visual layer) and callouts keep the legacy thresholds.
  The HUD clock rolls from the T-10 countdown into `T+` flight time; reduced motion disables shake
  and idle drift. Review in the Style Guide → **"LAUNCH CINEMATIC · 3D"** (scrubber + play).
* **Visual-layer step 8 — Results replay + Tech Tree backdrop** — Results now opens with an
  **orbital replay** beside the verdict: the same live ops scene (target planet, mission-window
  ring, severity-tinted event nodes) paused on the final day, draggable for inspection, with the
  score and grade next to it. The Tech Tree gains a quiet nebula + starfield layer behind the SVG
  (45% opacity, pointer-events-none) so the glowing nodes stay the hero. The safety KPI's
  reliability readout is fixed (it printed `1%` instead of the real percentage).
* **Visual-layer step 9 — perf, a11y & RTL pass** — the legacy `three/scenes.tsx` module is deleted:
  the Hangar bay now reuses the design-driven `BuilderPreview`, its cockpit window is a new lazy
  `CockpitView` (target planet close-up), and `MiniGlobe` moved to a pure-SVG component. The
  `three` + R3F + post stack is now **fully lazy**: initial JS is `index` **59.4 KB** + `react`
  **83.3 KB** gzip (≈143 KB, down from ≈342 KB when three was eager). The automated walkthrough now
  also verifies the RTL language switch end-to-end (Home, Hangar, Mission Select, Results) and a
  `prefers-reduced-motion` context (the wormhole transition is skipped, scenes render without
  motion), with zero console errors.
* **Playground route** — every shape with live debug sliders, quality-tier switching, backdrop
  toggles, impact / stage-separation triggers and a motion-preset player. Open it from the Home
  footer ("Playground") or the Style Guide ("3D playground →").

### What's new in 1.2

* **Cinematic visual pass** — a living 3D hero on the Home screen (planet limb, drifting clouds,
  a satellite pass, shooting stars), cloud shells + sun glint + camera drift on every planet view,
  a live 3D planet behind the mission-select holo overlay, a richer launch sequence (plume light,
  ignition flash, retracting service arms, lingering pad smoke, upper-stage burn), count-up KPI
  numbers, scan-band + vignette ambience and a shine/sparkle grade reveal on Results.
* **Visual layer v2 — step 1 of 9 (new architecture, in progress)** — the 3D/visual layer is being
  rebuilt on **React Three Fiber + drei + postprocessing** under `src/game/visual/`:
  * shared **`uAccent` uniform** locked to the CSS accent (`--ma-accent`) with a 0.6 s cross-fade —
    UI and 3D change theme together (switch planets/theme buttons and watch both follow);
  * **BaseCanvas** — ACES tone mapping, sRGB, adaptive DPR, loop paused on hidden tabs,
    context-loss overlay and a WebGL-unavailable fallback;
  * **EffectsRig** — Bloom (mipmap) + Vignette + fine Noise, optional chromatic aberration
    (fast motion / warp) and depth of field (Builder focus), all scaled by the quality tiers;
  * design tokens in `visual/theme/tokens.ts` mirrored by the CSS custom properties
    (neon gradient pairs, durations, easings);
  * the R3F stack lazy-loads (≈68 KB gzip) — initial JS stays ≈66 KB gzip, inside the budget;
  * review surface: **Style Guide → "VISUAL CORE v2 · 3D"**. Next: step 2 — shape library + Playground.

### What's new in 1.1

* **3 new destinations** — Venus (flux 2620 W/m²), asteroid **433 Eros**, and **Titan** (flux 15 W/m²,
  ~71-minute one-way light delay), each with procedural planet art and its own accent theme.
* **3 new missions** — Venus Climate Orbiter, Asteroid Rendezvous, Titan Explorer (5★ endgame).
* **Nuclear RTG** — 300 W of *constant, flux-independent* generation: the only power that works where
  sunlight dies. Compare with giant solar arrays in the builder and watch the physics agree.
* **Optical (laser) comms** — the only downlink that closes at Saturn distances.
* **Mass spectrometer** payload for atmosphere and asteroid-dust chemistry.
* **Super Heavy launcher** — 100 t class for Saturn-scale direct missions.
* **4 new tech nodes** — Inner-Solar Campaign, Nuclear Power Systems, Small-Body Ops and
  Giant-System Expedition (the tree now has 9 nodes and scrolls wider).

---

## 1. The loop

```
Home → Hangar/Profile → Mission Select → Spacecraft Builder → Launcher Select
     → Orbit Designer → Simulation (launch cinematic → operations) → Results
     → Tech Tree (spend credits) → next mission
```

| Screen | What the player does | Physics feedback |
|---|---|---|
| **Home** | cinematic entry, featured target, language switch | dynamic accent per target |
| **Hangar** | commander profile, badges, credits, level, live 3D spacecraft, cockpit, solar map, settings, keybindings | mass / power / cost / risk |
| **Mission Select** | planet carousel, holographic wireframe, difficulty stars, lock state, launch window | required Δv, science goal, budget cap |
| **Builder** | 7×5 payload-bay grid, six equipment slots, parts palette, redundancy toggles, propellant slider | rocket equation shown live, four ring gauges |
| **Launcher Select** | rockets drawn to relative scale, capacity vs mass margin, cost, reliability | capacity − mass margin in kg |
| **Orbit Designer** | altitude + inclination sliders, live 3D orbit | `v = √(μ/r)`, `T = 2π√(r³/μ)` |
| **Simulation** | T−10 countdown with GO/NO-GO, ignition, max-Q, staging, insertion, then real-time ops with FIRE/SCAN/NAV/COM/SHLD/WARP | power budget, battery, link budget + light delay, Δv remaining |
| **Results** | score count-up, grade, badges, first failure point, improvement report, local leaderboard | score breakdown 40/25/25/10 |
| **Tech Tree** | unlock components, launchers and missions with credits | gates the whole campaign |

Difficulties: **Tutorial** (no random events, guaranteed launch), **Normal**, **Engineer**, **Mission Director**
(higher event rates and failure risk).

---

## 2. Physics implemented (and where)

| Topic | Formula | Code |
|---|---|---|
| Rocket equation | `Δv = Isp · g₀ · ln(m₀/m_f)` | `src/engine/propulsion.ts` |
| Constant `g₀` | `9.80665 m/s²` | `src/engine/constants.ts` |
| Circular orbit | `v = √(μ/r)`, `T = 2π√(r³/μ)` | `src/engine/orbital.ts` |
| Solar power | `P = A · η · flux · cos θ`, `flux = flux₀/d²` | `src/engine/power.ts` |
| Nuclear power (RTG) | `P = const` — flux-independent generation | `src/engine/validation.ts` |
| Battery sizing | `E = load · eclipseDuration / DoD` | `src/engine/power.ts` |
| Link budget | `rate ∝ Pt · G / d²`, `delay = d / c` | `src/engine/comms.ts` |
| Cost | design + hardware + launcher + ops × months | `src/engine/cost.ts` |
| Reliability | `P = Π Rᵢ`, redundancy `1 − (1−R)²` | `src/engine/reliability.ts` |
| Random events | per-day probability, safe mode ×0.25 | `src/engine/events.ts` |
| Mission loop | power, science, storage cap, downlink, failures | `src/engine/simulation.ts` |
| Scoring | science 40, budget 25, safety 25, innovation 10 | `src/engine/scoring.ts` |

All formulas are unit-tested (`tests/engine.*.test.ts`) and the game data is validated for
integrity at load time (`tests/engine.data.test.ts`).

**Numbers the game anchors to:** LEO Δv 9.4 km/s, Moon 3.1, Venus 3.5, Mars 3.6, Eros 4.9, Jupiter 6.3,
Europa 6.8, Titan 7.3 km/s; one-way light delay Moon ≈ 1.3 s, Venus 2–14 min, Mars 3–22 min,
Jupiter 33–53 min, Titan ≈ 71 min; solar flux 1361 W/m² at Earth, 2620 at Venus, 15 at Titan.

---

## 3. Simplifications (education notes — shown in-app too)

1. **Circular orbits only.** Real transfers are ellipses (Hohmann); we charge fixed-ish Δv per mission.
2. **Single-impulse transfers.** No finite-burn losses, no gravity assists in the numbers (Voyager-style
   mission is represented by a fixed Δv).
3. **Launcher capacity is a LEO proxy.** "Capacity to LEO" is a single number; we do not model upper-stage
   energy for the specific target orbit.
4. **Constant solar flux per target** with an eclipse fraction (35% LEO/GTO/GEO, 5% elsewhere) baked into
   the daily charge; eclipses are not simulated second by second.
5. **Science model:** instruments accrue `sciencePower × 2.2` Gb/day, safe mode ×0.4; SCAN bursts add 1.2 Gb.
   Storage overflow is *lost* (a real design pressure).
6. **Auto-downlink:** 8% of stored data per day plus manual COM bursts of 2.5 Gb — an abstraction of ground-station
   passes (≈20% duty cycle).
7. **Independent failures.** Each subsystem fails independently; no common-cause or wear-out models beyond the
   battery-degradation event.
8. **Launch failure** is a single roll against launcher reliability (skipped in Tutorial).
9. **Operational events are discrete** (solar storm, debris, battery degradation, comms loss, fuel leak,
   overheating). Real anomalies are continuous and coupled.
10. **Comms gains** fold the ground segment into the spacecraft's system gain so `rate ∝ Pt·G/d²` stays
    believable for Ka-band + DSN stations.
11. **Money is game credits** anchored to real order-of-magnitude costs, not budgets of a specific agency.
12. **Δv of a FIRE command** costs 8 kg of propellant (engine step); the *available* Δv figure is always the
    rocket equation's, so the two views agree.
13. **RTG output is constant.** Nuclear decay and thermocouple aging are ignored (a real MMRTG loses
    ~1–2 %/year); in this model the RTG keeps producing everywhere, which is exactly why outer-planet
    missions use them — compare `pow_xl` (25 m² solar) between Earth and Titan in the tests.

Sources for every data row live in `src/engine/data/*.json` under a `source` field (NASA fact sheets,
ESA/JPL mission pages, textbook equations).

---

## 4. Controls

**Keyboard (rebindable in Hangar → System):**

| Keys | Action | Command |
|---|---|---|
| `Space` | burn | `FIRE` |
| `S` | science scan | `SCAN` |
| `N` | orbit lock readout | `NAV` |
| `C` | downlink | `COM` |
| `H` | safe mode | `SHLD` |
| `W` | time ×1 → ×10 → ×100 | `WARP` |
| `Enter` | confirm / place part | `CONFIRM` / `PLACE` |
| `Backspace` | back / remove part | `BACK` / `REMOVE` |
| `Tab` | next equipment slot | `NEXT_SLOT` |
| arrows | move cursor / carousel | `UP/DOWN/LEFT/RIGHT` |
| `Q` `E` | rotate part | `ROTATE_CCW/CW` |
| `A` | analyse design | `ANALYSE` |
| `Esc` | pause / cancel | `PAUSE` |

**Gamepad:** A confirm · B back · X scan · Y warp · RT fire · LT safe mode · L1/R1 timeline scrub ·
D-pad navigation. Polled at ~11 Hz with edge detection.

**Touch/pointer:** every control is a real button with ≥44 px targets, press feedback, haptics where
supported (`navigator.vibrate`), and the Pixel Command Deck adapts to one-hand use.

**Accessibility:** full `aria-label`/`role` coverage (meters, tablist, meter, progressbar, status),
keyboard-only playable, `prefers-reduced-motion` + an explicit reduced-motion setting, sound can be
muted and volume set, no reliance on colour alone (icons + text + numbers accompany every state),
and every screen is bilingual — Arabic (RTL) above English (LTR) or reversed with the UI language,
with numbers kept LTR for readability.

---

## 5. Data-driven design

```
src/engine/data/missions.json    12 missions  (Earth LEO → Venus / Eros / Mars / Jupiter / Titan), bilingual, with source notes
src/engine/data/components.json  27 parts across bus/power/propulsion/comms/payload/thermal
src/engine/data/launchers.json    6 launch vehicles with capacity/cost/reliability
src/engine/data/events.json       6 operational events with mitigations
src/engine/data/difficulties.json 4 difficulties incl. event rates + budget caps
```

`src/engine/data.ts` loads and validates them (`validateDataIntegrity()`), and a test fails the build
if a mission, component, launcher or tech-tree link points at something that does not exist.

---

## 6. Scoring

`Science 40 + Budget 25 + Safety 25 + Innovation 10`

* **Science** — returned data vs the mission goal (harder missions need more).
* **Budget** — cost vs the difficulty's cap; leftover budget also converts into credits.
* **Safety** — system reliability, survival, penalty per critical anomaly.
* **Innovation** — ion/hydrolox propulsion, advanced payloads, redundancy depth, tight-but-positive mass margin.

Grades S/A/B/C/D, badges (`Mission Ace`, `Efficient Engineer`, `Zero Waste`, `Survivor`,
`Deep-Space Navigator`), XP levels every 300 XP, and a local leaderboard per mission. Progressive
unlocks mean the tech tree is the campaign: credits earned from missions buy the next tier
(small-lift → medium-lift → deep space → outer planets), with side branches for the inner-solar
campaign (Venus), small bodies (Eros), nuclear power (RTG) and the giant-system expedition (Titan).

---

## 7. Module map

```
src/engine/                     pure TypeScript physics (no UI imports)
  constants, types, orbital, propulsion, power, comms, cost, reliability,
  events, validation, builder, simulation, scoring, commands, data, index
src/game/
  MissionApp.tsx               shell: RTL/LTR, dynamic accent, transitions, chips, toasts
  theme.css                    design tokens, holographic panels, glass controls
  i18n.ts                      bilingual dictionary (ar/en) + fallback
  audio.ts                     Web Audio SoundManager (synthesized: no audio files)
  store.ts                     Zustand store: design, validation, simulation, progress
  input.ts                     keyboard + gamepad → named commands
  tech.ts                      tech tree data + unlock/level rules
  components/                  controls.tsx (HudFrame/Kpi/HudSlider/…), MissionControl.tsx,
                               AIHelper.tsx, ShortcutSheet.tsx, MiniGlobe.tsx (pure SVG)
  visual/                      lazy 3D layer: BaseCanvas + SceneShell + Environment + post stack,
                               shape library, scenes, GLSL shaders, motion presets, accent bridge
  visual/three/scenes/         Home, Wormhole, MissionSelect, Builder, OrbitOps, Launch
  visual/*View.tsx             lazy screen entries (globe, bay, ops, launch, replay, backdrop)
  screens/                     Home, Hangar, MissionSelect, Builder, Launcher, Orbit,
                               Simulation, Results, TechTree, StyleGuide
tests/                         engine.*, mission.unit, mission.flow (headless end-to-end)
```

Vision: holographic mission control (Void `#02050F`, Deep `#050B1F`, Panel `#0B1A3D`, Line `#1B2A50`,
Text `#E8F1FF`, Muted `#8FA3C8`) with a dynamic accent colour per target (Earth `#46C8FF`,
Mars `#FF6A3D`, Jupiter/Europa `#A77BFF`, Moon `#9AD1FF`, Venus `#FFC55A`, Eros `#C9B29B`,
Titan `#E8A03D`) that cross-fades in 0.6 s, a severe-fault
mode that turns the HUD monochrome red, and contextual mission chips + a keys sheet
(keyboard and gamepad first-class) instead of the retired pixel command deck.
The full style guide ships in-app: Home → *Style Guide*.

**Performance:** lazy-loaded screens and visual entries, a single WebGL context per screen (2D
fallbacks when WebGL is missing), marker projection throttled to 10 Hz, procedural textures instead
of image assets, quality presets (Low/Medium/High) for geometry and particle counts, and
`ResizeObserver` sized canvases. The whole `three` stack is now lazy: the initial payload is
`index` **59.4 KB** + `react` **83.3 KB** gzip (**≈143 KB JS**, down from ≈342 KB when three was
eager); the R3F canvas chunks (`BaseCanvas` ≈67 KB, `three` ≈192 KB gzip) load with the first 3D
scene and are shared by every later screen. Motion honours `prefers-reduced-motion` (camera drift
and launch shake off, marker snapping, wormhole transition skipped) and nothing flashes faster
than 3 Hz.

**Offline:** no network calls anywhere — fonts are bundled (`@fontsource`), textures are drawn on
canvas, audio is synthesized, and a service worker (`public/ma-sw.js`) caches the shell in the
browser build for full offline play.
