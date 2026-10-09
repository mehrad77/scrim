# Show format

A Scrim show is an open, versioned JSON document. A `.scrim` file bundles it with its media so a show can move between machines and outlive any one version of the app. The source of truth is `packages/format/src/schema.ts`; this page describes it.

## The `.scrim` bundle

A `.scrim` file is a standard zip archive:

| Entry             | Compression | Contents                                          |
| ----------------- | ----------- | ------------------------------------------------- |
| `manifest.json`   | deflate     | The manifest (below). Always the first entry.     |
| `media/<mediaId>` | stored      | One file per entry in `show.media`, byte for byte |

```json
{
  "format": "scrim-bundle",
  "version": 1,
  "exportedAt": 1791470000000,
  "show": { "format": "scrim-show", "version": 1, "...": "..." }
}
```

Readers must:

- reject a manifest whose `format` is not `scrim-bundle`, or whose `version` is newer than they understand;
- validate `show` with `parseShow`, which migrates older show versions first;
- ignore `media/` entries that the show does not list;
- fail if a listed media entry is missing.

`writeBundle` and `readBundle` stream, so bundles larger than memory work. Writing pulls one chunk of media at a time; reading waits for each chunk to be stored before feeding more.

## The show document

```ts
{
  format: 'scrim-show',
  version: 1,
  id, name, createdAt, updatedAt,      // epoch ms
  outputs: Output[],
  media: Media[],
  layers: Layer[],
  scenes: Scene[],
  cues: Cue[],                         // running order: by scene order, then array order
  vars: Var[],                         // "state values" in the UI
  moments: Moment[],                   // audience moments
  triggers: Trigger[],
  rules: Rule[],
  inputs: { keys, midi, gamepad },
  audioBuses: { id, name }[],
  defaultFade?: { duration, easing },  // the fade new show/hide actions start with
}
```

