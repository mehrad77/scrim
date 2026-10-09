# Architecture

Scrim runs a show from one browser tab, the **operator view**. Everything else either renders what that tab decides, or sends it input.

```
                 ┌──────────────────────── show machine ─────────────────────────┐
                 │                                                               │
 MIDI / gamepad ─┤   Operator tab                         Output windows         │
 keyboard ───────┤   ┌─────────────────────┐  Broadcast-  ┌──────────────────┐   │
                 │   │ ShowHost            │  Channel     │ Stage renderer   │   │
                 │   │  ├ Engine (pure)    │ ───────────► │ (DOM/CSS, frame  │   │
                 │   │  ├ audio layers     │ ◄─────────── │  loop for fades) │   │
                 │   │  ├ journal, run log │  beats, keys └──────────────────┘   │
                 │   │  └ relay client     │                                     │
                 │   └──────────┬──────────┘   IndexedDB (shows, versions,       │
                 │              │              journal, runs) · OPFS (media)     │
                 └──────────────┼────────────────────────────────────────────────┘
                                │ WebSocket (optional; never on the critical path)
                     ┌──────────▼───────────┐
                     │ Relay: Worker +       │
                     │ Durable Object / room │
                     └──┬────────┬────────┬──┘
                        │        │        │
               audience phones  performer  remote outputs
                                 remotes   (other devices)
```

## Packages

| Package           | Responsibility                                                                     | Depends on       |
| ----------------- | ---------------------------------------------------------------------------------- | ---------------- |
| `@scrim/format`   | Show schema (zod), defaults, cue ordering, migrations, `.scrim` bundles            | zod, fflate      |
| `@scrim/engine`   | Deterministic show engine: `step(show, state, input, now)`                         | format           |
| `@scrim/protocol` | Message types for the local channel and the relay; zod schemas for untrusted input | format, engine   |
| `@scrim/relay`    | Cloudflare Worker and `Room` Durable Object                                        | protocol         |
| `@scrim/web`      | All browser UI: library, editor, operator, outputs, remotes, audience page         | everything above |

## The engine

`packages/engine/src/reducer.ts` holds one pure function:

```ts
step(show, state, input, now) → { state, events }
```

- **Inputs** are what can happen: `go`, `fireCue`, `standby*`, `jump`, `setOrder`, `hold`, `panic`/`release`, `trigger`, `tick`, audience totals (`momentAgg`), counts from the room (`countVote`), moment control, `mediaEnded`, `setVar`, `seek`, a direct `action`, `back`, the secondary clears, `mute`, `relaxed`, the time of day (`clock`, for opening hours), and `reset`.
- **Access channel.** `access: { captionCue, describeCue, seq, buzz }` is engine state, set when a cue fires, so a jump, Back or a crash resume restores the right caption. The host turns it into an access view for phones (`lib/access.ts`).
- **Relaxed performances.** `relaxed` is a tween like `mute`, so outputs dim and sound eases down over 2 seconds; renderers read it through `relaxedBrightness` and `soundLevel`. While it is on, the reducer lengthens fades to the show's minimum, skips `show`, `play` and `fade` on intense layers (emitting `leftOut`), and fires a cue's `gentle` actions instead of its own. Back and Reset keep it.
- **Opening hours.** The `clock { day, minute, force? }` input sets the show's `schedule` value; it changes state only when the value changes, unless `force` (the first clock after a start or a reset) announces it anyway, so rules always set the scene for the hours the machine wakes into.
- **No free text.** With `safety.noFreeText`, text moments don't open (a warning instead), `reconcile` shuts one already open, and their totals are ignored.
- **Moment totals by source.** A moment keeps totals per source: `relay` (phones and shared tablets, as running totals that replace their own source), `sim` (pretend phones), `buttons` and `counted` (which add). Its result and live values use the sum, and the default is used only when every source is empty.
- **Events** describe what happened: `cueFired`, `momentOpened`/`momentClosed`, `varChanged`, `trigger`, `mediaEnded`, `panic`, `cleared`, `mute`, `relaxed`, `leftOut`, `warning`, and so on.
- **Rules** run after every input on the events it produced. A rule's actions may cause further events, up to 200 per input; past that the engine stops and emits a warning, so a looping rule cannot hang the show.
- **Cues fired at once.** A zero-second auto-follow fires in the same step as the cue before it, after that cue's rules. One input may fire at most 64 cues through jumps that fire and zero-second follows; past that the engine stops the rest of that step's cue and rule actions, names the cues, and warns. The logic check flags such loops in the editor.
- **Rule traces.** Every rule whose `when` matched emits `ruleEvaluated` with whether it ran and each check with the value it saw. Traces never trigger rules and don't count toward the 200.

