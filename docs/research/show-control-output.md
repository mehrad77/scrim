# Research: show-control output

**Question:** how should a Scrim cue drive other gear (a lighting console, QLab, other media servers) the way professional show-control tools do, given that Scrim runs in a browser?

**Status:** research only, as of October 2026. Items marked _(unverified)_ come from background knowledge and were not checked against a live source.

## Summary

- **In theatre, show control sends cue triggers, not lighting levels.** The console owns the looks and fade timings, so Scrim should send "fire cue 5", not DMX.
- **Two protocols cover nearly every target:**
  - **MIDI Show Control (MSC)** is old but understood by almost every console and by QLab.
  - **OSC** is what modern rigs use.
- **What the browser can do:**
  - **Web MIDI** (Chrome, Edge, Firefox) can send MIDI and MSC with no extra software. The OS's network MIDI (rtpMIDI) and virtual ports extend its reach to consoles on Ethernet and to QLab on the same Mac.
  - **OSC, Art-Net and sACN** use UDP or TCP sockets, which browsers cannot open. They need a small local helper app (a "bridge"), or an existing hub such as Bitfocus Companion.
  - **Chrome now prompts** before a public HTTPS page can talk to `localhost` or the local network: fetch since Chrome 142, WebSockets since 147. Any bridge has to deal with this prompt.
- **Safety is mostly about not sending twice.**
  - Only the operator tab sends.
  - Nothing is re-sent when state is replayed: crash resume, live edits, version restore, preview.
  - Panic does not black out the lights unless the designer asks it to.

## 1. MIDI Show Control (MSC)

MSC is a MIDI system-exclusive (sysex) message defined by the MIDI Manufacturers Association (MSC 1.1, RP-002/RP-014).

```
F0 7F <device_id> 02 <command_format> <command> <data…> F7
```

- `7F` is "Universal Real Time" and `02` is the MSC sub-ID.
- **Device ID:**
  - `00`–`6F` address individual devices.
  - `70`–`7E` address groups.
  - `7F` is all-call, which every device answers.

### Command formats (selection)

| Code      | Target                                                        |
| --------- | ------------------------------------------------------------- |
| `01`      | Lighting (general); `02` moving lights, `03` colour changers… |
| `10`      | Sound (general); `11` music, `17` effects…                    |
| `20`–`2A` | Machinery: rigging, flys, lifts, turntables…                  |
| `30`      | Video (general); `34` video switcher…                         |
| `40`      | Projection; `43` video projector, `45` shutter…               |
| `50`–`58` | Process control, fog, smoke, haze                             |
| `60`      | Pyro                                                          |
| `7F`      | All types                                                     |

### Commands

| Code      | Command                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| `01`      | GO                                                                                        |
| `02`      | STOP                                                                                      |
| `03`      | RESUME                                                                                    |
| `04`      | TIMED_GO                                                                                  |
| `05`      | LOAD                                                                                      |
| `06`      | SET (control value)                                                                       |
| `07`      | FIRE (macro)                                                                              |
| `08`      | ALL_OFF                                                                                   |
| `09`      | RESTORE                                                                                   |
| `0A`      | RESET                                                                                     |
| `0B`      | GO_OFF                                                                                    |
| `10`–`1E` | GO/JAM_CLOCK, STANDBY±, SEQUENCE±, clock control, MTC chase, open/close cue list and path |

### Cue numbers

- **Encoding:** cue numbers are ASCII digits with `2E` for the decimal point.
- **Separators:** `00` separates the cue number from the cue list, and the list from the cue path.
- **Defaults:** all three are optional. GO with no number means "the next cue".

| Message                                  | Bytes                                 |
| ---------------------------------------- | ------------------------------------- |
| GO cue 1.5 in list 1, lighting, device 1 | `F0 7F 01 02 01 01 31 2E 35 00 31 F7` |
| STOP, all lighting devices               | `F0 7F 7F 02 01 02 F7`                |
| GO next cue, sound, all-call             | `F0 7F 7F 02 10 01 F7`                |

### Who accepts it

- **QLab** sends and receives MSC.
- **MSC input** is supported on:
  - ETC Eos, with a configurable device ID;
  - grandMA2/3;
  - ChamSys MagicQ.
- Which commands each console supports varies by model and software version _(unverified)_.
- MSC is now the "works with everything" fallback. New installations mostly use OSC, which is easier to read, runs over Ethernet and can reply.

## 2. OSC

**Transport:**

- OSC 1.0 sends one packet per UDP datagram.
- Over TCP, OSC needs framing:
  - **length-prefixed** (a 4-byte size before each packet), as in OSC 1.0 practice;
  - or **SLIP**, as recommended by OSC 1.1.
