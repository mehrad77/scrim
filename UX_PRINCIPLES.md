# UX principles

How Scrim should behave so that anyone can open it, find their way, make it their own, and still run a show under pressure. These are the rules and the reasons behind them.

- **Exact values** (colours, sizes, durations, components) are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
- **Who the users are**, and how a production moves through the app, is in [docs/users-and-journey.md](docs/users-and-journey.md).

Researched October 2026. The research covered:

- about 25 creative, show-control and authoring tools;
- design-system guidance;
- HCI research;
- a hands-on audit of the current app.

Sources are listed at the end. The full research notes are in [docs/research/ui-ux/](docs/research/ui-ux/README.md).

## The ten principles

1. **Design freely, run safely.** Exploring is rich and forgiving. Running is calm, stripped down and hard to change by accident.
2. **The audience never sees the machinery.** Nothing from the interface reaches an output during a show.
3. **GO is mechanical.** GO and PANIC respond in the next frame, never wait, never move and never fail silently.
4. **Undo beats "Are you sure?"** Make actions reversible instead of asking permission.
5. **Quiet when normal.** Colour and motion mean "look here". A healthy show looks calm and grey.
6. **Touch the work.** Edit things where they appear: on the canvas, in the cue list, on the timeline. Forms back these up.
7. **Show the shape of the show.** A writer can see branches, state and rules at a glance, test them without an audience, and find out why something happened.
8. **Simple first, powerful underneath.** Day one feels like a slide tool. Power is one signposted step away, and the user decides when to take it.
9. **Make it yours, and make it reset.** Deep control over layout and shortcuts, a few appearance settings, a clear scope for each, and a reset for all of them.
10. **Instant by default; motion explains, never delays.** Every action shows its result in the next frame. Motion only explains a change.

