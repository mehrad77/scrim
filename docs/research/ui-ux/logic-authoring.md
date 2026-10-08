# Research: Branching and logic authoring for non-programmers

**Question:** How can writers and directors author branches, state and rules without programming, and test them without an audience?

**Status:** research notes, October 2026. The decisions drawn from them are in [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md); where these notes and those documents differ, the documents win.

Scrim today (from the repo): `runRules` runs every matching enabled rule in list order and emits no rule events; `step()` is pure; `previewState()` replays earlier cues linearly with no audience input; an unknown `{{name}}` prints literally on stage; the Pre-show check covers hardware and media, not logic. The demo has three rules that all start at "Door vote closes".

## Findings

### 1. The cue list stays the spine; a derived map is a lens; exits show inline

- What: Writer tools keep one editable source plus a second, mostly read-only view. Yarn Spinner derives its graph from jump statements; QLab keeps a linear playhead with explicit Go To cues; Isadora keeps a bottom Scene List with Jump actors. Twine's map adds three zoom buttons, tag colour stripes, fuzzy Go To (P key) and red "no entry" lines for broken links.
- Evidence: Yarn VS Code — https://docs.yarnspinner.dev/next/write-yarn-scripts/writing-yarn-in-vs-code ; Twine map — https://twinery.org/reference/en/editing-stories/navigating.html ; QLab — https://qlab.app/docs/v5/fundamentals/cues/ ; Isadora — https://troikatronix.com/isadora/cueing-show-control/
- Apply to Scrim: Editor/Cues (creative author, director). Keep `CueList` as the editing surface; replace the "N actions · notes" subline with a generated summary plus exit chips ("Opens Door vote → Cellar | Attic"). Add a List | Map toggle: scenes as nodes, edges derived from `jumpScene`/`goToCue` (including nested `branch` and rule `then`), dashed for `fire:false` (standby), solid for `fire:true`, red end-cap on empty refs, unreachable scenes dimmed, click selects in the list. Nothing new to store. Demo: Preshow → The hallway → Cellar | Attic → Ending.
- Confidence: high

### 2. Rules read as sentences of typed pickers; the same chips serve `{{state}}`

- What: Builders for non-programmers show a rule as typed slots. Shortcuts offers "is/contains" for text, greater/less for numbers, Any/All, and blue pill tokens for earlier results. Zapier Filter is field | rule | value with AND/OR. Figma outlines an invalid conditional in red. HA lets you rename, disable and move each step.
- Evidence: Shortcuts If — https://support.apple.com/guide/shortcuts/use-if-actions-apd83dcd1b51/ios ; Shortcuts variables — https://support.apple.com/guide/shortcuts/intro-to-variables-apdd02c2780c/ios ; Zapier Filter — https://help.zapier.com/hc/en-us/articles/8496276332557-Add-conditions-to-your-Zap-with-Filter ; Figma — https://help.figma.com/hc/en-us/articles/15253220891799 ; HA editor — https://www.home-assistant.io/docs/automation/editor/
- Apply to Scrim: Editor/Interaction (creative author). A rule is now 5+ native `<select>`s with violet when/if/then labels (`WhenPicker`, `Conditions`). Render it as "When [Door vote] closes, and [door] [is] [The red door], then [Go to scene Cellar]": chips open a searchable popover and show option labels, not the `left` key. Collapsed rules show only the sentence, so ten rules scan like a script. For `{{name}}` in text, use an insert-state chip with a live value, so a typo cannot reach the stage. Label the two kinds of "if": rule condition (does this reaction run) vs the cue's "If… then… else" action (which actions in this cue run).
- Confidence: high

### 3. Group rules by trigger into a decision table; show order and "otherwise"

- What: Tools surface evaluation semantics because authors guess. Airtable runs only the first matching group and adds an "Otherwise" catch-all; Arcweave evaluates if/elseif/else top to bottom; Zapier Paths have Custom, Always-run and Fallback rules (10 branches per group, 3 nested) and need an action in every branch; Make numbers routes and marks the fallback with an arrow icon.
- Evidence: Airtable — https://support.airtable.com/articles/8153928625-conditional-groups-of-automation-actions ; Arcweave — https://docs.arcweave.com/project-items/branches ; Zapier Paths — https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zaps-with-Paths ; Make Router — https://help.make.com/router
- Apply to Scrim: Editor/Interaction (creative author, director). Scrim runs all matching rules, so say so. Group rules sharing a `when` under one header, "When Door vote closes": always → hide vote UI; left → Cellar; right → Attic; nobody votes → default `left`. Number the rows and state "every matching row runs, top to bottom". Auto-add one row per vote option; an option with no row gets an amber "unhandled" row, and two rows matching one value get an overlap warning. No data change; if first-match semantics are wanted later, add an optional `else` flag.
- Confidence: medium

