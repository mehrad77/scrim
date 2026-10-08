# Research: Show-control and live performance UIs (operator lens)

**Question:** What makes a cue list, GO panel and live operator view safe and glanceable under pressure in a dark booth?

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win.

Scope: QLab 5, Millumin, Resolume, disguise, ProPresenter, ETC Eos, Ableton, OBS/vMix, plus cockpit, alarm, low-light and error-prevention research. "(code reading)" = seen in `apps/web/src`, not run. Contrast figures are my calculations from Scrim's tokens.

## Findings

### 1. Separate "next" from "running"; encode each by shape and position

- What: QLab's masthead is always GO + the standby cue (number • name) + a notes field bound to that cue. A white playhead triangle marks it on the list's left edge. GO has a green border while a cue stands by and a red one during double-GO lockout. Running cues move to an Active Cues tab (elapsed/remaining; bar green playing, yellow paused). Status icons pair a shape with a colour (green triangle active, yellow bars paused, red X broken).

  |         | Next                                      | Running                              | Done                   |
  | ------- | ----------------------------------------- | ------------------------------------ | ---------------------- |
  | QLab    | playhead triangle; standby name beside GO | green triangle; Active Cues bar      | optional second colour |
  | Eos     | pending cue (loaded)                      | active cue: % complete, remaining    | —                      |
  | Ableton | —                                         | pie (loop) / progress bar (one-shot) | —                      |