They serve the product principles in the [proposal](https://claude.ai/code/artifact/8e8f9f6f-ccc6-4e46-9b08-ce8778cfb65d):

| Product principle                     | UX principles |
| ------------------------------------- | ------------- |
| The show must go on                   | 1, 3, 4, 5    |
| The audience never sees the machinery | 2             |
| One GO button                         | 1, 3          |
| Interactive by default                | 7             |
| Progressive power                     | 6, 8, 9       |

Six rules are not negotiable. They are collected in [Safety invariants](#safety-invariants), and every other section defers to them.

## Who we design for

The personas are in [docs/users-and-journey.md](docs/users-and-journey.md). Two more lenses matter for the editor. Both are show designers in that document.

- The **art director** is a visual show designer who lives in Figma and Adobe tools.
- The **creative author** is a writer, deviser or director who thinks in scenes and choices, not code.

| Who             | Where in Scrim                  | Attention                           | Feels comfortable when…                                        | Feels powerful when…                                                     |
| --------------- | ------------------------------- | ----------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Art director    | Editor: Stage, Cues             | Explore; long sessions, daylight    | The canvas, layers and inspector behave like Figma             | Scrubbing, nudging, aligning and timing are as precise as in Adobe tools |
| Creative author | Editor: Cues, Interaction       | Explore; thinking in story          | Rules read like sentences and the show's branches are visible  | They can test every outcome without an audience and see why it happened  |
| Director        | Operator in Rehearsal           | Explore; fast, interrupted          | They can jump anywhere and try "what if the audience picks B?" | Paths and setups can be saved and replayed                               |
| Stage manager   | Operator in Show mode           | Execute; dark booth, under pressure | There is one GO and they always know what it will do           | Nothing surprises them, and every failure has a one-click fix            |
| Technician      | Outputs & audio, output windows | Setup; at the rig                   | Displays and devices are detected, not typed                   | Health is visible at a glance, and setup can be reapplied per venue      |
| Performer       | Performer remote, pedal         | Glance; on stage                    | The button is big and only live when it should be              | They get standby → ready → go, like a cue light                          |
| Audience member | Audience page                   | Glance; seconds, poor Wi-Fi         | One clear choice with a big target                             | Their input changes the stage within a second                            |

**Two modes of attention.**

- **Exploring** happens in the Library, the Editor and Rehearsal. These are rich, forgiving and quick to change.
- **Executing** happens in Show mode, on the performer remote and on the audience page. Few choices, big targets, and nothing moves unless it means something.

## Safety invariants

These protect the live show. A design that breaks one is wrong, however good it looks.

1. **Esc is PANIC in the operator view and in output windows. Always.**
   - Scrim adds Esc at runtime, whatever the show file says. Older shows that remapped Esc still panic on it. The Controls tab shows Esc as fixed, and extra panic keys can be added.
   - The PANIC listener runs on `window` in the capture phase, before any menu, field or dialog.
   - Nothing else in the operator view uses Esc. Its overlays (menus, popovers) close by clicking outside or with their own key, and their keyboard dismissal is turned off.
2. **In the editor, Esc closes what you are in before it panics.** If a menu, popover, palette or dialog is open, Esc closes it. If a field is being edited, Esc reverts the edit. Otherwise, if the show is running, Esc forwards PANIC, as it does today.
3. **GO and PANIC dispatch first.** Nothing on their path waits for an animation, a dialog, storage or the network.
4. **No layer ever overlaps the GO or PANIC rectangle.** That includes banners, toasts, popovers, hints and the palette. GO, PANIC, Hold and Back keep their position and size. Messages appear in reserved slots that never change height.
5. **No modal in Show mode.**
   - The operator view in Show mode has no dialogs, palette or tours.
   - Confirmations are inline, or use hold-to-confirm.
   - A PIN, if one is used, goes in an inline field in the header.
   - The pre-show check runs in Rehearsal. In Show mode it is a non-modal status tab.
6. **Nothing from the interface reaches an output.** No HUD, Identify overlay, cursor, toast, focus ring or UI animation appears on an output window during Show mode. The output cursor is hidden.

## Principles in detail

Each principle gives the rule, why it holds, and how it shows up in Scrim.

### 1. Design freely, run safely

**Rule.** Exploring tolerates mistakes because everything can be undone. Running avoids them because nothing can be undone in front of an audience. Rehearsal is the loud mode, because it is the unsafe one. Show mode is quiet.

**Why.** QLab's Show mode disables editing as a safety mechanism. Eos keeps Live (what the stage shows) apart from Blind (editing off-air). Stress narrows attention, so the live view must offer fewer, clearer choices.

**In Scrim.**

- **Show mode removes, rather than greys out,** Reset, Edit, double-click-to-fire and setup tools: the room QR, the LAN address, Detect displays. GO, Hold, Back, PANIC and standby stay.
- **Rehearsal carries a steady marker,** a neutral inverted bar reading "REHEARSAL · EDITING UNLOCKED · DOUBLE-CLICK FIRES". Show mode shows only a small lock label.
- **Leaving Show mode is deliberate:** hold the mode switch for one second. An optional PIN goes in the header field. There is no secret to forget, and no way to slip out by accident.
- **Locked or off in Show mode:**
  - panel layouts;
  - the command palette;
  - hints;
  - single-key editing shortcuts.

**Don't.** Make Show mode the red, alarming state. Today the Show segment is red, while the risky Rehearsal state is neutral.

### 2. The audience never sees the machinery

**Rule.** During a show, nothing from the interface reaches an output window or a remote output (invariant 6).

**Why.** The outputs are the show. This is a product principle, and the reason operators trust media servers.

**In Scrim.**

- **Outputs keep the last good picture** when anything fails. Errors appear only on the operator's screen.
- **Identify and the hover HUD** work in Rehearsal and are hidden in Show mode.
- **A remote output's "Click for full screen" prompt** shows only until it is full screen.
- **UI code never styles or animates Stage nodes,** and output routes import no UI motion library ([DESIGN_SYSTEM.md › Motion](DESIGN_SYSTEM.md#motion)).

### 3. GO is mechanical

**Rule.** GO and PANIC behave like physical switches. They respond in the next frame, wait for nothing, never move, and never fail silently.

**Why.** Below 0.1 s a response feels instantaneous ([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)). QLab shows GO's state on its border, enforces a minimum time between GOs, and can require key-up before re-arming. Eos separates loading a cue from firing it.

**In Scrim.**

- **What GO will do is always visible:**
  - the standby cue;
  - its notes, in a fixed-height area that scrolls rather than pushing GO down;
  - optionally, a still thumbnail of the next picture beside the live one.
- **Standby only moves on purpose.** In Show mode, clicking a cue selects it for reading. Only an explicit command moves standby: Enter, "Set next", or a modifier with an arrow. The message strip then shows "Next: X (was Y)" for a few seconds.
- **Never drop a GO silently.**
  - If the double-GO guard swallows a press, GO shows a brief ring.
  - Keys reach GO whenever focus is not in a free-text field, including after picking from a list.
  - If keys are paused because someone is typing, a chip says so.
- **Press feedback never changes the button's shape** in the operator or on the remote, so a press can't end up outside the button. Feedback is a change of colour or border.
- **PANIC:**
  - **Placement.** PANIC is unmistakable but not GO's neighbour. It sits in its own corner of the GO panel, at most 40% of the panel's width, at least 24 px from GO. Secondary clears (text, media, sound) sit beside it.
  - **Informed release.** While the outputs are blacked out, operator thumbnails keep showing the picture underneath, dimmed and labelled, so Release is an informed decision.
  - **Steady.** The blacked-out state does not pulse. It is deliberate, not a fault.

### 4. Undo beats "Are you sure?"

**Rule.** Make actions reversible instead of asking permission. Confirm only actions that are rare, consequential and irreversible, and say exactly what will happen.

**Why.** Routine confirmations train reflex clicking ([NN/g](https://www.nngroup.com/articles/confirmation-dialog/)). "Never use a warning when you mean undo" ([Raskin](https://alistapart.com/article/neveruseawarning/)). Eos gives operators Stop/Back instead of a prompt.

**In Scrim.**

- **Editor:** every change is undoable (it is today). Deleting cues, layers, rules or media shows a toast with **Undo** instead of a prompt.
- **Operator:**
  - **Back** restores the state before the last GO, with the cue's own fade, and returns standby.
  - "Close now" and "Force" on audience moments show a toast with Undo for 10 s.
- **Rare destructive operator actions** (Reset, taking over another tab) use hold-to-confirm: press and hold for one second, with the progress shown on the button.
- **Confirmations in the editor** name the thing and the consequence: "Delete scene Cellar and its 2 cues?", with the verb on the button. Never a bare OK/Cancel.

### 5. Quiet when normal

**Rule.** When everything is fine, the interface is calm. Colour, brightness and motion are reserved for exceptions and for the few states the operator must track. Every state also has a word or a shape, never colour alone.

**A testable definition.** With every health check nominal, nothing running and nothing on standby, the operator view shows no lit lamp and no coloured text. With a cue on standby, the only colour is the standby marker and GO's lit border.

**Why.**

- The aviation "dark cockpit" lights only what is abnormal. Plant control screens (ISA-101) stay grey when healthy.
- Most alarms need no action, so people learn to ignore them. The Joint Commission estimates that 85–99% of device alarms in hospitals need no intervention.
- Hue alone fails about 1 in 12 men, who have a colour vision deficiency.

**In Scrim.**

- **One meaning per colour, everywhere.**
  - _go_ = running. _standby_ = next. _fault_ = something the audience can see or hear now, and PANIC.
  - Health warnings have their own colour, distinct from standby.
  - The brand accent never carries operator meaning. The focus ring is never red.
  - Scene tape colours appear in the editor, never in the operator view.
- **Status rolls up into four lamps:** OUTPUTS, SOUND, ROOM, INPUTS.
  - Off (grey) when nominal.
  - Warning when degraded but the show runs (not full screen, may sleep, reconnecting).
  - Fault when the audience is affected now (output lost, sound blocked).
  - Each abnormal state offers one verb, such as **Reopen**. A tolerated warning can be acknowledged for the rest of the run.
- **Off script.** One chip counts deliberate deviations (forced result, manual state edit, standby moved, Hold on), with "Back to script".
- **The pre-show check owns the all-green list.** The live view shows only exceptions.
- **Next, running and done differ by position and shape,** not just hue:
  - next: a playhead bar;
  - running: a play icon and a progress line;
  - done: a check and dimmed text.
  - _Today NEXT (amber) and LIVE (green) differ by hue only._
- **Nothing loops or pulses** in the operator view or on the remote.

### 6. Touch the work

**Rule.** People edit things where they appear. The canvas, the cue list and the timeline are the primary editors. Forms remain for precision, keyboard and screen readers.

**Why.** It's what art directors already know from Figma, Illustrator, Canva, Rive and After Effects. Direct manipulation only feels direct within 0.1 s.

**In Scrim.**

- **The inspector follows selection.** With nothing selected, it shows the output and show defaults (resolution, background, safe area, default fade), never an empty column.
- **A task bar near the selection** carries the next likely actions: Replace, Fit, Crop, Cue it in, Duplicate, Align.
- **The precision kit:**
  - Number fields scrub by dragging their label and accept typed math (`+10`, `*2`).
  - Arrow keys nudge (Shift for ×10). Snapping can be suspended with a held key. Distances are measured on hover.
  - Align and distribute. Multi-select shows "Mixed" for values that differ.
  - Rulers, guides and the safe-area overlay are saved per output.
  - An eyedropper samples colour from the canvas (the browser EyeDropper API, where available).
- **Shared canvas vocabulary.** Copy what designers already know: Space-drag pans, ⌘/Ctrl+scroll zooms, Shift+1 fits, Shift+2 zooms to selection, Shift+0 is 100%.
- **The canvas shows the stage at a cue.** "Every layer at once" is an opt-in overlay. Today it is the default, and it piles all text on top of itself.
- **Media is visual.** Thumbnails, drop to place, drop on a layer to replace (keeping position and crop), and "Replace everywhere" with a preview.
- **Fonts for text layers travel with the show,** because the show machine is offline. Picking a font that isn't bundled is flagged.
- **Time is visible.** A cue dock under the canvas shows each action as a bar with its fade and delay. Easing appears as a curve icon, and the show has a default fade.
- **Every drag has a non-drag path** (menu, keyboard, fields), as WCAG 2.5.7 requires.

**Don't.**

- Invent a new shortcut where Figma or Adobe already have one.
- Use floating panels. Figma tried them in UI3 and went back to docked, resizable ones.

### 7. Show the shape of the show

**Rule.** A creative author can see the show's branches, state and rules at a glance, test them without an audience, and find out why something happened.

**Why.**

- Writing tools pair one editable source with a derived map (Twine's story map, Yarn Spinner's graph).
- Rule builders for non-programmers use sentences of typed slots (Apple Shortcuts, Zapier).
- Debuggers explain runs (Home Assistant's automation traces).
- Hidden dependencies are a classic usability failure ([cognitive dimensions](https://en.wikipedia.org/wiki/Cognitive_dimensions_of_notations)).

**In Scrim.**

- **The cue list stays the spine.** Each cue shows its exits: "Opens Door vote → Cellar | Attic".
  - A read-only **scene map** is derived from jumps and rules, with a List | Map toggle on the cue list.
  - Unreachable scenes are dimmed and broken links marked.
- **Rules are sentences of chips:** "When [Door vote] closes, and [door] is [The red door], then [go to scene Cellar]". Chips show labels, never internal keys like `left`.
  - Rules that share a trigger are grouped under it, numbered, with the evaluation order stated: "every matching row runs, top to bottom".
  - A vote option with no rule gets an "unhandled" row.
- **State reads like values,** not JSON.
  - It shows the current value, the value before the last cue, and the initial value.
  - Every value, moment and trigger shows "used by N".
- **A logic check** flags:
  - unhandled options;
  - unreachable scenes;
  - broken references;
  - values written but never read;
  - possible loops.

  It appears as a count on the Cues and Interaction tabs, and as a section of the pre-show check.

- **Test without people:**
  - **Assume** chips in "After this cue" set what earlier moments returned.
  - **Try every outcome** in the moment editor lists one line per option with its path. **Simulate N phones** runs in Rehearsal.
  - **Rehearse from here** opens the operator at a cue with those values.
  - Saved **path bookmarks** replay after every edit and warn when a path breaks.
- **Explain.** The log says why: "Rule _Red door wins_ ran: door = left → Cellar on standby". Skipped rules fold into "1 skipped" and expand to "door = right ✗ (was left)".
- **Recipes create ordinary objects.** "Ask the audience" asks for the question, the options and where each goes. It then creates the moment, its result value and one rule per option, all still editable.

**Don't.** Hand creative authors a raw node graph (Blueprint, TouchDesigner). If a patch view ever comes, it is another view over the same data.

### 8. Simple first, powerful underneath

**Rule.** The first screen of anything shows the few controls most people need. More is one labelled step away, and the user decides when to take it. The interface never rearranges itself based on usage.

**Why.**

- Progressive disclosure works with at most two levels and a clear path to the second ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)).
- In studies, static and user-controlled menus beat adaptive ones (Findlater & McGrenere, 2004; McGrenere et al., 2002).
- Product tours are pushed at people, interrupt, and are often skipped. Contextual help and doing the task work better ([NN/g](https://www.nngroup.com/articles/onboarding-tutorials/)).

**In Scrim.**

- **Two levels at most:** basic fields, then **More options** (timing, conditions). An **Advanced** section holds expressions and types. Hide fields, never whole tabs or features.
- **A start gallery** in the Library: Blank, Demo, and three or four real starters (an audience vote that branches, slides with cues, a performer button counter), plus **Save show as template**.
- **The demo is disposable,** with **Restore demo**. It carries a short **Learn** checklist of things to do: press GO in Rehearsal, edit a cue, vote from your phone, map a key, switch to Show mode. The first item is already ticked, and completion is detected automatically.
- **First run** asks at most three questions: the tool they know (QLab, PowerPoint, Figma, none), the theme, and the GO key. All three can be changed later.
- **Empty states do three jobs:** say what's here, teach, and offer the first action. For example, "No cues yet. Drop media on the stage, or add a cue."
- **Help is pulled, not pushed.**
  - An **Info strip** at the bottom edge shows one line and the shortcut for whatever is under the pointer or focused. `?` toggles it.
  - One-time hints are dismissible and can be recalled from Help.
  - No auto-starting tours, and no hints in Show mode.

### 9. Make it yours, and make it reset

**Rule.** People customize to reach things faster, rarely to change looks. Offer deep control over access (layout, shortcuts, favourites) and only a few appearance settings. Every customization has a clear scope and a reset.

**Why.** Studies of real users found that most customization was about reaching frequent functions faster, and few touched appearance (Mackay, 1991; Page et al., 1996). Linear replaced 98 theme variables with three inputs: base, accent and contrast. QLab keeps settings that travel with the show apart from preferences that stay on the machine.

**In Scrim.** Scopes are in the [customization model](#customization-model).

- **Layout.** Panels resize and collapse, and are remembered per page on each machine. **Focus canvas** hides everything else. **Reset layout** comes with Undo.
- **Keyboard.**
  - **Map mode** highlights GO, Hold, PANIC and triggers on the real operator view. Press a key or pedal to assign it.
  - Conflicts resolve inline (Replace / Swap / Cancel).
  - Presets cover "Scrim" and "QLab-style".
  - Single-key editing shortcuts can be switched off.
  - Every menu item has **Set shortcut…** in its context menu, and the `?` sheet lists frequent commands that have no key yet.
- **Appearance.** Theme, accent, contrast, UI scale and density. Nothing more.
- **Preferences** open with ⌘, (Ctrl+,). They have search, a marker on changed rows, per-row Reset and Reset all, and import/export with a checklist of what to bring.

### 10. Instant by default; motion explains, never delays

**Rule.** Every action shows its result in the next frame. Motion is used only to show where something came from or went, or to draw the eye to something new. Never as decoration, never in the way of GO.

**Why.** Nielsen's limits are 0.1 s for instant, 1 s to keep flow and 10 s for attention. INP counts the next painted frame as the earliest feedback. Practitioners agree:

- Ask how often people will see an animation, and never animate keyboard-initiated actions ([Emil Kowalski](https://emilkowal.ski/ui/you-dont-need-animations)).
- Removing motion from a frequent interaction can make it feel faster ([Rauno Freiberg](https://rauno.me/craft/interaction-design)).
- Avoid motion on frequent interactions, and keep it optional (Apple HIG).

**In Scrim.**

- **Local first.** GO, edits and selection never wait on the network or storage.
- **Loading indicators** appear only for media import (a determinate bar with Cancel) and connecting phones. They show after 300 ms and stay at least 500 ms, so they never flicker.
- **What animates:** surfaces opened with the pointer (menus, popovers), dialogs in the editor, toasts, drag-reorder, panel content, and moments on the audience phone.
- **What never animates:**
  - Stage and output windows.
  - GO, PANIC and standby.
  - Tab switches and canvas selection.
  - Anything moved or opened from the keyboard: selection, standby, tabs, menus and the palette appear instantly.
  - Loops and pulses.
- **Reduced motion and Show mode share one profile:** no movement, and fades capped at 100 ms. The OS setting is honoured, and Preferences offers System / Reduced / Full.

Values, and the per-pattern table for each profile, are in [DESIGN_SYSTEM.md › Motion](DESIGN_SYSTEM.md#motion).

## Patterns by surface

The principles applied to each screen. Rows marked _today_ describe a gap found in the October 2026 audit.

### Library

- **Start gallery** first for new users. Recent shows first for returning ones, with **Resume last run**.
- Card actions have visible labels or tooltips with names. _Today: download, duplicate and delete are bare icons._
- Storage warnings stay proactive and actionable, as **Keep my shows** already is.

### Editor shell

- **Tabs are task pages,** as in DaVinci Resolve. Selection is shared across tabs, so a layer picked on Stage is still picked in Cues.
- **Header:** show name, a visible **Search ⌘K** pill, Undo/Redo with tooltips, save state, a logic-check count, Export, **Run show**.
- **Panels resize, collapse and remember** their sizes. **Focus canvas** (Shift+\\) hides both sides. No floating panels.
- **Navigation is instant:** switching tabs never animates.

### Stage (art director)

- **Layout:** media and layers | canvas | inspector, with the outputs strip and the cue dock below.
- **Canvas.**
  - It shows the stage at the selected cue, with a cue scrubber. "Every layer" is an overlay toggle.
  - An outputs strip shows every output as a live mini-frame.
  - _Today: one output at a time, and every layer at once by default._
- **Layers.**
  - Add-layer buttons show their names (Text, Countdown, Counter, State value), or sit in an Add menu.
  - Lock and Hide are visible, and the list is ordered front-to-back.
  - _Today: four icon-only buttons with hover titles._
- **Inspector.** It follows the selection; with nothing selected it shows output and show defaults. Basic properties come first, with **More** for crop, bus and loop.
- **The precision kit and task bar** are described in principle 6.

### Cues (creative author, art director)

- **Cue rows** show the number, name, a generated summary, exits, auto-follow timing and the scene's tape colour.
  - Reorder by dragging a grip, with Alt+↑/↓ and a **Move to…** menu as alternatives.
  - _Today: ↑/↓ buttons only._
- **The list header** has List | Map.
- **The cue editor** keeps today's sentence-like action rows ("Show / fade in [Attic] over [4] s [Smooth]"), which are a strength.
- **"After this cue"** previews the picture and state, with **Assume** chips and Play/scrub using the real fades. _Today: state shows as raw JSON._
- **The cue dock** under the canvas shows the selected cue's actions as bars on a time ruler. Drag a bar's end for duration and its start for delay.

### Interaction (creative author)

- **Level 1:** recipe cards in the empty state and in the **Add** menu ("Audience vote → branch", "Performer button → counter"), and the sentence rule builder.
- **Level 2:** **More options** per rule and action. **Advanced** holds value types and expressions.
- **Rules are grouped by trigger,** with an overview strip of moment → result → rules → scenes. _Today: four dense columns of selects, with no overview._
- **The moment editor** has **Try every outcome**.
- **Every chip opens a searchable picker** that shows labels, not keys.

### Controls and Outputs & audio (designer, technician)

- **Controls becomes Map mode** on the real operator layout, with conflict resolution and presets. Esc→PANIC is shown as fixed.
- **Outputs: detect, don't ask.** **Detect displays**, **Identify** and device pickers stay. Output profiles can be saved per venue for touring.
- **Empty states keep their current instructional tone** ("Click Learn, then press the control"), which works.

### Operator (stage manager, director)

- **Layout.** Cue list | GO panel with live and next pictures | side tabs (Audience, State, Media, Log).
  - The topology is fixed. Panels can resize in Rehearsal, and everything is locked in Show mode.
  - Operator text is set at stage size.
- **GO panel**, in fixed regions:
  - a **message strip**: banners, "Next: X (was Y)", keys paused;
  - **standby**: name and notes in large type, with notes in a fixed-height area;
  - **GO**, with its key and lockout state, and **Hold** and **Back** beside it;
  - a **Running** strip: media with time remaining, open moments, the follow countdown;
  - **outputs**;
  - **PANIC** in its own corner.
- **Rehearsal vs Show** as in principle 1.
- **Booth brightness.** In the Booth theme, live thumbnails are dimmed to about 60% by default, adjustable per machine. A bright slide shouldn't be the brightest light in the booth.
- **Status:** the four roll-up lamps and the off-script chip, as in principle 5.
- **Help.** Hover help appears in the Info strip, not in floating tooltips that cover content and would need Esc to dismiss.
- **The State tab** has columns for now, before the last cue, and initial. It has a "changed" filter, and up to three values can be pinned in the GO panel's message strip.
- **The Log** carries rule traces (principle 7), plus a source and time for every GO and trigger (key, pedal, remote).

### Output windows

- **Black, full screen, chrome-free,** with the cursor hidden.
- **The hover HUD and Identify** are available only outside Show mode, and appear instantly with no transition.

### Performer remote (performer)

- **Triggers have states:**
  - **idle:** dim, reading "not yet";
  - **standby:** a steady ring, reading "Your cue · tap Ready";
  - **acknowledged:** lit;
  - **fired:** confirmed.

  The operator sees "Performer ready ✓" next to the standby cue. A pocket touch while idle does nothing.

- **Targets** are at least 44 px. Press feedback appears on touch-down. A press counts as acknowledged when the operator receives it, not when it is sent.
- **Errors say what to do,** and offer it as a button ("Scan the performer QR code again").

### Audience page (audience member)

- **One question, one big choice per screen.** Buttons never move under a thumb, including while web fonts load.
- **Selection is instant,** with a light haptic and a check. "Vote counted" confirms it.
- **Motion.** This is the one place for expressive motion: small, brief, and reduced when the phone asks for reduced motion.
- **Brand mark, not emoji.** _Today the 🎭 emoji renders differently on every phone._ The disabled Join button must not read as an error.
- **Copy** is short, plain, and ready for translation.

## Cross-cutting patterns

### Commands, shortcuts and the palette

- **One command registry.** Each command has an id, a title, aliases, a shortcut and the context where it applies. Menus, context menus, tooltips, the Info strip, the palette and the `?` sheet all read from it, so they never disagree.
- **Every command has a visible control.** Shortcuts and the palette are accelerators, not the only way.
- **⌘K (Ctrl+K) opens the palette** in the Library, the Editor and Rehearsal. It is not available in Show mode.
- **Teach shortcuts where the eyes already are.**
  - Tooltips, menu items and the Info strip show the key.
  - Holding Alt/Option overlays shortcuts on buttons.
  - `?` opens a sheet for the current surface, with GO, Hold, PANIC and standby first.
- **Store physical keys** (`event.code`) with a display label, so bindings survive non-US layouts.
- **Single-character shortcuts** can be switched off (WCAG 2.1.4). They never apply in Show mode, except the show's own GO, Hold and standby keys.

### Feedback, loading and latency

| Situation                        | Target                     | Pattern                                                                                 |
| -------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Press, select, drag, GO          | Next frame (≤ 100 ms)      | State changes immediately; no spinner, no animation in the way                          |
| Save, apply an edit to the show  | Under 1 s, usually instant | Optimistic; quiet "Saved" status; errors are loud and keep the work                     |
| Media import, decode             | Seconds                    | Determinate progress with Cancel, after 300 ms; fixed-size placeholders hold the layout |
| Phones joining, relay connecting | Seconds, out of our hands  | "Connecting…" after 300 ms; never blocks the show                                       |
| Anything over 10 s               | Rare                       | Progress, an estimate, and a way to carry on with other work                            |

### Errors and messages

- **Say what happened, what it means for the show, and the one thing to do:** "Main stage window closed. The audience sees nothing. **Reopen**".
- **Rank problems on the operator's screen** by whether the audience is affected now.
- **Never fail silently.** A dropped GO, an ignored key or an unhandled vote option always leaves a visible trace.

### Words

- **Sentence case.** Buttons start with a verb ("Open room", "Reopen", "Set next"). Mono caps are only for short labels people scan (lamp words, panel titles).
- **Theatre vocabulary.** Use cue, scene, standby, GO, hold, house and blackout, not software terms. "Show values" is acceptable alongside "state" when talking to authors.
- **Labels over keys.** Show "The red door", never `left`.
- **Short:** one line for hints, two for errors.

## Customization model

Four scopes. Each setting lives in exactly one, and Preferences shows which.

| Scope       | Where it lives                   | Travels       | What it holds                                                                                                                                                                                               |
| ----------- | -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Show**    | The `.scrim` file                | With the file | Key, MIDI and gamepad maps for GO, Hold, extra panic keys and triggers; the double-GO guard; an optional default operator layout; cue notes; scene and cue tape colours                                     |
| **Machine** | Browser storage on this computer | Never         | Display and audio assignments, public URL, panel layouts, theme, accent, contrast, UI scale, density, motion, thumbnail brightness, editor keymap preset and overrides, favourite commands, dismissed hints |
| **Session** | Memory                           | No            | Current tab, selection, zoom, Focus state, search text                                                                                                                                                      |

The **preferences file** is not a fourth place where settings live. It is an export of chosen machine settings, so a person can carry their setup to another computer, and saved templates go with it. Importing it shows a checklist, and it can never change show behaviour, so a guest operator's preferences cannot break a show.

Rules:

- **Everything can be reset,** per row, per page ("Reset layout") and all at once, each with Undo.
- **Detect instead of asking.** Displays, audio devices and the LAN address are detected wherever the browser allows.
- **The operator view never adapts on its own.** Nothing reorders or hides itself based on usage, and its layout is locked in Show mode.
- **Show settings win for running the show** (GO keys, guard). Machine settings win for how the interface looks and feels.

## Accessibility commitments

Scrim meets WCAG 2.2 AA in the editor, the operator view and both phone pages, plus 2.3.3 (AAA) for motion. These are minimums; values are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

- **Contrast** (1.4.3, 1.4.11).
  - Text is at least 4.5:1, including secondary text and placeholders.
  - Control boundaries, icons and focus indicators are at least 3:1, on every surface they appear on, including menus and dialogs.
  - _Today: the most-used secondary text is 4.0:1, and input borders are 1.3:1._
- **Colour is never the only signal** (1.4.1). Every state has a word, icon or shape.
- **Text size.**
  - Interface text is at least 12 px.
  - In the operator, labels and captions are at least 13 px, and everything else is at least 15 px.
  - _Today there are 30 labels at 10–11 px._
- **Keyboard** (2.1.1, 2.4.3). Every list is reachable and operable by keyboard, including cue rows, layers, rules and media. Focus order follows reading order. _Today: cue rows are not focusable._
- **Focus** (2.4.7, 2.4.11). Focus is always visible, never hidden behind a sticky panel or toast, and never red.
- **Content on hover** (1.4.13).
  - In the editor, tooltips can be dismissed with Esc and stay while hovered.
  - In the operator, where Esc is PANIC, hover help goes in the Info strip, which never covers other content.
- **Targets** (2.5.8). Controls are at least 24 × 24 px. The remote, the audience page, GO and PANIC are at least 44 px.
- **Dragging** (2.5.7). Every drag has a single-pointer or keyboard alternative.
- **Motion** (2.2.2, 2.3.1, 2.3.3).
  - Respect reduced motion.
  - Nothing moves, blinks or scrolls automatically for over five seconds without a way to stop it.
  - Nothing flashes more than three times a second.
- **Shortcuts** (2.1.4). Single-key shortcuts can be turned off or remapped.
- **Screen readers.** Every control has a name. Live regions announce standby changes, moment results and health changes, briefly.
- **Language.** The audience page is ready for translation; no text is baked into images.

## Review checklist for a new screen or feature

- [ ] Which persona and which attention mode (explore or execute) is it for?
- [ ] Does it keep all six [safety invariants](#safety-invariants)?
- [ ] Is it reversible? If it asks for confirmation, is the action truly rare and irreversible, and does the prompt name the consequence?
- [ ] Is it quiet when normal? Does every colour have one meaning, with a word or shape too?
- [ ] Can it be done on the canvas or list itself, and also from the keyboard and the palette?
- [ ] Is there a teaching empty state? Is advanced material behind one labelled step?
- [ ] Which customization scope does any new setting belong to, and can it be reset?
- [ ] Does every action respond in the next frame? Is any motion explaining a change, and does it follow the reduced profile?
- [ ] Does it meet the accessibility commitments? Has it been checked in the Booth theme at booth brightness?

## Open decisions

These need a product decision before they are built:

1. **Back for GO.** How far back should it go: one step, or several?
2. **Leaving Show mode:** a one-second hold only, or an optional PIN as well?
3. **Rule evaluation.** All matching rules run today. Should a trigger group also support "first match wins", with an "otherwise" row?
4. **Mouse GO on press or release.** Firing on press is faster, and the double-GO guard already prevents doubles. Release lets a mis-click be dragged off.

### Needs engine or show-format changes

These patterns depend on work outside the interface:

- **Per-action delay** (cue dock): an optional `delay` on actions.
- **Tape colours** on scenes and cues, and a show-level default fade.
- **Fonts bundled** in the `.scrim` file for text layers.
- **Rule trace:** the engine emits a `ruleEvaluated` event with each check and its result.
- **Back:** the engine restores the pre-GO state with the cue's fades.
- **Path bookmarks and "Rehearse from here":** a named list of inputs replayed through the engine. They could be stored in the show or per machine.
- **An optional default operator layout** saved in the show.
- **Panic:** Esc always added at runtime, plus extra panic keys in the show.

## Sources

**Show control and live performance**

- QLab 5 docs (workspace, inspector, Show mode, workspace settings, keyboard shortcuts, cue carts): [qlab.app/docs/v5](https://qlab.app/docs/v5/fundamentals/workspace/)
- ETC Eos Level 1 workbook (Live/Blind, Stop/Back): [etcconnect.com](https://www.etcconnect.com/uploadedFiles/Main_Site/Documents/Public/Video_Tutorial/EosGio_L1_Workbook_v2.6.0_revA.pdf)
- ETC CueSystem (standby → acknowledge → go): [etcconnect.com](https://www.etcconnect.com/About/News/ETC-moves-into-the-stage-manager-s-desk-with-CueSystem.aspx)
- disguise network status widget: [help.disguise.one](https://help.disguise.one/designer/networking/network-status-widget)
- Bitfocus Companion settings (PIN lock): [companion.free](https://companion.free/user-guide/v5.0/config/settings)
- ProPresenter stage display: [renewedvision.com](https://renewedvision.com/propresenter/stage-display)
- The dark cockpit: [lean.org](https://www.lean.org/the-lean-post/articles/the-dark-cockpit-what-aviation-can-teach-lean-leaders/)
- Going gray (ISA-101): [ca118.webteractive.co](https://ca118.webteractive.co/technical-articles/going-gray/)
- Joint Commission, Sentinel Event Alert 50 (alarm fatigue): [jointcommission.org](https://digitalassets.jointcommission.org/api/public/content/f65e5c9df2b94000a99445e0a7877007)
- FAA human factors guidance on alerting and colour: [hfcc.dot.gov](https://hfcc.dot.gov/publications/docs/GeneralGuidance/zz_FAA_GeneralGuidanceDoc_Chapter_04_Section_01.html)

**Creative tools**

- Figma, our approach to designing UI3: [figma.com](https://www.figma.com/blog/our-approach-to-designing-ui3/)
- Figma help (properties panel, position and alignment, measure, zoom, actions menu): [help.figma.com](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions)
- Figma Motion timeline: [help.figma.com](https://help.figma.com/hc/en-us/articles/41405906446999-Use-the-Figma-Motion-timeline)
- Illustrator contextual task bar: [helpx.adobe.com](https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/contextual-task-bar-overview.html)
- Premiere workspaces: [helpx.adobe.com](https://helpx.adobe.com/premiere/desktop/get-started/tour-the-workspace/what-are-workspaces.html)
- Rive editor (inspector, timeline, easing): [rive.app/docs](https://rive.app/docs/editor/interface-overview/inspector.md)
- Canva shortcuts and templates: [canva.com](https://www.canva.com/help/canva-keyboard-shortcuts/)
- DaVinci Resolve pages: [blackmagicdesign.com](https://www.blackmagicdesign.com/products/davinciresolve)

**Authoring branching and logic**

- Twine reference (story map, testing): [twinery.org](https://twinery.org/reference/en/editing-stories/navigating.html)
- Yarn Spinner (graph view, node groups): [docs.yarnspinner.dev](https://docs.yarnspinner.dev/)
- Arcweave play mode and debugger: [docs.arcweave.com](https://docs.arcweave.com/tutorials/basic/pt-4)
- Apple Shortcuts, If actions: [support.apple.com](https://support.apple.com/guide/shortcuts/use-if-actions-apd83dcd1b51/ios)
- Zapier Paths: [help.zapier.com](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zaps-with-Paths)
- Home Assistant automation traces: [home-assistant.io](https://www.home-assistant.io/integrations/trace/)
- ChoiceScript automatic testing: [choiceofgames.com](https://choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically)
- Cognitive dimensions of notations: [wikipedia.org](https://en.wikipedia.org/wiki/Cognitive_dimensions_of_notations)

**Customization, onboarding and discoverability**

- VS Code settings, profiles, keybindings: [code.visualstudio.com](https://code.visualstudio.com/docs/configure/settings)
- Blender workspaces and keymap preferences: [docs.blender.org](https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html)
- Ableton Live 12, MIDI and key remote control: [ableton.com](https://www.ableton.com/en/live-manual/12/midi-and-key-remote-control/)
- Superhuman, how to build a remarkable command palette: [blog.superhuman.com](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- Linear, how we redesigned the Linear UI: [linear.app](https://linear.app/now/how-we-redesigned-the-linear-ui)
- NN/g, onboarding tutorials vs contextual help: [nngroup.com](https://www.nngroup.com/articles/onboarding-tutorials/)
- NN/g, empty states in complex applications: [nngroup.com](https://www.nngroup.com/articles/empty-state-interface-design/)
- NN/g, progressive disclosure: [nngroup.com](https://www.nngroup.com/articles/progressive-disclosure/)
- Findlater & McGrenere, static, adaptive and adaptable menus (CHI 2004): [doi.org](https://doi.org/10.1145/985692.985704)
- McGrenere et al., multiple interfaces for bloated software (CHI 2002): [doi.org](https://doi.org/10.1145/503376.503406)
- Mackay, triggers and barriers to customizing software (CHI 1991): [doi.org](https://doi.org/10.1145/108844.108867)
- Page et al., user customization of a word processor (CHI 1996): [doi.org](https://doi.org/10.1145/238386.238541)
- Malacria et al., ExposeHK (CHI 2013): [doi.org](https://doi.org/10.1145/2470654.2470735)

**Speed, motion and errors**

- NN/g, response times: the three important limits: [nngroup.com](https://www.nngroup.com/articles/response-times-3-important-limits/)
- web.dev, Interaction to Next Paint: [web.dev](https://web.dev/articles/inp)
- Emil Kowalski, you don't need animations: [emilkowal.ski](https://emilkowal.ski/ui/you-dont-need-animations)
- Rauno Freiberg, invisible details of interaction design: [rauno.me](https://rauno.me/craft/interaction-design)
- Apple HIG, motion: [developer.apple.com](https://developer.apple.com/design/human-interface-guidelines/motion)
- Vercel web interface guidelines (loading delays, optimistic updates): [vercel.com](https://vercel.com/design/guidelines)
- NN/g, confirmation dialogs: [nngroup.com](https://www.nngroup.com/articles/confirmation-dialog/)
- Raskin, never use a warning when you mean undo: [alistapart.com](https://alistapart.com/article/neveruseawarning/)

**Accessibility**

- WCAG 2.2 Understanding documents (1.4.1, 1.4.3, 1.4.11, 1.4.13, 2.1.4, 2.2.2, 2.3.1, 2.3.3, 2.4.11, 2.5.7, 2.5.8): [w3.org/WAI/WCAG22/Understanding](https://www.w3.org/WAI/WCAG22/Understanding/)
- MDN, EyeDropper API: [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API)
- NN/g, dark mode vs light mode: [nngroup.com](https://www.nngroup.com/articles/dark-mode/)
- NEI, colour blindness: [nei.nih.gov](https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness)