### 4. Lint the logic: dead ends, unhandled options, broken refs, "used by"

- What: Mature tools make structure checkable. Twine's Details counts links, broken ones included. ChoiceScript Quicktest tries every option and both sides of every `*if`, reporting unreachable lines. Yarn's Story Solver targets reachability and soft locks (page still says closed alpha). Cognitive Dimensions names what this prevents: hidden dependencies.
- Evidence: Twine Details — https://twinery.org/reference/en/editing-stories/stats.html ; ChoiceScript — https://choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically ; Story Solver — https://www.yarnspinner.dev/storysolver ; Cognitive Dimensions — https://en.wikipedia.org/wiki/Cognitive_dimensions_of_notations
- Apply to Scrim: Editor + operator Pre-show check (designer, stage manager). Today there is an amber empty-picker border and "No cue opens this moment yet"; the engine only warns at run time, which is too late. Add a Logic check: vote option with no rule; moment never opened; empty or deleted refs; scene nobody reaches; state written never read; possible rule loop. Badge it on the Cues and Interaction tabs, add it to `PreshowCheck` so READY includes logic, and show "used by N" on every state value, moment and trigger.
- Confidence: high

### 5. Show state as moving values: now, was, initial; editable in rehearsal

- What: People grasp variables when they watch them move. Scratch's checkbox puts a live monitor on stage (readout, or a slider that sets the value). Arcweave's Debugger shows previous and current values, marks changes orange and lets you edit the previous value. articy adds initial values and a "changed" filter. Harlowe lists type, name, scope and value in a sortable table.
- Evidence: Scratch — https://en.scratch-wiki.info/wiki/Variable_Monitor ; Arcweave — https://docs.arcweave.com/tutorials/basic/pt-4 ; articy — https://www.articy.com/help/adx/Presentation_Simulation.html ; Harlowe — https://twine2.neocities.org/
- Apply to Scrim: Operator/State (director, stage manager). `StatePanel` is name + value, editable only in Rehearsal. Add columns now · was (before the last cue) · initial, a short highlight on change (Motion, operator only, reduced-motion safe), a "changed" filter and per-variable reset to initial. List moment results first and show choice labels. Pin up to three values beside GO ("door = left"). In Editor/Cues, make `StatePreview` show the change versus the previous cue.
- Confidence: high

### 6. Let content carry its conditions: derived values, auto "visited", random pick

- What: Plain branching explodes: three clues in any order need 6 paths, but 4 storylets in quality-based narrative. Yarn Spinner 3 lets same-named nodes carry `when:` conditions and picks one; smart variables name an expression once. ink counts knot visits automatically. QLab's Start Random plays each child once before repeating.
- Evidence: Emily Short (2016, foundational) — https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/ ; Yarn node groups — https://docs.yarnspinner.dev/next/write-yarn-scripts/syntax-basics/node-groups ; Yarn smart variables — https://docs.yarnspinner.dev/3.1/write-yarn-scripts/scripting-fundamentals/smart-variables.md ; ink — https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md ; QLab groups — https://qlab.app/docs/v5/fundamentals/group-cues/
- Apply to Scrim: Editor/Interaction state values, Cues (creative author). A `Condition` is one value against a literal, so "most phones chose left" or "has seen the Cellar" needs extra vars and rules. Add as additive format fields: (1) derived values built from a sentence ("crowd_agrees = share of left in tally ≥ 60%") with a live readout; (2) automatic visited flags per scene and cue; (3) a "Pick one of… (no repeats)" action under Show flow; (4) later, an optional `when` on a scene so alternatives self-select.
- Confidence: medium

### 7. Play from here with chosen assumptions; save paths as bookmarks and replay them

