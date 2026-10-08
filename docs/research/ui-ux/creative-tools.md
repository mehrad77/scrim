# Research: Creative design tools (art director lens)

**Question:** How do pro creative tools let visual people work fast while staying approachable, and what should the Stage and Cues editors borrow?

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win.

Baseline from the code: Stage = fixed 260 px media+layers | canvas | 288 px inspector; one-layer inspector, native number boxes, Moveable move/resize with snap but no arrow keys, rotate, zoom/pan or multi-select, text-list media panel, one output at a time. Cues = 340 px cue list | cue editor (form-style action cards) | 360 px read-only "After this cue" preview; actions are show/hide/fade with a duration, four named easings, no per-action delay.

## Findings

### 1. Selection-driven inspector with a useful "nothing selected" state

- What: Content follows selection. Figma with nothing selected: page background, local styles, variables. Illustrator: document controls with nothing selected, type-specific blocks (image/text/path), shared properties for multi-select. Rive: file-level settings incl. default interpolation. Spline: scene settings, with its Variables panel.
- Evidence: Figma properties panel — https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel; Illustrator Properties panel — https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/properties-panel-overview.html; Rive Inspector — https://rive.app/docs/editor/interface-overview/inspector.md; Spline UI — https://docs.spline.design/basics/understanding-splines-ui; Spline Variables — https://docs.spline.design/interaction-states-events-and-actions/variables
- Apply to Scrim: Editor/Stage + Cues, art director + show designer. Replace "Select a layer to edit it" with Output settings (resolution, background, safe area), show defaults (fade length/easing, colour/text styles) and State values.
- Confidence: high

### 2. Number fields: scrub the label, step with modifiers, accept math

- What: Figma: drag the label to scrub (or Opt/Alt over the field); cursor height picks speed (2x, 1x, 1/2, 1/4); scrubbing continues off-screen; fields take math (`+10`, `*2`, `(x/2)+6`). Spectrum: arrows + wheel, Shift ×10, units via Intl.NumberFormat.
- Evidence: Figma position/dimensions — https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions; Spectrum Number Field — https://opensource.adobe.com/spectrum-web-components/components/number-field/
- Apply to Scrim: Editor/Stage + Cues, art director. Swap `NumberInput` for a scrub-label field (X/Y/W/H, crop, opacity, seconds): ↑/↓ 1 (0.1 for seconds), Shift ×10, Alt ×0.1, typed math, unit suffix. Commit to the running show on pointer-up and reuse the `coalesce` undo key. A px ↔ % of stage toggle may help across output resolutions (my inference).
- Confidence: high (scrub, math); medium (% toggle)

### 3. Multi-select with "Mixed" values and bulk edit

- What: Figma: "Mixed" values, equations apply to every selected layer (`Mixed+100`), Selection colors, Select Matching Layers (⌥⌘A). Premiere 25.0 edits several clips at once. After Effects' Proportional Scrubbing (⌘⌥ + scrub) ramps a change from 0% on the first selected layer to 100% on the last.
- Evidence: Figma position/dimensions — https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions; Figma select layers — https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects; Premiere 25.0 — https://larryjordan.com/articles/the-new-properties-panel-in-adobe-premiere-pro-25-0/; AE Proportional Scrubbing — https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/proportional-scrubbing-in-timeline.html; Moveable — https://github.com/daybrush/moveable
- Apply to Scrim: Editor/Stage, art director: selection is one `layerId`. Add Shift-click + marquee (Moveable has group targets; its companion Selecto does marquee), "Mixed" placeholders, Align/Distribute, "select all using this media". Editor/Cues, show designer: proportional-scrub delays to stagger a reveal.
- Confidence: high (multi-select); medium (stagger)

### 4. Direct-manipulation feedback: snap, measure, spacing, nudge, align

- What: Figma: snap-to-objects with red guides (hold Ctrl to suspend); Opt/Alt-hover another layer for red distances; Smart selection's pink spacing handles with a px tooltip; nudge 1, Shift 10; align Alt+W/A/S/D/H/V (Framer: same keys plus Distribute). Canva: Tidy up ⌥⇧T, ⌘+arrow resize, Shift+R rulers/guides.
- Evidence: Figma snap/nudge/align — https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions; Figma measure — https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers; Figma Smart selection — https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection; Framer shortcuts — https://www.framer.com/shortcuts; Canva shortcuts — https://www.canva.com/help/canva-keyboard-shortcuts/; Moveable Snappable — https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html
- Apply to Scrim: Editor/Stage, art director. Drag-only today (snap threshold 8). Add arrow nudge, hold-⌘ to suspend snap, equal-gap snap, align keys and ruler guides saved per output. Moveable already exposes distance readouts and gap/grid snapping.
- Confidence: high

