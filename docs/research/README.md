# Research

Background research for features that are not built yet. These notes record what the industry does and what the browser allows, so proposals and implementation plans can cite them. They describe options, not decisions. The UI/UX notes have already led to decisions, recorded in [UX_PRINCIPLES.md](../../UX_PRINCIPLES.md) and [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md).

| Document                                         | Topic                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [show-control-output.md](show-control-output.md) | Driving lighting consoles, QLab and other gear from cues: MIDI Show Control, OSC, Art-Net/sACN, bridges                                    |
| [gpu-compositor.md](gpu-compositor.md)           | Replacing the DOM renderer with a GPU compositor: canvas/slice model, warping, edge blending, effects                                      |
| [ui-ux/](ui-ux/README.md)                        | UI/UX patterns from creative, show-control and authoring tools; design-system foundations; motion; visual identity; an audit of today's UI |

Researched October 2026. Facts that change over time (browser support, Chrome's permission rules) were checked against live sources then. Items marked _(unverified)_ come from background knowledge and should be checked before they are relied on.

## Open decisions

These need an answer before a proposal is written:

1. **Show-control output.**
   - Should the first phase be Web MIDI only, or ship a local bridge for OSC from the start?
   - Or should Scrim lean on Bitfocus Companion instead of building its own bridge?
2. **Show format v2.** Is it acceptable to move to a canvas → slices → outputs model, with a format version bump and a migration? Blending several projectors into one image requires it.
3. **GPU API.** WebGL2 first (lower risk, universal) or WebGPU first (zero-copy video for several 4K streams)?
4. **Effects.** Should the first version import ISF effects, or ship only a few built-in effects?