- What: Twine's "Test From Here" skips start-passage setup, so state can be wrong. Arcweave's "Quickstart Play Mode from here" pairs with an editable Debugger to patch state. articy records choices and replays them with current text. Inky replays remembered choices after every recompile.
- Evidence: Twine testing — https://twinery.org/reference/en/publishing/testing.html ; Arcweave — https://docs.arcweave.com/tutorials/basic/pt-4 ; articy — https://www.articy.com/help/Presentation_RecordPlay.html ; Inky — https://github.com/inkle/inky
- Apply to Scrim: Editor/Cues + Operator rehearsal (director). `previewState()` ignores where a vote sent you, so "After this cue" can be wrong in a branching show. Add "Assume" chips above the preview, one per earlier moment (default = its `defaultResult`), applied as a `closeMoment` input. Add "Rehearse from here": Operator opens in Rehearsal with that cue on standby and those values. Save named bookmarks ("Red door path"), the "rehearsal bookmark" gap in `docs/users-and-journey.md`; since `step()` is deterministic, a bookmark is a list of inputs. After each edit, re-run it and flag "no longer reaches Cellar".
- Confidence: high

### 8. Simulate the audience without phones: inject, try every outcome, run many

- What: Builders give a test button and somewhere to read the result. Node-RED's Inject node sends a test message on click and the Debug sidebar shows what arrived. Airtable tests conditions against a sample record. ChoiceScript Randomtest recommends 10,000+ random playthroughs with per-line hit counts.
- Evidence: Node-RED — https://nodered.org/docs/tutorials/first-flow ; Airtable — https://support.airtable.com/articles/3669392397-Getting-started-with-Airtable-automations ; ChoiceScript — https://choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically
- Apply to Scrim: `MomentEditor` + Operator Audience panel (director, designer). Today the director uses Close now / Force / Override and manual state edits. Add a "Try it" row: drag a split across options (a slider position, sample names for text), press Close, and see the result value, the rules that ran and the scene reached, all through pure `step()`. Add "Try every outcome" (one line per option, with its path) and "Simulate 200 phones" in Rehearsal to watch the tally bar. This answers "what if the audience picks B?" in one click.
- Confidence: high

### 9. "Why did this fire?" (and "why didn't it?") as a rule trace

- What: Home Assistant records each run as a trace: a graph highlighting the path taken, per-step data including changed variables, a timeline; it keeps the last 5 per automation plus separate "Did not trigger" traces. Zapier history shows a status (including Filtered) with input and output per step; Make's bubbles open module input and output; Unreal pulses active wires.
- Evidence: HA trace — https://www.home-assistant.io/integrations/trace/ ; Zapier history — https://help.zapier.com/hc/en-us/articles/8496291148685 ; Make — https://help.make.com/view-module-run-data ; Unreal — https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-debugging-example-in-unreal-engine
- Apply to Scrim: Operator/Log + rule cards (director, designer, stage manager). `LogPanel` shows mono lines for cues, moments and warnings but cannot say why a branch happened, since the engine emits no rule events. Emit `ruleEvaluated {ruleId, ran, checks[{var, op, expected, actual}]}` from `runRules` whenever `when` matched. Log "Rule 'Red door wins → cellar' ran: door = left → Cellar on standby"; fold skipped rules into "1 skipped", expanding to "door = right ✗ (was left)". Rule cards get a last-run badge in Rehearsal. Keep one line per rule in Show mode and 5 recent evaluations per rule; never animate outputs.
- Confidence: high

### 10. A progressive ladder with recipes: one object, more layers, no mode switch

- What: Strong tools grow one object. HA goes blueprints (fill in inputs) → visual editor → YAML, but "Take control" is irreversible. Zapier goes Zap → Filter → Paths; Copilot has an "Ask as you build" confirm mode (docs: open beta). Airtable tucks branching under "+ Add advanced logic or action". Figma goes trigger → action → Set variable → Conditional. Shortcuts' Gallery shows how starters are built. Twine 2.6 imports and exports Twee 3, a plain-text story format.
- Evidence: HA blueprints — https://www.home-assistant.io/docs/automation/using_blueprints/ ; Zapier Copilot — https://help.zapier.com/hc/en-us/articles/15703650952077 ; Airtable — https://support.airtable.com/articles/8153928625-conditional-groups-of-automation-actions ; Figma — https://help.figma.com/hc/en-us/articles/14506587589399 ; Shortcuts Gallery — https://support.apple.com/guide/shortcuts/discover-shortcuts-in-the-gallery-apdd018638ca/ios ; Twine 2.6 — https://twinery.org/reference/en/release-notes/2-6.html
- Apply to Scrim: whole editor (creative author, art director). Level 0: cues in order, like slides. Level 1: an "Ask the audience" recipe in one dialog (question, options, where each goes) that creates the moment, result vars (existing `createResultVars`) and one rule per option; the result stays ordinary editable objects, with a "Show as rules" link. Level 2: rule sentences. Level 3: derived values. Level 4: scripting, external control. Offer starter recipes ("Vote → two scenes", "Counter reaches N", "Performer reveals") in the Interaction empty state. Optional writing-first on-ramp (low confidence): import Twee or a pasted outline to scaffold scenes and votes.
- Confidence: medium