### 5. Zoom, pan, fit: a shared vocabulary

- What: Figma Shift+1 fit, Shift+2 selection, ⌘/Ctrl+scroll, pixel grid from 400%. Framer ⌘1 fit, ⌘2 selection, ⌘0 100% (Shift+n on Windows), Space-drag. Rive: F fits selection, Space or right-drag pans, ⌘0 = 100%. After Effects: hold Space for the Hand. Canva: ⌘0 actual size, ⌥⌘0 fit.
- Evidence: Figma zoom — https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options; Framer shortcuts — https://www.framer.com/shortcuts; Rive navigation — https://rive.app/docs/editor/interface-overview/selection-and-navigation.md; AE shortcuts — https://helpx.adobe.com/after-effects/desktop/get-started/keyboard-shortcuts/keyboard-shortcuts-reference.html; Canva shortcuts — https://www.canva.com/help/canva-keyboard-shortcuts/
- Apply to Scrim: Editor/Stage, art director. The canvas only auto-fits. Add Shift+1/2/0 (matches Figma, and Framer on Windows), Space-drag, ⌘/Ctrl+scroll, a zoom pill, and a pixel grid for 4K edge checks.
- Confidence: high

### 6. Floating contextual task bar and right-click

- What: Illustrator's Contextual Task Bar floats on the canvas as one row that swaps by type: path (Join/Edit), several objects (Group/Align/Recolor), linked image (Embed/Relink/Edit in Photoshop), text (font/size/fill). Movable, pinnable, hideable; it steps aside when a tool shows its own widgets. Photoshop (2026) follows. Canva's floating toolbar: Lock, Group/Ungroup; its Position panel: layers, alignment, Advanced X/Y. Right-click resolves overlaps (Figma's Select layer submenu).
- Evidence: Illustrator CTB — https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/contextual-task-bar-overview.html; Photoshop CTB — https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/boost-workflows-with-the-contextual-task-bar.html; Canva move elements — https://www.canva.com/help/moving-elements/; Canva group/layer/align — https://www.canva.com/help/layer-group-align/; Figma select layers — https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
- Apply to Scrim: Editor/Stage, art director + creative author. A bar above the Moveable box (hidden while dragging; pin/hide). Image/video: Replace, Fit, Crop. Text: font, size, colour, align. All: "Cue it in" (buried at the inspector's foot today), Duplicate, Lock, Delete. 2+: Align. Right-click: Select layer ▸ stack.
- Confidence: high

### 7. Docked resizable panels, Minimize UI, pages per task

- What: Figma UI3 trialled floating panels and reverted to docked, resizable ones (floating cramped the canvas, slowed people); toolbar at the bottom; Minimize UI (Shift+\) hides panels and properties return on selection. Resolve 21 has eight pages (Media, Photo, Cut, Edit, Fusion, Color, Fairlight, Deliver); Cut and Edit share a timeline. Premiere ships 16 task workspaces.
- Evidence: Figma UI3 approach — https://www.figma.com/blog/our-approach-to-designing-ui3/; Figma move to UI3 — https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/; Resolve — https://www.blackmagicdesign.com/products/davinciresolve; Resolve Cut — https://www.blackmagicdesign.com/products/davinciresolve/cut; Premiere workspaces — https://helpx.adobe.com/premiere/desktop/get-started/tour-the-workspace/what-are-workspaces.html
- Apply to Scrim: Editor, art director on a laptop. Keep tab-per-task (it is Resolve's pages); make the 260/288 and 340/360 columns drag-resizable, collapsible, remembered; add Focus canvas (Shift+\); share layer/cue selection across tabs; no floating panels.
- Confidence: high

### 8. Media browser: thumbnails, drop targets, replace in place

- What: Resolve: thumbnails, icon/list toggle, smart bins, an edit overlay when dragging to the viewer. Figma: drop on canvas = new layer; drop on a shape = swap the fill, keep crop and position; "Place all". Canva: Replace in the toolbar; "Replace across designs" → pick designs → Preview → confirm the count.
- Evidence: Resolve Edit — https://www.blackmagicdesign.com/products/davinciresolve/edit; Figma add images — https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs; Canva add/replace videos — https://www.canva.com/help/add-videos/; Canva replace across designs — https://www.canva.com/help/replace-all-images/
- Apply to Scrim: Editor/Stage media panel, art director. Text list today. Add poster/waveform thumbnails, grid/list, kind filter + search, "used by N layers". Drop on canvas places at the pointer; drop on a layer replaces media, keeping x/y/crop/fit. "Replace everywhere…" with count and preview for tech-week re-renders.
- Confidence: high

### 9. Preview inside the editor, every output at once

- What: Figma's inline Preview plays in the editor, refreshes as you edit, is resizable. Spline: Edit/Preview/Code tabs with Restart and Full-screen. Framer: a breakpoint bar whose children inherit the primary and override only differences. Canva opens audience and presenter windows (notes, next), pushes editor edits live, and has a grid view of all pages.
- Evidence: Figma prototype play — https://help.figma.com/hc/en-us/articles/360040318013-Present-designs-and-prototypes; Spline UI — https://docs.spline.design/basics/understanding-splines-ui; Framer breakpoints — https://www.framer.com/academy/lessons/framer-fundamentals-breakpoints; Canva presentation modes — https://www.canva.com/help/presentation-modes/; Canva Design School — https://www.canva.com/design-school/resources/using-and-customizing-templates/
- Apply to Scrim: Editor/Stage + Cues, show designer + art director. One output via dropdown today. Add an outputs strip of live mini-frames, a cue filmstrip under the canvas (replaces the "preview at" dropdown), and Play/scrub on "After this cue" with the real fades. Editor tab only; Space scoped to the Editor.
- Confidence: high

### 10. Low floor, high ceiling through layered disclosure

- What: Canva: templates (one page or the whole set), a selection-driven toolbar, X/Y under Position ▸ Advanced, "/" Quick actions. Figma UI3 kept x/y, w/h order (swapping hurt muscle memory), added optional property labels, and ⌘K Actions covers snap/nudge prefs. Illustrator hides extra controls behind "…". Spectrum 2 announces rounder panels, user-set density/contrast, and highlight colours reserved for high-action moments. Canva binds B/C/D/M/O/Q/U to effects while presenting.
- Evidence: Canva templates — https://www.canva.com/design-school/resources/using-and-customizing-templates/; Canva Quick actions — https://www.canva.com/help/slash-magic-shortcut-commands/; Figma UI3 design — https://www.figma.com/blog/behind-our-redesign-ui3/; Figma Actions menu — https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design; Illustrator Properties panel — https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/properties-panel-overview.html; Spectrum 2 — https://blog.adobe.com/en/publish/2023/12/12/adobe-unveils-spectrum-2-design-system-reimagining-user-experience-over-100-adobe-applications; Canva presentation modes — https://www.canva.com/help/presentation-modes/
- Apply to Scrim: Editor, creative author + first-time art director. 4–6 controls per layer type, the rest (Crop, Bus, Loop) under More; Property-labels toggle; ⌘K palette (Editor only); "?" sheet; keyboard-reachable cue rows; templates in the Library. Keep single-key shortcuts out of Show mode, and reserve go/standby/live hues for show state: the editor's focus ring and slider/checkbox accents use the live rose (#f43f5e) today.
- Confidence: high

### 11. Timeline docked under the canvas

- What: After Effects: layer bars beside a Graph Editor; Space previews, J/K jump keyframes, B/N set the work area. Rive: One-shot/Loop/Ping-pong, work area, 1/60 s snap, "Show Only Selected". Figma Motion: timeline along the bottom of the same canvas (drag its top edge, collapsible), default 2000 ms, seconds↔ms toggle, a track per layer with duration handles, Space plays.
- Evidence: AE shortcuts — https://helpx.adobe.com/after-effects/desktop/get-started/keyboard-shortcuts/keyboard-shortcuts-reference.html; Rive timeline — https://rive.app/docs/editor/animate-mode/timeline.md; Figma Motion timeline — https://help.figma.com/hc/en-us/articles/41405906446999-Use-the-Figma-Motion-timeline; Figma Motion intro — https://www.figma.com/blog/introducing-figma-motion/
- Apply to Scrim: Editor/Cues + Stage, show designer + art director. Actions are form cards with no sense of time and no per-action delay, so "title, then subtitle 0.5 s later" takes two cues. Add a collapsible bottom dock: cue filmstrip plus the selected cue's bars (drag duration/delay, 0.1 s snap, marker where auto-follow fires). Needs an optional `delay` (format change); keep forms for keyboard and screen readers.
- Confidence: medium (format change)

### 12. Easing as pictures, with show-wide defaults and presets

- What: Rive: graph with Linear/Cubic/Hold/Elastic, four handle numbers, "Set as default". After Effects: F9 Easy Ease (Shift+F9 in), Hold keys, icons showing in/out interpolation. Framer: Shift locks easing handles. Figma Motion: stackable presets (fade, move, scale) plus easing.
- Evidence: Rive interpolation — https://rive.app/docs/editor/animate-mode/interpolation-easing.md; AE interpolation — https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/keyframe-interpolation.html; AE shortcuts — https://helpx.adobe.com/after-effects/desktop/get-started/keyboard-shortcuts/keyboard-shortcuts-reference.html; Framer Jan 2025 — https://www.framer.com/updates/january-update-2025; Figma Motion presets — https://help.figma.com/hc/en-us/articles/41307886266135-Quickly-add-motion-with-preset-animation-styles
- Apply to Scrim: Editor/Cues, art director. Curve glyph on the easing select (Linear / Ease in / Ease out / Smooth) plus "Cut"; a show-level default fade (hard-coded 1 s easeInOut today) in the no-selection inspector; presets (Fade in/out, Dip to black, Crossfade) that expand into editable actions; cubic-bezier only under Advanced.
- Confidence: high (glyph, defaults); medium (custom curve)

### 13. Bridge picture and logic: bind dots and armed recording

- What: Spline: hover a property, click the corner dot, bind a variable (number, string, boolean, clock, counter, random). Rive: right-click a key → Data Bind; Design/Animate modes (Tab), warning that editing with a timeline selected writes keys. Figma Motion auto-keyframe: red bar over timeline and playhead, records every change, accidents included.
- Evidence: Spline Variables — https://docs.spline.design/interaction-states-events-and-actions/variables; Rive keys — https://rive.app/docs/editor/animate-mode/keys.md; Rive design vs animate — https://rive.app/docs/editor/fundamentals/design-vs-animate-mode.md; Figma keyframes — https://help.figma.com/hc/en-us/articles/41307938657559-Add-select-and-delete-keyframes
- Apply to Scrim: Editor/Stage + Interaction + Cues, creative author + art director. State reaches pixels only via typed `{{name}}` or a State layer: add a bind dot on inspector fields (opacity, colour, X/Y, bar width, text), with a chip linking to the rule. Separately, "Arm" a cue ("Recording into cue 7"): eye/opacity edits then write show/hide/fade into it; red frame, one-click disarm, never in Show mode. Both need engine/format work; no move/scale actions yet.
- Confidence: medium

## Top 5 recommendations

1. Selection-aware Stage inspector plus a floating layer bar (1, 6): empty state becomes Output + show defaults; the bar carries Replace, Fit, "Cue it in". Smallest change, biggest Figma/Canva-grade feel.
2. The precision kit (2–5): scrub/math number fields, arrow nudge, ⌘ to suspend snap, Mixed multi-select, align keys, Shift+1/2/0 and Space-drag.
3. Layout and reach (7, 10): resizable, collapsible, remembered panels with Focus canvas; ⌘K and "?"; keyboard-reachable lists. No floating panels; no single-key shortcuts in Show mode.
4. See everything (8, 9): media thumbnails, replace-in-place and "Replace everywhere", outputs strip, cue filmstrip, Play/scrub inside Cues.
5. Time and easing (11, 12): bottom cue dock with per-action delay bars, curve glyph, show-level default fades, presets; later bind dots and armed recording (13).

## Sources (opened)

- Making the Move to UI3 (Figma) — https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/
- Inside the redesigned Figma (UI3) — https://www.figma.com/blog/behind-our-redesign-ui3/
- Figma on Figma: designing UI3 — https://www.figma.com/blog/our-approach-to-designing-ui3/
- Figma Help: properties panel — https://help.figma.com/hc/en-us/articles/360039832014-Design-Prototype-and-view-Code-in-the-Properties-Panel
- Figma Help: alignment, rotation, position, dimensions — https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions
- Figma Help: measure distances — https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers
- Figma Help: Smart selection — https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection
- Figma Help: select layers and objects — https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
- Figma Help: zoom and view options — https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options
- Figma Help: actions menu — https://help.figma.com/hc/en-us/articles/23570416033943-Use-the-actions-menu-in-Figma-Design
- Figma Help: play your prototypes — https://help.figma.com/hc/en-us/articles/360040318013-Present-designs-and-prototypes
- Figma Help: add images and videos — https://help.figma.com/hc/en-us/articles/360040028034-Add-images-and-videos-to-designs
- Introducing Figma Motion — https://www.figma.com/blog/introducing-figma-motion/
- Figma Help: Motion timeline — https://help.figma.com/hc/en-us/articles/41405906446999-Use-the-Figma-Motion-timeline
- Figma Help: Motion preset animation styles — https://help.figma.com/hc/en-us/articles/41307886266135-Quickly-add-motion-with-preset-animation-styles
- Figma Help: Motion keyframes — https://help.figma.com/hc/en-us/articles/41307938657559-Add-select-and-delete-keyframes
- Illustrator: Contextual Task Bar — https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/contextual-task-bar-overview.html
- Illustrator: Properties panel — https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/properties-panel-overview.html
- Photoshop: Contextual Task Bar — https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/boost-workflows-with-the-contextual-task-bar.html
- Premiere: overview of workspaces — https://helpx.adobe.com/premiere/desktop/get-started/tour-the-workspace/what-are-workspaces.html
- Larry Jordan: Premiere Pro 25.0 Properties panel — https://larryjordan.com/articles/the-new-properties-panel-in-adobe-premiere-pro-25-0/
- After Effects: keyframe interpolation — https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/keyframe-interpolation.html
- After Effects: Proportional Scrubbing — https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/proportional-scrubbing-in-timeline.html
- After Effects: keyboard shortcuts — https://helpx.adobe.com/after-effects/desktop/get-started/keyboard-shortcuts/keyboard-shortcuts-reference.html
- Adobe unveils Spectrum 2 — https://blog.adobe.com/en/publish/2023/12/12/adobe-unveils-spectrum-2-design-system-reimagining-user-experience-over-100-adobe-applications
- Spectrum Web Components: Number Field — https://opensource.adobe.com/spectrum-web-components/components/number-field/
- DaVinci Resolve — https://www.blackmagicdesign.com/products/davinciresolve
- DaVinci Resolve Cut page — https://www.blackmagicdesign.com/products/davinciresolve/cut
- DaVinci Resolve Edit page — https://www.blackmagicdesign.com/products/davinciresolve/edit
- Rive: Inspector — https://rive.app/docs/editor/interface-overview/inspector.md
- Rive: Selection and navigation — https://rive.app/docs/editor/interface-overview/selection-and-navigation.md
- Rive: Design vs Animate mode — https://rive.app/docs/editor/fundamentals/design-vs-animate-mode.md
- Rive: Timeline — https://rive.app/docs/editor/animate-mode/timeline.md
- Rive: Keys — https://rive.app/docs/editor/animate-mode/keys.md
- Rive: Interpolation and easing — https://rive.app/docs/editor/animate-mode/interpolation-easing.md
- Understanding Spline's UI — https://docs.spline.design/basics/understanding-splines-ui
- Spline: Variables — https://docs.spline.design/interaction-states-events-and-actions/variables
- Framer keyboard shortcuts — https://www.framer.com/shortcuts
- Framer Academy: responsive breakpoints — https://www.framer.com/academy/lessons/framer-fundamentals-breakpoints
- Framer January 2025 update — https://www.framer.com/updates/january-update-2025
- Canva: move elements — https://www.canva.com/help/moving-elements/
- Canva: group, layer, align — https://www.canva.com/help/layer-group-align/
- Canva: Quick actions — https://www.canva.com/help/slash-magic-shortcut-commands/
- Canva: presentation modes — https://www.canva.com/help/presentation-modes/
- Canva: keyboard shortcuts — https://www.canva.com/help/canva-keyboard-shortcuts/
- Canva Design School: customizing templates — https://www.canva.com/design-school/resources/using-and-customizing-templates/
- Canva: add and replace videos — https://www.canva.com/help/add-videos/
- Canva: replace images across designs — https://www.canva.com/help/replace-all-images/
- Moveable: Snappable API — https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html
- Moveable README — https://github.com/daybrush/moveable
