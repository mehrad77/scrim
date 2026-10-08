# Research: UI/UX

The research behind [UX_PRINCIPLES.md](../../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md).

**Question:** what UI/UX patterns, design-system foundations and motion practices would let anyone open Scrim, feel comfortable, and customize it? It must also stay powerful enough for art directors, creative authors and stage managers running a live show.

**Status:** research notes, October 2026. The two documents above record what was decided. Where a note and a decision differ, the decision wins. For example:

- the notes propose three identity directions, and the chosen one is a blend;
- the motion notes suggest Motion's `Reorder`, and the design system uses React Aria's drag-and-drop instead.

## Method

**Seven research tracks**, each written as findings with this structure:

- **pattern:** what the tools do;
- **evidence:** a source page that was opened;
- **apply to Scrim:** which surface and which persona;
- **confidence.**

**One hands-on audit** of the running app, with measured contrast and usage counts.

**Rules for evidence.**

- A search snippet was not accepted as a source.
- Anything from background knowledge is marked _(unverified)_.
- Library versions were checked on npm on 8 October 2026.

## Notes

| Document                                 | Lens            | Topic                                                                                                           |
| ---------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| [audit.md](audit.md)                     | All             | The current app walked through and measured: contrast failures, colour collisions, gaps per surface             |
| [creative-tools.md](creative-tools.md)   | Art director    | Figma, Adobe, Resolve, Rive, Spline, Canva: inspector, precision tools, task bar, timeline, media               |
| [show-control-ui.md](show-control-ui.md) | Stage manager   | QLab, Eos, disguise, ProPresenter, Ableton, OBS; dark cockpit and alarm fatigue: GO panel, modes, health, panic |
| [logic-authoring.md](logic-authoring.md) | Creative author | Twine, ink, Yarn Spinner, articy, Arcweave, Shortcuts, Zapier: rule sentences, scene map, simulation, traces    |
| [customization.md](customization.md)     | Everyone        | Workspaces, panel libraries, command palette, keymaps, settings scope, onboarding, progressive disclosure       |
| [motion.md](motion.md)                   | Everyone        | Motion 14 API and bundle size, motion tokens from Carbon, Material 3 and Fluent 2, perceived speed, hard rules  |
| [foundations.md](foundations.md)         | Developers      | Design tokens, OKLCH, contrast, type, density, headless libraries (React Aria, Base UI, Radix)                  |
| [identity.md](identity.md)               | Brand           | Three visual directions (Ghost Light, Call Sheet, Spike), each with palette, type, shape and motion             |

## Findings that matter most

- **The live view needs fewer, calmer signals.**
  - Show-control tools and cockpit research agree that colour should mean "look here".
  - Next, running and done should differ by shape and position, not hue alone.
  - The risky mode (Rehearsal) is the one to mark loudly ([show-control-ui.md](show-control-ui.md)).
- **Esc is PANIC, and every headless overlay library swallows Esc.**
  - PANIC has to be captured before overlays see the key ([foundations.md](foundations.md)).
  - Operator overlays must not use Esc at all ([customization.md](customization.md)).
- **Art directors expect Figma's conventions:** a selection-driven inspector, scrubbable number fields, nudging, snapping and zoom keys ([creative-tools.md](creative-tools.md)).
- **Creative authors need to see and test the logic:**
  - rules as sentences;
  - a derived scene map;
  - audience simulation;
  - a "why did this fire" trace ([logic-authoring.md](logic-authoring.md)).
- **People customize access, not looks.**
  - Invest in layouts, shortcuts and a command palette.
  - Keep appearance to a few inputs (theme, accent, contrast) ([customization.md](customization.md)).
- **Motion should be CSS-first and never on the show path.** Keyboard actions don't animate, and output windows import no animation code ([motion.md](motion.md)).
- **Today's UI has measurable debts** ([audit.md](audit.md)):
  - the most-used secondary text is 4.0:1;
  - input borders are 1.3:1;
  - the PANIC colour doubles as the focus ring.
