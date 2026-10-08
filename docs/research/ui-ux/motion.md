# Research: Motion and perceived speed

**Question:** How should Scrim use Motion (formerly Framer Motion) so the app feels fast and responsive, without ever touching the show?

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win.

Method: live docs, npm and GitHub; the Motion source and `size-rollup-*` bundles from a local `framer-motion@12.40.0` install (read-only); a read-only skim of Scrim (`Stage.tsx`, `docs/architecture.md`, `GoPanel`, `CueStack`, `AudiencePanel`, `ui/*`, `main.tsx`). Items marked _(unverified)_ or _(inference)_ did not come from an opened source.

**Stance:** Motion where CSS cannot (FLIP/reorder, exits on React unmount, velocity-preserving gestures); CSS tokens everywhere else; nothing on Stage, GO or PANIC.

## Findings

### 1. Package, version, license: `motion@14.0.0`, import from `motion/react`

- What: npm `motion` 14.0.0 (changelog 2026-10-02), MIT, ~33.9k GitHub stars. Imports: `motion/react`, plus `motion/react-m`, `motion/react-mini`, `motion/mini`, `motion/react-animate-view`. `framer-motion@14.0.0` is the same code under the old name (`motion` pins it). Peers `react`/`react-dom` `^18 || ^19` (optional). Upgrade guide: v14 no breaking changes; v13 dropped the optional `@emotion/is-prop-valid`. Eleven-plus releases between 2026-08-18 and 2026-10-02.
- Evidence: npm registry — https://registry.npmjs.org/motion/latest ; upgrade guide — https://motion.dev/docs/react-upgrade-guide ; changelog — https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md
- Apply to Scrim: add `motion` to `apps/web`, pin `~14.0`, read the changelog on bumps. Scrim's React `^19.3.0` also meets `AnimateView`'s floor (but see 13). Motion+ ($399 one-time: AnimateNumber, Ticker...) and Motion Studio (visual spring editor, free tier) are optional; nothing below needs them.
- Confidence: high

### 2. Bundle size: budget per surface, not one global number

- What: docs say full `motion` ~34 kB, `m`+LazyMotion+`domAnimation` 4.6 kB initial +15 kB, `domMax` +25 kB, hybrid `animate()` 18 kB, mini 2.3 kB, but that page's measurement note cites v7.2.0, so treat it as dated. Measured from the `size-rollup-*` bundles in framer-motion 12.40.0 (brotli / gzip kB): full `motion` 35.1 / 39.4; `m` alone 5.9 / 6.5; LazyMotion+`domAnimation` 12.7 / 13.9; +`domMax` 24.5 / 27.4; hybrid `animate` 20.0 / 22.1; `motion/mini` 2.9 / 3.2. Bundlephobia: whole `motion@14.0.0` 141 kB min / 47.6 kB gzip, untreeshaken. 13.5.0 claims `<m>` ~20% smaller (v14 not re-measured). Source: `domAnimation` = animate/variants, exit, hover/tap/focus/inView; `domMax` adds drag and layout (`layout`, `layoutId`, `drag`). `Reorder.Group/Item` render the full `motion` component (Item passes `ignoreStrict`), so importing Reorder defeats LazyMotion.
- Evidence: https://motion.dev/docs/react-reduce-bundle-size ; https://bundlephobia.com/api/size?package=motion@14.0.0 ; https://raw.githubusercontent.com/motiondivision/motion/main/packages/framer-motion/src/components/Reorder/Item.tsx ; local `framer-motion@12.40.0/dist/size-rollup-*.js`
- Apply to Scrim: Output/RemoteOutput 0 kB (no import). Audience phone page (audience member) and Remote (performer): CSS only, or `motion/mini` (~3 kB) if a spring is truly needed (venue Wi-Fi/cellular). Operator: CSS for GO, Cue stack, Outputs; `m`+`domAnimation` (~13 kB) only if toast/dialog exits need JS. Editor (lazy route): full `motion` (~35 kB) since Reorder needs it; skip LazyMotion there. Add per-route-chunk size checks in CI.
- Confidence: high (v12.40 measured, docs); medium for v14

### 3. Hybrid engine: only transform, opacity, filter and clip-path leave the main thread

