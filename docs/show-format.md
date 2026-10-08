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
}
```

Ids are opaque, non-empty strings, for example `cue_k3f9x2ab`. **References** to other objects (an action's `layerId`, a rule's `triggerId`, a state layer's `varId`, and so on) may be the empty string while the designer has not picked a target yet; the engine skips such actions and reports a warning.

### Output

`{ id, name, width, height, background, safeArea, cornerPin? }`

- `width` and `height` are the canvas in pixels; every layer on the output is placed in this space.
- `safeArea` is a fraction from 0 to 0.25, used only as an editor guide.
- `cornerPin` lists four pixel offsets — top-left, top-right, bottom-right, bottom-left — for keystone correction.

### Media

`{ id, kind: 'image' | 'video' | 'audio', name, mime, size, duration?, width?, height? }`

### Layer

Common fields: `id, name, kind, outputId (null for audio), x, y, w, h, z, opacity, visible, crop`.

- `opacity` is the opacity when shown. `visible` says whether the layer is shown when the show starts.
- `crop` holds fractions from 0 to 1 per edge.

| `kind`    | Extra fields                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- |
| `image`   | `mediaId`, `fit` (`contain` · `cover` · `fill`)                                                |
| `video`   | `mediaId`, `fit`, `loop`, `volume`, `bus`                                                      |
| `audio`   | `mediaId`, `loop`, `volume`, `bus` — played by the operator tab; opacity acts as a level       |
| `text`    | `text` (may contain `{{varName}}`), text style                                                 |
| `counter` | `mode` (`countdown` · `countup` · `count`), `start`, `format` (`clock` · `number`), text style |
| `state`   | `varId`, `display` (`value` · `bars`), text style                                              |

Text style: `fontSize, color, fontFamily, fontWeight, align, background`.

### Scene and cue

```ts
Scene { id, name }
Cue   { id, sceneId, name, actions: Action[], follow: { auto, delay }, notes, updatedAt }
```

When `follow.auto` is true, the next cue fires `delay` seconds after this one. `updatedAt` drives "changed since the last run" in rehearsal.

### Actions

| `type`                       | Fields                                                        | Effect                                |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `show` · `hide`              | `layerId, duration, easing`                                   | Fade to the layer's opacity, or to 0  |
| `fade`                       | `layerId, opacity, duration, easing`                          | Fade to a given opacity               |
| `play` · `pause`             | `layerId`, `restart` (play)                                   | Control a video or audio layer        |
| `seek`                       | `layerId, time`                                               | Jump media to `time` seconds          |
| `setText`                    | `layerId, text`                                               | Replace a text layer's text           |
| `counter`                    | `layerId, op` (`start` · `pause` · `reset` · `add`), `value?` | Control a counter                     |
| `setVar` · `addVar`          | `varId, value` · `varId, amount`                              | Change state                          |
| `jumpScene` · `goToCue`      | `sceneId` · `cueId`, `fire`                                   | Put a cue on standby, or fire it      |
| `openMoment` · `closeMoment` | `momentId`                                                    | Control an audience moment            |
| `stopAll`                    | `duration`                                                    | Fade everything out, then pause media |
| `branch`                     | `if: Condition[], then: Action[], else: Action[]`             | Conditional actions (nestable)        |

Easing is one of `linear`, `easeIn`, `easeOut` or `easeInOut`. Durations are in seconds.

### State values

`Var { id, name, type, initial, options? }`

- `name` is an identifier (`[A-Za-z_][A-Za-z0-9_]*`), used in `{{name}}` placeholders.
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
Command = go | panic | hold | standbyNext | standbyPrev | trigger(triggerId)
inputs  = { keys: {key, command}[], midi: {kind: note|cc, channel|null, number, command}[], gamepad: {button, command}[] }
```

## Versioning

- `version` is the show format version, now 1.
- `parseShow` refuses newer versions and upgrades older ones step by step through `migrations[n]` in `packages/format/src/migrate.ts`.
- Any change that existing documents would fail to parse needs a new version and a migration.
- Adding an optional field, or one with a default, does not.