Time never advances inside the engine. Instead, state stores _when_ things happen:

- **Fades** are tweens: `{from, to, t0, dur, easing}`. Renderers interpolate them on their own frame loop.
- **Media** is a clock: `{playing, position, anchor}`. Its position at time `t` is `position + (t - anchor)`.
- **Counters** are `{running, base, anchor}`.
- **Running order.** Tonight's order (`order: {scenes, skipped}`) is engine state, like standby, so the show never changes when a setlist does, and the journal keeps it. GO, follows and standby next follow it. A jump or standby into a skipped scene brings it back after the live one; what is live can't be skipped; Back and Reset keep the order.
- **Pending things** (auto-follow, moment time-outs, delayed actions and pauses) carry an epoch time. `nextWakeup(state)` says when a `tick` is due, and the `Engine` wrapper schedules exactly one timer for it.

The engine is therefore deterministic and cheap to unit-test, and every window that receives the same state draws the same picture at the same moment.

When a show is edited mid-run, `reconcile(show, state)` adapts the running state: it drops layers, values and moments that were deleted, and adds new ones in their initial state.

Frames are ordinary layers to the engine: each has its own opacity tween, and nothing in the state is nested. `layerTree` (in `@scrim/format`) derives the nesting and repairs broken links, and `effectiveOpacity` multiplies a layer's opacity by its frames'. Fade all fades only top-level layers, so frames keep their content; the secondary clears take a frame as one when everything in it matches.

## The operator tab (`ShowHost`)

An installation runs the same host on the `/kiosk/:id` page (`routes/Kiosk.tsx`): always in Show mode, carrying on from the journal, drawing one output in its own tab from the host's state, opening the others where policy allows, and holding the same Web Lock as the operator view, so staff can take over. See [the installation guide](installation-guide.md).

`apps/web/src/host/ShowHost.ts` owns one `Engine` and wires it to the world:

- **Outputs.** It broadcasts `show` and `state` on the show's BroadcastChannel. It collects heartbeats from output windows; one silent for 2 s is marked _lost_ and offered for reopening.
- **Journal.** It writes engine state to IndexedDB at most every 250 ms, and immediately on GO or panic. Reopening the operator view restores it.
- **Run log.** It records cues, audience results, triggers, the rules that ran (skipped rules fold into one "N skipped" line that says what each saw) and warnings, flushed to IndexedDB every second.
- **Audio.** Audio layers play in the operator tab (`AudioEngine`), so sound comes from the show machine even if every output is remote. Volume follows the layer's opacity, which turns fades into sound fades, the blackout, the sound mute and a relaxed performance's cap (`soundLevel`).
- **Inputs.** Keyboard (also forwarded from output and editor windows), Web MIDI and the Gamepad API all map to commands through the show's `inputs`. A second GO within 300 ms is ignored.
- **Relay** (optional). It sends `state`, the set of open moments, the remote-control view and the access view; it turns relay totals into `momentAgg` inputs, remote triggers into `trigger` inputs and, when the show allows Remote GO, remote GO, Hold and Back into commands. A room that expired is replaced by a new one, except a kept room, which is retried every minute.
- **Clock.** For a show with opening hours it sends the wall-clock time as each minute turns, and again on waking from sleep.
- **Media end.** It schedules `mediaEnded` from known durations, so rules fire even with no local output open.
- **Wake lock and single instance.** It holds a screen wake lock. A Web Lock (`scrim-host-<showId>`) ensures one operator per show per machine; another tab can take over explicitly, and the tab it was taken from stops its host.

