# Scrim

Browser-native show control and projection for interactive theater. Open a link, build a show, press GO.

Scrim drives one or more clean, full-screen audience outputs from an operator view. Shows are cue lists that read and change shared **show state**, so audience votes, performer triggers and MIDI pedals are first-class. Once loaded, a show runs offline on the show machine; the network only adds the people in the room.

## What's here

| Path                | What it is                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/format`   | The open show format: zod schema, migrations, and the `.scrim` bundle (zip of `manifest.json` + `media/<id>`), streamed with fflate.                           |
| `packages/engine`   | The show engine: a pure, deterministic reducer over cues, scenes, rules, state, audience moments, fades and media clocks. No DOM.                              |
| `packages/protocol` | Versioned messages between the operator, output windows (BroadcastChannel) and the relay (WebSocket).                                                          |
| `apps/web`          | The app (Vite + React + Tailwind): show library, editor, operator view, output windows, performer remote, remote outputs, audience page.                       |
| `apps/relay`        | Realtime relay: a Cloudflare Worker with one Durable Object per room. Folds audience input into totals so the show machine gets a few small messages a second. |
| `tools/loadtest`    | Simulated audience: opens a room, joins N phones, runs vote rounds and reports vote → host latency.                                                            |

## Run it

Requirements: Node 24+, pnpm 11, and Chrome or Edge on the show machine. Audience and remote pages work in any modern browser.

```bash
pnpm install
```

```bash
pnpm dev:relay
```

```bash
pnpm dev
```

Open http://localhost:5173 and choose **Demo show** for a ten-minute interactive piece with a vote, a branch and a performer trigger.

For phones on the venue network, open the app by this machine's LAN address (for example `http://192.168.1.20:5173`), or set that address in the operator view's audience panel. In development the relay is reached on the same host at port 8790; set `VITE_RELAY_URL` to point the app elsewhere.

### Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm e2e
```

```bash
pnpm loadtest -- --phones 200 --rounds 3
```

The load test needs the relay running. The MVP target is p95 vote → stage under 1 s; locally it measures about 200 ms, most of which is the relay's 200 ms batching window.

## Running a show

1. **Design** in the editor: place media and text on each output's canvas, build cues in scenes, define state values, audience moments, triggers and "when / if / then" rules. The stage preview shows the picture after any cue, without a projector.
2. **Rehearse** in the operator view: click a cue to put it on standby, double-click to fire it, scrub media, override state values. Edits made in the editor apply live, and cues changed since the last run are marked.
3. **Go live**: press _Go live: open all_ once. With the Window Management permission, each output opens full screen on its assigned display; otherwise click each output window once. Then run the **Pre-show check** until it says READY, and switch to **Show mode** (editing locked).
4. **Perform**: GO (Space by default), Hold, and PANIC (Esc) work from the operator view and from any output window; PANIC also works from the editor. GO ignores a second press within 300 ms, so a bounced key or pedal can't skip a cue. See the [operator guide](docs/operator-guide.md) for the full show-night runbook.

### When something goes wrong

- **The operator tab reloads or crashes**: the show position and state are journaled continuously. Reopening resumes at the same cue, outputs reconnect, and the audience room reopens by itself.
- **An output window closes**: the operator view flags it at once, with _Reopen_.
- **The network drops**: local outputs keep running. Remotes and phones reconnect automatically and get the current state. Audience moments that receive no input close with their designed default.
- **After the show**: the run log (History tab) lists every cue, audience result and warning.

## Remote outputs

An output can also live on another device: copy its link from the operator view and open it there. Media never crosses the network. The remote device imports the show's `.scrim` file once and then follows the operator through the relay, with clock-offset correction.

## Hardware guidance

- Show machine: a recent Chrome or Edge on a mid-range laptop or mini PC. Target 1080p at 60 fps per output, and prefer H.264 MP4 or WebM for video.
- Keep the operator tab visible. The screen wake lock holds only while it is. Turn on Do Not Disturb and disable sleep on battery.
- Audience Wi-Fi: for more than about 50 phones, bring a dedicated router. Every moment has a default result, so the show goes on regardless.
- Choose an audio device per bus under _Outputs & audio_. The choice is per machine, not saved in the show.

## Deploy

- Relay: `pnpm --filter @scrim/relay deploy` (Cloudflare Workers with Durable Objects). Set `ALLOWED_ORIGINS` in `wrangler.toml` to the app's origin.
- App: `pnpm build`, then serve `apps/web/dist` as a static site with SPA fallback (for example Cloudflare Pages). Set `VITE_RELAY_URL` to the relay's URL at build time.

## Documentation

| Document                                         | For                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)     | How the engine, operator tab, renderer, storage and relay fit together, and the reliability rules changes must keep |
| [docs/show-format.md](docs/show-format.md)       | The open show document and the `.scrim` bundle: every field, action and moment type, and how versions migrate       |
| [docs/protocol.md](docs/protocol.md)             | BroadcastChannel and relay messages, roles and keys, limits, clock sync, close codes                                |
| [docs/operator-guide.md](docs/operator-guide.md) | Show-night runbook: before doors, during the show, when something goes wrong                                        |
| [docs/research/](docs/research/README.md)        | Background research for planned features: show-control output, GPU compositor                                       |

## Contributing

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(engine): …`, `fix(web): …`).
- Behavior lives in the engine whenever it can. Add a test in `packages/engine/src/engine.test.ts` alongside the change.
- A schema change that existing shows would fail to parse needs a format version bump and a migration (see [docs/show-format.md](docs/show-format.md#versioning)).
- Before pushing, run `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e`.
