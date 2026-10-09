# Design system

The concrete spec for how Scrim looks and moves: identity, tokens, type, density, motion, components and layout, with the CSS to implement them. The rules and reasons behind it, including the six [safety invariants](UX_PRINCIPLES.md#safety-invariants), are in [UX_PRINCIPLES.md](UX_PRINCIPLES.md). When the two disagree, the safety invariants win.

Decided October 2026. Library versions, browser support and colour contrast were checked then. Every colour pair named here was measured against WCAG 2.2, and the token CSS compiles with Tailwind 4.3.3 (see [Verification](#verification)). The research behind it is in [docs/research/ui-ux/](docs/research/ui-ux/README.md).

## At a glance

| Decision      | Choice                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity      | **Tech Table**: the production desk in tech week. Black stage, spike tape, lit console buttons, paper scripts                                |
| Themes        | **Booth** (near-black, the default everywhere) and **Paper** (warm off-white, for daylight), plus System. Standard or High contrast          |
| Accent        | **UV**, a magenta-violet at hue 330. Users can change the hue; operator surfaces never use it                                                |
| State colours | Lamps: **go** (running), **standby** (next), **fault** (audience affected, PANIC). Status: **warn**, **info**. Neutral when nominal          |
| Type          | **IBM Plex Sans** for the interface, **IBM Plex Mono** for numbers, timecode and caps labels, **Fraunces** for brand moments. Self-hosted    |
| Shape         | Square: 2 px on controls, 4 px on overlays, 0 on panels. 1 px rules; panels meet edge to edge                                                |
| Density       | Compact 24 px, comfortable 28 px (editor default), stage 44 px (operator, remote, audience). UI scale 90–125%                                |
| Icons         | Lucide at a fixed 1.75 px stroke; 14, 16 or 20 px by density. State icons are Lucide too                                                     |
| Motion        | CSS first. `motion` 14 (`motion/react`) only in the editor, for layout, reorder and exit animations. None on the operator, remote or outputs |
| Components    | React Aria Components 1.22 (headless) and react-resizable-panels 4.14. Custom: lamps, GO, scrub fields, tape, scene map, cue dock            |
| Tokens        | Three tiers in CSS: primitives → semantic roles per theme → density. Tailwind 4 utilities through `@theme inline`                            |

## Identity: Tech Table

During tech week the production desk sits in the middle of the stalls. It holds scripts with pencilled cues, a strip of coloured spike tape, a desk lamp, and a console of labelled, lit buttons. Scrim should feel like that desk: **precise, tactile, labelled, calm**.

**How it was chosen.** The [identity research](docs/research/ui-ux/identity.md) proposed three directions:

- **Ghost Light:** a monochrome instrument with one warm accent.
- **Call Sheet:** paper, pencil and violet ink, with IBM Plex and Fraunces.
- **Spike:** spike tape on a black stage, with LED states, square corners and mono caps.

Tech Table blends Call Sheet and Spike, leaning towards Spike.

- **From Spike:**
  - near-black surfaces by default;
  - square corners;
  - mono caps labels;
  - lamp-style states;
  - mechanical, no-overshoot motion.
- **From Call Sheet:**
  - warm neutrals rather than cold greys;
  - a paper theme for daylight work;
  - IBM Plex with Fraunces for display;
  - the habit of writing a label on everything.

**Keeping it friendly.** Spike's austerity is what Figma moved away from for newcomers in UI3. Tech Table keeps the look but not the guessing:

- every control has a visible boundary (≥ 3:1) and a label;
- field labels stay in sentence case;
- the editor defaults to comfortable density;
- Paper is one click away for daylight work.

**Where it is quiet and where it is expressive:**

| Quiet (tool)                                          | Expressive (brand)                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Operator: no accent, no tape, lamps and words only    | Library header and start gallery: Fraunces, tape colours                              |
| Editor chrome: neutral surfaces, accent for selection | Empty-state headlines in Fraunces                                                     |
| Remote: lamps, mono caps, big targets                 | Audience page: the question in Fraunces, the accent on the chosen answer              |
| Output windows: nothing at all                        | Printed or exported cue sheets: Plex on paper, Fraunces title, tape stripes per scene |

**Mark.** Replace the 🎭 emoji on the audience page, and the generic app icon, with a wordmark and a spike-mark glyph: two crossed strips of tape, the floor mark for a position. The wordmark is "Scrim" in Fraunces 600. Both need a designer's pass; this sets the brief.

## Colour

### Themes and modes

Five settings live on `<html>`. They are set before first paint by an inline script ([Theme bootstrap](#theme-bootstrap)).

| Attribute or property | Values                            | Default                       | Set by                                                                        |
| --------------------- | --------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `data-theme`          | `booth`, `paper`                  | `booth`                       | Preferences: Booth / Paper / System                                           |
| `data-contrast`       | `standard`, `high`                | `standard`                    | Preferences; follows `prefers-contrast: more`                                 |
| `data-density`        | `compact`, `comfortable`, `stage` | `comfortable`, set per region | Each surface's root; Preferences can change the editor's                      |
| `data-motion`         | `full`, `reduced`                 | `full`                        | OS setting, Preferences (System / Reduced / Full); Show mode forces `reduced` |
| `--ui-scale`          | 0.9, 1, 1.1, 1.25                 | 1                             | Preferences (per machine)                                                     |

Output windows are not themed. They stay black (`#000`), with the cursor hidden.

### Neutral ramps

Two warm 12-step ramps, following the Radix scale roles: backgrounds, then controls, then lines, then text. Booth runs dark to light; Paper runs light to dark. Values are OKLCH lightness and chroma.

| Step | Role                                | Booth (hue 75) | Paper (hue 85) |
| ---- | ----------------------------------- | -------------- | -------------- |
| 1    | App background                      | 0.130 0.008    | 0.985 0.012    |
| 2    | Panel                               | 0.160 0.008    | 0.970 0.012    |
| 3    | Control                             | 0.195 0.008    | 0.945 0.012    |
| 4    | Control hover; raised               | 0.230 0.008    | 0.925 0.012    |
| 5    | Control active; overlay             | 0.265 0.008    | 0.905 0.012    |
| 6    | Subtle line (decorative)            | 0.310 0.008    | 0.885 0.010    |
| 7    | Strong line (dividers)              | 0.400 0.008    | 0.790 0.010    |
| 8    | Control line (≥ 3:1 on any surface) | 0.540 0.008    | 0.640 0.010    |
| 9    | Icons (≥ 3:1)                       | 0.600 0.008    | 0.590 0.009    |
| 10   | Subtle text, placeholders (≥ 4.5:1) | 0.640 0.008    | 0.510 0.009    |
| 11   | Secondary text (≥ 7:1)              | 0.790 0.008    | 0.430 0.009    |
| 12   | Primary text                        | 0.955 0.005    | 0.220 0.008    |

- **The stage canvas surround is a true neutral** (chroma 0), so the warm UI never tints colour judgement on the canvas.
- **In Booth, elevation is lighter, not shadowed:** app 1 < panel 2 < raised 4 < overlay 5. Overlays add one soft shadow. Paper uses shadows.
- **No pure-white surface anywhere in Booth.** A bright area is the biggest light source in a dark booth.

### Semantic roles

Components use only these roles, through the utilities in the token file. Values are `oklch(L C H)`; `h` is the accent hue.

| Utility                                       | Role                                              | Booth                               | Paper                                       |
| --------------------------------------------- | ------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| `bg-app`, `bg-panel`                          | App and panel backgrounds                         | steps 1, 2                          | steps 1, 2                                  |
| `bg-control` (+`-hover`, `-active`)           | Fields and buttons at rest                        | steps 3–5                           | steps 3–5                                   |
| `bg-raised`, `bg-overlay`                     | Popovers and menus; dialogs                       | steps 4, 5                          | near-white + shadow                         |
| `bg-canvas`                                   | Surround behind the stage canvas                  | `0.11 0 0`                          | `0.90 0 0`                                  |
| `border-line-subtle` / `-strong` / `-control` | Decorative rules / dividers / control edges       | steps 6 / 7 / 8                     | steps 6 / 7 / 8                             |
| `text-fg`, `text-fg-muted`, `text-fg-subtle`  | Primary, secondary, subtle text                   | steps 12, 11, 10                    | steps 12, 11, 10                            |
| `text-fg-icon`                                | Icons                                             | step 9                              | step 9                                      |
| `bg-accent`, `text-accent-fg`                 | Primary button, selection fill                    | `0.72 0.19 h`, dark legend          | `0.47 0.20 h`, white legend                 |
| `text-accent-text`, `bg-accent-subtle`        | Links, selected labels; selection tint            | `0.74 0.17 h`; 18% mix              | `0.47 0.20 h`; 12% mix                      |
| `outline-focus`                               | Focus ring, two-tone with `--focus-inner`         | step 12 over step 1                 | step 12 over step 1                         |
| `bg-lamp-go`, `bg-lamp-go-tint`, `text-go`    | Running; GO at rest (tint)                        | `0.76 0.17 152`; 14% tint           | `0.70 0.16 150`; tint; text `0.46 0.13 150` |
| `bg-lamp-standby`, `-tint`, `text-standby`    | Next (standby)                                    | `0.91 0.12 95`; 14% tint            | `0.86 0.13 92`; tint; text `0.52 0.11 85`   |
| `bg-lamp-fault`, `text-fault`                 | Audience affected; PANIC                          | `0.66 0.20 22`; text `0.68 0.19 22` | `0.54 0.20 22`; text `0.52 0.20 22`         |
| `text-on-lamp`, `text-on-fault`               | Legends on lit lamps                              | step 1 (dark ink)                   | step 12; white on fault                     |
| `text-warn`                                   | Health degraded but the show runs; logic warnings | `0.78 0.14 62`                      | `0.54 0.14 55`                              |
| `text-info`                                   | Neutral information                               | `0.76 0.10 240`                     | `0.50 0.12 245`                             |
| `bg-tape-1` … `bg-tape-8`                     | Scene and cue tags (editor, Library, print)       | L 0.72, C 0.13                      | L 0.58, C 0.14                              |

Rules:

- **One meaning per colour.**
  - Go, standby and fault mean only those operator states.
  - Warn is only for health and logic warnings. It is orange at a lower lightness than standby, never yellow.
  - The Rehearsal marker is a neutral inverted bar, not a colour.
  - "All fine" has no colour; it is neutral.
- **Lamps are lit with dark legends.** White text sits only on fault and on the accent in Paper, where it measures at least 5.2:1 for every hue.
- **Never colour alone.** Every lamp has a word, and abnormal states add an icon (see [Lamps](#lamps)).
- **The accent never appears on operator surfaces** (Operator, Remote) or in any state meaning. In the editor it marks selection, the primary action and links.
- **Focus is never coloured.** It is a two-tone ring of primary text over the app background, visible on any surface and never mistaken for a state.
- **Tape colours are tags, not states.**
  - They never appear in the operator view.
  - They are never a background for text: a tape stripe or dot sits beside a text label.

### Lamps

A lamp is the one way state is shown: in the operator, the status roll-up, the Remote and cue rows.

**Anatomy.** An 8 × 8 px LED square with a 1 px `line-control` border, then a word in `label-caps`, then an optional Lucide icon. The border keeps the LED's edge at ≥ 3:1 even when a light lamp colour sits on Paper.

**States.**

- **Off:** an empty LED, with the word in `fg-subtle`.
- **Lit:** the LED filled with the lamp colour, and the word in `fg`.
- **Fault:** lit, with the `X` icon and the word in `text-fault`.

**Timing.** A lamp lights instantly. In the full profile it goes out over `--dur-fast`, like an LED decaying; in the reduced profile over `--dur-micro`. Lamps never blink or pulse.

| What                       | Lamp                     | Icon + word                                                                        | Where                         |
| -------------------------- | ------------------------ | ---------------------------------------------------------------------------------- | ----------------------------- |
| Cue running                | go, lit                  | `Play` LIVE + progress line                                                        | Cue list, Running strip       |
| Cue on standby             | standby, lit             | NEXT + playhead bar + `bg-lamp-standby-tint` row                                   | Cue list, GO panel            |
| Cue done                   | none                     | `Check`; text in `fg-subtle`                                                       | Cue list                      |
| Health nominal             | off                      | OUTPUTS · SOUND · ROOM · INPUTS                                                    | Status roll-up                |
| Health degraded, show runs | off, word in `text-warn` | `TriangleAlert` + one verb                                                         | Status roll-up                |
| Audience affected now      | fault, lit               | `X` + one verb ("Reopen")                                                          | Status roll-up, message strip |
| Blacked out                | fault, lit               | BLACKED OUT · Release (steady)                                                     | PANIC button                  |
| Hold on                    | none                     | `Pause` HOLD in `fg`                                                               | GO panel                      |
| Show mode                  | none                     | `Lock` SHOW in `fg-muted`                                                          | Operator header               |
| Rehearsal                  | none                     | Inverted bar (`bg-fg text-app`): REHEARSAL · EDITING UNLOCKED · DOUBLE-CLICK FIRES | Operator header               |
| Performer: your cue        | standby ring (steady)    | YOUR CUE · Tap ready                                                               | Remote                        |

### Accent

**One input, the hue.** The default is 330 (UV). Preferences › Appearance offers 8 presets and a hue slider. The slider skips 355°–50°, so the accent can never look like fault or warn.

Lightness and chroma are fixed per theme, so every hue keeps its contrast:

| Theme | Accent               | Lowest contrast across all hues                        |
| ----- | -------------------- | ------------------------------------------------------ |
| Booth | L 0.72, dark legend  | 7.2:1 for the legend, 7.6:1 as text                    |
| Paper | L 0.47, white legend | 5.25:1 for the legend, 4.88:1 as text, both at hue 195 |

The flip rule for any future accent: L ≥ 0.60 takes a dark legend, L < 0.60 a white one. The hue is written with `style.setProperty('--accent-h', …)` on `<html>`, so it needs no React render.

### Tape palette

Eight spike-tape hues tag scenes and cues: 25 red, 60 orange, 95 yellow, 150 green, 190 teal, 245 blue, 295 violet, 345 pink.

- Each scene gets one. It shows as a 4 px stripe on editor cue rows, a dot in the scene map, a stripe on printed cue sheets, and on Library cards.
- A cue can override its scene's colour.
- Following QLab, an optional second colour can mark a cue once it has started (editor and print only).
- Tape never appears in the operator view, where red, yellow and green belong to the lamps.

## Typography

| Family        | Use                                                                                               | Files (Latin subset)              | Licence |
| ------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| IBM Plex Sans | All interface text                                                                                | Variable, wght 100–700, ~45 KB    | OFL     |
| IBM Plex Mono | Cue numbers, timecode, durations, numeric fields, caps labels, key hints, the log                 | Static 400, 500, 600, ~15 KB each | OFL     |
| Fraunces      | Brand moments only: Library header, empty-state headlines, audience questions, printed cue sheets | Variable, opsz + wght, ~66 KB     | OFL     |

- **Self-host all three and precache them** in the PWA, because the show machine runs offline. Fraunces is downloaded only where Fraunces text renders, so tool screens never pay for it.
- **Plex Sans digits are tabular by default,** so numbers and timecode don't jitter.
- **Plex has no key glyphs** (⌘ ⌥ ⇧). The `Kbd` component falls back to `system-ui` for them.
- **Check OpenType features after subsetting.** `tnum` survives Latin subsets; check `case` and `zero`.
- **The audience page must not reflow when fonts arrive.** Use `font-display: optional` there, with a metric-matched fallback (`size-adjust`, `ascent-override`), so answer buttons never move under a thumb.

**Scale.** These are role names, not sizes. `text-ui`, `text-label` and `text-caption` follow density.

| Class                                  | Size / line (stage)                | Use                                                                                    |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `label-caps`                           | 12 / 16 (13 / 18)                  | Panel titles, section labels, lamp words, key hints. Plex Mono 500, uppercase, +0.06em |
| `text-caption`                         | 12 / 16 (13 / 18)                  | Secondary metadata, helper text                                                        |
| `text-ui`                              | 13 / 18 (15 / 22); compact 12 / 16 | Default interface text, field values, lists                                            |
| `text-body`                            | 14 / 20                            | Dialogs, notes in the editor, audience body copy                                       |
| `text-title font-semibold`             | 16 / 24                            | Dialog and section titles                                                              |
| `text-heading font-semibold`           | 20 / 28                            | Page headings; add `font-display` on brand surfaces                                    |
| `text-cue font-semibold`               | 28 / 32                            | The standby cue in the GO panel; its number `font-mono`                                |
| `text-display font-mono font-semibold` | 40 / 44                            | GO label, clocks; `font-display` for the Library title                                 |

- **Floor:** no text below 12 px.
- **In the operator** (stage density), labels and captions are at least 13 px, and everything else at least 15 px.
- **Field labels stay in sentence case** (`text-caption` or `text-ui`). Mono caps are for short labels people scan, never for sentences.

## Space, density and shape

The base grid is 4 px. Density changes control and row heights, icon size and three text roles through the tier-3 tokens. Spacing utilities (`p-2`, `gap-3`) stay on the 4 px grid.

| Token                      | Compact | Comfortable | Stage | Utility                      |
| -------------------------- | ------- | ----------- | ----- | ---------------------------- |
| `--control-h`              | 24 px   | 28 px       | 44 px | `h-control`                  |
| `--row-h`                  | 24 px   | 28 px       | 40 px | `h-row`                      |
| `--panel-head-h`           | 28 px   | 32 px       | 40 px | `h-panel-head`               |
| `--icon-size`              | 14 px   | 16 px       | 20 px | `size-icon`                  |
| `--text-ui`                | 12 px   | 13 px       | 15 px | `text-ui`                    |
| `--text-label`, `-caption` | 12 px   | 12 px       | 13 px | `label-caps`, `text-caption` |

| Surface                    | Density                        |
| -------------------------- | ------------------------------ |
| Library, Editor            | Comfortable (Compact optional) |
| Operator, Remote, Audience | Stage                          |

- **UI scale.** `--ui-scale` (0.9, 1, 1.1, 1.25) sets the root font size. All sizes are in rem, so everything follows, while 1 px lines and 2–4 px corners stay crisp. It suits laptops at a distance and high-resolution booth screens.
- **Targets.** Every control is at least 24 × 24 px (WCAG 2.5.8). GO, PANIC, remote triggers and audience answers are at least 44 px.
- **Radius.**
  - `rounded-control` (2 px) for buttons, fields, chips, lamps and cards.
  - `rounded-overlay` (4 px) for popovers, menus, dialogs and toasts.
  - 0 for panels.
  - No pills; even switches are square-cornered.
- **Lines.** Always 1 px. Panels meet edge to edge, with a `line-subtle` divider and no gutters. Control edges use `line-control`.

**Layers.** No layer may overlap the GO or PANIC rectangle (safety invariant 4).

| Layer                            | z-index | Surface   | Shadow           |
| -------------------------------- | ------- | --------- | ---------------- |
| Panels                           | 0       | `panel`   | none             |
| Sticky headers                   | 10      | `panel`   | none             |
| Popover, menu, tooltip           | 30      | `raised`  | `shadow-overlay` |
| Toast lane                       | 40      | `raised`  | `shadow-overlay` |
| Dialog (editor and Library only) | 50      | `overlay` | `shadow-overlay` |

Banners (output lost, blacked out, resumed) are not overlays. In the operator they appear in the GO panel's fixed-height message strip, and in the editor in a strip under the header. Toasts sit in a lane that never covers GO, PANIC, the cue list or the focused element (WCAG 2.4.11).

## Icons

- **Lucide** (`lucide-react`, already in use), with `absoluteStrokeWidth` and `strokeWidth={1.75}`, so strokes stay 1.75 px at every size.
- **Size from density:** 14, 16 or 20 px (`size-icon`). The colour is `text-fg-icon`, or the text colour when the icon sits in a label.
- **State icons are Lucide too:** `Play`, `Check`, `TriangleAlert`, `X`, `Pause`, `Lock`. Not text glyphs or emoji, which fall back to inconsistent system fonts.
- **Icon-only buttons** need an `aria-label` and a tooltip that names the action and shows its key. In the operator, that is the Info strip instead.

## Motion

The rules are in [UX principle 10](UX_PRINCIPLES.md#10-instant-by-default-motion-explains-never-delays) and the [safety invariants](UX_PRINCIPLES.md#safety-invariants). The personality is **mechanical**: quick, decelerating, with no visible overshoot in the tools. The softer, more expressive motion is reserved for the audience page.

### Library and where it loads

- **`motion` 14.0.x** (`import { … } from 'motion/react'`; MIT; React 18 and 19; released 2 October 2026). Pin `~14.0`.
- **CSS first.** CSS transitions handle hover, press, menu, popover and dialog entry and exit (`@starting-style`, with Tailwind's `starting:` and `transition-discrete`).
- **Motion only where CSS can't:**
  - layout (FLIP) animations;
  - exits of elements React has removed (`AnimatePresence`);
  - gestures that keep their velocity.

| Surface                     | Motion library            | Why                                                                                    |
| --------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| Editor (lazy route chunk)   | `motion` (full component) | Reorder settle, list add and remove, panel content, toasts                             |
| Library                     | CSS only                  | First-paint fade, card stagger                                                         |
| Operator                    | **CSS only**              | The main thread stays free for the show. Toasts exit with CSS                          |
| Remote, Audience page       | CSS only                  | Phones on venue Wi-Fi. Add `motion/mini` (about 3 KB) only if a spring is truly needed |
| Output windows, `render/**` | **Never**                 | Safety invariant 6                                                                     |

**Bundle size.** Measured with esbuild on `motion` 14.0.0 in October 2026, gzip:

- `m` + `LazyMotion` + `domAnimation` + `AnimatePresence`: about 29 KB;
- `domMax`, which layout animation needs: about 43 KB;
- the full `motion` component: about 43 KB.

Since `domMax` costs the same as the full component, the editor simply imports `motion`. Re-measure in Scrim's own build when adopting it.

**Reorder.** Reordering uses React Aria's `GridList` drag-and-drop, which comes with keyboard and screen-reader support. Motion's `layout` animates only the siblings settling after the drop. Prototype `layout` with React Aria's `Virtualizer` before relying on it; the combination is untested.

### Tokens

**Durations.** Use them as `duration-(--dur-fast)` in Tailwind, or as seconds in Motion. Nothing in the tools runs longer than `slow`.

| Token           | ms  | Use                                                                                  |
| --------------- | --- | ------------------------------------------------------------------------------------ |
| `--dur-instant` | 0   | Everything in the "never animates" list (UX principle 10)                            |
| `--dur-micro`   | 100 | Press release, hover, tooltip fade, exits of small surfaces; the reduced-profile cap |
| `--dur-fast`    | 150 | Menu and popover entry, toggles, toast exit, lamp decay. The default                 |
| `--dur-base`    | 200 | Dialog entry, toast entry, panel content, vote bars                                  |
| `--dur-slow`    | 300 | Audience phone transitions, the "just fired" row fade                                |

Exits take about two-thirds of the entry time.

**Easings** (`ease-*` utilities):

| Easing   | Curve                        | Use                                      |
| -------- | ---------------------------- | ---------------------------------------- |
| `enter`  | `cubic-bezier(0, 0, 0, 1)`   | Decelerate: everything entering          |
| `move`   | `cubic-bezier(0.2, 0, 0, 1)` | The default for all transitions          |
| `exit`   | `cubic-bezier(0.3, 0, 1, 1)` | Accelerate: only exits of 150 ms or less |
| `soft`   | `cubic-bezier(0, 0, 0.3, 1)` | Audience page only                       |
| `linear` | —                            | Countdowns and progress only             |

**Springs** (Motion). At `bounce: 0.1` the overshoot is about 0.15%, which is invisible, and the spring keeps its velocity if interrupted.

```ts
// apps/web/src/ui/motion.ts
export const spring = {
  snap: { type: 'spring', visualDuration: 0.14, bounce: 0.1 }, // switches, segmented highlight
  settle: { type: 'spring', visualDuration: 0.2, bounce: 0.1 }, // popovers, panel content, reorder settle, toasts
  glide: { type: 'spring', visualDuration: 0.3, bounce: 0.1 }, // large areas (Library cards)
  pop: { type: 'spring', visualDuration: 0.35, bounce: 0.25 }, // audience page only: the "vote counted" check
} as const;
```

Where they come from: the durations follow Fluent 2, Material 3 and Carbon, whose scales converge on 100–300 ms. `enter` and `move` are Material 3's standard-decelerate and standard curves. `soft` is Carbon's expressive entrance. The springs are Material 3 Expressive's spatial springs, converted to Motion's `visualDuration`/`bounce`.

### Setup

```tsx
// Editor route root
<MotionConfig
  reducedMotion={document.documentElement.dataset.motion === 'reduced' ? 'always' : 'never'}
  transition={spring.settle}
>
  {children}
</MotionConfig>
```

- **`data-motion` on `<html>` is the single switch.** It is `reduced` when:
  - the OS prefers reduced motion, unless the user chose Full;
  - the user chose Reduced;
  - the operator is in Show mode.
- **CSS reads it through the `motion-ok:` variant.** Transform and position transitions are written as `motion-ok:transition-transform`. Colour and opacity transitions use `duration-(--dur-micro)` when reduced.
- **Ban `transition-all`.** The default transition is set in the token file, so every existing `transition-*` class tightens at once.
- **No Tailwind `transition-*` class on a `motion` element.** The two fight and stutter.

### Patterns

**Full** is the normal editor and Library profile. **Reduced** applies with reduced motion, and always in the operator in Show mode.

| Pattern                                       | Full                                                                                                                                                      | Reduced                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Press: GO, PANIC, operator and remote buttons | Instant change of fill or border on press-in (`active:transition-none`); release over `micro`. Shape never changes                                        | Same                              |
| Press: editor and Library buttons             | `active:scale-[.97]`, instant; release over `micro`                                                                                                       | Colour change only                |
| Keyboard GO                                   | A 100 ms `data-pressed` fill echo                                                                                                                         | Same                              |
| Hover                                         | Colour only, `micro`                                                                                                                                      | Same                              |
| Tooltip (editor)                              | The first one appears after 500 ms; later ones appear instantly, with no animation                                                                        | Same                              |
| Menu, popover opened with the pointer         | `fast`: opacity plus scale 0.96→1 from the trigger's side, `enter`; exit `micro`, opacity only                                                            | Opacity only, `micro`             |
| Menu, popover, palette opened by keyboard     | Instant                                                                                                                                                   | Instant                           |
| Dialog (editor, Library)                      | Native `<dialog>`: `base` opacity plus scale 0.96→1, backdrop fade; exit `micro`. Resolve the promise before the exit                                     | Opacity, `micro`                  |
| Toast                                         | Enters with an 8 px rise and fade (`settle`); exit `micro`. The editor stack uses `layout="position"`, at most 4                                          | Opacity, `micro`; no stack motion |
| Tab switch                                    | Instant                                                                                                                                                   | Instant                           |
| Panel collapse / expand                       | The panel snaps to size; only its content fades in (`base`). Splitter drags are 1:1                                                                       | Instant                           |
| Canvas selection, handles, snapping guides    | Instant                                                                                                                                                   | Instant                           |
| Cue, layer or rule reorder (editor)           | While dragging, lift with a shadow (`micro`); on drop, siblings settle (`layout`, `settle`). Keyboard moves are instant and announced                     | Instant                           |
| Rows added or removed (editor)                | New row: `base` fade with a 4 px offset. Removed row: `micro` fade; siblings close the gap with `settle`                                                  | Opacity, `micro`; instant reflow  |
| Media import                                  | Progress after 300 ms; thumbnails fade in over `fast` on fixed-size placeholders                                                                          | Thumbnails appear instantly       |
| Standby advance (operator)                    | Instant. Scrolling the row into view is instant for key and GO moves, and smooth (≤ `base`) only for pointer reveals                                      | Instant                           |
| "Just fired" row (operator)                   | A low-brightness overlay fades out over `slow`                                                                                                            | Fades over `micro`                |
| Rehearsal ↔ Show                              | The state flips instantly; the header marker fades over `base` (colour and opacity only)                                                                  | Marker swaps instantly            |
| Lamp on / off                                 | On instantly; off over `fast`                                                                                                                             | On instantly; off over `micro`    |
| PANIC, blackout, release                      | Instant. The fade to black on outputs belongs to the engine                                                                                               | Same                              |
| Vote bars (operator)                          | CSS `scaleX` transition over `base` with `move`; numbers never tween; order never changes                                                                 | Bars jump; numbers update         |
| Audience page                                 | Moment card enters over `slow` (16 px rise and fade, `soft`); the chosen answer is instant, with a haptic; the check uses `pop`; close fades over `micro` | Fades only, `micro`               |

### Motion rules

The safety invariants come first. On top of them:

1. **No Motion import in output routes or `render/**`.** This is enforced by ESLint `no-restricted-imports` and a CI check that output chunks contain no `motion-dom`. No UI transition targets Stage nodes.
2. **Nothing in the operator awaits an animation.**
   - No `onAnimationComplete` gates.
   - No `AnimatePresence mode="wait"`.
   - No entry delays or staggers in the GO panel, the cue list or the outputs.
3. **Operator discipline.**
   - Animate only `transform` and `opacity`. Never `width`, `height`, `top`, `left`, margins or box shadows.
   - No View Transitions.
   - No loops.
4. **Everything is interruptible,** and nothing exceeds `slow` outside the audience page.
5. **Accessibility.**
   - Honour the OS setting and the in-app choice.
   - Nothing moves for over five seconds without a stop.
   - Nothing flashes more than three times a second.

## Components

### Libraries

| Need                            | Choice                                               | Why                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headless, accessible primitives | **React Aria Components** 1.22.x (Adobe, Apache-2.0) | The only one with Tree, colour pickers, and GridList with keyboard drag-reorder; it publishes a screen-reader test matrix. Base UI 1.8 and Radix 1.7 each miss several of these |
| Resizable panels                | **react-resizable-panels** 4.14.x                    | Fixed layouts that resize, collapse and persist; keyboard splitters; `disabled` locks a layout in Show mode                                                                     |
| Animation                       | **motion** 14.0.x                                    | See [Motion](#motion)                                                                                                                                                           |
| Command palette                 | React Aria `Autocomplete` + `Menu`                   | `cmdk` has had no release since March 2025                                                                                                                                      |
| Toasts                          | Scrim's toast store                                  | Add an F6 landmark, pause on hover and focus, a 5 s minimum, persistent errors and an action slot (Undo). Move to React Aria Toast when it leaves `UNSTABLE_`                   |
| Icons                           | lucide-react (existing)                              | See [Icons](#icons)                                                                                                                                                             |

**Cost.** React Aria for the full set is about 113 KB gzip, and Motion about 43 KB, both measured in October 2026. App JavaScript today is about 303 KB gzip. That is acceptable for a precached app, if it is split by route. The operator route imports Tabs, Menu, GridList and ToggleButtonGroup, and no Motion.

**Esc in overlays** (safety invariants 1 and 2). React Aria overlays stop Esc from propagating, so register PANIC on `window` in the capture phase, ignoring `defaultPrevented`.

- In the operator, overlays set `isKeyboardDismissDisabled`.
- Native dialogs call `preventDefault()` on `cancel`, so pressing Esc never both closes a dialog and fires PANIC.
- In the editor, overlays keep Esc-to-close, and the editor forwards Esc as PANIC only when nothing is open or being edited.

### Inventory

**Today** refers to `apps/web/src/ui/` and the routes.

| Component                     | Today                                                                     | Build on                                                                              | Notes                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Button, IconButton            | `Button.tsx`: 5 variants (primary, secondary, ghost, danger, go), 3 sizes | RAC `Button`                                                                          | `go` becomes the GO component. Icon-only needs a tooltip                                                           |
| GO, PANIC, Hold, Back         | Inside `GoPanel`                                                          | RAC `Button` + `usePress`                                                             | See [GO and PANIC](#go-and-panic)                                                                                  |
| Hold-to-confirm button        | None (modal confirms)                                                     | RAC `Button` + `usePress`                                                             | One-second hold with progress on the button. For Reset and Take over                                               |
| Lamp, status roll-up          | `Badge` (colour only)                                                     | Custom                                                                                | See [Lamps](#lamps)                                                                                                |
| Message strip                 | Banners above the layout (they shift it)                                  | Custom                                                                                | Fixed height in the GO panel and under the editor header                                                           |
| Off-script chip               | None                                                                      | Custom                                                                                | Count, list of deviations, "Back to script"                                                                        |
| Tooltip with key hint         | 49 `title=` attributes, plus IconButton's built-in `title`                | RAC `Tooltip` + `Kbd`                                                                 | Editor and Library. The operator uses the Info strip                                                               |
| Info strip                    | None                                                                      | Custom                                                                                | One line plus the key for what is under the pointer or focused; `?` toggles                                        |
| Kbd                           | `Panel.tsx`                                                               | Custom                                                                                | Platform glyphs (⌘ on macOS, Ctrl elsewhere), `label-caps`                                                         |
| Menu, context menu            | None                                                                      | RAC `Menu`, `MenuTrigger trigger="contextMenu"`                                       | Every context-menu item also has a visible control; menu items offer "Set shortcut…"                               |
| Select, combobox, rule chips  | 37 native selects (36 through the `Select` wrapper)                       | RAC `Select`, `ComboBox`, `Autocomplete`                                              | Searchable; labels, never internal keys                                                                            |
| Number field with scrub label | `NumberInput`                                                             | RAC `NumberField` + custom `ScrubLabel` (`useMove`)                                   | See [Scrub field](#scrub-field)                                                                                    |
| Slider                        | None                                                                      | RAC `Slider`                                                                          | Opacity, volume, crossfade                                                                                         |
| Colour picker, eyedropper     | Native colour input                                                       | RAC `ColorArea`, `ColorSlider`, `ColorField` + custom OKLCH sliders; `EyeDropper` API | React Aria covers RGB, HSL and HSB. The EyeDropper API has limited browser support; show it behind a feature check |
| Segmented control             | Ad hoc (Rehearsal/Show)                                                   | RAC `ToggleButtonGroup`                                                               | View toggles. The Show-mode switch adds the one-second hold to leave                                               |
| Tabs                          | `Tabs.tsx` (no arrow keys)                                                | RAC `Tabs`                                                                            | Arrow keys; instant switching                                                                                      |
| Tree (layers, scenes)         | Custom lists                                                              | RAC `Tree`                                                                            | Keyboard, screen reader, drag to reorder and to nest. Layers with frames; scenes with their cues                   |
| Cue list                      | `CueList`, `CueStack` (rows not focusable)                                | Editor: the scene `Tree`. Operator: RAC `GridList` + drag-and-drop + `Virtualizer`    | Keyboard reorder, drop indicator; Motion `layout` settles the drop in the editor                                   |
| Dialog                        | Native `<dialog>`, promise-based `ask()`                                  | Keep; CSS motion                                                                      | Editor and Library only (safety invariant 5)                                                                       |
| Toast                         | `toast.tsx`                                                               | Keep, improved                                                                        | Action slot for Undo; one lane per surface                                                                         |
| Resizable panels              | Fixed grid columns                                                        | react-resizable-panels                                                                | See [Layout](#layout)                                                                                              |
| Command palette               | None                                                                      | RAC `Autocomplete` + `Menu` in a `Modal`                                              | Reads the command registry. Library, editor and Rehearsal only                                                     |
| Preferences                   | Scattered fields                                                          | RAC `Dialog`, `SearchField`, `Switch`                                                 | Search, changed markers, per-row Reset, import/export checklist                                                    |
| Text field, area, toggle      | `Field.tsx`                                                               | RAC `TextField`, `Switch`, `Checkbox`                                                 | Square switch                                                                                                      |
| Empty state                   | `Empty`                                                                   | Custom                                                                                | Headline (Fraunces on brand surfaces), one line, one action                                                        |
| Start gallery                 | Demo button                                                               | Custom on RAC `GridList`                                                              | Blank, Demo, starters, saved templates                                                                             |
| Panel                         | `Panel`                                                                   | Custom                                                                                | Header `h-panel-head`, title `label-caps`, actions on the right, 1 px rule                                         |
| Progress                      | None                                                                      | RAC `ProgressBar`                                                                     | Media import, with Cancel                                                                                          |
| Task bar                      | None                                                                      | RAC `Toolbar`                                                                         | Floats above the selection on the canvas; hidden while dragging                                                    |
| Map mode                      | Controls form                                                             | Custom overlay on the operator layout                                                 | Highlights mappable controls; inline conflict resolution                                                           |
| Tape picker, tape stripe      | None                                                                      | Custom on RAC `RadioGroup`                                                            | 8 swatches with names; the stripe is 4 px                                                                          |
| Cue dock (timeline)           | None                                                                      | Custom                                                                                | Bars per action on a time ruler; keyboard fields mirror it                                                         |
| Scene map                     | None                                                                      | Custom SVG                                                                            | Read-only and derived; clicking selects in the list                                                                |
| Pads grid                     | `Remote.tsx` buttons                                                      | Custom on RAC `Button`                                                                | Shared by the Remote and an operator Pads tab                                                                      |

### GO and PANIC

**GO.**

- **Size:** at least 112 px tall (today's height) and 192 px wide, filling the GO panel column.
- **Label:** "GO" in `text-display font-mono font-semibold`, with the key in `label-caps` below it.
- **States:**
  - **Ready** (a cue on standby): `bg-lamp-go-tint`, a 2 px `border-go`, label in `text-go`. It is calm at rest, with no glow and no shadow.
  - **Pressed:** filled `bg-lamp-go text-on-lamp`, instantly, for the press and a 100 ms echo.
  - **Nothing on standby:** a `line-control` outline, label in `text-fg-subtle`, and "Nothing on standby" in the message strip. GO is never disabled.
  - **Lockout:** for the 300 ms after a press, a 2 px `fg` ring shows the guard. A press during lockout flashes the ring, so a GO is never dropped silently.

**PANIC.**

- **Size and place:** 44 px tall, in its own corner of the GO panel, at most 40% of the panel's width and at least 24 px from GO.
- **Rest:** a `line-control` outline, "PANIC" in `fg`, `Esc` in `label-caps`, and an unlit fault LED.
- **Blacked out:** filled `bg-lamp-fault text-on-fault`, reading "BLACKED OUT · Release". It is steady.
- **Secondary clears** (Text, Media, Sound) sit beside it at `h-control`.

**Hold and Back** sit next to GO at `h-control`, stage density.

### Scrub field

- **The label is the drag handle** (cursor `ew-resize`), using pointer lock where the browser allows it.
- **Steps:** 1 unit per 2 px of drag. Shift multiplies by 10, Alt by 0.1. ↑/↓ change by 1, or by 10 with Shift.
- **Typed math:** `+10`, `*2`, `/2`, and `Mixed+10` across a multi-selection.
- **Units** show as a suffix in `fg-subtle` (px, %, s, dB).
- **Commit** on pointer-up, as one undo step, using the existing `coalesce` undo key.
- **Values** are in Plex Mono with tabular digits.

### Rule sentence

- **A rule is a line of chips:** "When [Door vote] [closes], and [door] [is] [The red door], then [go to scene] [Cellar]".
- **Chips:**
  - `h-control`, `rounded-control`, `bg-control`, with a `line-control` border.
  - An empty chip has a dashed border and "Choose…" in `fg-subtle`.
  - A chip opens a searchable picker.
- **Grouping:** rules that share a trigger sit under one header, with numbered rows. A collapsed rule shows only its sentence.
- **Logic-check problems** on a rule show a `TriangleAlert` in `text-warn`, with the reason.

## Layout

**Editor pages.** All panels use react-resizable-panels.

- Side panels set `groupResizeBehavior="preserve-pixel-size"`, so they keep their width when the window resizes.
- The centre panel keeps a relative size.
- The Stage group uses `resizePreviewMode="separator"`, so the canvas is measured once on release, not on every pointer move.

| Page        | Left                                                        | Centre                                              | Right                                                   | Bottom                       | Also holds                                                          |
| ----------- | ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| Stage       | Media + layers: 260 px (min 200; collapses to a 40 px rail) | Canvas, with the outputs strip and task bar         | Inspector: 288 px (min 240, max 420, collapsible)       | Cue dock: 0–40%, collapsible | Rulers, guides and safe area per output; eyedropper                 |
| Cues        | Cue list: 340 px (min 260), List \| Map toggle              | Cue editor                                          | After this cue: 360 px (collapsible), with Assume chips | —                            | Logic-check count in the tab                                        |
| Interaction | Values and triggers: 300 px                                 | Rules as sentences, grouped, with an overview strip | Moment editor: 360 px, with Try every outcome           | —                            | Recipe cards in the empty state and the Add menu; logic-check count |

- **Layouts persist per page, per machine** under `scrim.layout.<surface>.<page>`, through the guarded storage helpers. **View › Reset layout** restores the defaults, with Undo.
- **Focus canvas** (Shift+\\) collapses both sides. The inspector comes back on selection.
- **The Info strip** runs along the bottom edge of the window; `?` toggles it.

**Operator.**

- **Layout:** cue list (min 280 px) | GO panel (min 420 px) | side tabs (min 300 px, collapsible). Splitters work in Rehearsal and are `disabled` in Show mode.
- **The GO panel's regions are fixed,** top to bottom:
  - the message strip (48 px);
  - standby (name, and notes clamped to a fixed height that scrolls);
  - GO with Hold and Back;
  - the Running strip;
  - the live and next outputs;
  - PANIC with the secondary clears.
- **Booth brightness.** Thumbnails are drawn at about 60% brightness in Booth (a per-machine setting). Output windows themselves are never dimmed.

**Minimum widths.**

- The editor and the full operator view need at least 1024 px. Below that, the editor shows a message instead of a broken layout, and the operator switches to the **simple view**: Now and Next, a GO at least 60% of the width and 200 px tall, Hold and Back at 56 px, places and the open moment below, and PANIC in its own top corner (its own row on a phone). A show can open in the simple view at any width (`operator.layout`).
- The Remote and the audience page are single-column from 320 px, with safe-area padding.

## Surfaces

| Surface           | Theme default           | Density     | Accent                        | Type notes                              | Motion                              |
| ----------------- | ----------------------- | ----------- | ----------------------------- | --------------------------------------- | ----------------------------------- |
| Library           | Booth                   | Comfortable | Brand moments, primary action | Fraunces title and gallery headings     | CSS; first-paint fade               |
| Editor            | Booth (Paper optional)  | Comfortable | Selection, primary, links     | Plex; mono for values                   | Motion (lazy chunk)                 |
| Operator          | Booth                   | Stage       | **None**                      | Mono for numbers, timecode and labels   | CSS only; reduced in Show mode      |
| Output windows    | None (black)            | —           | —                             | —                                       | **None**                            |
| Remote            | Booth                   | Stage       | **None**                      | Mono caps lamp words                    | CSS only                            |
| Audience page     | Booth (dark auditorium) | Stage       | The chosen answer             | Fraunces question, Plex answers         | Expressive but small; `soft`, `pop` |
| Printed cue sheet | Paper                   | —           | —                             | Fraunces title, Plex body, tape stripes | —                                   |

The audience page defaults to Booth, because a bright phone in a dark auditorium distracts everyone around it.

## Implementation

### Token file

This is `apps/web/src/theme.css`, shared by the app (`styles.css`) and the audience page (`audience/audience.css`), which each run their own Tailwind build. During the migration, `ink-*` and `live` aliases at the end of `@theme inline` kept older classes working; they are now removed, and a lint rule rejects them.

```css
@import 'tailwindcss';

/* ── Tier 1: primitives. Plain variables; no utilities are generated from them. ── */
:root {
  /* Booth: warm near-black neutrals (hue 75). Steps 1–12, darkest first. */
  --booth-1: oklch(0.13 0.008 75);
  --booth-2: oklch(0.16 0.008 75);
  --booth-3: oklch(0.195 0.008 75);
  --booth-4: oklch(0.23 0.008 75);
  --booth-5: oklch(0.265 0.008 75);
  --booth-6: oklch(0.31 0.008 75);
  --booth-7: oklch(0.4 0.008 75);
  --booth-8: oklch(0.54 0.008 75);
  --booth-9: oklch(0.6 0.008 75);
  --booth-10: oklch(0.64 0.008 75);
  --booth-11: oklch(0.79 0.008 75);
  --booth-12: oklch(0.955 0.005 75);

  /* Paper: warm off-white neutrals (hue 85). Steps 1–12, lightest first. */
  --paper-1: oklch(0.985 0.012 85);
  --paper-2: oklch(0.97 0.012 85);
  --paper-3: oklch(0.945 0.012 85);
  --paper-4: oklch(0.925 0.012 85);
  --paper-5: oklch(0.905 0.012 85);
  --paper-6: oklch(0.885 0.01 85);
  --paper-7: oklch(0.79 0.01 85);
  --paper-8: oklch(0.64 0.01 85);
  --paper-9: oklch(0.59 0.009 85);
  --paper-10: oklch(0.51 0.009 85);
  --paper-11: oklch(0.43 0.009 85);
  --paper-12: oklch(0.22 0.008 85);

  /* Accent hue: the one colour input a user can change (Preferences › Appearance). 330 = UV. */
  --accent-h: 330;

  /* Spike-tape hues for scene and cue tags (never state). */
  --tape-h-1: 25;
  --tape-h-2: 60;
  --tape-h-3: 95;
  --tape-h-4: 150;
  --tape-h-5: 190;
  --tape-h-6: 245;
  --tape-h-7: 295;
  --tape-h-8: 345;

  /* Motion durations (Tailwind has no duration namespace: use duration-(--dur-fast)). */
  --dur-instant: 0ms;
  --dur-micro: 100ms;
  --dur-fast: 150ms;
  --dur-base: 200ms;
  --dur-slow: 300ms;
}

/* ── Tier 2: semantic roles per theme. Components use only these (through the utilities below). ── */
:root,
[data-theme='booth'] {
  color-scheme: dark;
  --surface-app: var(--booth-1);
  --surface-panel: var(--booth-2);
  --surface-control: var(--booth-3);
  --surface-control-hover: var(--booth-4);
  --surface-control-active: var(--booth-5);
  --surface-raised: var(--booth-4);
  --surface-overlay: var(--booth-5);
  --surface-canvas: oklch(0.11 0 0);
  --line-subtle: var(--booth-6);
  --line-strong: var(--booth-7);
  --line-control: var(--booth-8);
  --fg: var(--booth-12);
  --fg-muted: var(--booth-11);
  --fg-subtle: var(--booth-10);
  --fg-icon: var(--booth-9);
  --fg-on-lamp: var(--booth-1);
  --fg-on-fault: var(--booth-1);
  --focus: var(--booth-12);
  --focus-inner: var(--booth-1);
  --accent: oklch(0.72 0.19 var(--accent-h));
  --accent-hover: oklch(0.77 0.17 var(--accent-h));
  --accent-fg: var(--booth-1);
  --accent-text: oklch(0.74 0.17 var(--accent-h));
  --accent-subtle: color-mix(in oklab, var(--accent) 18%, var(--surface-panel));
  --lamp-go: oklch(0.76 0.17 152);
  --lamp-standby: oklch(0.91 0.12 95);
  --lamp-fault: oklch(0.66 0.2 22);
  --lamp-go-tint: color-mix(in oklab, var(--lamp-go) 14%, var(--surface-panel));
  --lamp-standby-tint: color-mix(in oklab, var(--lamp-standby) 14%, var(--surface-panel));
  --fg-go: oklch(0.76 0.17 152);
  --fg-standby: oklch(0.91 0.12 95);
  --fg-fault: oklch(0.68 0.19 22);
  --fg-warn: oklch(0.78 0.14 62);
  --fg-info: oklch(0.76 0.1 240);
  --tape-l: 0.72;
  --tape-c: 0.13;
  --elevation-overlay: 0 8px 24px oklch(0 0 0 / 0.5), 0 0 0 1px var(--line-subtle);
}

[data-theme='paper'] {
  color-scheme: light;
  --surface-app: var(--paper-1);
  --surface-panel: var(--paper-2);
  --surface-control: var(--paper-3);
  --surface-control-hover: var(--paper-4);
  --surface-control-active: var(--paper-5);
  --surface-raised: oklch(0.995 0.004 85);
  --surface-overlay: oklch(0.995 0.004 85);
  --surface-canvas: oklch(0.9 0 0);
  --line-subtle: var(--paper-6);
  --line-strong: var(--paper-7);
  --line-control: var(--paper-8);
  --fg: var(--paper-12);
  --fg-muted: var(--paper-11);
  --fg-subtle: var(--paper-10);
  --fg-icon: var(--paper-9);
  --fg-on-lamp: var(--paper-12);
  --fg-on-fault: oklch(0.995 0.004 85);
  --focus: var(--paper-12);
  --focus-inner: var(--paper-1);
  --accent: oklch(0.47 0.2 var(--accent-h));
  --accent-hover: oklch(0.42 0.19 var(--accent-h));
  --accent-fg: oklch(0.995 0.004 85);
  --accent-text: oklch(0.47 0.2 var(--accent-h));
  --accent-subtle: color-mix(in oklab, var(--accent) 12%, var(--surface-panel));
  --lamp-go: oklch(0.7 0.16 150);
  --lamp-standby: oklch(0.86 0.13 92);
  --lamp-fault: oklch(0.54 0.2 22);
  --lamp-go-tint: color-mix(in oklab, var(--lamp-go) 14%, var(--surface-panel));
  --lamp-standby-tint: color-mix(in oklab, var(--lamp-standby) 14%, var(--surface-panel));
  --fg-go: oklch(0.46 0.13 150);
  --fg-standby: oklch(0.52 0.11 85);
  --fg-fault: oklch(0.52 0.2 22);
  --fg-warn: oklch(0.54 0.14 55);
  --fg-info: oklch(0.5 0.12 245);
  --tape-l: 0.58;
  --tape-c: 0.14;
  --elevation-overlay: 0 8px 24px oklch(0.22 0.01 85 / 0.14), 0 1px 2px oklch(0.22 0.01 85 / 0.12);
}

/* High contrast: every text and line role moves one or two steps toward the foreground. */
[data-contrast='high'] {
  --fg-muted: var(--fg);
}
:root[data-contrast='high'],
[data-theme='booth'][data-contrast='high'] {
  --fg-subtle: var(--booth-11);
  --line-subtle: var(--booth-7);
  --line-strong: var(--booth-8);
  --line-control: var(--booth-9);
}
[data-theme='paper'][data-contrast='high'] {
  --fg-subtle: var(--paper-11);
  --line-subtle: var(--paper-7);
  --line-strong: var(--paper-8);
  --line-control: var(--paper-9);
}

/* ── Tier 3: density. Set on a region root; the Operator, Remote and Audience use "stage". ── */
:root,
[data-density='comfortable'] {
  --control-h: 1.75rem;
  --row-h: 1.75rem;
  --panel-head-h: 2rem;
  --icon-size: 1rem;
  --text-ui: 0.8125rem;
  --text-ui--line-height: 1.125rem;
}
[data-density='compact'] {
  --control-h: 1.5rem;
  --row-h: 1.5rem;
  --panel-head-h: 1.75rem;
  --icon-size: 0.875rem;
  --text-ui: 0.75rem;
  --text-ui--line-height: 1rem;
}
[data-density='stage'] {
  --control-h: 2.75rem;
  --row-h: 2.5rem;
  --panel-head-h: 2.5rem;
  --icon-size: 1.25rem;
  --text-ui: 0.9375rem;
  --text-ui--line-height: 1.375rem;
  --text-label: 0.8125rem;
  --text-label--line-height: 1.125rem;
  --text-caption: 0.8125rem;
  --text-caption--line-height: 1.125rem;
}

/* ── Utilities. `inline` keeps the var() reference, so nested [data-theme] scopes work. ── */
@theme inline {
  --color-app: var(--surface-app);
  --color-panel: var(--surface-panel);
  --color-control: var(--surface-control);
  --color-control-hover: var(--surface-control-hover);
  --color-control-active: var(--surface-control-active);
  --color-raised: var(--surface-raised);
  --color-overlay: var(--surface-overlay);
  --color-canvas: var(--surface-canvas);
  --color-line-subtle: var(--line-subtle);
  --color-line-strong: var(--line-strong);
  --color-line-control: var(--line-control);
  --color-fg: var(--fg);
  --color-fg-muted: var(--fg-muted);
  --color-fg-subtle: var(--fg-subtle);
  --color-fg-icon: var(--fg-icon);
  --color-on-lamp: var(--fg-on-lamp);
  --color-on-fault: var(--fg-on-fault);
  --color-focus: var(--focus);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-fg: var(--accent-fg);
  --color-accent-text: var(--accent-text);
  --color-accent-subtle: var(--accent-subtle);
  --color-lamp-go: var(--lamp-go);
  --color-lamp-standby: var(--lamp-standby);
  --color-lamp-fault: var(--lamp-fault);
  --color-lamp-go-tint: var(--lamp-go-tint);
  --color-lamp-standby-tint: var(--lamp-standby-tint);
  --color-go: var(--fg-go);
  --color-standby: var(--fg-standby);
  --color-fault: var(--fg-fault);
  --color-warn: var(--fg-warn);
  --color-info: var(--fg-info);
  --color-tape-1: oklch(var(--tape-l) var(--tape-c) var(--tape-h-1));
  --color-tape-2: oklch(var(--tape-l) var(--tape-c) var(--tape-h-2));
  --color-tape-3: oklch(var(--tape-l) calc(var(--tape-c) - 0.02) var(--tape-h-3));
  --color-tape-4: oklch(var(--tape-l) var(--tape-c) var(--tape-h-4));
  --color-tape-5: oklch(var(--tape-l) var(--tape-c) var(--tape-h-5));
  --color-tape-6: oklch(var(--tape-l) var(--tape-c) var(--tape-h-6));
  --color-tape-7: oklch(var(--tape-l) var(--tape-c) var(--tape-h-7));
  --color-tape-8: oklch(var(--tape-l) var(--tape-c) var(--tape-h-8));
  --shadow-overlay: var(--elevation-overlay);
  --spacing-control: var(--control-h);
  --spacing-row: var(--row-h);
  --spacing-panel-head: var(--panel-head-h);
  --spacing-icon: var(--icon-size);

  /* Migration aliases: old class names keep working until each file is moved over. Remove when unused. */
  --color-ink-950: var(--surface-app);
  --color-ink-900: var(--surface-panel);
  --color-ink-850: var(--surface-control);
  --color-ink-800: var(--surface-control-hover);
  --color-ink-700: var(--line-subtle);
  --color-ink-600: var(--line-strong);
  --color-ink-500: var(--fg-subtle);
  --color-ink-400: var(--fg-subtle);
  --color-ink-300: var(--fg-muted);
  --color-ink-200: var(--fg-muted);
  --color-ink-100: var(--fg);
  --color-live: var(--lamp-fault);
}

/* ── Type, shape and easing. Not inline: utilities read the variable, so density scopes can override it. ── */
@theme {
  --font-sans: 'IBM Plex Sans Variable', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --font-display: 'Fraunces Variable', 'Fraunces', Georgia, serif;

  --text-label: 0.75rem;
  --text-label--line-height: 1rem;
  --text-label--letter-spacing: 0.06em;
  --text-label--font-weight: 500;
  --text-caption: 0.75rem;
  --text-caption--line-height: 1rem;
  --text-ui: 0.8125rem;
  --text-ui--line-height: 1.125rem;
  --text-body: 0.875rem;
  --text-body--line-height: 1.25rem;
  --text-title: 1rem;
  --text-title--line-height: 1.5rem;
  --text-heading: 1.25rem;
  --text-heading--line-height: 1.75rem;
  --text-cue: 1.75rem;
  --text-cue--line-height: 2rem;
  --text-display: 2.5rem;
  --text-display--line-height: 2.75rem;

  --radius-control: 2px;
  --radius-overlay: 4px;

  --ease-enter: cubic-bezier(0, 0, 0, 1);
  --ease-move: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit: cubic-bezier(0.3, 0, 1, 1);
  --ease-soft: cubic-bezier(0, 0, 0.3, 1);

  --default-transition-duration: 150ms;
  --default-transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

/* Motion: data-motion on <html> is "reduced" when the OS asks for it (unless the user chose Full),
   when the user chose Reduced, or while the operator is in Show mode. */
@custom-variant motion-ok (&:where([data-motion='full'], [data-motion='full'] *));

html,
body,
#root {
  height: 100%;
}

/* UI scale (Preferences, per machine): 0.9, 1, 1.1 or 1.25. Sizes are in rem, so everything follows;
   1 px lines and 2–4 px radii stay crisp. Output windows set no scale. */
html {
  font-size: calc(var(--ui-scale, 1) * 100%);
}

/* The mono caps label: panel titles, section labels, lamp words, key hints. */
@utility label-caps {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  line-height: var(--text-label--line-height);
  letter-spacing: var(--text-label--letter-spacing);
  font-weight: 500;
  text-transform: uppercase;
}

body {
  margin: 0;
  background: var(--surface-app);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text-ui);
  line-height: var(--text-ui--line-height);
  -webkit-font-smoothing: antialiased;
}

/* Two-tone focus ring: visible on any surface, never red. */
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--focus-inner);
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
```

### Fonts

```css
@font-face {
  font-family: 'IBM Plex Sans Variable';
  src: url('/fonts/IBMPlexSansVar-Latin.woff2') format('woff2');
  font-weight: 100 700;
  font-display: swap;
}
@font-face {
  font-family: 'IBM Plex Mono';
  src: url('/fonts/IBMPlexMono-Medium-Latin.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
/* …Plex Mono 400 and 600 the same way. */
@font-face {
  font-family: 'Fraunces Variable';
  src: url('/fonts/FrauncesVar-Latin.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
```

Put the files in `apps/web/public/fonts/` and add them to the PWA precache. Preload Plex Sans in `index.html`. The audience bundle uses its own `@font-face` rules with `font-display: optional` and metric-matched fallbacks.

### Theme bootstrap

An inline script in `index.html` and `audience.html` runs before first paint. It reads the machine preferences through guarded storage, and sets on `<html>`:

- `data-theme`: `booth` or `paper`, resolving System through `prefers-color-scheme`;
- `data-contrast`;
- `data-motion`;
- `--ui-scale` and `--accent-h`, as inline styles.

Update `<meta name="theme-color">` and the PWA manifest's `theme_color` from `#0b0b0f` to Booth step 1, `#090705`.

### Migrating today's classes

| Today                                           | Becomes                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `bg-ink-950` / `bg-ink-900`                     | `bg-app` / `bg-panel`                                                               |
| `bg-ink-850`, `bg-ink-800`                      | `bg-control`, `bg-control-hover`                                                    |
| `border-ink-700`, `border-ink-800`              | `border-line-subtle` (decorative) or `border-line-control` (field and button edges) |
| `text-ink-100`                                  | `text-fg`                                                                           |
| `text-ink-200`, `text-ink-300`                  | `text-fg-muted`                                                                     |
| `text-ink-400`, `text-ink-500`, placeholders    | `text-fg-subtle` (4.0:1 and 2.2:1 → 5.8:1)                                          |
| Button `variant="go"`, `bg-go`                  | The GO component (`bg-lamp-go-tint`, `border-go`, `text-go`)                        |
| `text-go`, `text-standby`                       | Unchanged names, new values                                                         |
| `live` (rose): focus ring                       | The two-tone `focus` ring (already in the token file)                               |
| `live` / `rose-*`: PANIC, lost output, blackout | `lamp-fault`, `text-fault`, `text-on-fault`                                         |
| `live` / `rose-*`: Show-mode toggle             | The neutral `Lock` SHOW label (Show is the calm state)                              |
| `live` / `rose-*`: danger buttons               | Button `danger` variant: `text-fault` with a `line-control` outline                 |
| `amber-*` warnings                              | `text-warn` with `TriangleAlert`                                                    |
| `amber-*` / `standby` Rehearsal marker          | The inverted Rehearsal bar                                                          |
| `green-*`, `sky-*`                              | `text-go` only if it means running; otherwise `text-info` or neutral                |
| `text-[11px]`, `text-[10px]`                    | `label-caps` or `text-caption`                                                      |
| `text-xs`, `text-sm` in the editor and operator | `text-ui` (follows density)                                                         |
| `animate-pulse` (4 uses)                        | Steady lamps                                                                        |

### Guards

- **ESLint.**
  - `no-restricted-imports`: no `motion` in `routes/OutputWindow.tsx`, `routes/RemoteOutput.tsx`, `render/**` or `routes/operator/**`.
  - A class-name rule: no `transition-all`, no arbitrary `text-[Npx]`, and no raw Tailwind palette colours (`rose-*`, `amber-*`…) in `apps/web/src`.
- **CI bundle budgets** against the first measured build:
  - Output-window and audience chunks may not grow by more than 5% without review.
  - The editor chunk may grow by up to 160 KB gzip, for React Aria and Motion.
- **Vitest.**
  - Every semantic pair in this document meets its contrast target in both themes and both contrast modes.
  - The accent passes at every allowed hue in 15° steps.
  - The contrast script used for this document becomes that test.
- **Playwright.**
  - Esc fires PANIC in the operator with a menu, popover or select focused, and with a Rehearsal dialog open.
  - In the editor, Esc closes an open menu without firing PANIC.
  - GO responds after picking from a select.
  - Nothing animates in Show mode: `getAnimations()` is empty on the operator after GO.
  - No element overlaps the GO or PANIC rectangle, with a banner and a toast showing.

## Migration order

1. **Safety (small, independent):**
   - PANIC on a capture-phase listener, with Esc always added at runtime.
   - Esc on an operator dialog must not also fire PANIC (`cancel` → `preventDefault`).
   - GO must not be swallowed while a select or number field has focus.
   - Move banners into a fixed message strip, so dismissing one no longer shifts GO.
   - Check that "Blacked out" clears after Release; code reading suggests it can stick.
   - Move the focus ring off the PANIC red.
   - Remove the infinite pulse on Release.
   - Make GO's press-in instant.
   - Make keyboard standby moves scroll instantly.
2. **Tokens:**
   - the token file with aliases;
   - self-hosted fonts;
   - the theme bootstrap;
   - `theme-color` and manifest updates.
3. **Contrast:** move `text-ink-400` (69 uses) and `text-ink-500` (12) to `fg-subtle`. Move field and button edges to `line-control`. Remove white text on the rose fill.
4. **Meaning:** replace off-palette colours (`rose-*` ×37, `amber-*` ×25, `green-*` ×11, `sky-*` ×3) with roles, and split `live` into fault, focus and accent.
5. **Type:** replace 28 × `text-[11px]` and 2 × `text-[10px]`. Adopt `text-ui`, `label-caps` and density on region roots.
6. **Primitives:**
   - React Aria Tooltip and the Info strip, replacing the `title=` attributes;
   - Select and ComboBox, replacing the native selects;
   - Menu, context menu and Tabs;
   - react-resizable-panels in the editor and the operator.
7. **Motion:** add `motion` to the editor chunk, the `data-motion` switch, the Preferences setting, and the lint and CI guards.
8. **New components:**
   - GO and PANIC states, and lamps with the status roll-up;
   - the GridList cue list with keyboard reorder;
   - the layer and scene Tree;
   - scrub fields;
   - the command registry and palette;
   - Preferences;
   - the cue dock and the scene map.
9. **Remove the migration aliases** when `grep -rE "ink-[0-9]|bg-live|text-live" apps/web/src` returns nothing.

## Verification

Run in October 2026 against this document:

- **Contrast.**
  - 72 named colour pairs meet their targets, across both themes, standard and high contrast, and the GO and NEXT tints. The targets are 4.5:1 for text, 7:1 for secondary text, and 3:1 for control lines, LED borders, icons and focus.
  - The lowest pairs: Booth `line-control` on `overlay` at 3.02:1, and Booth `fg-subtle` on `overlay` at 4.55:1.
  - The accent passes at every hue from 0° to 345° in 15° steps, in both themes. The lowest is Paper accent text at hue 195, 4.88:1.
- **Tailwind.** The token file compiles with Tailwind 4.3.3, and every utility named here resolves. That includes the density-scoped `text-ui` and `label-caps`, the tints, the `motion-ok:` variant and the migration aliases.
- **Versions** were checked on npm on 8 October 2026:
  - `motion` 14.0.0;
  - `react-aria-components` 1.22.0;
  - `react-resizable-panels` 4.14.3.

## Sources

**Tokens, colour, type**

- Design Tokens Community Group format 2025.10 (stable): [designtokens.org](https://www.designtokens.org/TR/2025.10/format/)
- Tailwind CSS v4 theme variables, `@theme inline`, dark mode, font features: [tailwindcss.com](https://tailwindcss.com/docs/theme)
- Radix Colors, understanding the 12-step scale: [radix-ui.com](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Linear, how we redesigned the Linear UI (three-input themes in LCH): [linear.app](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Adobe Spectrum design tokens; Carbon colour tokens and type sets; Atlassian elevation: [spectrum.adobe.com](https://spectrum.adobe.com/page/design-tokens), [carbondesignsystem.com](https://carbondesignsystem.com/elements/color/tokens/), [atlassian.design](https://atlassian.design/foundations/elevation)
- MDN, `oklch()` and `color-mix()`: [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)
- WCAG 2.2 Understanding: contrast (1.4.3), non-text contrast (1.4.11), focus not obscured (2.4.11), target size (2.5.8): [w3.org](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- Sara Soueidan, designing accessible focus indicators: [sarasoueidan.com](https://www.sarasoueidan.com/blog/focus-indicators/)
- NN/g, dark mode vs light mode: [nngroup.com](https://www.nngroup.com/articles/dark-mode/)
- IBM Plex: [github.com/IBM/plex](https://github.com/IBM/plex)
- Fraunces: [github.com/undercasetype/Fraunces](https://github.com/undercasetype/Fraunces)
- Lucide stroke width: [lucide.dev](https://lucide.dev/guide/react/basics/stroke-width)

**Motion**

- Motion for React (MotionConfig, accessibility, layout animations, bundle size, upgrade guide): [motion.dev/docs](https://motion.dev/docs/react-motion-config)
- Motion changelog: [github.com/motiondivision/motion](https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md)
- Material 3 motion tokens, including Expressive springs: [github.com/material-components](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md)
- IBM Carbon motion (productive and expressive): [carbondesignsystem.com](https://carbondesignsystem.com/elements/motion/overview/)
- Fluent 2 motion: [fluent2.microsoft.design](https://fluent2.microsoft.design/motion)
- Emil Kowalski, practical animation tips: [emilkowal.ski](https://emilkowal.ski/ui/7-practical-animation-tips)
- MDN, `@starting-style`: [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)

**Components**

- React Aria Components (Tree, GridList drag-and-drop, Autocomplete, ColorPicker, quality and testing): [react-aria.adobe.com](https://react-aria.adobe.com/quality)
- Base UI releases and components: [base-ui.com](https://base-ui.com/react/overview/releases)
- Radix Primitives releases: [radix-ui.com](https://www.radix-ui.com/primitives/docs/overview/releases)
- react-resizable-panels: [github.com/bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- cmdk: [github.com/dip/cmdk](https://github.com/dip/cmdk)

**Identity references**

- Teenage Engineering: [teenage.engineering](https://teenage.engineering/)
- QLab 5 workspace (GO states, cue colours): [qlab.app](https://qlab.app/docs/v5/fundamentals/workspace/)
- Figma, behind our redesign UI3: [figma.com](https://www.figma.com/blog/behind-our-redesign-ui3/)
- Spike (stagecraft): [wikipedia.org](<https://en.wikipedia.org/wiki/Spike_(stagecraft)>)
- Gauze and scrim lighting: [theatrecrafts.com](https://theatrecrafts.com/pages/home/topics/lighting/lighting-gauze-scrim/)