### 11. Cautionary: keep the raw node-graph ceiling opt-in and live

- What: Blueprints give strong runtime visibility but leave readability to the author (community guides: comment boxes, reroutes, collapse to functions). TouchDesigner expects newcomers to learn wires, cooking, paths and four parameter modes. Isadora, built for theatre, pairs a linear scene list with explicit jumps and a Blind mode for editing off-air scenes. articy tames size with nested flows.
- Evidence: Blueprint community guide — https://uhiyama-lab.com/en/notes/ue/blueprint-spaghetti-code-prevention-techniques/ ; TouchDesigner — https://derivative.ca/UserGuide/First_Things_to_Know_about_TouchDesigner ; Isadora — https://troikatronix.com/isadora/cueing-show-control/ ; articy nesting — https://www.articy.com/en/improve-project-structure-with-nesting/
- Apply to Scrim: whole editor (art director vs creative author). Do not hand creative authors a raw wire canvas. Keep logic declarative (cues, rules) with the derived read-only map from finding 1. A pro patch view, if ever added, should be another lens over the same data, with live values on wires, hierarchical collapse (articy: two-triangle marker, Enter to dive in) and "used by" links. Blind editing of off-air scenes is a later idea; Show mode currently locks editing.
- Confidence: medium

## Top 5 recommendations

1. Rule trace: `ruleEvaluated` engine events, a readable log line per rule that ran, folded "skipped" lines, last-run badge on rule cards (finding 9).
2. Audience simulator plus "Assume" chips and path bookmarks in Cues and Operator (findings 7, 8).
3. Rules as sentences with searchable chips, grouped by trigger into a decision table that flags unhandled vote options (findings 2, 3).
4. Logic check in the editor and the Pre-show check, with "used by" counts (finding 4).
5. Show the show's shape: exits inline in cue rows, a derived read-only scene map, and an "Ask the audience" recipe as the on-ramp (findings 1, 10).

## Sources (opened)