- What: v12.40 source accelerates exactly `opacity`, `clipPath`, `filter`, `transform` (background-color off). Springs compile to a `linear()` easing so they can run on the compositor (`linear()` Baseline since Dec 2023); interruption samples a renderless JS animation to keep velocity. Main-thread fallbacks: independent transforms (`x`, `y`, `scale` use CSS variables), `transformTemplate`, `onUpdate`, `repeatDelay`, `mirror`, inertia, elements in other windows. Motion's tier list: S transform/opacity/filter/clip-path; B Motion layout (FLIP); C colours, border-radius, any CSS-variable animation (always repaints); D width/height/margin.
- Evidence: local motion-dom `waapi/supports/waapi.mjs`, `accelerated-values.mjs`, `apply-generator.mjs` ; https://motion.dev/docs/performance ; https://motion.dev/magazine/web-animation-performance-tier-list ; https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear
- Apply to Scrim (stage manager, art director): Operator and Editor motion = `transform`/`opacity` only, written as a full `transform` string or CSS where it must survive main-thread load. Vote bars (`AudiencePanel.tsx:311`, `transition-[width]`) become `scaleX`.
- Confidence: high

### 4. `MotionConfig` is where policy lives; Motion's defaults do not suit a tool UI

- What: props `transition` (fallback for all children), `reducedMotion` (`"user"` | `"always"` | `"never"`; default `"never"`), `transformPagePoint`, `nonce`. `"user"` disables transform and layout animations but keeps opacity/colour. `useReducedMotion()` gives a boolean for per-component swaps. Spring defaults are slow and bouncy (docs: 800 ms, bounce 0.25; 12.40 source: bounce 0.3); physics props override time props; `visualDuration` + `bounce` (-1..1) is the intended API. Tailwind adds `motion-safe:`/`motion-reduce:`.
- Evidence: https://motion.dev/docs/react-motion-config ; https://motion.dev/docs/react-accessibility ; https://motion.dev/docs/spring
- Apply to Scrim: one root `<MotionConfig reducedMotion={…} transition={spring.settle}>`. Scrim has zero `prefers-reduced-motion` handling, 4 `animate-pulse`, 1 `animate-spin`. Bind `reducedMotion` to a Preferences setting (System / Reduced / Full), force `"always"` in Show mode, and drive CSS from the same switch (Show-mode default protects the stage manager; the Preferences setting serves motion-sensitive art directors). OS reduced-motion must affect UI chrome only, never Stage content (`StateLayerView.tsx:23` has a 300 ms width transition that is show art).
- Confidence: high

### 5. `AnimatePresence`: good for exits, risky as a gate

- What: needs direct children with stable unique keys and must stay mounted. Modes: `sync` (default), `wait` (one child; entering waits for exit), `popLayout` (exiting child leaves flow, siblings reflow; needs ref forwarding and a non-static parent). Also `initial`, `custom`, `onExitComplete`, `propagate`, `usePresence`. Interruption bugs fixed as recently as 12.41.0 (stuck exits), 13.4.5 (2026-09-28, dropped or stuck children) and 13.4.6 (2026-09-29, `wait` dropping children during React transitions).
- Evidence: https://motion.dev/docs/react-animate-presence ; https://motion.dev/changelog
- Apply to Scrim: Editor lists (delete cue/layer) and toasts (key = toast id from the existing store). Editor/Interaction (creative author): adding or removing a when/if/then rule or action row = `popLayout` exit + `layout="position"` on siblings over `fast`, so the author sees where it went. Editor/Controls: the key-capture "listening" state stays static; a mapped key confirms with a `micro` colour flash. `mode="wait"` is banned near the Operator: it delays by design and has had the most bugs.
- Confidence: medium-high

### 6. Layout animations and `Reorder` (cue list)

- What: `layout` animates with `transform` after measuring before/after a render (FLIP; the layout engine is ~12 kB). Props: `layout="position"|"size"`, `layoutId` (shared element), `LayoutGroup`, `layoutDependency` (limits measuring), `layoutScroll` on scrollable ancestors, `layoutRoot` on fixed elements. Caveats: no `display: inline`; scaling distorts children/borders (set radius/shadow via `style`); blocked during horizontal window resize; no SVG. `Reorder`: `axis` auto-detected (incl. `xy` grids), `values`/`onReorder`, handles via `useDragControls`, auto-scrolls a scrollable parent. Virtualized lists: request #3061 closed 2026-03-16 and 12.40's `Group` preserves unmeasured items. Cross-list drag is not documented.
- Evidence: https://motion.dev/docs/react-layout-animations ; https://motion.dev/docs/react-reorder ; https://motion.dev/docs/react-motion-component ; https://api.github.com/search/issues?q=repo:motiondivision/motion+layout+scroll+virtualized
- Apply to Scrim (Editor/Cues, designer and creative author): one `Reorder.Group` per scene with a grip handle; cross-scene moves via menu/keyboard or a dedicated drag-and-drop library (see [foundations](foundations.md)). `layout` only on the dragged group, `layoutDependency` on rows, `layoutScroll` on the cue scroller. Never on the Operator Cue stack. _(Inference: measuring cost grows with the number of `layout` elements in a re-rendered tree; the docs do not quantify it.)_
- Confidence: high (API), medium (cost)