- Evidence: QLab workspace — https://qlab.app/docs/v5/fundamentals/workspace/ ; Eos Selected Cue — https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/13_Cue_Playback/Selected_Cue.htm ; Ableton Session View — https://www.ableton.com/en/live-manual/12/session-view/ ; QLab 5.2 notes (second cue colour, colour-vision support) — https://qlab.app/release-notes/5.2
- Apply to Scrim: [Operator · stage manager] GoPanel's "Live" is just `lastFired`. Add a Running strip (media layers with remaining time, counters, open audience moment, follow countdown; all in `EngineState`). CueStack's NEXT (amber #f59e0b) and LIVE (green #22c55e) differ by hue only: luminance 0.44 vs 0.41, contrast 1.06:1, and about 1 in 12 men are colour-deficient. Use a left-rail playhead bar + bold row for NEXT, play glyph + thin progress for RUNNING, check + dimmed text for DONE; keep standby notes above GO at 14 px or more.
- Confidence: high

### 2. Colour means exceptions; one role per colour, never colour alone

- What: FAA guidance: red = warning, amber = caution, green = "normal" (so not for advisories), red/amber kept scarce elsewhere. ISA-101 plant screens stay grey when healthy, so colour means "look here". Live conventions collide: tally red = on air, green = preview; theatre cue lights flashing red = standby, green = go. vMix argued exactly this (began green GO / yellow GET SET; now configurable). Eos colours values by cause: red = manual/unsaved, blue/green = moving, magenta = tracked, grey = untouched.
- Evidence: FAA — https://hfcc.dot.gov/publications/docs/GeneralGuidance/zz_FAA_GeneralGuidanceDoc_Chapter_04_Section_01.html ; ISA-101 — https://ca118.webteractive.co/technical-articles/going-gray/ ; vMix forum — https://forums.vmix.com/posts/t8582-GreenPreview-----RedProgram ; Eos workbook colour conventions and Eos Displays Conventions PDF (grey = untouched) — see Sources
- Apply to Scrim: [Operator, tokens · designer] Rose `--color-live` marks Show mode, PANIC, lost output, "Blacked out", the Identify frame and the global focus ring, while the LIVE badge is green: the token name contradicts broadcast usage. Define four roles: Run = green, Next = amber, Fault = red (audience-visible problems and PANIC only), Mode = neutral/violet; focus ring white or blue. Pair every state with a word or shape (WCAG 1.4.1). White text on the rose fill is only 3.67:1.
- Confidence: high

### 3. Rehearsal is the loud mode; Show is calm, stripped, hard to leave by accident

- What: QLab Show mode disables the inspector, toolbar, Find and cue editing ("a safety mechanism") but not OSC/AppleScript; ⇧⌘] / ⇧⌘[ toggle it. A Figure 53 developer said in Feb 2023 there is no lock against leaving it, and users want one (none in the QLab 5 docs I opened). Eos Blind changes the command-line and display colours, needs no Record, and firing cues never moves the cue being edited. ProPresenter splits Show / Edit / Reflow; Millumin's preview grid locks once configured. Companion locks surfaces with a PIN plus idle timeout (0 = off) or a lock button.
- Evidence: QLab shortcuts — https://qlab.app/docs/v5/general/keyboard-shortcuts/ ; QLab mailing list — https://groups.google.com/g/qlab/c/InHMWGUSxxw ; Eos workbook p.6 — https://www.etcconnect.com/uploadedFiles/Main_Site/Documents/Public/Video_Tutorial/EosGio_L1_Workbook_v2.6.0_revA.pdf ; Companion — https://companion.free/user-guide/v5.0/config/settings ; ProPresenter UI and Millumin Workspace — see Sources
- Apply to Scrim: [Operator, Controls · stage manager, director] Today Show is the red segment. Invert: mark the unsafe state (Rehearsal: amber top rule, "Editing unlocked · double-click fires") and keep Show quiet. In Show, remove Reset/Edit/double-fire rather than greying them; leave Show by a 1 s hold (no secret to forget) or an optional PIN, with GO and PANIC always live. Hide Identify and suppress the output HUD in Show, so machinery cannot reach the audience mid-show (Identify paints a 7xl overlay for 3 s; the HUD appears on any pointer move; code reading). Queue director live tweaks Blind-style, applied between GOs. Make Esc→PANIC non-remappable (QLab fixes Panic All); today Controls can delete or remap it (code reading).
- Confidence: high (QLab/Eos), medium (PIN/hold, tweak queue)

### 4. Quiet when nominal: dark-cockpit health, plus an off-script flag

- What: The dark cockpit keeps indications off when normal so only abnormal states light up. The Joint Commission estimates 85–99% of device alarms need no intervention, so staff may turn alarms down or off. disguise's Network Status widget: four icons per machine (network, devices, genlock, video output), green/orange/red, blue = busy, grey = offline, each showing its worst sub-status, with summary icons on top. QLab's footer has a Warnings icon. Deviation flags: Ableton's "Back to Arrangement" lights when what you hear differs from the arrangement; Resolume's master slider turns red when not at 100%.
- Evidence: Lean Post — https://www.lean.org/the-lean-post/articles/the-dark-cockpit-what-aviation-can-teach-lean-leaders/ ; Sentinel Event Alert 50 — https://digitalassets.jointcommission.org/api/public/content/f65e5c9df2b94000a99445e0a7877007 ; disguise — https://help.disguise.one/designer/networking/network-status-widget
- Apply to Scrim: [Operator · stage manager] StatusChips shows "Awake", "Room · N phones" and MIDI as permanent green chips. Replace with four glyphs (Outputs, Audio, Room, Controls): grey when nominal; amber = degraded but the show runs (not full screen, may sleep, reconnecting); red = audience-visible now (output lost, sound blocked for the running cue); each abnormal state carries one verb (Reopen). Allow acknowledging a tolerated caution for the run. Add one amber "Off script · N" chip for deliberate deviations (forced audience result, manual state edit, standby moved, Hold on) with "Back to script". Pre-show check owns the all-green list.
- Confidence: high

### 5. Standby → acknowledge → Go, on the Remote and a performer display

- What: Calling a show runs Warning (about a minute ahead) → Standby (seconds) → Go. ETC CueSystem outstations flash red on standby; the person in position presses the flashing button to make it steady; the SM then sends green. It is bi-directional and shows current/upcoming cues. Eos Cue Alerts learn the gap between manual Go presses, then count down (gold under 5 s, green at 0), informational only. ProPresenter's stage display is a separate confidence monitor: current + next slide, clocks, timers, stage messages.
- Evidence: Cue (theatrical) — https://en.wikipedia.org/wiki/Cue_(theatrical) ; ETC CueSystem — https://www.etcconnect.com/About/News/ETC-moves-into-the-stage-manager-s-desk-with-CueSystem.aspx ; Eos Cue Alerts — https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/13_Cue_Playback/Cue_Alerts.htm ; ProPresenter — https://renewedvision.com/propresenter/stage-display
- Apply to Scrim: [Remote, Operator, Output · performer, stage manager] `/remote` shows "Next cue: X" in 12 px grey, enables every trigger while connected and fires on `pointerdown` (code reading), so a pocket touch fires. Give each trigger states: idle (dim, "not yet"), standby (slow amber ring, "Your cue · tap Ready"), acknowledged (steady), fire. The GO panel shows "Performer ready ✓" beside the standby cue; add an informational "usually ~N s after the last GO" timer from History. Pedals have no screen: show a last-trigger source/time chip. Add a "Stage display" role on `/remote-output` (current/next cue, clock, messages; large, dim).
- Confidence: medium-high (needs one new relay message)

### 6. A stray click or key must not move what GO fires; never drop a GO silently

- What: QLab keeps selection and playhead apart (the inspector follows selection; ⌘↓ selects, ⇧⌘↓ moves the playhead), offers "minimum time between GOs" (red border while locked) and "require key-up before re-arming". Eos Load puts a cue in pending; only Go fires it. NN/g: feedback within 0.1 s feels instantaneous.
- Evidence: QLab inspector — https://qlab.app/docs/v5/fundamentals/inspector/ ; QLab settings — https://qlab.app/docs/v5/fundamentals/workspace-settings/ ; NN/g — https://www.nngroup.com/articles/response-times-3-important-limits/
- Apply to Scrim: [Operator · stage manager] CueStack: one click sets standby, plain ↑/↓ move it, and the 300 ms double-GO guard drops silently (code reading). In Show: click = select/peek (notes only); standby moves only via Enter, a "Set next" button or modifier+arrow (not double-click, which fires in Rehearsal), with "Next: X (was Y)" for 3 s; a dropped GO flashes a 300 ms ring; require key-up before re-arm. `isTyping()` swallows Space/H/arrows while focus sits in any input or select (the Display select, State number fields): GO silently dead (code reading). In Show keep GO live outside explicit text entry, blur controls on commit, and show a "keys paused" chip.
- Confidence: high (QLab), medium (code claims)

### 7. Panic: instant, informed release, partial clears

- What: QLab: Esc once = panic (fade over a set duration), twice = hard stop; unremappable; Reset (hard stop + playhead to top) is separate; Pause all / Resume all go yellow / green. disguise's dashboard has Fade down / Fade up / Hold. Resolume previews the composition while faded down; X ejects everything. ProPresenter Clear Groups: per-layer clears with icon + tint (Clear All red, partial orange).
- Evidence: QLab shortcuts (above) ; Resolume composition — https://resolume.com/support/en/composition ; ProPresenter Clear Groups — https://support.renewedvision.com/hc/en-us/articles/4408681880211-Using-Clear-Groups-in-ProPresenter
- Apply to Scrim: [Operator · stage manager] Keep Esc instant. While blacked out, keep operator thumbnails showing the underlying picture, dimmed and labelled BLACKED OUT, so Release is informed. Make the banner steady, not `animate-pulse` (deliberate, not a fault). Add secondary Clear text / Clear media / Mute audio below PANIC. Likely defects (code reading, not run): a native `<dialog>` Esc-cancel also bubbles to the window handler, so cancelling a Rehearsal confirm fires PANIC; and `GoPanel` derives `blackedOut` from a `now` frozen at mount (refreshed only while follow/hold timers run), so after Release the "Blacked out" state lingers (I replayed the repo's `tweenValue`/`retarget` logic in a scratch script).
- Confidence: high (patterns), medium (defects)

### 8. Undo beats confirm: a "Back" for GO

- What: Eos [Stop/Back] freezes a cue mid-transition; again = previous cue; [Go] resumes. NN/g: confirm only serious, irreversible actions, be specific, require a non-standard action for extreme ones, always offer undo; overuse breeds reflex clicks. Raskin: never use a warning when you mean undo.
- Evidence: Eos workbook, Playback (above) ; NN/g — https://www.nngroup.com/articles/confirmation-dialog/ ; Raskin — https://alistapart.com/article/neveruseawarning/
- Apply to Scrim: [Operator · stage manager, director] No confirm on GO/PANIC/standby. Add Back: restore the pre-GO `EngineState` (plain data) with the cue's own fade, standby returns. Replace operator modals (Reset, Take over) with hold-to-confirm; audience "Close now" / "Force" get a 10 s undo toast.
- Confidence: medium (engine support unchecked)

### 9. Booth lighting: dim surfaces, keep text legible, treat thumbnails as light sources

- What: Material dark theme: dark grey (#121212) not black; text 87/60/38% white; desaturated accents; bright colours on small surfaces only; glow is no substitute for shadow. NN/g: even at night light-on-dark reads worse, most at small sizes, so fix size and weight. Rods take 30–45 min to adapt and barely respond to red. Theatre is split: blue backstage work lights (less visible spill) vs red booth lamps; one poster warns red can read as a warning, another that theatres are rarely dark enough for true night vision.
- Evidence: Material — https://m2.material.io/design/color/dark-theme.html ; NN/g — https://www.nngroup.com/articles/dark-mode/ ; Blue Room forum — https://www.blue-room.org.uk/topic/66631-backstage-blue-working-light/
- Apply to Scrim: [Operator, Remote · stage manager] Measured: ink-100 on ink-900 16.3:1 (fine); ink-400 4.0:1 and ink-500 2.2:1 at 10–11 px (fail AA); GO fill luminance 0.41 vs panel 0.005, plus a 40 px glow; thumbnails of bright slides can be the booth's largest light. Presets: Day (today); Booth (Show default: primary text ink-200 11.7:1, secondary floor #8a8aa0 5.7:1, 13 px minimum for operational text, GO as outline + tint without glow, thumbnails about 60%, one master dim); Night (opt-in warm monochrome: bg #0a0303, text ≥ #e0584a 5.5:1, floor ≈ #cc4a3e 4.5:1; hue cannot carry state there, so use shape/brightness and never let red mean "fault"). Build as token sets.
- Confidence: medium-high (thresholds are mine)

### 10. Motion budget by mode

- What: NN/g: most animation 100–500 ms, feedback about 100 ms and starting within 0.1 s; peripheral motion grabs attention, slides faster than fades; repetition annoys. WCAG: ≤3 flashes/s (2.3.1); auto-blinking over 5 s needs pause (2.2.2); `prefers-reduced-motion` satisfies 2.3.3. Motion: `MotionConfig reducedMotion="user"` drops transform/layout but keeps opacity/colour; only transform, opacity, filter and clip-path are compositor-friendly (layout and box-shadow run on the main thread); `AnimatePresence mode="wait"` holds the entering child until the exit ends. disguise doubles a flash rate to mean "hold": rare and deliberate.
- Evidence: NN/g — https://www.nngroup.com/articles/animation-usability/ ; Motion — https://motion.dev/docs/react-accessibility ; https://motion.dev/docs/performance ; WCAG 2.3.1 — https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- Apply to Scrim: [Operator, Remote, Output] (1) Dispatch GO/PANIC first, animate after; never await an animation. (2) Show allows only ≤100 ms opacity/background fades and progress bars; standby/NEXT changes are instant (a ≤150 ms marker slide is Rehearsal-only). (3) Show forbids looping pulses (`animate-pulse` on the blackout button and the Remote's connecting dot), slide-in toasts/banners, `mode="wait"`, height/box-shadow animation, smooth auto-scroll, layout shifts (dismissing `ResumeBanner` moves GO about 45 px; code reading). (4) Keep the Remote's single 400 ms ack ring. (5) Bind `MotionConfig reducedMotion` to a Calm preference (System / Reduced / Full) and force "always" in Show; the Output route never imports Motion. (6) Richer motion lives in Library, Editor, Rehearsal.
- Confidence: high

### 11. Show what GO will do; give one-shots a pad grid

- What: OBS Studio Mode prepares the next scene offscreen, then swaps. vMix has Preview/Output plus Quick Play (a GO per input, skipping preview, 0.5 s fade). QLab carts are 1×1–15×15 grids fired in any order, any number of times, with no playhead or auto-continue, in three cell sizes.
- Evidence: OBS — https://github.com/obsproject/obs-studio/wiki/obs-studio-overview ; vMix — https://www.vmix.com/help29/QuickPlay.html ; QLab carts — https://qlab.app/docs/v5/fundamentals/cue-carts/
- Apply to Scrim: [Operator · stage manager, designer] OutputsPanel shows only the current picture. Add an optional static (no rAF) "Next" thumbnail per output for the standby cue, amber frame beside the green Live one. Add a Pads tab for non-linear one-shots (audience override, stings, remote triggers), cart-sized, sharing definitions with Remote buttons.
- Confidence: medium

## Top 5 recommendations

1. Adopt a dark-cockpit status model: grey when nominal, amber/red only for exceptions, four roll-up glyphs, one colour per role, always a word or shape alongside (findings 2, 4).
2. Rebuild the GO panel for a one-second glance: playhead bar for NEXT, Running strip, GO lockout ring, standby notes, selection separate from standby in Show mode; extend with standby → ack → go on the Remote (1, 5, 6).
3. Make Rehearsal the loud mode and Show calm, stripped and deliberately unlockable; hide audience-visible tools in Show; make Esc→PANIC non-remappable (3).
4. Replace confirmations with reversibility: Back for GO, hold-to-confirm for rare destructive actions, informed Release (underlying picture visible); fix the Esc/dialog and blackout-state defects (7, 8).
5. Ship Booth and Night presets (13 px and 4.5:1 floors, dimmed previews, no GO glow) with a mode-tied motion budget: instant state changes and ≤100 ms fades in Show, no pulses/slides/layout shifts, `reducedMotion` forced on in Show, no Motion in Output (9, 10).

## Sources (opened)

- QLab 5, The Workspace — https://qlab.app/docs/v5/fundamentals/workspace/
- QLab 5, Workspace Settings — https://qlab.app/docs/v5/fundamentals/workspace-settings/
- QLab 5, Keyboard Shortcuts — https://qlab.app/docs/v5/general/keyboard-shortcuts/
- QLab 5, The Inspector — https://qlab.app/docs/v5/fundamentals/inspector/
- QLab 5, Cue Carts — https://qlab.app/docs/v5/fundamentals/cue-carts/
- QLab 5.2 release notes (cue colours) — https://qlab.app/release-notes/5.2
- QLab mailing list, Lock Workspace in Show Mode — https://groups.google.com/g/qlab/c/InHMWGUSxxw
- ETC, Eos/Gio Level 1 Essentials v2.6.0 (PDF; Live/Blind, Stop/Back, colour conventions) — https://www.etcconnect.com/uploadedFiles/Main_Site/Documents/Public/Video_Tutorial/EosGio_L1_Workbook_v2.6.0_revA.pdf
- Eos online help, Selected Cue — https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/13_Cue_Playback/Selected_Cue.htm
- Eos online help, Cue Alerts — https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/13_Cue_Playback/Cue_Alerts.htm
- ETC, De-Mystifying Eos and Ion Displays (PDF; pinned tabs, focus, grey = untouched) — https://www.etcconnect.com/uploadedFiles/Main_Site/Content/Support/Articles/Consoles/Eos/Eos-Ion%20Displays%20Conventions.pdf
- ETC, CueSystem news — https://www.etcconnect.com/About/News/ETC-moves-into-the-stage-manager-s-desk-with-CueSystem.aspx
- ETC, CueSystem outstations — https://www.etcconnect.com/Products/Legacy/Console/CueSystem/Outstations.aspx
- Millumin v4, Dashboard — https://help.millumin.com/v4/playback/dashboard/
- Millumin v4, Workspace — https://help.millumin.com/v4/playback/workspace/
- Resolume, Composition — https://resolume.com/support/en/composition
- disguise, Network Status widget — https://help.disguise.one/designer/networking/network-status-widget
- disguise, Designer user interface — https://help.disguise.one/designer/ui/designer-user-interface
- disguise, Transport player controls — https://help.disguise.one/designer/timeline-tracks-transports/transports-controls
- ProPresenter, Clear Groups — https://support.renewedvision.com/hc/en-us/articles/4408681880211-Using-Clear-Groups-in-ProPresenter
- ProPresenter, user interface — https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface
- ProPresenter, Stage Display — https://renewedvision.com/propresenter/stage-display
- Ableton Live 12 manual, Session View — https://www.ableton.com/en/live-manual/12/session-view/
- Ableton Live 12 manual, Live Concepts — https://www.ableton.com/en/live-manual/12/live-concepts/
- OBS Studio overview (Studio Mode) — https://github.com/obsproject/obs-studio/wiki/obs-studio-overview
- vMix, Quick Play — https://www.vmix.com/help29/QuickPlay.html
- vMix forum, Green=Preview / Red=Program — https://forums.vmix.com/posts/t8582-GreenPreview-----RedProgram
- Bitfocus Companion 5.0, Settings (PIN lockout) — https://companion.free/user-guide/v5.0/config/settings
- Wikipedia, Cue (theatrical) — https://en.wikipedia.org/wiki/Cue_(theatrical)
- Wikipedia, Tally light — https://en.wikipedia.org/wiki/Tally_light
- Blue Room forum, Backstage blue working light — https://www.blue-room.org.uk/topic/66631-backstage-blue-working-light/
- Lean Post, The Dark Cockpit — https://www.lean.org/the-lean-post/articles/the-dark-cockpit-what-aviation-can-teach-lean-leaders/
- FAA human factors general guidance, alerting and colour — https://hfcc.dot.gov/publications/docs/GeneralGuidance/zz_FAA_GeneralGuidanceDoc_Chapter_04_Section_01.html
- Joint Commission, Sentinel Event Alert 50 — https://digitalassets.jointcommission.org/api/public/content/f65e5c9df2b94000a99445e0a7877007
- Going Gray: A New HMI Standard (ISA-101) — https://ca118.webteractive.co/technical-articles/going-gray/
- NN/g, Confirmation dialogs — https://www.nngroup.com/articles/confirmation-dialog/
- A List Apart, Never Use a Warning When You Mean Undo — https://alistapart.com/article/neveruseawarning/
- NN/g, Response times: the 3 important limits — https://www.nngroup.com/articles/response-times-3-important-limits/
- NN/g, Animation in UX — https://www.nngroup.com/articles/animation-usability/
- NN/g, Animation duration — https://www.nngroup.com/articles/animation-duration/
- NN/g, Dark mode vs light mode — https://www.nngroup.com/articles/dark-mode/
- Material Design 2, Dark theme — https://m2.material.io/design/color/dark-theme.html
- Wikipedia, Adaptation (eye) — https://en.wikipedia.org/wiki/Adaptation_(eye)
- NEI, Color blindness — https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness
- WCAG 2.2, Use of Color — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- WCAG 2.2, Three Flashes — https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- WCAG 2.2, Pause, Stop, Hide — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- WCAG 2.2, Animation from Interactions — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- Motion, React accessibility — https://motion.dev/docs/react-accessibility
- Motion, Performance — https://motion.dev/docs/performance
- Motion, AnimatePresence — https://motion.dev/docs/react-animate-presence