- Twine: navigating the map — https://twinery.org/reference/en/editing-stories/navigating.html
- Twine: testing a story — https://twinery.org/reference/en/publishing/testing.html
- Twine: story statistics — https://twinery.org/reference/en/editing-stories/stats.html
- Twine: 2.6 release notes — https://twinery.org/reference/en/release-notes/2-6.html
- Twine: linking passages — https://twinery.org/reference/en/editing-stories/linking-passages.html
- Twine: story format extensions — https://twinery.org/reference/en/story-formats/extensions.html
- Twine: large stories; collaborating (no multi-user editing) — https://twinery.org/reference/en/limitations/large-stories.html ; https://twinery.org/reference/en/limitations/collaborating.html
- Twine releases (2.12.1 listed latest) — https://github.com/klembot/twinejs/releases
- Harlowe manual (debug mode) — https://twine2.neocities.org/
- Inky; releases (0.15.x, 2024) — https://github.com/inkle/inky ; https://github.com/inkle/inky/releases
- ink site; Writing with ink — https://www.inklestudios.com/ink/ ; https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md
- Yarn Spinner docs; node groups; VS Code and graph view; smart variables; 3.0 preview; Story Solver — https://docs.yarnspinner.dev/ ; https://docs.yarnspinner.dev/next/write-yarn-scripts/syntax-basics/node-groups ; https://docs.yarnspinner.dev/next/write-yarn-scripts/writing-yarn-in-vs-code ; https://docs.yarnspinner.dev/3.1/write-yarn-scripts/scripting-fundamentals/smart-variables.md ; https://www.yarnspinner.dev/blog/yarn-spinner-30-what-to-expect/ ; https://www.yarnspinner.dev/storysolver
- articy:draft: presentation mode; record and auto-play; simulation; nesting; flow view — https://www.articy.com/en/articydraft-first-steps-tutorial-series-l07-presentation-mode/ ; https://www.articy.com/help/Presentation_RecordPlay.html ; https://www.articy.com/help/adx/Presentation_Simulation.html ; https://www.articy.com/en/improve-project-structure-with-nesting/ ; https://www.articy.com/help/adx/UI_View_Flow.html
- Arcweave: play mode tutorial; branches; variables; boards and jumpers — https://docs.arcweave.com/tutorials/basic/pt-4 ; https://docs.arcweave.com/project-items/branches ; https://docs.arcweave.com/project-items/variables/overview ; https://docs.arcweave.com/project-items/boards
- Apple Shortcuts: variables; If actions; Gallery — https://support.apple.com/guide/shortcuts/intro-to-variables-apdd02c2780c/ios ; https://support.apple.com/guide/shortcuts/use-if-actions-apd83dcd1b51/ios ; https://support.apple.com/guide/shortcuts/discover-shortcuts-in-the-gallery-apdd018638ca/ios
- Zapier: Paths; Filter; Zap history; Copilot — https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zaps-with-Paths ; https://help.zapier.com/hc/en-us/articles/8496276332557-Add-conditions-to-your-Zap-with-Filter ; https://help.zapier.com/hc/en-us/articles/8496291148685 ; https://help.zapier.com/hc/en-us/articles/15703650952077
- Make: Router; execution history; module run data — https://help.make.com/router ; https://help.make.com/scenario-execution-history ; https://help.make.com/view-module-run-data
- Airtable: conditional groups; getting started — https://support.airtable.com/articles/8153928625-conditional-groups-of-automation-actions ; https://support.airtable.com/articles/3669392397-Getting-started-with-Airtable-automations
- Notion: database automations (trigger, optional any/all conditions, actions) — https://www.notion.com/help/database-automations
- Scratch Wiki: variable monitor; variables; block shapes (K-State) — https://en.scratch-wiki.info/wiki/Variable_Monitor ; https://en.scratch-wiki.info/wiki/Variables ; https://textbooks.cs.ksu.edu/intro-scratch/02-blocks/02-block-shapes/
- Unreal: Blueprint debugging; graph organisation (community article, not Epic) — https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-debugging-example-in-unreal-engine ; https://uhiyama-lab.com/en/notes/ue/blueprint-spaghetti-code-prevention-techniques/
- TouchDesigner: first things to know; Network Editor — https://derivative.ca/UserGuide/First_Things_to_Know_about_TouchDesigner ; https://derivative.ca/UserGuide/Network_Editor
- Isadora: cueing and show control — https://troikatronix.com/isadora/cueing-show-control/
- Home Assistant: automation editor; overview; blueprints; troubleshooting; trace — https://www.home-assistant.io/docs/automation/editor/ ; https://www.home-assistant.io/docs/automation/ ; https://www.home-assistant.io/docs/automation/using_blueprints/ ; https://www.home-assistant.io/docs/automation/troubleshooting/ ; https://www.home-assistant.io/integrations/trace/
- Figma: variables in prototypes; multiple actions and conditionals — https://help.figma.com/hc/en-us/articles/14506587589399 ; https://help.figma.com/hc/en-us/articles/15253220891799
- Rive: transitions; listeners — https://rive.app/docs/editor/state-machine/transitions ; https://rive.app/docs/editor/state-machine/listeners
- ChoiceScript: automatic testing — https://choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically
- Node-RED: first flow — https://nodered.org/docs/tutorials/first-flow
- GDevelop: events; Else events — https://wiki.gdevelop.io/gdevelop5/events/ ; https://wiki.gdevelop.io/gdevelop5/events/else/
- QLab 5: cues; group cues — https://qlab.app/docs/v5/fundamentals/cues/ ; https://qlab.app/docs/v5/fundamentals/group-cues/
- Ableton Live 12 manual: launching clips (follow actions, Chance slider) — https://www.ableton.com/en/live-manual/12/launching-clips/
- Cognitive Dimensions of Notations — https://en.wikipedia.org/wiki/Cognitive_dimensions_of_notations
- Emily Short, Beyond Branching (2016) — https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/