### 7. Pitfalls checklist: StrictMode, Tailwind, scaled canvas, touch

- What: (a) `main.tsx` uses `StrictMode`; `AnimatePresence` remounted present children under React 19 StrictMode (issue #3752, closed 2026-08-20; changelog 13.1.1, 2026-08-18, "improved compat with React 19 strict mode"), so stay >= 13.1.1. (b) A Tailwind `transition-*` class on a `motion` element fights Motion and stutters; official advice: remove it. (c) `whileHover` ignores touch; `whileTap` also fires on Enter keydown (source), clashing with "keyboard never animates". (d) Dragging inside CSS-scaled ancestors needs `MotionConfig transformPagePoint` _(inference from its purpose)_. (e) `will-change` layers are not free.
- Evidence: https://api.github.com/search/issues?q=repo:motiondivision/motion+strict+mode+AnimatePresence ; https://motion.dev/docs/react-tailwind ; local `motion-dom/gestures/hover.mjs`, `press/utils/keyboard.mjs`
- Apply to Scrim: do not wrap `ui/Button` (it hard-codes `transition-colors`) in `motion.button`; animate a child or use CSS. Keep Moveable for the scaled Stage canvas and Motion `drag`/`layout` out of it. Use `:active` CSS for press feedback, not `whileTap`.
- Confidence: high (a–c), medium (d)

### 8. Design systems converge on 100–300 ms and a decelerate curve for entrances

- What: **Carbon** durations 70/110/150/240/400/700 ms; productive mode for task UI, expressive for significant moments; productive standard/entrance/exit curves (0.2,0,0.38,0.9)/(0,0,0.38,0.9)/(0.2,0,1,0.9); expressive (0.4,0.14,0.3,1)/(0,0,0.3,1)/(0.4,0.14,1,1). **Material 3** durations 50–1000 ms in 50 ms steps; standard (0.2,0,0,1), decelerate (0,0,0,1), accelerate (0.3,0,1,1). **Fluent 2** tokens 50/100/150/200/250/300/400/500 ms; decelerate-mid (0,0,0,1), accelerate-mid (1,0,1,1); scale time with size/distance; offer a "no motion" setting. **Spectrum**: purposeful, intuitive, seamless; direction vocabulary (linear = forward, diagonal = context switch, clockwise = loading); large-area motion honours reduced motion; no numeric tokens on the page. **Apple HIG**: purposeful, optional, brief feedback, avoid motion on frequent interactions, let people cancel.
- Evidence: https://carbondesignsystem.com/elements/motion/overview/ ; https://unpkg.com/@carbon/motion/es/index.js ; https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md ; https://fluent2.microsoft.design/motion ; https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/global/curves.ts ; https://spectrum.adobe.com/page/motion ; https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json
- Apply to Scrim: Carbon's split maps onto Scrim: productive = Operator, Editor, Library; expressive (still <= 400 ms) = audience phone page only. The entrance curve (0,0,0,1) is identical in M3 and Fluent, so adopt it.
- Confidence: high

### 9. M3 Expressive springs translate into Motion's `visualDuration`/`bounce`

- What: M3 Expressive has six spring tokens: spatial (damping ratio 0.9; stiffness 1400/700/300 for fast/default/slow) and effects (ratio 1.0; 3800/1600/800; for colour/opacity so they never overshoot). Motion converts `visualDuration` to stiffness = (2π/(1.2·vd))² and damping = 2·(1−bounce)·√stiffness, mass 1 (12.40 source). So 1400/700/300 ≈ `visualDuration` 0.14/0.20/0.30 s at `bounce` 0.1. Ratio 0.9 overshoots 0.15% (invisible) yet keeps velocity when interrupted; bounce 0.25 overshoots 2.8%. (Computed.)
- Evidence: https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md ; local `motion-dom/animation/generators/spring.mjs`
- Apply to Scrim (art director wants tactile feel, stage manager wants calm): springs for `transform`/layout (a panel toggled mid-flight retargets smoothly); tweens for opacity/colour. Named springs in the tokens section.
- Confidence: medium-high (derived from two verified inputs)

### 10. Frequency and keyboard rule

- What: Emil Kowalski's framework asks purpose, frequency, input type: "never animate keyboard initiated actions"; high-frequency surfaces (command menus, navigation) get none; UI under 300 ms (a 180 ms dropdown feels faster than 400); ease-out, not ease-in; tooltips delay first, then zero animation between them; `:active` scale(0.97); never animate from scale(0). Rauno Freiberg: command menus unanimated; removing motion from a frequent interaction made it feel faster; gestures respond immediately and stay interruptible. Linear-style speed (third-party analyses, medium-low): local store, optimistic updates, transform/opacity only, durations under ~150 ms.
- Evidence: https://emilkowal.ski/ui/you-dont-need-animations ; https://emilkowal.ski/ui/7-practical-animation-tips ; https://emilkowal.ski/ui/great-animations ; https://rauno.me/craft/interaction-design ; https://performance.dev/how-linear-feels-instant
- Apply to Scrim: sort every action by frequency and stress. Stage-manager actions (GO, standby, hold, panic) and Editor navigation (tabs, selection, undo) = 0 ms. `CueStack.tsx:20` calls `scrollIntoView({behavior:'smooth'})` on every standby change, arrow-key and GO-driven included; use `auto` for those, smooth only for pointer-initiated off-screen reveals.
- Confidence: high

### 11. Perceived-speed thresholds and loading states

- What: Nielsen: 0.1 s feels instantaneous (direct manipulation), 1 s keeps flow, 10 s is the attention limit (percent-done plus cancel). Doherty (IBM 1982): feedback under 400 ms keeps productivity. INP: good <= 200 ms, poor > 500 ms; the next painted frame is the earliest feedback. Vercel: loading indicators get a ~150–300 ms show-delay and ~300–500 ms minimum visible time; optimistic updates with rollback or undo. NN/g: nothing under 1 s, spinners 2–10 s, skeletons for full-page loads under 10 s (frame-only skeletons read as spinners), progress bars over 10 s. React 19 `useOptimistic` reverts automatically if the action throws.
- Evidence: https://www.nngroup.com/articles/response-times-3-important-limits/ ; https://lawsofux.com/doherty-threshold/ ; https://web.dev/articles/inp ; https://vercel.com/design/guidelines ; https://www.nngroup.com/articles/skeleton-screens/ ; https://react.dev/reference/react/useOptimistic
- Apply to Scrim: already local-first, so GO and standby never wait. Loaders only for media import/decode (determinate bar plus cancel; fixed-aspect thumbnail placeholders fading in over `fast`) and relay join (plain "Connecting..." after ~300 ms). No skeletons in the Operator; Library paints from IndexedDB with no loader. Remote triggers: optimistic "sent" state, reconcile on ack.
- Confidence: high

### 12. Press feedback inside one frame

- What: `GoPanel.tsx:65` uses `transition-transform active:scale-[.97]`, inheriting Tailwind's default 150 ms `cubic-bezier(0.4,0,0.2,1)`. Computed progress at 16.7 / 33 / 50 ms: 3% / 17% / 46% (default) vs 20% / 55% / 73% for (0.2,0,0,1); a `transition-none` press-in is 100% in frame one. GO fires on `click` (release); the performer Remote fires on `pointerdown` (`Remote.tsx:108`).
- Evidence: https://tailwindcss.com/docs/transition-property (utilities read `--default-transition-duration`/`-timing-function`) ; https://web.dev/articles/inp ; https://emilkowal.ski/ui/7-practical-animation-tips
- Apply to Scrim (stage manager, performer): GO, PANIC, Hold, prev/next and Remote buttons get `active:transition-none active:scale-[.97]`, release over `micro` with `move`. Override `--default-transition-duration`/`-timing-function` in `@theme` so every existing `transition-*` tightens at once. Keyboard GO has no `:active`, so add a ~100 ms `data-pressed` echo. Consider mouse GO on `pointerdown` like Remote (product decision; the 300 ms debounce guards double fire).
- Confidence: high (computation), medium (pointerdown idea)

### 13. CSS-first for enter/exit; View Transitions stay out of the Operator

- What: `@starting-style` (Baseline 2024) plus `transition-behavior: allow-discrete` animate entry from `display:none` and entry/exit in the top layer (`<dialog>`, popover) with no JS. Tailwind 4.3 has `starting:`, `transition-discrete`, `motion-safe:`/`motion-reduce:`, `--ease-*`/`--animate-*` theme namespaces (no duration namespace). View Transitions (Chrome 111+, Firefox 144+, Safari 18+): the page is frozen while the update callback runs, live video can look frozen, and Motion notes only one whole-screen transition at a time. Motion's `AnimateView` (free since 13.4, needs React 19.3) wraps this API.
- Evidence: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style ; https://tailwindcss.com/docs/hover-focus-and-other-states ; https://tailwindcss.com/docs/transition-behavior ; https://developer.chrome.com/docs/web-platform/view-transitions/same-document ; https://motion.dev/docs/react-animate-view
- Apply to Scrim: dialogs (`ui/dialog.tsx` already uses native `<dialog>`), menus and popovers enter/exit in CSS; Motion only for reorder/FLIP, React-unmount exits and gestures. No View Transitions or `AnimateView` in the Operator or any window with Stage thumbnails. Library (seen once per session, first-time users): card enter fade + rise over `base`, 30 ms stagger capped at 8 cards, CSS only.
- Confidence: high

### 14. Accessibility floor

- What: WCAG 2.3.3 (AAA): non-essential interaction-triggered motion can be disabled; opacity, colour and blur changes do not count as motion. 2.2.2 (A): auto-starting movement over 5 s beside other content needs pause/stop/hide. 2.5.7 (AA): anything done by dragging needs a single-pointer alternative. HIG: motion must be optional.
- Evidence: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html ; https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html ; https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- Apply to Scrim: `GoPanel.tsx:102` puts an infinite `animate-pulse` on the PANIC-release button; make it a static high-contrast state (at most a `motion-safe:` halo). Status dots (Remote, Audience, AudiencePanel) get `motion-safe:animate-pulse`. Cue/layer reorder needs Alt+Up/Down and a "Move" menu with an aria-live announcement. Reduced profile defined in the tokens section (Motion's `"user"` keeps opacity/colour animations; we also cap them at `micro`).
- Confidence: high

### 15. Stage isolation: how UI motion could still interfere

- What: `Stage.tsx` writes inline `opacity`/`visibility` on every layer and the blackout node from a rAF loop (plus a 250 ms interval) and measures its box with `ResizeObserver` then `setSize` (line 43). So (i) any CSS transition or Motion on those nodes lags or fights the engine tween; (ii) animating a Stage container's size re-renders Stage every frame; (iii) each operator thumbnail runs its own rAF loop; (iv) outputs open via `window.open(url, name, features)` (`host/windows.ts:61`), and Chromium keeps same-site windows of one browsing-context group in one renderer process. That same-process pages share one main thread is background knowledge _(unverified)_, so heavy main-thread UI animation in the Operator could in principle delay output frames. Existing exposure: `OutputWindow.tsx:192` HUD uses `transition-opacity`.
- Evidence: `apps/web/src/render/Stage.tsx` ; `docs/architecture.md` (Rendering) ; https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md
- Apply to Scrim (stage manager protects what the audience sees): hard rules below, plus one test: a 40 ms busy loop every 100 ms in the Operator, logging output-window rAF deltas with Motion mounted vs not. If it matters, consider COOP separation (loses the window handle; architecture call).
- Confidence: medium

## Proposed motion tokens

**Durations** (CSS `duration-*` utilities; JS seconds). Ceiling: nothing in Operator/Editor above `slow`.

| Token     | ms  | Use                                                                                    | Anchors                           |
| --------- | --- | -------------------------------------------------------------------------------------- | --------------------------------- |
| `instant` | 0   | GO/PANIC/standby state, selection, tab content, anything keyboard-initiated, Show mode | Emil, Rauno, HIG                  |
| `micro`   | 100 | hover/press release, tooltip fade, exits of small surfaces                             | Fluent 100, M3 short2, Carbon 110 |
| `fast`    | 150 | menu/popover enter, toggles, toast exit                                                | Carbon 150, Fluent 150, M3 short3 |
| `base`    | 200 | dialog, toast enter, panel content, vote bars                                          | Fluent 200, M3 short4             |
| `slow`    | 300 | GO debounce ring, row-flash decay, audience-phone transitions                          | Fluent 300, M3 medium2, Emil <300 |

Design choices (mine, informed by the above): exit about 60–70% of enter; add ~50 ms per doubling of distance or size; audience "ceremonial" moments may use 400–600 ms (M3 medium4..long2).

**Easings:** `enter` (0,0,0,1) [M3 standard-decelerate = Fluent decelerate-mid]; `move` (0.2,0,0,1) [M3 standard; default for all `transition-*`]; `exit` (0.3,0,1,1) [M3 standard-accelerate; only <= 150 ms, since ease-in feels sluggish]; `soft` (0,0,0.3,1) [Carbon expressive entrance; audience page only]; `linear` for countdowns and progress.

**Springs** (Motion; damping ratio 0.9 except `pop`):

```ts
// apps/web/src/ui/motion.ts
export const spring = {
  snap: { type: 'spring', visualDuration: 0.14, bounce: 0.1 }, // ~M3 fast spatial (k 1400): switches, press release, segmented highlight
  settle: { type: 'spring', visualDuration: 0.2, bounce: 0.1 }, // ~default spatial (k 700): popovers, panel content, reorder settle, toast enter
  glide: { type: 'spring', visualDuration: 0.3, bounce: 0.1 }, // ~slow spatial (k 300): large areas, audience cards
  pop: { type: 'spring', visualDuration: 0.35, bounce: 0.25 }, // audience success moments only (2.8% overshoot)
} as const;
```

Wiring: `<MotionConfig reducedMotion={prefs} transition={spring.settle}>`; in `styles.css` `@theme { --ease-enter; --ease-move; --ease-exit; --ease-soft; --default-transition-duration: 150ms; --default-transition-timing-function: cubic-bezier(0.2,0,0,1) }`; one attribute `<html data-motion="full|reduced">` (System pref OR user setting OR Show mode) feeds `reducedMotion` and a Tailwind `@custom-variant` used beside the built-in `motion-reduce:`. **Reduced profile:** no animated transform or layout movement; state changes are instant (a pressed button still shows its pressed state); opacity/colour fades capped at `micro`. Ban `transition-all`.

## Pattern table: animate? how? why

| Pattern (surface, persona)                                         | Animate? / how (tokens)                                                                                                                                                                                                                                                                                                          | Why                                                                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel open/close (Editor panels, Operator side tabs; art director) | Pointer: light. Snap the grid track at t=0, animate only panel content (opacity + 8 px slide, `base`, `enter`). Shortcut: none. Drag-resize is 1:1, no easing                                                                                                                                                                    | Animating a Stage container re-renders Stage every frame (ResizeObserver); width is D-tier; toggled constantly                                    |
| Popover / menu / tooltip (new; Editor, Library)                    | Pointer-opened: `fast` opacity + scale .96→1 + 4 px offset, origin-aware, `enter`; exit `micro` opacity only. Tooltip: short intent delay on the first, then no delay and no animation between tooltips. Cmd+K or keyboard-opened: none                                                                                          | Frequent surfaces; origin-aware reads as spatial; never from scale(0) (Emil)                                                                      |
| Dialog (`ask()`, Pre-show check)                                   | CSS-only on native `<dialog>`: `base` opacity + scale .96→1 (`starting:`/`transition-discrete`), backdrop fade; exit `micro`. Resolve the promise first, unmount after the transition. Show mode: none                                                                                                                           | Rare and blocking, so a polite entrance; a decision must never wait on animation                                                                  |
| Toast (`ui/toast.tsx`)                                             | Enter `base` 8 px rise + fade (`settle`); exit `micro` fade; `layout="position"` for the stack (max 4); pause timer on hover/focus; reduced = fade only                                                                                                                                                                          | Unprompted element: motion locates it; same direction in and out; 4-item cap keeps layout cost trivial                                            |
| Tab switch (Editor 6 tabs, Operator tabs)                          | Content swap `instant`. Indicator: none, or pointer-only `snap` slide <= 150 ms; never on keyboard                                                                                                                                                                                                                               | Highest-frequency navigation (HIG, Emil, Rauno)                                                                                                   |
| List reorder (Editor/Cues)                                         | Only while dragging: lift (scale 1.02 + shadow, `micro`), siblings via `layout` + `settle`, drop settles with `settle`, auto-scroll. Alt+Up/Down and "Move" menu apply instantly + aria-live. Operator Cue stack: never                                                                                                          | Spatial change that motion explains; cost confined to the drag; WCAG 2.5.7 needs a non-drag path                                                  |
| Layer selection on canvas (Editor/Stage; art director)             | None. Handles appear in the same frame as pointerdown; hover outline instant; Moveable drag/resize 1:1; snap guides instant                                                                                                                                                                                                      | Direct manipulation (0.1 s rule), Figma-class expectation; canvas parent is CSS-scaled                                                            |
| Drag & drop media (MediaPanel to canvas, native HTML5 DnD)         | Drop-zone highlight instant (`transition-colors` <= `micro`); drag ghost is native; new layer appears selected at once; import progress determinate after a 150–300 ms delay; thumbnails fade in `fast` over fixed-aspect placeholders                                                                                           | Native DnD cannot be animated; layer DOM belongs to Stage; placeholders prevent layout jump                                                       |
| GO press feedback (Operator; stage manager; Remote triggers)       | `instant`: press-in `active:transition-none` scale .97; release `micro`/`move`; keyboard echo ~100 ms; LIVE/NEXT badges flip same frame; optional 300 ms `linear` ring (overlay `scaleX`) showing the debounce window. Dispatch before any visual work                                                                           | Nielsen 0.1 s, INP next-frame; GO must feel mechanical                                                                                            |
| Standby advance (Cue stack; arrows or after GO)                    | State, border and NEXT badge flip `instant`. `scrollIntoView` `auto` for key/GO-driven moves, smooth <= `base` only for pointer reveals. "Just fired" row flash: low-luminance overlay opacity decaying over `slow`                                                                                                              | Keyboard never animates; stacked smooth scrolls lag rapid arrows; the flash confirms GO landed in peripheral vision without glare in a dark booth |
| Mode switch Rehearsal→Show (Operator header)                       | State flips `instant` (lock applies at once). Emphasis is opacity/colour only, so it survives the reduced profile: `live` top border + persistent Show chip fade in over `base`; segmented highlight `snap` (instant when reduced). Edit/Reset vanish with no animation; GO panel never shifts. Show→Rehearsal: confirm, instant | Rare and consequential: motion adds emphasis, never delay or a half-locked state                                                                  |
| PANIC (Operator; Esc in every window)                              | None. Border and label flip in the same frame; no spring, fade or shake. Release state static (no infinite pulse). The fade to black is the engine tween on Stage, not UI                                                                                                                                                        | Instant is the requirement; WCAG 2.2.2 for loops over 5 s                                                                                         |
| Audience vote results on operator (AudiencePanel)                  | Bars: `scaleX` over `base` with `move` (relay totals arrive at most every 200 ms, so each update retargets smoothly). Numbers: no tween, tabular figures. Leader by colour. Stable row order. Result chosen: 150 ms fade of the result row                                                                                       | Continuous data needs a little smoothing; operators need exact numbers; `width` transitions are layout-tier                                       |
| Phone audience page (Audience; audience member)                    | Expressive but small: moment card enters `slow` (16 px rise + fade, `soft`); tap = instant selected state + existing haptic; check mark `pop`; "Vote counted" fades `fast`; close = `micro` fade. CSS or `motion/mini` only; press state not hover; vote buttons never shift; reduced = fades                                    | Rare moment, the brand's face; venue network makes JS weight matter; mis-taps from moving targets are costly                                      |

## Hard rules: where motion is forbidden

1. **Output windows and Stage:** `routes/OutputWindow.tsx`, `routes/RemoteOutput.tsx` and `render/**` never import `motion` (ESLint `no-restricted-imports` plus a CI check that output chunks contain no `motion-dom`). No UI transition on output windows: HUD and identify overlay appear and disappear instantly.
2. **Stage subtree is motion-free for UI code:** no Motion, CSS transition or animation targeting `[data-layer]`, `LayerBox` or the blackout node; UI overlays are siblings. No global `*` transition rules, no `transition: all`. Stage-internal effects (e.g. `StateLayerView`) are show content owned by `render/` and exempt from OS/UI reduced-motion.
3. **GO/PANIC path:** dispatch first, animate after, in the same tick. Nothing awaits `onAnimationComplete`; no `AnimatePresence mode="wait"`, entry delays or staggers on GoPanel, Cue stack or Outputs; command handlers never wrapped in `startTransition`. PANIC feedback is 0 ms and Esc has no animation dependency.
4. **Hit targets never move:** GO, PANIC, Hold, prev/next keep position and size at all times; press feedback is `transform: scale` on the button itself; nothing mounts or reflows next to them.
5. **Show mode:** `reducedMotion="always"` plus `data-motion="reduced"` (reduced profile above); no layout animation; no looping animation except status dots under `motion-safe:`; toasts appear where they cannot cover GO/PANIC.
6. **Operator main-thread discipline:** transform/opacity only; no animating `width`/`height`/`top`/`left`/margin/padding/CSS variables; no `layout` props except toasts (<= 4); no MotionValue-to-React-state loops; no View Transitions or `AnimateView`.
7. **Keyboard-initiated actions never animate** (focus ring excepted); every animation is interruptible; nothing exceeds `slow` (300 ms) outside audience moments.
8. **Accessibility:** honour OS reduced-motion plus the in-app override; no autoplaying loop over 5 s without a stop; flashes stay far below 3 per second.

## Top 5 recommendations

1. Adopt `motion@14` (`motion/react`) with a CSS-first policy: Motion only in the lazy Editor chunk (Reorder, layout, exits); Operator, Remote and Audience stay on CSS tokens (`motion/mini` ~3 kB optional on Audience); Output imports nothing. Add per-route size checks.
2. Ship the token set once: `@theme` easings and `--default-transition-*`, `ui/motion.ts` springs (`snap`/`settle`/`glide`/`pop`), a root `MotionConfig`, the `data-motion` switch and a Preferences setting; forbid `transition-all`.
3. Make the Operator motion-free where it counts: `active:transition-none` press-in, keyboard echo, instant LIVE/NEXT, `scrollIntoView` `auto` for keys, no infinite pulse on PANIC release, vote bars on `scaleX`, Show mode = reduced.
4. Enforce isolation mechanically: lint and CI rules for Output/Stage, no UI transitions on Stage nodes, panel animations never resize Stage per frame, and run the cross-window jank test before enabling Motion in the Operator.
5. Build cue-list reorder with `Reorder.Group` per scene, grip handle, keyboard and menu alternatives, `layoutScroll`, drag-only layout animation; stay on >= 13.1.1 for StrictMode.

## Sources (opened)

- npm registry — https://registry.npmjs.org/motion/latest ; https://registry.npmjs.org/framer-motion/latest
- Motion changelog — https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md ; https://motion.dev/changelog ; repo — https://github.com/motiondivision/motion
- Motion docs — https://motion.dev/docs/react ; /docs/react-upgrade-guide ; /docs/react-reduce-bundle-size ; /docs/react-lazy-motion ; /docs/react-motion-config ; /docs/react-animate-presence ; /docs/react-layout-animations ; /docs/react-reorder ; /docs/react-gestures ; /docs/react-transitions ; /docs/spring ; /docs/react-use-reduced-motion ; /docs/react-accessibility ; /docs/react-animation ; /docs/performance ; /docs/animate ; /docs/react-use-animate ; /docs/react-motion-component ; /docs/react-tailwind ; /docs/react-animate-view ; https://motion.dev/magazine/web-animation-performance-tier-list ; https://motion.dev/plus ; https://motion.dev/studio
- GitHub — https://raw.githubusercontent.com/motiondivision/motion/main/packages/framer-motion/src/components/Reorder/Item.tsx ; issue searches (#3752 StrictMode, #3061 virtualized Reorder) via https://api.github.com/search/issues?q=repo:motiondivision/motion+strict+mode+AnimatePresence
- Bundlephobia — https://bundlephobia.com/api/size?package=motion@14.0.0 ; jsDelivr file list — https://data.jsdelivr.com/v1/packages/npm/motion@14.0.0?structure=flat
- Local read-only: the installed `framer-motion@12.40.0` package (package.json, `dist/size-rollup-*.js`, features, Reorder) and `motion-dom@12.40.0` (spring, WAAPI support, hover/press gestures)
- IBM Carbon — https://carbondesignsystem.com/elements/motion/overview/ ; https://unpkg.com/@carbon/motion/es/index.js
- Material 3 tokens incl. Expressive springs (MDC-Android docs) — https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md
- Fluent 2 — https://fluent2.microsoft.design/motion ; https://raw.githubusercontent.com/microsoft/fluentui/master/packages/tokens/src/global/durations.ts ; .../curves.ts
- Apple HIG Motion — https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json ; Adobe Spectrum — https://spectrum.adobe.com/page/motion
- Emil Kowalski — https://emilkowal.ski/ui/you-dont-need-animations ; /ui/great-animations ; /ui/7-practical-animation-tips ; https://animations.dev/
- Rauno Freiberg — https://rauno.me/craft/interaction-design ; Vercel Web Interface Guidelines — https://vercel.com/design/guidelines
- Linear — https://linear.app/now/how-we-redesigned-the-linear-ui (opened; visual-system post, no motion guidance); third-party speed analyses https://performance.dev/how-linear-feels-instant , https://hungrymindsdev.substack.com/p/why-linear-feels-so-fast-technical
- Perceived speed — https://www.nngroup.com/articles/response-times-3-important-limits/ ; https://lawsofux.com/doherty-threshold/ ; https://www.nngroup.com/articles/skeleton-screens/ ; https://web.dev/articles/inp ; https://react.dev/reference/react/useOptimistic
- WCAG 2.2 — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html ; /pause-stop-hide.html ; /dragging-movements.html
- CSS/platform — https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style ; https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear ; https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using ; https://developer.chrome.com/docs/web-platform/view-transitions/same-document ; https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md
- Tailwind 4.3 — https://tailwindcss.com/docs/hover-focus-and-other-states ; /docs/theme ; /docs/transition-behavior ; /docs/transition-property ; /docs/transition-duration
- Scrim (read-only) — `apps/web/src/render/Stage.tsx`, `docs/architecture.md`, `routes/operator/{GoPanel,CueStack,AudiencePanel,Operator}.tsx`, `routes/OutputWindow.tsx`, `routes/Remote.tsx`, `audience/Audience.tsx`, `ui/{Button,toast,dialog,Tabs}.tsx`, `host/windows.ts`, `main.tsx`, `styles.css`

Could not open (client-rendered or empty): m3.material.io motion pages, Apple HIG HTML (JSON used), Compose `MotionScheme` reference, deno.bundlejs.com. v14 sizes were not re-measured; re-measure in Scrim's Vite build after adoption.
