# Research: Audit of the current UI

**Question:** How does the October 2026 app hold up when walked through and measured against usability heuristics and WCAG contrast?

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win.

Walked the running dev app (localhost:5173) at 1440×900 and 375×812 with "The Two Doors (demo)": Library → Editor (Stage, Cues, Interaction, Controls, Outputs & audio) → Operator (Rehearsal) → audience page → performer remote.

## Measured

- Text color usage in .tsx: `text-ink-400` ×69, `text-ink-300` ×28, `text-ink-500` ×12. Sizes: `text-xs` ×75, `text-[11px]` ×28, `text-[10px]` ×2.
- WCAG contrast (sRGB):
  - ink-400 (#71718a) on ink-900 = **4.03**, on ink-800 = **3.65** → the most-used secondary text fails 4.5:1.
  - ink-500 on ink-900 = **2.24** → fails even for large text; used for hints and placeholders.
  - ink-300 on ink-900 = 7.20, ink-200 = 11.7, ink-100 = 16.3 (pass).
  - Borders: ink-700 on ink-900 = 1.28, ink-600 = 1.61 → panel/inputs boundaries below 3:1 non-text contrast (WCAG 1.4.11) where the border is the only affordance.
  - White on `live` #f43f5e (PANIC button label) = **3.67** → fails 4.5:1 for normal-size text. `go` with dark label = 8.78 (pass); white on go would be 2.28.
- Off-palette Tailwind colors: rose-* ×37, amber-* ×25, green-* ×11, sky-* ×3 — semantic colors are used ad hoc instead of tokens.
- Semantic collision: token `live` = rose, but a LIVE cue in the operator cue stack is green; the focus ring is also `live` rose (red focus ring reads as error). Amber means "standby" and also "warning" (resume banner, "may sleep" chip, phones-can't-reach warning).

## Per surface (Nielsen heuristic in brackets)

**Library**

- Clear and calm; Run (green) and Edit side by side on every card. Icon-only download/duplicate/delete with no visible labels [recognition over recall]. "Storage may be cleared" amber chip + "Keep my shows" is good proactive error prevention.

**Editor shell**

- Six tabs map to the model (Stage, Cues, Interaction, Controls, Outputs & audio, History) rather than to tasks; a newcomer must learn the data model first [match with real world]. "Controls" holds key/MIDI maps — the name is ambiguous.
- Undo/redo/history are icon-only. "Saved" status is quiet (good).

**Stage tab**

- "Design view (every layer)" overlays every layer of every cue at once; with "Show hidden faintly" the demo canvas is an illegible pile of overlapping text [aesthetic & minimalist; visibility of system status]. Art directors expect to see the canvas _at a cue_.
- Layers panel: add-layer buttons are tiny unlabeled glyphs (T, clock, #, (·)) [recognition over recall].
- Inspector shows "Select a layer to edit it." — a whole 288px column empty by default.
- Fixed 260/flex/288 px columns; no collapse or resize.

**Cues tab**

- Strong: cue list grouped by scene, sentence-like action rows ("Show / fade in [Attic] over [4] s [Smooth]"), "After this cue" preview with state values, operator notes.
- Reorder only by ↑/↓ buttons (no drag). State shown as raw JSON (`{"left":0,"right":0}`) — hostile to creative authors. Middle column empty until a cue is picked.

**Interaction tab**

- Four dense form columns (state values, triggers, audience moments, rules). Rules read "when … if … then …" — good grammar — but nothing shows how moments → state → rules → scenes connect; the show's branching shape is invisible [visibility; recognition]. Every rule is a stack of selects; long vertical scroll.

**Controls / Outputs & audio**

- Clear empty states with instructions ("Click Learn, then press the control"). Plain and functional.

**Operator (Rehearsal)**

- Strong: LIVE vs STANDBY readout with big type, GO with key hint, PANIC labelled with its key, NEXT/LIVE badges in the cue stack, status chips (May sleep, Room · phones), resume banner after reload.
- PANIC is a full-width saturated red bar directly under GO, about as large as GO — a high-consequence target placed where a slip lands [error prevention; Fitts]. In a dark booth, the saturated green GO + red PANIC + amber banner are the brightest things on screen at all times (opposite of "dark cockpit").
- Right column mixes setup (QR, room, LAN address warning) with live monitoring (vote tally) — setup chrome stays visible during the show.
- Many 10–11px labels (section headings, chips) — hard to read at booth distance.

**Audience phone page**

- Simple, centered "Join the show" with a big code field and button. Uses a 🎭 emoji as the logo (renders differently per OS); disabled Join is a dim rose that reads as an error state.

**Performer remote (no params)**

- Plain one-line error text, no recovery action beyond "scan again".

## Implications to carry into the docs

1. New neutral ramp must give secondary text ≥ 4.5:1 and component borders ≥ 3:1 where they are the affordance.
2. Separate operator semantics (go / standby / live / panic) from status semantics (success / warning / danger / info) and from brand accent; focus ring must not be red.
3. Default the Stage canvas to "at cue N" with a cue scrubber; "every layer" becomes an opt-in view.
4. Give the Interaction model a visual overview (scene/branch map) alongside the forms; show state as typed, human-readable values.
5. Operator: keep GO dominant; make PANIC unmistakable but not adjacent-and-equal; move room setup out of the live view once live; adopt a quieter booth palette.
6. Replace icon-only actions with tooltip + shortcut hints; label the add-layer buttons.
7. Minimum UI text 12px; brand mark instead of emoji on the audience page.