- The two OSC versions are compatible in practice.

### ETC Eos

| Item         | Value                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------- |
| Enable       | ECU › Settings › Network › Interface Protocols › **UDP Strings & OSC**                      |
| TCP          | Port 3032 (OSC 1.0, length-prefixed). Port 3037 (OSC 1.1 SLIP, "Third Party OSC", Eos 3.1+) |
| UDP          | Ports set in Setup › Show Control › OSC; ETC suggests 4703–4727 or 8000/8001                |
| Fire a cue   | `/eos/cue/<list>/<cue>/fire`, e.g. `/eos/cue/1/5/fire`                                      |
| Keys         | `/eos/key/go_0`, `/eos/key/stop` _(unverified)_                                             |
| Command line | `/eos/newcmd "Cue 5 Go#"` _(unverified)_                                                    |
| Heartbeat    | `/eos/ping`; the console echoes it back _(unverified)_                                      |
| Status       | `/eos/subscribe` for feedback _(unverified)_                                                |

ETC prefers TCP for OSC because it is reliable and can carry replies.

### QLab

| Item     | Value                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Port     | 53000 (UDP and TCP). TCP uses SLIP framing; replies come back on TCP, or on UDP 53001 when enabled _(unverified)_ |
| Commands | `/go`, `/panic`, `/cue/<number>/start`, `/cue/<number>/stop`, `/cue_id/<uuid>/start`, `/workspace/<id>/go`        |
| Passcode | If the workspace has an OSC passcode, send `/workspace/<id>/connect "<passcode>"` first _(unverified)_            |
| Replies  | JSON strings under `/reply/…`                                                                                     |

### Others

- **grandMA3:** OSC is enabled in settings. The generic route is a command string, e.g. `/cmd "Go+ Sequence 1"` _(unverified)_.
- **ChamSys MagicQ:** playback addresses such as `/pb/1/go` _(unverified)_.
- **Millumin, Resolume, TouchDesigner, Isadora:** native OSC in and out. Resolume also has a REST/WebSocket API.

## 3. Art-Net and sACN (sending DMX directly)

These protocols carry lighting **levels**, not cue triggers.

- **When to use them:** when the show-control software _is_ the lighting source, as with a media server, pixel mapping, or a small show with no console.
- **When not to:** in a theatre with a lighting console, sending DMX alongside it fights the console.

| Protocol          | Transport                               | Notes                                                                                                                                                                                                                                                                           |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Art-Net 4         | UDP 6454, `ArtDmx` opcode `0x5000`      | Up to 32,768 universes of 512 channels. About 44 Hz at most. Sends again every ~4 s even if nothing changed.                                                                                                                                                                    |
| sACN (ANSI E1.31) | UDP 5568, multicast `239.255.<hi>.<lo>` | Each source has a priority from 0 to 200 (default 100), and the receiver follows the highest. Same-priority sources are merged, keeping either the highest value or the latest. A receiver drops a source after ~2.5 s of silence. Per-channel priority uses start code `0xDD`. |

Merging is a receiver setting. Neither protocol can be sent from a browser without a bridge.

## 4. Web MIDI in practice