React reads a `ShowHost` through `useSyncExternalStore(host.subscribe, host.getSnapshot)`.

## Rendering

`apps/web/src/render/Stage.tsx` draws one output:

- **Placement.** Layers are placed in output pixels and the whole canvas is scaled to fit its container. Optional corner-pin keystone is applied with a CSS `matrix3d` (`render/cornerPin.ts`).
- **Frames.** A frame's content is nested inside its box (`render/box.ts` turns a layer into CSS), so CSS multiplies a frame's opacity into its content, lays out rows and columns with flexbox, and sizes hugging boxes with `max-content`. The DOM renderer is the reference for this layout.
- **Fades.** Opacity and blackout are applied straight to the DOM by a `requestAnimationFrame` loop. A 250 ms timer backs it up for hidden or occluded windows, so React re-renders only when state changes. A layer's visibility is set to hidden or left to inherit, never forced visible, so a hidden frame hides its content. The blackout sits above the highest layer.
- **Media sync.** Video follows the engine's media clock and is re-synced whenever drift exceeds 250 ms. If the browser blocks sound, the video keeps playing muted and the operator is told to click the output once.
- **Preloading.** Every layer is mounted from the start, so media is loaded and decoded before its cue.

The same component draws output windows, operator thumbnails (muted) and the editor canvas (static, with move and resize handles).

## Storage

| What                 | Where                                         | Notes                                                                        |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Show documents       | IndexedDB `scrim/shows`                       | Autosaved 400 ms after an edit                                               |
| Versions             | IndexedDB `scrim/versions`                    | Every 5 min while editing and before restores; last 50 kept                  |
| Journal              | IndexedDB `scrim/journal`                     | One record per show: the live engine state                                   |
| Run logs             | IndexedDB `scrim/runs`                        | One per operator session                                                     |
| Per-machine settings | IndexedDB `scrim/settings`, `localStorage`    | Room keys, audio devices, display assignments, public URL, the song licence  |
| Templates and songs  | IndexedDB `scrim/settings`                    | Saved templates, and the song library every show's song wizard picks from    |
| Media                | Origin Private File System, `media/<mediaId>` | Each window resolves media by id; blob URLs are never shared between windows |

Media files are shared between shows with the same media ids, for example a copy and its original. Deleting a show removes only media that no other show uses.

**Wizards and imports.** The editor's wizards (a song, a photo story, notices, a quiz question, a choice point) are pure builders in `apps/web/src/lib/build/`. Each changes a show the way an edit does and makes only ordinary scenes, cues, layers, values and rules, and each built show passes the logic and flash checks. `lib/merge.ts` imports scenes from another show, with everything their cues use and a new id for each object (media keeps its ids, since a media id names one stored file). It also gives a show made from a template ids of its own.

## The relay

`apps/relay` is a Cloudflare Worker that routes each room code to one `Room` Durable Object:

- **Sockets.** It uses hibernatable WebSockets with a role and client id attached to each socket.
- **Aggregation.** Audience input is folded by `Aggregator` (`apps/relay/src/aggregate.ts`) into running totals per open moment: votes per phone (the last one wins), slider values per phone, taps (rate-limited), text entries (3 per phone), and prop assignments.
- **Totals to the host.** Totals go to the host at most every 200 ms. After a reconnect the host gets a full copy, including every text entry; the engine de-duplicates them.
- **Persistence.** The aggregator, the latest show and state, and the remote view are kept in Durable Object storage, so a room survives hibernation. Rooms expire after 24 hours with no connections.

See [protocol.md](protocol.md) for the messages.

## Reliability rules

These are the properties the code is built to keep; changes should not break them.

1. Nothing on the network is required to keep a loaded show running on the show machine.
2. Output windows keep the last picture if the operator tab disappears. A reloaded output with no operator restores from the journal.
3. Every audience moment has a default result, used when no input arrives.
4. The operator can always override: hold, extend or close moments, force a result, panic.
5. A reload of the operator tab resumes at the same cue, with the same state and the audience room.