Ids are opaque, non-empty strings, for example `cue_k3f9x2ab`. **References** to other objects (an action's `layerId`, a rule's `triggerId`, a state layer's `varId`, and so on) may be the empty string while the designer has not picked a target yet; the engine skips such actions and reports a warning.

### Output

`{ id, name, width, height, background, safeArea, cornerPin?, guides? }`

- `width` and `height` are the canvas in pixels; every layer on the output is placed in this space.
- `safeArea` is a fraction from 0 to 0.25, used only as an editor guide.
- `cornerPin` lists four pixel offsets — top-left, top-right, bottom-right, bottom-left — for keystone correction.
- `guides` (`{ x: number[], y: number[] }`) are editor ruler guides in output pixels; they are never drawn on the output.

### Media

`{ id, kind: 'image' | 'video' | 'audio' | 'font', name, mime, size, duration?, width?, height? }`

A `font` file (WOFF2, WOFF, TTF or OTF) is registered under its file name without the extension, so text layers can use it on any machine, offline. Older apps can't open shows that contain fonts.

### Layer

Common fields: `id, name, kind, outputId (null for audio), x, y, w, h, z, opacity, visible, crop, parentId?, pin?, locked?`.

- `opacity` is the opacity when shown. `visible` says whether the layer is shown when the show starts.
- `crop` holds fractions from 0 to 1 per edge.
- `parentId` puts the layer inside a frame on the same output. Its `x` and `y` are then relative to the frame, and `z` orders it among the frame's children only. A link that can't hold (the frame is missing, is not a frame, sits on another output or inside the layer itself, or the layer is audio) is ignored: the layer is drawn on the output, and the logic check reports it.
- `pin` (`{ x: left · center · right, y: top · center · bottom }`, default left and top) is the output edge a top-level layer keeps its distance to when the output is resized or the layer moves to another output. A layer that hugs its content grows away from its pin: one pinned right grows to the left. It is ignored inside a frame.
- `locked` (optional) is an editor aid: the canvas can't select or move the layer, or anything inside it. It changes nothing on stage.

| `kind`    | Extra fields                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- |
| `image`   | `mediaId`, `fit` (`contain` · `cover` · `fill`)                                                |
| `video`   | `mediaId`, `fit`, `loop`, `volume`, `bus`                                                      |
| `audio`   | `mediaId`, `loop`, `volume`, `bus` — played by the operator tab; opacity acts as a level       |
| `text`    | `text` (may contain `{{varName}}`), text style                                                 |
| `counter` | `mode` (`countdown` · `countup` · `count`), `start`, `format` (`clock` · `number`), text style |
| `state`   | `varId`, `display` (`value` · `bars` · `list`), text style                                     |
| `frame`   | `fill`, `radius`, `clip`, `layout`                                                             |

A `state` layer shows a value as one line of text (`value`), a vote's or prop's tally as bars (`bars`), or one entry per line, newest last and held to the bottom of a fixed box (`list`). Older apps can't open shows that use `list`.

Text style: `fontSize, color, fontFamily, fontWeight, align, background, sizing?`. `sizing` is `fixed` (the default: a `w` × `h` box), `autoWidth` (one line per line of text, as wide as it needs) or `autoHeight` (`w` wide, as tall as the wrapped text).

**Frames** group layers that move, fade and clear as one. A frame's opacity multiplies into everything inside it, so showing or hiding the frame shows or hides its content, and the content keeps its own opacity for the next time.

- `fill` is a colour behind the content, `radius` rounds its corners, and `clip` cuts the content off at its edge.
- `layout` is `{ mode, gap, padX, padY, align, justify, hugW, hugH }`. In a `free` frame (the default) children sit at their `x` and `y`. In a `row` or `column` frame they line up in list order (front first), with `gap` between them and `padX`/`padY` inside the edge; `align` (`start` · `center` · `end`) places them across the line and `justify` (`start` · `center` · `end` · `between`) along it. `hugW` and `hugH` make a row or column frame grow and shrink with its content.
- On an axis that hugs, `x`/`w` (or `y`/`h`) only fix the edge the layer grows from: the left edge for a left pin, the right edge for a right pin, the middle for a centred one.
- **Fade all** fades what sits on the output, so frames keep their content. **Clear text** and **Clear media** take a frame as one when everything in it is of that kind, and otherwise take just the matching layers inside it.

Older apps can't open shows that contain frames.

### Scene and cue

```ts
Scene { id, name, tape? }
Cue   { id, sceneId, name, actions: Action[], follow: { auto, delay }, notes, tape?, waitFor?, updatedAt }
```

When `follow.auto` is true, the next cue fires `delay` seconds after this one; with a delay of 0 it fires at once, after the rules of the cue before it. One input fires at most 64 cues through zero-second follows and jumps that fire; past that the engine stops the loop, and the rest of that input's actions, and warns. `updatedAt` drives "changed since the last run" in rehearsal. `tape` (1–8) is an optional spike-tape colour that tags a scene, or overrides it for one cue, in the editor and on printed sheets; the operator view never shows it. `waitFor` names a trigger whose performer the cue waits for: while the cue is on standby, that trigger's remotes read "Your cue · tap Ready", and the operator sees when they are ready. It never fires anything by itself.

### Actions

Layer and media actions (`show`, `hide`, `fade`, `play`, `pause`, `seek`, `setText`, `counter`) take an optional `delay` in seconds: they start that long after the cue fires. Hold postpones pending delayed actions; PANIC and Back cancel them.

| `type`                       | Fields                                                        | Effect                                                                      |
| ---------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `show` · `hide`              | `layerId, duration, easing`                                   | Fade to the layer's opacity, or to 0                                        |
| `fade`                       | `layerId, opacity, duration, easing`                          | Fade to a given opacity                                                     |
| `play` · `pause`             | `layerId`, `restart` (play)                                   | Control a video or audio layer                                              |
| `seek`                       | `layerId, time`                                               | Jump media to `time` seconds                                                |
| `setText`                    | `layerId, text`                                               | Replace a text layer's text                                                 |
| `counter`                    | `layerId, op` (`start` · `pause` · `reset` · `add`), `value?` | Control a counter                                                           |
| `setVar` · `addVar`          | `varId, value` · `varId, amount`                              | Change state                                                                |
| `jumpScene` · `goToCue`      | `sceneId` · `cueId`, `fire`                                   | Put a cue on standby, or fire it                                            |
| `openMoment` · `closeMoment` | `momentId`                                                    | Control an audience moment                                                  |
| `stopAll`                    | `duration`                                                    | Fade everything out, cancel earlier cues' delayed actions, then pause media |
| `branch`                     | `if: Condition[], then: Action[], else: Action[]`             | Conditional actions (nestable)                                              |

Easing is one of `linear`, `easeIn`, `easeOut` or `easeInOut`. Durations are in seconds.

### State values

`Var { id, name, type, initial, options? }`

- `name` is an identifier (`[A-Za-z_][A-Za-z0-9_]*`), used in `{{name}}` placeholders. A placeholder shows a vote's result and tally by the options' labels (and a prop's by its variants' labels), not their ids; a list reads `a, b, c`.
- `type` is `number`, `text`, `choice`, `tally` (a record of counts) or `list` (an array of strings).

`Condition { varId, op, value }`, where `op` is one of `eq`, `neq`, `gt`, `gte`, `lt`, `lte` or `contains`. For tallies and lists, `contains` tests membership. Numeric comparisons use the sum of a tally or the length of a list.

### Audience moments

`Moment { id, name, type, prompt, options, min, max, variants, durationSec, resultVarId, tallyVarId, defaultResult, moderated }`

| `type`   | Result (`resultVarId`)                         | Tally (`tallyVarId`)     |
| -------- | ---------------------------------------------- | ------------------------ |
| `vote`   | Winning option id (earliest option wins a tie) | Votes per option         |
| `tap`    | Total taps                                     | —                        |
| `slider` | Average                                        | `{ average, spread, n }` |
| `text`   | Approved entries (a list)                      | —                        |
| `prop`   | Number of phones                               | Phones per variant       |

- A moment with no input closes with `defaultResult`.
- `durationSec: 0` means the operator closes it.
- Live values update while a moment is open, so a tally bar on stage moves as votes arrive.

### Triggers, rules and inputs

```ts
Trigger { id, name, color }
Rule    { id, name, enabled, when, if: Condition[], then: Action[] }
when    = trigger(triggerId) | momentClosed(momentId) | varChanged(varId) | cueFired(cueId) | mediaEnded(layerId)
Command = go | panic | hold | back | standbyNext | standbyPrev | trigger(triggerId) | clearText | clearMedia | mute
inputs  = { keys: {key, command}[], midi: {kind: note|cc, channel|null, number, command}[], gamepad: {button, command}[] }
```

- **Every matching rule runs**, top to bottom in `rules` order. The editor groups rules by `when` and numbers them in that order.
- **`keys[].key` is a physical key**, a `KeyboardEvent.code` such as `Space`, `KeyH` or `BracketLeft`, so a map survives non-US layouts. Shows saved before this store the key's value (`' '`, `h`); those still match the typed character.
- **Esc is always PANIC.** The app adds it at runtime whatever `keys` says; a show can map extra panic keys.
- **PANIC's secondary clears.** `clearText` fades text, counter and live-value layers off stage, and `clearMedia` fades pictures and video (pausing video). Pressed again before the next cue, each brings back what it took. `mute` silences all sound until pressed again; it is separate from the blackout. Older apps can't open shows that map them.
- **`back`** returns to the state before the operator's last GO (one step). Older apps don't know this command, so they can't open shows that map a key to it.

## Versioning

- `version` is the show format version, now 1.
- `parseShow` refuses newer versions and upgrades older ones step by step through `migrations[n]` in `packages/format/src/migrate.ts`.
- Any change that existing documents would fail to parse needs a new version and a migration.
- Adding an optional field, or one with a default, does not.
- `parseShow` keeps fields it doesn't know, at any depth, so a show made with a newer Scrim keeps them when an older app saves it. A new action type, layer kind or enum value still makes older apps refuse the show.