| Topic            | Detail                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Support          | Chrome 43+, Edge 79+ and Firefox 108+. **Not Safari** (WebKit bug 107250 is still open). Needs a secure context (HTTPS or localhost).                                                                                                          |
| Permission       | `navigator.requestMIDIAccess()` prompts in Chrome and Firefox. `requestMIDIAccess({ sysex: true })` asks for a further permission, which **MSC needs**. Scrim's MIDI _input_ currently requests without sysex (`apps/web/src/host/inputs.ts`). |
| Hot-plug         | `access.onstatechange` fires on connect and disconnect. Ports should be re-found by name: ids are not guaranteed stable between sessions, and names change between machines.                                                                   |
| Timing           | `output.send(bytes, timestamp)` schedules against `performance.now()`. Real latency comes from the OS driver, so don't promise tight sync.                                                                                                     |
| Same machine     | macOS: IAC Driver (Audio MIDI Setup). Windows: loopMIDI. Linux: ALSA virtual ports. This is how Scrim reaches QLab running on the show machine.                                                                                                |
| Over the network | rtpMIDI (Apple Network MIDI on macOS, Tobias Erichsen's rtpMIDI on Windows) appears as an ordinary MIDI port, so the browser can reach consoles over Ethernet with no extra code.                                                              |
| Timecode         | MIDI Timecode (MTC) out is possible, but browser timers make it jittery. Linear Timecode (LTC) is an audio signal. Industry practice is to let the receiving device chase timecode, not the show-control tool.                                 |

## 5. USB DMX (Web Serial, WebUSB)

- **Web Serial** is Chrome/Edge desktop only. The user picks the port in a chooser.
- **Enttec DMX USB Pro** works well from a browser. The device generates DMX timing itself, and a frame is `7E 06 <len_lsb> <len_msb> 00 <up to 512 bytes> E7`.
- **Enttec Open DMX** (bare FTDI chip) does not. The host must generate the DMX break timing at 250 kbaud, and JavaScript timers are too jittery: expect flicker.
- **WebUSB** cannot claim a device the OS driver already holds, such as FTDI on macOS and Windows, so it is a poor fit.

## 6. How comparable products solve it

| Product                    | Outbound control                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **QLab**                   | MIDI cues (note, CC, program change, MSC), Network cues (OSC, UDP, TCP; lighting in v5). Each cue sends through a named **patch**, so cues say _what_ and patches say _where_.                                                                                  |
| **Bitfocus Companion**     | Local Node app with a web UI and hundreds of device **modules** (Eos, QLab, grandMA, ATEM…). Each module offers ready-made actions, status feedback and variables. Its HTTP API: `POST /api/location/<page>/<row>/<col>/press`, plus `/down`, `/up` and rotate. |
| **Chataigne**              | Desktop mapping hub for OSC, MIDI, DMX and serial, popular for scripting.                                                                                                                                                                                       |
| **SCS (Show Cue Systems)** | Native Windows app with MIDI, MSC and DMX out.                                                                                                                                                                                                                  |
| **Watchout / disguise**    | TCP command port (Watchout). OSC and an API (disguise).                                                                                                                                                                                                         |
| **osc-js, node-osc**       | Small Node libraries. osc-js has a WebSocket↔UDP bridge plugin: the usual way a browser app reaches OSC.                                                                                                                                                        |

Patterns operators expect:

- **Send test:** a button on every message.
- **Log:** a list of everything that was sent, with time.
- **Learn mode:** for MIDI input.
- **Device templates:** pick "Eos" or "QLab", fill in a cue number, and the template builds the address and arguments.
- **No acknowledgement**, apart from OSC over TCP (QLab replies, Eos ping). Most messages are fire-and-forget, so the tool shows "last sent" and, where possible, "last reply".

## 7. The bridge problem

A browser page cannot open UDP or TCP sockets, so OSC, Art-Net and sACN need something on the show machine. The options:

| Option                          | For                                                                                              | Against                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Web MIDI only**               | No install. Reaches consoles (rtpMIDI) and QLab (IAC) already.                                   | No OSC, so no replies or heartbeats. Needs MIDI routing set up in the OS. No Safari.                                |
| **Own bridge** (`scrim-bridge`) | Full control: OSC over UDP/TCP/SLIP, heartbeats, Art-Net/sACN later. Same protocol as the relay. | A native app to build, sign (macOS notarisation) and support.                                                       |
| **Bitfocus Companion**          | Hundreds of device modules already exist, and many venues already run it.                        | Scrim only presses buttons, so cues are wired twice (Scrim → Companion button → device). Another app on show night. |

Chrome's **Local Network Access** permission applies to every option that talks to a local server ([Chrome blog](https://developer.chrome.com/blog/local-network-access)):

- **Scope:** a page served from a public HTTPS origin needs the user's permission before it reaches a loopback (`localhost`, `127.0.0.1`, `::1`) or private-network address.
- **Timeline:**
  - Enforced for fetch and XHR since **Chrome 142** (October 2025).
  - Enforced for **WebSockets since Chrome 147** (April 2026).
- **Scope of browsers:** Chrome, Edge and every other Chromium browser.
- **Consequence:** the pre-show check must confirm the permission was granted before doors.

**Bridge security, whichever bridge is used:**

- listen on `127.0.0.1` only;
- accept the WebSocket upgrade only from allowed `Origin`s;
- require a one-time pairing token shown by the bridge;
- never open a raw "send anything anywhere" endpoint to the network.

## 8. Safety and reliability rules

1. **Only the operator tab sends.** Output windows, the editor, remotes and audience phones never send to devices.
2. **Never re-send on replay.**
   - Scrim restores and re-derives state in several places:
     - crash resume from the journal;
     - `reconcile` after live edits;
     - version restore;
     - editor preview (`settle`).
   - None of them may emit messages. Sending must be a side effect of _events_ (like `cueFired`), never of _state_.
3. **Prefer absolute commands.** "Fire cue 5" is safe to repeat; "Go" (next) and toggles are not.
4. **No double-sends.** Give each emission an id (run id, sequence) so a retry or a duplicate tab cannot send twice. Scrim's Web Lock (one operator per show per machine) and the 300 ms double-GO guard already help.
5. **Arm / dry run.** In rehearsal, log messages without sending them unless the operator arms outputs for that session. Show mode is armed.
6. **Panic does not kill the lights by default.** A blackout of house or work lights can be dangerous. Offer an explicit, opt-in "on panic, send…" list per device.
7. **Health is visible.**
   - Each device shows connected, last sent and last reply.
   - Heartbeats run where the protocol allows (Eos ping, QLab replies, TCP state).
   - The pre-show check fails if a device the show uses is missing.
8. **Log everything sent** into the run log, so a missed lighting cue can be traced after the show.

## 9. How it would fit Scrim

- **Engine:**
  - Add an action such as `{ type: 'send', deviceId, message }`.
  - The pure engine emits an `outbound` event for it. It works inside `branch` and rules like any other action.
- **Delivery:**
  - `ShowHost` turns those events into messages and delivers them through a transport per device (Web MIDI now, the bridge later), the same way it drives `AudioEngine` today.
  - Because sending hangs off events and not state, rule 2 above follows from the design.
- **Devices:**
  - Named per show (e.g. "Lighting console", "QLab") with a template (MSC lighting, Eos OSC, QLab OSC, raw MIDI).
  - Bound **per machine** to an actual MIDI port or bridge target, like audio buses and display assignments today.
- **Input:** OSC arriving through a bridge can map to Scrim commands and triggers, reusing the existing `inputs` mapping (keys, MIDI, gamepad).
- **Format:** adding devices and the `send` action is additive, so it fits format v1 with defaults, no version bump.

## 10. Recommendation

1. **Phase 1, Web MIDI output.**
   - `send` action; devices with per-machine port binding.
   - Message builders for note, CC, program change and MSC (with sysex permission).
   - Send-test, an outgoing log in the run log, arm/dry run, and pre-show checks.
2. **Phase 2, OSC through a bridge.**
   - Decide between our own `scrim-bridge` and Bitfocus Companion.
   - Eos and QLab templates with heartbeats; OSC input mapped to triggers.
3. **Later, on demand:** Art-Net/sACN through the bridge, and Enttec DMX USB Pro over Web Serial.

## Sources

- MIDI Show Control 1.1: [midi.org/specifications](https://midi.org/specifications)
- OSC 1.0 specification: [opensoundcontrol.stanford.edu](https://opensoundcontrol.stanford.edu/spec-1_0.html)
- ETC, Eos OSC setup: [etcconnect.com](https://www.etcconnect.com/WebDocs/Controls/EosFamilyOnlineHelp/en/Content/23_Show_Control/08_OSC/Using_OSC_with_Eos/Eos_OSC_Setup.htm)
- ETC, TCP port for OSC: [support.etcconnect.com](https://support.etcconnect.com/ETC/Consoles/Eos_Family/Software_and_Programming/TCP_port_for_OSC_communication_with_Eos_Software)
- ETC community, triggering Eos from QLab over OSC: [community.etcconnect.com](https://community.etcconnect.com/control_consoles/eos-family-consoles/f/eos-family-show-control-support-midi-smpte-osc-rtc-etc/17655/guide-to-triggering-eos-via-osc-from-qlab/81166)
- QLab documentation: [qlab.app/docs](https://qlab.app/docs/)
- Art-Net 4: [art-net.org.uk](https://art-net.org.uk); sACN (ANSI E1.31): [tsp.esta.org](https://tsp.esta.org)
- Web MIDI API: [webaudio.github.io/web-midi-api](https://webaudio.github.io/web-midi-api/)
- Chrome, MIDI permission prompt: [developer.chrome.com](https://developer.chrome.com/blog/web-midi-permission-prompt)
- WebKit Web MIDI bug: [webkit.org/b/107250](https://webkit.org/b/107250)
- Web Serial: [wicg.github.io/serial](https://wicg.github.io/serial/)
- Chrome, Local Network Access: [developer.chrome.com](https://developer.chrome.com/blog/local-network-access)
- LNA and WebSockets in Chrome 147: [localtonet.com](https://localtonet.com/blog/chrome-local-network-access-apis-websockets)
- Bitfocus Companion HTTP remote control: [companion.free](https://companion.free/user-guide/remote_control/http_remote_control)
- osc-js: [github.com/adzialocha/osc-js](https://github.com/adzialocha/osc-js)
- Chataigne: [benjamin.kuperberg.fr/chataigne](https://benjamin.kuperberg.fr/chataigne)
