# Research: Visual identity directions

**Question:** What could Scrim look like? Three directions, each with palette, type, shape and motion.

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win. The direction chosen was a blend of Call Sheet and Spike, leaning towards Spike, called **Tech Table**; see [DESIGN_SYSTEM.md › Identity](../../../DESIGN_SYSTEM.md#identity-tech-table).

Method: Colour maths (OKLCH→sRGB gamut, WCAG 2.2 + APCA, Machado colour-blind sim; ΔE = OKLab distance) and font metrics were computed by script. [S#] = opened sources; _(unverified)_ = not opened.

## Findings

### 1. Themes are three inputs, not 98 variables

- What: Linear (Mar 2024) moved to LCH; base, accent and contrast replaced 98 variables, and contrast auto-yields high-contrast themes. Its Mar 2026 refresh dimmed the sidebar, cut icons, softened separators, warmed the grey. Ableton Live 12: cool/neutral/warm tone, high-contrast option, follow-system. Rive: Design/Animate modes (Tab).
- Evidence: [S1][S2][S4][S9]
- Apply: all surfaces — Preferences ▸ Appearance = mode + tone + accent + contrast, plus a dim "Booth" preset. Rehearsal vs Show becomes a posture (dimmer chrome, accent retired, lock glyph), not a toggle. Operator, art director.
- Confidence: high

### 2. Colour is scarce and always paired with a shape

- What: QLab status = hue + glyph (green ▶ active, yellow ‖ paused, yellow ● loaded, red ✕ broken); its GO border is green when ready, red while double-GO protection is on; QLab 5 adds an optional second cue colour after start. Cue lights: red = warning, yellow/flashing red = standby, green = go. Vercel's report-site guidelines: monochrome, colour only with a non-colour cue.
- Evidence: [S5][S6][S7]
- Apply: Operator (stage manager) — lamp + glyph + word per state; no brand accent there. Today's rose `live` (oklch .645 .215 16) is also the danger button, Show-mode toggle, focus ring, blackout border and audience CTA (grep of apps/web/src) — split it.
- Confidence: high

### 3. Affordance beats austerity for newcomers

- What: Figma UI3 swapped sharp edges and abstract icons for input backgrounds, bordered dropdowns, rounded corners, 200 hand-drawn icons, optional labels, resizable panels.
- Evidence: [S8]
- Apply: Editor (Stage, Interaction) — visible controls and labels for creative authors; austerity only on Operator.
- Confidence: high

### 4. Expressive type belongs to brand moments

- What: site CSS (marketing, not apps): Dia = Exposure variable display + ABC Oracle + Favorit Mono on paper #FBFAF6 / charcoal #1B1B1B, hard offset shadows; Arc = Marlin Soft + Favorit Mono; Linear = Inter Variable at weights 510/590/680, Berkeley Mono, Tiempos Headline; Framer and Rive mostly Inter + Inter Display.
- Evidence: [S3][S9][S10]
- Apply: Library, empty states, audience page, printed cue sheets (art director) may be expressive; Operator never. Inter is the category default, so differentiate with display/mono faces.
- Confidence: medium

### 5. Instrument language

- What: teenage.engineering preloads one proprietary light face, near-black rgba(15,14,18), grid dividers; the K.O. II has a three-character readout and backlit indicators, though two-digit scene entry is slow. Resolume: dark UI, colour-coded clips/layers/decks, portable XML layouts. Cavalry (Canva, Feb 2026): visuals not verifiable.
- Evidence: [S11][S12][S13]
- Apply: Remote (performer), Controls, Operator — pad grid, LED-style cue number, saved layouts per role.
- Confidence: medium

### 6. Stage vocabulary

- What: gauze is opaque front-lit, see-through when the scene behind is lit, and takes projection; a ghost light is a bare bulb in a cage near centre stage; spike tape colour-codes items/scenes, labelled, glow tape in the dark; Lee gels are number + name with published swatches (181 Congo Blue #5000AA, 795 Magical Magenta #FA46C8); cue sheets are columns (number, description, timing, notes) with prefixed numbers (S1, S2). Theatre brands are type-led (Public Theater wood-type caps; Trøndelag variable display type; Studio Theatre yellow/black).
- Evidence: [S14][S15]
- Apply: "bleed-through" dissolve for Editor/Cues preview and Operator blackout; ghost-light idle state; tape palette for scene tags; gel-named tokens.
- Confidence: medium (inference)

### 7. OKLCH and variable fonts are ready; ship them offline

- What: oklch()/color-mix() are Baseline widely available; light-dark() and relative colours newly (2024); Tailwind v4's palette is OKLCH; Radix roles: 1–2 backgrounds, 3–5 controls, 6–8 borders, 9–10 solids, 11–12 text (APCA Lc 60/90); Geist: 10 steps (1–3 components, 4–6 borders, 7–8 solid, 9–10 text). Latin subsets keep `tnum`, drop `zero`/`ss*`/`cv*`. Commit Mono advises weight 400 on dark, 450 on light.
- Evidence: [S16][S17]
- Apply: tokens in `@theme` as oklch; self-host and precache (offline show machine); ~50 lighter weight in dark.
- Confidence: high

### Typefaces (OFL unless noted; Latin woff2, measured)

- Inter 4.1: wght 100–900 + opsz 14–32 (Display = 32); 47 KB, 71 KB with opsz; full 344 KB adds zero, cv01–14, ss01–08; needs `tnum`.
- Geist 1.7.2: Sans/Mono wght 100–900, 29/23 KB (full 68/70 KB, ss01–11); Pixel = 5 static cuts, 18–28 KB, proportional digits.
- IBM Plex: Sans variable wght 100–700 (45 KB; +wdth 75–100 = 64 KB), digits tabular by default; Mono static, 14–15 KB/cut; Arabic/Hebrew/Thai/CJK siblings.
- Fraunces: opsz 9–144, wght, SOFT, WONK; 36 / 66 / 118 KB (wght / +opsz / all); proportional digits.
- Also variable: JetBrains Mono 40 KB, Martian Mono 23, Manrope 24, Space Grotesk 22. Berkeley-like free monos: Commit Mono (static; variable in design pack), Monaspace. Other display serifs: Newsreader (opsz 6–72, 129 KB), Instrument Serif (static, 20 KB). Berkeley Mono is commercial _(terms unverified, site blocked)_.

## Directions

### 1. Ghost Light — monochrome instrument, one warm bulb

- Mood/personas: calm, exact; nothing competes until earned. Operator, director, art director (neutral surround); weakest for creative authors. Brand moment: audience page = black with one ghost-light dot until the first vote.
- Refs: Linear 2024/2026 [S1][S2], Vercel guidelines [S7], QLab 5 [S5].
- Palette (dark): neutral `oklch(L .010 262)`, L = .145 .175 .205 .235 .265 .305 .365 .455 .560 .620 .765 .950 (C → .005 by step 12). Accent Ghost `oklch(.95 .045 88)` (focus ring, primary fill, ink legend). Semantics (L C H): go .75 .17 155 · standby .93 .11 98 · live .63 .21 37 · danger .62 .20 10 · info .76 .11 245. Steps 11/12 on step 2: 9.0/16.3:1; lamps ≥ 4.6:1; go/standby/live ΔE ≥ .11 under protan/deutan (lightness-driven).
- Light: L .995 .980 .962 .944 .925 .895 .850 .775 .600 .545 .440 .230 (C .002→.008); Ghost becomes ink (step 12, 16.6:1); semantic text variants L .52–.55 (≥ 5:1).
- Type: Inter, `font-optical-sizing: auto` (71 KB) + JetBrains Mono for cue numbers/timecode (40 KB).
- Shape: Lucide strokeWidth 2.25 at 16 px ≈ 1.5 px (default 2 ≈ 1.33); radius 6/10; borders at steps 6–7, shadow only on popovers; 28 px rows, 13 px text.
- Motion: snappy-quiet — 120–160 ms ease-out, springs `duration .25 bounce 0`; GO/PANIC feedback is CSS `:active`.
- Fit: dark booth best; daylight needs the light theme. Risks: reads as Linear/Vercel; Ghost is only ΔE .05 from text white, so brand recall is weak — add gel-wash gradients on Library/audience only.

### 2. Call Sheet — paper, pencil, one violet pen

- Mood/personas: editorial, warm, readable like a prompt book. Creative author, director, art director; operator via the Booth variant. Brand moment: audience page as a printed programme; cue/call-sheet PDFs share the look.
- Refs: Dia [S10], Public Theater/Trøndelag [S15], prompt books and cue sheets [S14], Lee gels [S14].
- Palette (dark Booth): neutral `oklch(L .009 80)`, L = .170 .200 .230 .260 .290 .335 .395 .485 .580 .640 .785 .955. Accent Congo `oklch(.74 .14 292)` (links, selection; Lee 181 ≈ .39 .22 292). Semantics: go .74 .16 150 · standby .92 .11 98 · live .63 .19 37 · danger .63 .18 10 · info slate .72 .03 250 (glyph-only). Steps 11/12: 9.2/15.9:1; lamps ≥ 4.7:1.
- Paper (default): L .985 .972 .955 .938 .920 .890 .845 .770 .590 .535 .430 .220, hue 85, C .014→.008; Congo ink `oklch(.42 .19 292)` 8.9:1; text variants L .45–.54 (≥ 4.9:1).
- Type: IBM Plex Sans (wdth 85 for cue columns, 64 KB) + Fraunces ≥ 24 px (66 KB; 118 KB only for SOFT/WONK) + Plex Mono 400/600 (30 KB). ≈ 160–210 KB; best i18n path.
- Shape: Lucide 1.5 px, butt caps/miter via props; radius 3/6; hairline rules, not boxes; one hard offset shadow on the primary action; 32 px rows, 14 px text.
- Motion: soft, paper-like — springs `visualDuration .35 bounce .2`, `layoutId` reorders, 400 ms scrim dissolve for scene preview.
- Fit: daylight studio, tech table, print best. Risks: tinted neutrals bias colour judgement (offer a neutral canvas surround); serif slows dense UI (display only); a bright paper theme in a glazed back-of-house booth [S14] spills light, so Booth must be first-class.

### 3. Spike — tape on a black stage, lit like a desk

- Mood/personas: tactile, labelled, LED-bright. Operator and performer remote first; art directors with a VJ/instrument bent; weakest for creative authors. Brand moment: audience page as one giant pad.
- Refs: Teenage Engineering [S11], Resolume [S12], Ableton tone/contrast [S4], QLab GO states [S5].
- Palette (dark): neutral `oklch(L .006 300)`, L = .120 .150 .185 .220 .255 .300 .370 .470 .570 .640 .790 .965. Accent Magical Magenta `oklch(.70 .22 338)` (Lee 795 ≈ .69 .25 341; ink legend 6.8:1). Semantics: go .76 .185 155 · standby .94 .10 96 · live .66 .185 46 · danger .62 .22 14 · info .80 .07 235. Steps 11/12: 10.2/17.8:1; lamps ≥ 4.8:1.
- Light "aluminium": L .985 .965 .945 .925 .905 .875 .830 .755 .590 .535 .430 .180 (C .004–.006); accent text `oklch(.55 .24 338)` 5.3:1.
- Type: Geist Sans (29 KB) + Geist Mono caps microlabels (23 KB) + Geist Pixel Grid for cue number/clock (28 KB; fixed-width cells, digits are proportional). ≈ 80 KB via npm `geist`.
- Shape: Lucide strokeWidth 3 at 16 px ≈ 2 px, square caps/miter; radius 0–2; 1 px grid dividers; lit states glow instead of shadow; 24 px dense rows, 12 px mono caps.
- Motion: mechanical — 60–100 ms linear, LED on instantly with 180 ms decay, detented sliders, no overshoot.
- Fit: dark booth strong, daylight weak (neon washes out). Risks: toy-like; the austerity Figma left for newcomers [S8]; accent only 36° from danger (glyphs mandatory).

## Cross-cutting rules

- Roles (Radix-style): 1 app bg · 2 panel · 3–5 control rest/hover/active · 6–8 hairline/border/focus · 9 icons ≥ 3:1 · 10 placeholder ≥ 4.5:1 · 11–12 text.
- Lamps carry ink (step 1) legends; white legends give 1.2–4.1:1. Live = solid dot + word; danger = outline + icon (live–danger ΔE only ≈ .09–.12). Test with stage managers: red means "warning" in cue lights but "on-air" in broadcast _(unverified)_; if misread, make live a white-hot lamp.
- Separate 8-hue tape palette for scenes/cues; optional second colour after start (QLab).
- Colours are sRGB-safe; boost chroma +.03 under `@media (color-gamut: p3)`. Targets ≥ 24 px (WCAG 2.5.8); labels ≥ 12 px (today: `text-[11px]` ×28, `text-[10px]` ×2).
- Fonts: self-host woff2 (show machine is offline), `font-display: swap`, preload UI + mono, precache in the service worker; OFL permits bundling.
- No UI motion on outputs or the GO/PANIC path; honour `prefers-reduced-motion`.

## Top 5 recommendations

1. Generate themes from base/accent/contrast in OKLCH with 12 roles; ship Dark, Light, System and a dim high-contrast Booth preset.
2. Split rose `live` into accent, focus, live, danger, info; lamp + glyph + word; ink legends; on Operator the accent is only the focus ring.
3. Ghost Light for Operator/Editor chrome; borrow Call Sheet's paper + Fraunces for Library, audience page, printed sheets; Spike's pad grid and Geist Pixel clock for Remote.
4. Self-host variable Inter (opsz) + one mono, `tnum`, labels ≥ 12 px, density presets 32/28/24 px.
5. Put stage vocabulary into tokens: gel-named colours, tape palette, scrim bleed-through dissolve, ghost-light idle.

## Sources (opened)

- [S1] https://linear.app/now/how-we-redesigned-the-linear-ui (Linear, Mar 2024)
- [S2] https://linear.app/now/behind-the-latest-design-refresh (Linear, Mar 2026)
- [S3] https://linear.app/ (CSS)
- [S4] https://www.ableton.com/en/live/all-new-features/ · https://cdm.link/ableton-live-12-everything-new/
- [S5] https://qlab.app/docs/v5/fundamentals/workspace/ · https://qlab.app/docs/v5/general/new-in-qlab-5/ · https://qlab.app/
- [S6] https://en.wikipedia.org/wiki/Cue_light
- [S7] https://vercel.com/design.md · https://vercel.com/geist/colors · https://vercel.com/font · https://github.com/vercel/geist-font
- [S8] https://www.figma.com/blog/behind-our-redesign-ui3/
- [S9] https://rive.app/blog/design-vs-animate-mode · https://rive.app/docs/editor/fundamentals/design-vs-animate-mode · https://rive.app/ (CSS)
- [S10] https://diabrowser.com/ · https://arc.net/ · https://www.framer.com/ (CSS)
- [S11] https://teenage.engineering/ (CSS) · https://www.soundonsound.com/reviews/teenage-engineering-ep-133-ko-ii
- [S12] https://resolume.com/support/en/layouts · https://cdm.link/resolume-7-18/ · https://resolume.com/
- [S13] https://www.cgchannel.com/?p=174225
- [S14] https://theatrecrafts.com/pages/home/topics/lighting/lighting-gauze-scrim/ · https://en.wikipedia.org/wiki/Ghost_light_(theatre) · https://en.wikipedia.org/wiki/Spike_(stagecraft) · https://en.wikipedia.org/wiki/Prompt_book · https://en.wikipedia.org/wiki/Control_booth · https://stageagent.com/resources/templates/sound-cue-sheet · https://www.leefilters.com/lighting/colour-list.html
- [S15] https://www.pentagram.com/work/the-public-theater · https://fontsinuse.com/uses/72430/trondelag-teater · https://www.creativereview.co.uk/studio-theatre-washington-identity-posters/
- [S16] https://api.webstatus.dev/v1/features/oklab (also light-dark, relative-color) · https://tailwindcss.com/docs/colors · https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale · https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- [S17] https://api.fontsource.org/v1/variable/inter (+ other faces) · https://cdn.jsdelivr.net/npm/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2 · https://rsms.me/inter/ · https://data.jsdelivr.com/v1/packages/npm/geist@1.7.2?structure=flat (Geist files) · https://github.com/undercasetype/Fraunces · https://github.com/IBM/plex · https://commitmono.com/ · https://monaspace.githubnext.com/ · https://motion.dev/docs/react-transitions · https://lucide.dev/guide/react/basics/stroke-width
