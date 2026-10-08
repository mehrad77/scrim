# Research: Design-system foundations

**Question:** Which token, colour, type, density and component foundations suit a pro creative web app in 2026?

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win.

Method: Every cited page was opened (the one exception is flagged _(unverified)_). Versions/dates come from the npm registry (queried 8 October 2026). Items tagged **measured** were produced locally: esbuild bundles, font-binary inspection (fontTools/HarfBuzz), contrast maths (culori), a Tailwind 4.3.3 compile, and library-source reads. Repo facts are from a read-only look at `apps/web/src` (40 `.tsx` files).

## Findings

### 1. DTCG 2025.10 is stable — use it for interchange, not as the runtime source of truth

- What: First stable Design Tokens spec (Format, Color, Resolver modules), 28 Oct 2025. JSON `.tokens.json`; `$value/$type`; `{group.token}` aliases + `$ref`; `$extends`; composites (shadow, typography, border, transition). Colour = object `{colorSpace, components, alpha, hex}` with 14 spaces incl. `oklch`/`display-p3`. Themes/modes are **not** in Format; they live in the Resolver module (sets, modifiers, resolutionOrder; a "Final Community Group Report", not a W3C Rec). Tooling lags: Style Dictionary 5.6.0 (3 Oct 2026) documents 2025.10 as in progress; Terrazzo 2.7.1 claims full support (CSS/Tailwind plugins); Figma's native DTCG variable export was announced Nov 2025, still "rolling out" in Dec 2025, and a Jul 2026 article says it isn't native — unconfirmed.
- Evidence: https://www.designtokens.org/ · https://www.designtokens.org/TR/2025.10/format/ · …/color/ · …/resolver/ · https://styledictionary.com/info/dtcg/ · https://terrazzo.app/docs/ · https://forum.figma.com/ask-the-community-7/native-variable-export-feature-47831 · https://atomize.tools/blog/figma-design-tokens-vibe-coding/
- Apply to Scrim: Author tokens in CSS (Tailwind `@theme` + `:root`): no build step, offline. Later add DTCG export/import of user themes (Editor › Preferences › Appearance) — fits "open format, zero lock-in" (show designer, art director).
- Confidence: high (status), medium (tooling).

### 2. Mature systems converged on three tiers plus mode axes

- What: Spectrum: primitive (`blue-800`) → semantic (`accent-background-color-default`) → component (`tooltip-maximum-width`), names broad→specific; its format has mode sets `colorScheme`, `scale` (desktop/mobile) and `contrast`. Carbon: semantic `layer/background/text/border/field/support` tokens, numbered layering (`$layer-01..03`), four themes, component tokens confined to their component. Fluent 2: global + alias. Atlassian: `Foundation.Property.Modifier` (`color.text.subtle`, `elevation.surface.raised`, `space.100`), pick by meaning not hue. Radix Themes: `--accent-1..12`, `--gray-1..12`, alpha `a1..a12`, functional `--accent-surface/-indicator/-track/-contrast`. shadcn: `x` / `x-foreground` pairs, one `--radius`.
- Evidence: https://spectrum.adobe.com/page/design-tokens · https://opensource.adobe.com/spectrum-design-data/spec/token-format · https://carbondesignsystem.com/elements/color/tokens/ · https://fluent2.microsoft.design/design-tokens · https://atlassian.design/foundations/tokens/design-tokens · https://www.radix-ui.com/themes/docs/theme/color · https://ui.shadcn.com/docs/theming
- Apply to Scrim: **T1 primitives** (12-step ink/paper neutrals, accent ramp from one hue, status ramps, type/space/radius/duration/z-index scales). **T2 semantic** per theme: `surface-{app,panel,raised,overlay}`, `fg{,-muted,-subtle}`, `line{,-strong,-control}`, `accent{,-hover,-subtle,-fg}`, `focus`, `state-{go,standby,live,error}`. **T3 component**, only what varies by density: `--control-h`, `--row-h`, `--panel-head-h`, `--go-size`. Modes: `data-theme` × `data-density` × `data-contrast`. New components consume T2 only.
- Confidence: high.

### 3. Expressing the tiers in Tailwind v4 (compiled on 4.3.3, measured)

- What:

