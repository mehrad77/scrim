# Protocol

Two transports carry the same ideas: the operator tab is authoritative and broadcasts state; everything else sends input. Types live in `packages/protocol/src`.

## Same machine: BroadcastChannel

- **Channel:** `scrim:<showId>`.
- **Envelope:** every message carries `v` (the protocol version, now 1); messages with another `v` are ignored.

### Operator → windows

| `t`        | Fields                     | When                                                       |
| ---------- | -------------------------- | ---------------------------------------------------------- |
| `show`     | `show`                     | On start, on every `hello`, after edits                    |
| `state`    | `seq, state, mode, offset` | After every engine change; `mode` is `rehearsal` or `show` |
| `beat`     | `hostId`                   | Every 500 ms                                               |
| `identify` | `outputId \| null`         | Operator pressed Identify                                  |
| `closing`  | `hostId`                   | The operator tab is closing                                |

### Windows → operator

| `t`            | Fields                                        | Sent by                                                       |
| -------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `hello`        | `clientId, role (output \| editor), outputId` | On open                                                       |
| `outputBeat`   | `clientId, outputId, status`                  | Output windows, every 500 ms                                  |
| `mediaEnded`   | `layerId`                                     | Output window, when a non-looping video ends                  |
| `audioBlocked` | `outputId`                                    | Output window, when sound needs a click                       |
| `key`          | `key`                                         | Output windows (all keys), editor (Escape)                    |
| `showSaved`    | `show`                                        | Editor, after each autosave, so a running show picks up edits |
| `bye`          | `clientId`                                    | On close                                                      |

`status` is `{ fullscreen, width, height, screen, errors }`. An output with no beat for 2 s is reported as lost.

## Across devices: the relay

### HTTP

| Request                                         | Response                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /api/rooms`                               | `{ code, hostKey, deviceKey }`; `code` is five characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` |
| `GET /api/rooms/:code`                          | `{ exists, title }`                                                                              |
| `GET /api/rooms/:code/ws?role=…&client=…&key=…` | WebSocket upgrade                                                                                |
| `GET /health`                                   | `ok`                                                                                             |

### Roles and keys

| `role`     | `key`       | Purpose                                                       |
| ---------- | ----------- | ------------------------------------------------------------- |
| `host`     | `hostKey`   | The operator tab. A new host connection replaces the old one. |
| `output`   | `deviceKey` | A remote output on another device                             |
| `remote`   | `deviceKey` | A performer remote                                            |
| `audience` | none        | Audience phones; the room code is enough                      |

`client` is a stable id per device (6–40 characters from `[A-Za-z0-9_-]`). Audience phones keep theirs in `localStorage`, so votes survive a reload.

### Host → relay

| `t`          | Fields                                                    |
| ------------ | --------------------------------------------------------- |
| `show`       | `show` (forwarded to remote outputs)                      |
| `state`      | `state, mode, offset` (forwarded to remote outputs)       |
| `moments`    | `title, open: MomentSpec[]`: the full set of open moments |
| `remoteView` | `view: { showName, triggers, standby, lastFired }`        |
| `ping`       | `c` (client time)                                         |

### Relay → host

| `t`                         | Fields                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `welcome`                   | `code`                                                                                  |
| `totals`                    | `totals: MomentTotals[]`: changed moments, at most every 200 ms; all of them on connect |
| `presence`                  | `{ audience, remotes, outputs }`                                                        |
| `trigger`                   | `triggerId, from`                                                                       |
| `outputBeat` · `outputGone` | Remote output status                                                                    |
| `pong`                      | `c, s` (server time)                                                                    |
| `error`                     | `message`                                                                               |

`MomentTotals` is `{ momentId, tally, count, sum, sumSq, n, entries }`. `entries` holds the text entries not yet sent to this host connection.

### Audience, remote, output → relay

These messages are untrusted and validated with zod.

| Role     | `t`          | Fields                         | Limits                                                  |
| -------- | ------------ | ------------------------------ | ------------------------------------------------------- |
| audience | `vote`       | `momentId, optionId`           | The latest vote per phone counts                        |
| audience | `tap`        | `momentId, count` (1–50)       | 15 taps per second per phone                            |
| audience | `slider`     | `momentId, value`              | Clamped to the moment's range                           |
| audience | `text`       | `momentId, text` (1–280 chars) | 3 entries per phone per moment                          |
| remote   | `trigger`    | `triggerId`                    | Answered with `ack`, or `error` if no host is connected |
| output   | `outputBeat` | `outputId, status`             | —                                                       |
| all      | `ping`       | `c`                            | —                                                       |

Every non-host socket is limited to 30 messages per second and 4 KB per message. Input for a moment that is closed, past its `closesAt`, or of the wrong type is dropped.

### Relay → audience, remote, output

| Role     | `t`             | Fields                                                                      |
| -------- | --------------- | --------------------------------------------------------------------------- |
| audience | `view`          | `title, moments: PublicMoment[]`; each phone sees only its own prop variant |
| remote   | `remoteView`    | `view` plus `connected`                                                     |
| remote   | `ack`           | `triggerId`                                                                 |
| output   | `show`, `state` | As sent by the host                                                         |
| output   | `hostGone`      | The host disconnected; keep the last picture                                |

### Clocks

Clients estimate `offset = serverTime - localTime` from the lowest-latency of their last 10 pings.

- The host sends its own offset with `state`. A remote output converts the operator's engine times to its own clock with `local = serverNow - hostOffset`.
- `closesAt` in a `MomentSpec` is already in server time.

### Close codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 4400 | Bad request (unknown role)               |
| 4401 | Wrong key                                |
| 4404 | No such room (expired or never created)  |
| 4409 | Room full (`MAX_AUDIENCE`, default 2000) |
| 4410 | Replaced by another host connection      |

Rooms expire after 24 hours with no connections. A host that gets 4401 or 4404 opens a new room automatically.