```css
@import 'tailwindcss';
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
:root {
  --ink-1: oklch(0.145 0.006 285); /* …T1: plain vars, no utilities */
  --accent-h: 25;
}
:root,
[data-theme='dark'] {
  --surface-app: var(--ink-1);
  --accent: oklch(0.68 0.19 var(--accent-h));
}
[data-theme='light'] {
  --surface-app: var(--paper-1);
  --accent: oklch(0.55 0.2 var(--accent-h));
}
@theme inline {
  --color-app: var(--surface-app);
  --color-accent: var(--accent);
}
@theme {
  --font-ui: 'Inter Variable', system-ui, sans-serif;
  --font-ui--font-feature-settings: 'case', 'ss02';
  --text-xs: 0.75rem;
  --text-xs--line-height: 1rem;
}
[data-density='compact'] {
  --spacing: 0.1875rem;
}
```

Compiled output: `bg-app` → `var(--surface-app)` (no `--color-app` emitted, so nested `[data-theme]` scopes work; docs: use `inline` when a theme value references a variable); a plain `@theme { --color-x: var(--y) }` is frozen on `:root`; `bg-panel/50` → `color-mix(in oklab, var(--surface-panel) 50%, transparent)` (with `@supports` fallback), so tokens can be whole colours; `h-8` → `calc(var(--spacing) * 8)`, so one `--spacing` override rescales all spacing/size utilities; font features attach to `.font-ui`; `dark:` compiles to the `:where([data-theme=dark]…)` selector. Set `data-theme` and `color-scheme` from an inline script in `index.html` (Tailwind's three-way pattern); today only `color-scheme: dark`.

- Evidence: https://tailwindcss.com/docs/theme · …/dark-mode · …/functions-and-directives · …/font-family · …/colors
- Apply to Scrim: Replace the single raw `@theme` (`ink-*`, `go/standby/live`). Keep `ink-*` as T1 aliases during migration (246 raw `ink-NNN` class uses; `ink-400` alone 71). Operator, Editor, Remote set their own `data-density` on the region root.
- Confidence: high.

### 4. OKLCH in practice and a hue-independent runtime-accent rule

- What: `oklch()` and `color-mix()` are Baseline widely available (May 2023); `light-dark()` since May 2024; MDN advises `@supports` guards for relative colour syntax; `contrast-color()` is Baseline since Apr 2026 (Chrome 147/Firefox 146/Safari 26) but returns only black/white, uses WCAG 2 maths, can't interpolate and is shaky on mid-tones. **Measured** (chroma .19, hues 25–320, sRGB-clamped): a white label reaches 4.5:1 only when the solid's L ≤ ~0.55–0.59 (those solids still give ≥4:1 against a dark panel, L .18); above L ≈ 0.60 a near-black label (L .15) gives 4.9–9.2:1. One flip rule works for any user hue.
- Evidence: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch · …/color-mix · …/light-dark · …/contrast-color · …/CSS_colors/Relative_colors · https://www.smashingmagazine.com/2026/05/building-self-correcting-color-systems-contrast-color/
- Apply to Scrim: Preferences › Accent = hue (+chroma). A small generator (culori 4.0.2 or colorjs.io 0.7.1, offline) clamps L to ~.55–.74, picks `accent-fg` by the L≈0.60 flip, writes `--accent-*` via `style.setProperty` (no React re-render); `contrast-color()` only as enhancement. Fix now: Scrim `live` `#f43f5e` has L .645, so white on it is 3.67:1 (fails; danger Button, `Badge live`, 7 `bg-live`) — use a dark label (5.45:1) or `oklch(.55 .22 20)` (white 5.45:1, 3.45:1 vs panel).
- Confidence: high (computed), medium (beyond chroma .19).

### 5. Radix's 12-step roles are right, but steps alone don't meet 1.4.11 — and Scrim's greys miss thresholds

- What: Steps 1–2 backgrounds; 3–5 component bg (normal/hover/pressed); 6–8 borders (non-interactive/interactive/strong+focus); 9–10 solid/hover; 11–12 text (~Lc 60/90). **Measured**, Radix Colors 3.0.0 `slateDark` vs step 2: step 11 = 8.45:1, 12 = 15.2:1 (APCA ≈ −60/−95), but step 7 = 1.91:1 and step 8 = 2.81:1; the first step ≥3:1 is 9 (3.43:1; light slate step 9 = 3.14:1). **Measured on Scrim**: `text-ink-400` on ink-900 = 4.03:1 (69 uses; 17 on `text-[11px]` lines), on ink-850 3.87:1; `ink-500`/placeholder 2.24:1 (12 uses); input border ink-700 vs ink-900 = 1.28:1; Kbd border 1.46:1; white on `live` 3.67:1. GO and LIVE differ by hue only: luminance contrast 1.61:1 (1.54:1 under simulated deuteranopia).
- Evidence: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale · …/composing-a-palette · https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.json (don't rely on colour alone)
- Apply to Scrim: Keep the 12-step roles but solve each role for a **target ratio vs the panel** — dark panel `oklch(.18 .008 285)`: text-1 ≥12:1 (L≈.85–.95), text-2 ≥7:1 (L .70), text-3/placeholder ≥4.5:1 (L .586), `line-control` ≥3:1 (L .49, `#5f6068`), `line-strong` 2:1 (L .395), `line-subtle` 1.35:1 decorative (L .294). Light panel `oklch(.965 .008 285)`: text L .31/.44/.54, control line .644, strong .752, subtle .879. Assert these in a Vitest on the generated tokens. State chips carry icon + label, never hue alone (Operator, Remote).
- Confidence: high.

### 6. Few-input theme generators: Linear (base/accent/contrast), Material HCT, Leonardo

- What: Linear (28 Mar 2024) cut 98 theme variables to three inputs — base, accent, contrast — moved HSL→LCH for uniform lightness, gets automatic high-contrast themes, and uses Inter Display for headings. Material HCT guarantees WCAG by tone gaps (Δ40 ≥ 3:1, Δ50 ≥ 4.5:1). Adobe Leonardo (npm 1.1.0) generates scales from target contrast ratios (WCAG 2 + APCA; OKLCH/CIELAB/CAM02), exports CSS/JSON/DTCG and ships an end-user personalisation module.
- Evidence: https://linear.app/now/how-we-redesigned-the-linear-ui · https://m3.material.io/blog/science-of-color-design · https://leonardocolor.io/
- Apply to Scrim: Preferences › Appearance = three controls — **Base** (neutral hue/chroma), **Accent**, **Contrast** (moves the finding-5 target ratios up to a high-contrast preset) — plus Dark/Light/System. Generate with a ~60-line culori solver (as done here) or Leonardo. Premiere Pro reportedly offers brightness/controls/focus sliders (search listing only, page 403) _(unverified)_; a continuous "UI brightness" slider beside the theme toggle is worth prototyping.
- Confidence: medium-high.

### 7. WCAG 2.2 checklist (numbering corrected), APCA status, focus ring

- What: 1.4.3 text 4.5:1 (3:1 only ≥18pt or 14pt bold ≈ 24/18.5 px); 1.4.11 non-text 3:1 (control boundaries, icons, focus indicators; disabled exempt); **2.4.11 is Focus Not Obscured (Minimum), AA** — sticky panels/toasts must not fully hide the focused element; **2.4.13 is Focus Appearance, AAA** (≥2 px perimeter, 3:1 change focused vs unfocused); 2.5.8 target ≥24×24 px (AA); 2.5.5 ≥44×44 (AAA). APCA is not in WCAG 3: the 10 Sep 2026 Working Draft says the contrast algorithm is "yet to be determined"; APCA left the draft in 2023; Roselli advises meeting WCAG 2 and optionally APCA. Focus craft: ≥2 px, 3:1 against component and surroundings, a two-colour ring works on any background, use `outline` so forced-colors keeps it.
- Evidence: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · …/non-text-contrast.html · …/focus-not-obscured-minimum.html · …/focus-appearance.html · …/target-size-minimum.html · …/target-size-enhanced.html · https://www.w3.org/TR/wcag-3.0/ · https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html · https://www.sarasoueidan.com/blog/focus-indicators/
- Apply to Scrim: The focus ring reuses `--color-live` (the PANIC/danger rose), so focus reads as danger. Give it `--color-focus`: `outline: 2px solid var(--focus-outer); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-inner)` (near-white/near-black ≈19:1). Reserve the toast lane so it never covers the cue stack/GO (2.4.11) and add `scroll-padding`. Compact floor = 24 px controls; Remote and GO ≥44 px.
- Confidence: high.

### 8. Dark-first for the booth, light for daylight work; elevation = lighter surfaces

- What: NN/g: for normal vision light mode usually performs better; polarity is irrelevant in bright ambient light, but at night light mode wins, especially with smaller fonts; offer a toggle. Mechanism (cogsci.nl): dark backgrounds dilate pupils, blurring detail, worse in dim rooms. Atlassian: in dark mode higher elevation = lighter surface, shadows only on raised/overlay, tokens always paired. Apple HIG: dim base vs brighter elevated backgrounds, bright white areas glow in dark contexts, 4.5:1 minimum and 7:1 for small text. Carbon alternates `layer-01/02/03`.
- Evidence: https://www.nngroup.com/articles/dark-mode/ · https://cogsci.nl/blog/is-bright-text-on-a-dark-background-a-good-idea · https://atlassian.design/foundations/elevation · https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.json
- Apply to Scrim: Keep dark default for Operator (booth light spill/dark adaptation _(unverified; domain reasoning)_) but pay the small-text penalty: ≥12 px, secondary text ≥7:1, no large pure-white areas. Dark `app L.145 < panel .18 < raised .215 < overlay .25 + shadow`; light `app .985 / panel .965 / raised 1.0`. Editor gets a real Light theme (art director, daylight). Stage-canvas surround = true neutral so chrome doesn't tint colour judgement _(unverified)_.
- Confidence: medium (studies cover reading tasks, not booth work).

### 9. Type stack: self-host the official Inter 4.1, not the Fontsource subset

- What: **Measured**: Fontsource `@fontsource-variable/inter` 5.3.0 latin files keep only `tnum, pnum, calt, frac` (48 KB wght; 73 KB wght+opsz) — no `case`, `zero`, `ss01/02`, `cv11`, and no ⌘ ⌥ ⇧ ⌃ ⌫ ⏎ ↵ ⎋ ⇥ glyphs. Official `InterVariable.woff2` (352 KB) has opsz 14–32, wght 100–900, all features and the key glyphs. A pyftsubset of it (Latin, punctuation, arrows, key glyphs; keep `tnum,zero,case,ss01,cv11,calt,kern`) = **74 KB** (full axes) or **35 KB** (wght 400–700, opsz pinned). With `font-optical-sizing: auto` large text uses the Display design automatically. **Digits are proportional by default** in Inter and Geist: `11:11:11:11` is 30% (Inter) / 39% (Geist) narrower than `00:00:00:00`; `tnum` equalises them. IBM Plex Sans (46 KB) is tabular by default but has no key glyphs; official Geist (70 KB) lacks ⌘ ⌥ ⌃ ⌫ ⏎ ⎋ ␣ and `zero`; Geist Mono 23 KB / JetBrains Mono 40 KB are monospaced anyway. Tailwind v4 attaches features per font token and has `tabular-nums`/`slashed-zero`.
- Evidence: https://rsms.me/inter/ · https://fontsource.org/docs/getting-started/variable · https://vercel.com/font · https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric · https://tailwindcss.com/docs/font-variant-numeric · jsDelivr file listings of the Fontsource packages
- Apply to Scrim: `--font-ui` = Inter Variable subset above, self-hosted and precached (Inter is declared today but never loaded; offline needs local files), features `case` + `ss02`; `tabular-nums` as the default for readouts (timecode, cue numbers, durations, inspector values — Operator, Cues); `slashed-zero` for MIDI/key IDs; `cv11`/`ss01` are taste. Mono face only for Log/State JSON. Real Kbd glyphs need Inter (Geist falls back to OS fonts).
- Confidence: high (measured), medium (feature taste).

### 10. Type scale and minimum sizes

- What: Floors: Carbon's smallest UI text is 12 px; Atlassian's smallest body is 12 px, "sparingly"; Fluent 2 web ramp is 10/12/14 px; Apple macOS default 13 pt/min 10 pt, iOS 17/11. Light-on-dark small text is the worst case (finding 8). No controlled 11-vs-12 px study found; the case for 12 px+ is these floors plus the small-size × dark × dim penalty. Scrim: 28 × `text-[11px]`, 2 × `text-[10px]`, 75 × `text-xs`, 57 × `text-sm`.
- Evidence: https://carbondesignsystem.com/elements/typography/type-sets/ · https://atlassian.design/foundations/typography · https://fluent2.microsoft.design/typography · https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.json
- Apply to Scrim: Scale px/line: `2xs 11/14` (redundant hints only, e.g. Kbd chips), `xs 12/16 w500` (labels, headers, chips), `sm 13/18` (Editor default = macOS body), `base 14/20` (Operator lists, dialogs), `lg 16/24`, `2xl 28/32` (Operator "next cue"), `display 40–64` (GO, clock). Migrate the 30 sub-12 px uses first; uppercase panel titles get `case`.
- Confidence: medium.

### 11. Density modes, radius, borders

- What: Spectrum themes via `<sp-theme color="dark" scale="medium|large">` — colour and scale are independent axes (medium = desktop, large = touch). Carbon: 2× grid, 13 spacing tokens. Radix Themes has a `scaling` prop; shadcn derives all radii from one `--radius`. In Tailwind v4 the single `--spacing` already drives all spacing/size utilities (finding 3).
- Evidence: https://opensource.adobe.com/spectrum-web-components/tools/styles · https://carbondesignsystem.com/guidelines/spacing/overview/ · https://www.radix-ui.com/themes/docs/theme/overview · https://ui.shadcn.com/docs/theming
- Apply to Scrim: Three scales on region roots: **compact** (24 px controls, the WCAG 2.5.8 floor; opt-in power editing), **comfortable** (32 px; Editor/Library default), **stage** (44 px targets, 14–16 px text; Operator, Remote, Audience). Replace fixed 260/288 px side panels with resizable ones (finding 14). One `--radius` base (controls ×1, panels ×1.33, overlays ×2); 1 px borders at every density; icon sizes 14/16/20 tied to density.
- Confidence: medium.

### 12. Headless libraries, Oct 2026: comparison and pick

|                                              | Radix Primitives                                                                                                        | Base UI                                                                         | React Aria Components (RAC)                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Latest / cadence                             | `radix-ui` 1.7.0 (5 Oct; 1.8.0 RCs 7–8 Oct). No stable release 13 Aug 2025 → 6 Jun 2026; 10 since (none 24 Jul → 5 Oct) | `@base-ui/react` 1.8.0 (4 Sep); v1.0 on 11 Dec 2025, ~monthly                   | 1.22.0 (8 Oct), every 4–8 weeks                                                                                |
| Steward / licence                            | WorkOS; latest commits mostly one maintainer / MIT                                                                      | MUI / MIT                                                                       | Adobe / Apache-2.0                                                                                             |
| Coverage                                     | 33 namespaces; no Combobox, NumberField, Tree, Colour                                                                   | ~40; Combobox, Autocomplete, NumberField+ScrubArea, Toast; no Tree, Colour, DnD | 169 exports: Tree, Colour family, GridList/ListBox/Table, Virtualizer, DnD, Autocomplete; Toast `UNSTABLE_`    |
| A11y evidence                                | WAI-ARIA patterns; no SR matrix found                                                                                   | WAI-ARIA; no localized strings                                                  | Published SR matrix (VoiceOver mac/iOS, JAWS, NVDA, TalkBack), 30+ languages, keyboard/SR drag-and-drop parity |
| gz, **measured** (common set / full pro set) | 49.8 / 57 KB (incomplete)                                                                                               | 84.9 / 118 KB                                                                   | 73.6 / 113 KB                                                                                                  |
| Tailwind                                     | `data-[state=open]:`, `asChild`                                                                                         | `data-[popup-open]:`, `render`, documented Motion hand-off                      | `data-[pressed]:` or `tailwindcss-react-aria-components` 2.2.0 (v4)                                            |

Size note: one secondary article says Base UI is smaller than Radix; my numbers disagree (Tooltip alone: Base UI 34 KB, Radix 19, RAC 14 gz). Scrim's JS is 303 KB gz today, so ~115 KB is +38% — fine for a precached PWA if the Operator route imports only tooltip/dialog/tabs/menu.

- Evidence: https://www.radix-ui.com/primitives/docs/overview/releases · https://github.com/radix-ui/primitives/commits/main · https://base-ui.com/react/overview/releases · https://github.com/adobe/react-spectrum/releases · https://react-aria.adobe.com/quality · https://react-aria.adobe.com/styling · https://base-ui.com/react/handbook/animation · https://www.untitledui.com/blog/base-ui-vs-react-aria (author builds on RAC) · https://www.shadcndeck.com/blog/radix-vs-base-ui · https://ui.shadcn.com/docs/changelog/2026-07-react-aria (shadcn supports all three; Base UI is its default)
- Apply to Scrim — **pick RAC** (pin 1.22.x) as the single headless layer: (1) it alone ships the hardest builds — accessible Tree for layers/scenes, Colour Area/Slider/Wheel/Field for fills, GridList/ListBox + Virtualizer + keyboard/screen-reader drag reorder for the cue list (fixes "cue rows not keyboard reachable"); (2) tested SR matrix and i18n; (3) `MenuTrigger trigger="contextMenu"`, `Keyboard` hints, a documented Autocomplete command palette, `useMove`/`usePress` for custom scrubbers. Costs: Colour is RGB/HSL/HSB only (build OKLCH sliders on `Slider`), no scrub field, no splitter, Toast unstable. Flip to Base UI if cue list/layers stay hand-built and English-only; Radix only for a slim Operator build. Avoid mixing libraries' overlays (separate dismiss/focus stacks) _(inference)_.
- Confidence: medium-high.

### 13. Esc = PANIC collides with every overlay's dismiss handler

- What: Read in the installed sources (**measured**): Radix `DismissableLayer` listens on `document` in the capture phase and only calls `preventDefault`; Base UI `useDismiss` defaults `escapeKey` bubbling to false, so it calls `stopPropagation` (and waits out IME composition); RAC `useOverlay` runs Escape through `useKeyboard` shortcuts, where a handler returning nothing means preventDefault + stopPropagation (`isKeyboardDismissDisabled` returns false → propagates). Radix modal layers can also disable outside pointer events.
- Evidence: sources of radix-ui 1.7.0, @base-ui/react 1.8.0, react-aria-components 1.22.0 (installed locally); https://react-aria.adobe.com/Autocomplete (palette closes on Esc)
- Apply to Scrim: Register PANIC as `window.addEventListener('keydown', h, { capture: true })`, ignore `defaultPrevented`, no focus/target gating; overlays closing too is fine. No modal dialogs on the Operator route in Show mode (they block pointer access to GO/PANIC) — use non-modal popovers/inline confirm. E2E: open Menu/Popover/Combobox → Esc → PANIC fires (Operator, stage manager).
- Confidence: high (source-verified; re-test on upgrades).

### 14. Satellite libraries

- What: **react-resizable-panels** 4.14.3 (7 Oct; five releases in two weeks): `Group/Panel/Separator`, `defaultLayout` + `onLayoutChanged` persistence, collapsible, px/%/rem units, WAI-ARIA separator (arrows, Home/End, Enter). **cmdk** 1.1.1 last published 14 Mar 2025 and depends on Radix Dialog → stale; build the palette from RAC Autocomplete + Menu in a Modal (documented example, virtual focus) or Base UI Autocomplete in a Dialog. **sonner** 2.0.8 (9.7 KB gz, 0 deps; one release in 12 months) vs RAC `UNSTABLE_Toast` (F6 landmark, pause on hover/focus, ≥5 s advised) vs Base UI Toast (F6, low/high priority). **@tanstack/react-virtual** 3.14.13 only if RAC's Virtualizer falls short. **Motion** 14.0.0 (2 Oct): `LazyMotion`+`domAnimation`+`m`+`AnimatePresence` = 29 KB gz, full `motion` = 43 KB gz (**measured**).
- Evidence: https://github.com/bvaughn/react-resizable-panels · https://raw.githubusercontent.com/bvaughn/react-resizable-panels/main/README.md · https://github.com/dip/cmdk · https://sonner.emilkowal.ski/getting-started · https://react-aria.adobe.com/Toast · https://base-ui.com/react/components/toast · https://base-ui.com/react/components/autocomplete
- Apply to Scrim: Editor (Stage/Cues/Interaction) and Operator become `Group`s with layouts persisted per workspace. Palette: Cmd+K in the Editor, restricted in Rehearsal, none in Show. Keep Scrim's toast store but add a landmark/F6, pause-on-hover, ≥5 s, persistent errors; move to RAC Toast when it leaves UNSTABLE.
- Confidence: high.

### 15. Component inventory → coverage (from installed exports and docs)

| Need                                               | Radix         | Base UI                                                                  | RAC                                                           |
| -------------------------------------------------- | ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Tooltip / Popover / Menu / Tabs / Dialog / Toolbar | ✔             | ✔                                                                        | ✔ (tooltip: warmup on hover, instant on focus, none on touch) |
| Context menu                                       | ✔             | ✔ (long-press; keyboard undocumented)                                    | ✔ `trigger="contextMenu"`                                     |
| Combobox / command palette                         | ✘ / cmdk      | ✔ / Autocomplete in Dialog                                               | ✔ / Autocomplete + Menu in Modal                              |
| Number scrubber                                    | ✘             | ✔ `NumberField.ScrubArea` (pointer lock, off in Safari; Alt/Shift steps) | ✘ (build with `useMove`)                                      |
| Slider / range                                     | ✔             | ✔ multi-thumb                                                            | ✔                                                             |
| Colour picker                                      | ✘             | ✘                                                                        | ✔ (RGB/HSL/HSB)                                               |
| Segmented control                                  | ✔ ToggleGroup | ✔                                                                        | ✔ ToggleButtonGroup                                           |
| Tree / virtualized list / drag reorder             | ✘ / ✘ / ✘     | ✘ / via TanStack / ✘                                                     | ✔ / ✔ / ✔                                                     |
| Toast                                              | ✔             | ✔                                                                        | `UNSTABLE_`                                                   |
| Resizable panels                                   | ✘             | ✘                                                                        | ✘ → react-resizable-panels                                    |
| Kbd hints / status chips                           | custom        | custom                                                                   | `Keyboard` in menus / `Tag` — else custom                     |

- Evidence: https://base-ui.com/react/components/number-field · …/combobox · …/context-menu · https://react-aria.adobe.com/Tree · …/Virtualizer · …/ColorPicker · …/NumberField · …/Menu · …/Tooltip · …/blog/drag-and-drop · Figma Option/Alt-drag scrubbing: https://forum.figma.com/report-a-problem-6/option-drag-to-change-values-is-inconsistent-36984
- Apply to Scrim: First replace the 49 native `title=` tooltips and 37 native `<select>`s (Stage inspector, Interaction rules — art director, creative author). Build custom: `ScrubLabel` (Alt/Shift fine/coarse, pointer lock where available; art directors expect Figma-style), OKLCH sliders, `Kbd` with platform glyphs, icon+text status chip. Every context-menu action also gets a visible control (Base UI's own warning).
- Confidence: high (coverage), medium (quality).

## Top 5 recommendations

1. **Headless layer: React Aria Components 1.22.x** as the single primitive set (Tree, Colour, GridList+Virtualizer+DnD, Menu/context menu, Autocomplete palette, Tooltip, Dialog, Tabs, Slider) plus react-resizable-panels 4; custom scrub field, OKLCH sliders, Kbd, chips; thin toasts until RAC Toast stabilises; skip cmdk; code-split so Operator imports only tooltip/dialog/tabs/menu.
2. **Token tiers in CSS**: T1 primitives (plain vars) → T2 semantic per `[data-theme]` via `@theme inline` → T3 density/component tokens; modes theme × density × contrast; every colour role solved for a target ratio (text 12/7/4.5:1, control lines 3:1, two-tone focus) and asserted in Vitest; runtime accent from one hue with the L≈0.60 label-flip; DTCG export later.
3. **Type**: self-hosted Inter 4.1 subset (≈74 KB, wght+opsz, `tnum case zero ss02`), `tabular-nums` on all readouts, floor 12 px / default 13 px / Operator ≥14 px; migrate the 30 sub-12 px labels.
4. **Density**: `data-density` = compact 24 / comfortable 32 / stage 44 px via `--spacing` + T3 control-height tokens; Editor comfortable, Operator/Remote stage; resizable panels replace the fixed 260/288 px columns.
5. **Fix first (reliability + a11y debts)**: bind PANIC in the window capture phase and forbid modals in Show mode; lift `text-ink-400` (69 uses), placeholders and input borders to ≥4.5:1 / 3:1; fix white-on-`live` (3.67:1); give focus its own two-tone ring (it shares the PANIC rose); make GO/LIVE distinguishable without hue.

## Sources (opened)

- DTCG and tooling: https://www.designtokens.org/ · https://www.designtokens.org/TR/2025.10/format/ · https://www.designtokens.org/TR/2025.10/color/ · https://www.designtokens.org/TR/2025.10/resolver/ · https://styledictionary.com/info/dtcg/ · https://terrazzo.app/docs/ · https://forum.figma.com/ask-the-community-7/native-variable-export-feature-47831 · https://atomize.tools/blog/figma-design-tokens-vibe-coding/
- Tailwind: https://tailwindcss.com/docs/theme · https://tailwindcss.com/docs/dark-mode · https://tailwindcss.com/docs/colors · https://tailwindcss.com/docs/functions-and-directives · https://tailwindcss.com/docs/adding-custom-styles · https://tailwindcss.com/docs/font-family · https://tailwindcss.com/docs/font-variant-numeric
- Design systems: https://ui.shadcn.com/docs/theming · https://ui.shadcn.com/docs/changelog/2026-07-react-aria · https://spectrum.adobe.com/page/design-tokens · https://opensource.adobe.com/spectrum-design-data/spec/token-format · https://opensource.adobe.com/spectrum-web-components/tools/styles · https://carbondesignsystem.com/elements/color/tokens/ · https://carbondesignsystem.com/elements/typography/type-sets/ · https://carbondesignsystem.com/guidelines/spacing/overview/ · https://fluent2.microsoft.design/design-tokens · https://fluent2.microsoft.design/typography · https://atlassian.design/foundations/tokens/design-tokens · https://atlassian.design/foundations/elevation · https://atlassian.design/foundations/typography · https://www.radix-ui.com/themes/docs/theme/color · https://www.radix-ui.com/themes/docs/theme/overview · https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale · https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette
- Apple HIG (data endpoints behind the HIG pages): https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.json · https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.json · https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.json
- Colour: https://linear.app/now/how-we-redesigned-the-linear-ui · https://m3.material.io/blog/science-of-color-design · https://leonardocolor.io/ · https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch · https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix · https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark · https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/contrast-color · https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors · https://www.smashingmagazine.com/2026/05/building-self-correcting-color-systems-contrast-color/
- Accessibility: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html · https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html · https://www.w3.org/TR/wcag-3.0/ · https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html · https://www.sarasoueidan.com/blog/focus-indicators/ · https://www.nngroup.com/articles/dark-mode/ · https://cogsci.nl/blog/is-bright-text-on-a-dark-background-a-good-idea
- Fonts: https://rsms.me/inter/ · https://fontsource.org/docs/getting-started/variable · https://vercel.com/font · https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric · jsDelivr package listings (https://data.jsdelivr.com/v1/package/npm/@fontsource-variable/inter@5.3.0/flat and the geist, geist-mono, ibm-plex-sans, jetbrains-mono equivalents)
- Headless libraries: https://www.radix-ui.com/primitives/docs/overview/releases · https://www.radix-ui.com/primitives/docs/overview/introduction · https://github.com/radix-ui/primitives · https://github.com/radix-ui/primitives/commits/main · https://base-ui.com/react/overview/releases · https://base-ui.com/react/overview/quick-start · https://base-ui.com/react/components/slider · https://base-ui.com/react/components/number-field · https://base-ui.com/react/components/context-menu · https://base-ui.com/react/components/combobox · https://base-ui.com/react/components/autocomplete · https://base-ui.com/react/components/toast · https://base-ui.com/react/handbook/animation · https://base-ui.com/react/handbook/styling · https://react-aria.adobe.com/ · https://react-aria.adobe.com/ColorPicker · https://react-aria.adobe.com/Tree · https://react-aria.adobe.com/NumberField · https://react-aria.adobe.com/Virtualizer · https://react-aria.adobe.com/Toast · https://react-aria.adobe.com/Autocomplete · https://react-aria.adobe.com/Tooltip · https://react-aria.adobe.com/Menu · https://react-aria.adobe.com/styling · https://react-aria.adobe.com/quality · https://react-aria.adobe.com/blog/drag-and-drop · https://react-aria.adobe.com/releases/v1-14-0 · https://github.com/adobe/react-spectrum/releases · https://newreleases.io/project/github/adobe/react-spectrum/release/react-aria-components@1.20.0 · https://www.untitledui.com/blog/base-ui-vs-react-aria · https://www.shadcndeck.com/blog/radix-vs-base-ui
- Satellites and prior art: https://github.com/bvaughn/react-resizable-panels · https://raw.githubusercontent.com/bvaughn/react-resizable-panels/main/README.md · https://github.com/dip/cmdk · https://sonner.emilkowal.ski/getting-started · https://forum.figma.com/report-a-problem-6/option-drag-to-change-values-is-inconsistent-36984
- npm registry (versions and dates, 2026-10-08): https://registry.npmjs.org/ radix-ui, @base-ui/react, react-aria-components, cmdk, sonner, react-resizable-panels, @radix-ui/colors, tailwindcss, culori, colorjs.io, style-dictionary, @terrazzo/cli, motion, @tanstack/react-virtual, @fontsource-variable/*, tailwindcss-react-aria-components, @adobe/leonardo-contrast-colors, geist.
