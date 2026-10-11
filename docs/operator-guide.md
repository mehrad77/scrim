# Operator guide

A runbook for the stage manager or operator running a show in Scrim.

## Before the day

- [ ] Use Chrome or Edge on the show machine and keep it updated before tech week, not during the run.
- [ ] Open [scrim.shab.boo](https://scrim.shab.boo) once while online, so the app is cached for offline use.
- [ ] In the library, choose **Keep my shows** so the browser will not clear storage.
- [ ] Export a `.scrim` backup to a USB stick. It is the master copy if the machine fails.
- [ ] For screens on other devices: import the same `.scrim` file on each device once.
- [ ] For more than about 50 audience phones, bring a dedicated Wi-Fi router.
- [ ] For a show that runs with nobody at the desk (a museum piece, a lobby loop), follow the [installation guide](installation-guide.md) instead.

## Before doors open

1. Open the show and choose **Run show**. If the show was interrupted, the operator view says so and resumes where it left off; choose **Start from the top** for a fresh run.
2. Choose **Go live: open all**. The first time, allow window management so each output opens full screen on its own display. Use **Detect displays** and assign each output to a display; Scrim remembers the assignment on this machine.
3. If an output says _Not full screen_ or _Click output once for sound_, click that output window once.
4. Press **Identify** to flash each output's name on its screen.
5. For audience or performer moments, choose **Open audience room**. Project or print the audience QR code, and give performers the performer QR code. Scan both with a phone to test.
6. Map pedals, presenter clickers or MIDI pads: choose **Map keys** (the keyboard button in the header), pick GO, Hold, Back, standby, PANIC or a trigger, then press the key or pad. If it already does something else, choose **Replace**, **Swap** or **Cancel**. **Preset** offers Scrim and QLab-style keys. Esc is always PANIC.
7. If the show has captions or translations, tell front of house about the phone's **Access** menu (captions, language, text size, audio description), and check the open captions on stage.
8. Open **Pre-show check** and work down the list until it says **READY**. It includes the show's logic check: unhandled vote options, scenes nothing leads to, and anything pointing at a deleted item. A flash check flags any cue that flashes an output more than three times a second (a design aid, not a certified test: it reads cue timings, not what plays inside video). If the show has a relaxed version, confirm whether tonight is relaxed.
9. Switch to **Show** mode (the lock in the header). Editing, panel layouts, the palette and help sheets are locked away in every window, and nothing animates. Leaving Show mode takes a one-second hold on **Hold to unlock**.

## During the show

| Do this                              | How                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fire the next cue                    | **GO** or Space (also from an output window). A second press within 0.3 s is ignored, and GO's ring flashes so you know. If the show asks for a hold, keep GO (or its key or pedal) down for the time shown on the button; a shorter press doesn't fire, and the message strip says so.                      |
| Undo the last GO                     | **Back** (B with the Scrim keys): the stage returns to just before that GO, one step.                                                                                                                                                                                                                        |
| Look ahead                           | The **Standby** cue and its notes are shown above GO                                                                                                                                                                                                                                                         |
| Skip or go back                      | ↑ / ↓, or click a cue to put it on standby                                                                                                                                                                                                                                                                   |
| Change tonight's running order       | In the cue pane choose **Order**: drag a scene (song), or use its ↑ / ↓, and **Skip** what you leave out; what is live can't be skipped. It changes tonight only, not the show, works in Show mode, and survives a reload. **Setlists** plays a prepared order; the ↺ button goes back to the show's order.  |
| Jump to a song or section            | Keys, pedals and MIDI mapped in the Controls tab can jump to a scene, the next or previous scene, or a section of the live scene (the next **Chorus**, or the last one again). A jump set to fire goes through the same 0.3 s guard as GO.                                                                   |
| Pause auto-follows and moment timers | **Hold** (H, or [ with QLab-style keys); press again to resume                                                                                                                                                                                                                                               |
| Wait for a performer                 | A cue that waits for a performer says **Waiting for Bell** beside Standby, then **Bell ready** once they tap Ready on their phone.                                                                                                                                                                           |
| Emergency                            | **PANIC** (Esc), from any Scrim window: every output goes black and all sound mutes. **Release** fades back.                                                                                                                                                                                                 |
| Take one thing off stage             | Beside PANIC: **Text** fades captions, counters and values out; **Media** fades pictures and video out and pauses video. Press again to bring it back, until the next GO. **Sound** mutes everything until pressed again. A frame that holds only text (or only media) goes with it, bar and all.            |
| Relaxed performance                  | **Relaxed** in the header (in Show mode, hold it for a second): every output dims, sound is capped, fades slow down, layers marked **Intense** stay off and cues play their gentler version. Phones say it's OK to step out and come back. It eases in and out over two seconds, and Back and Reset keep it. |
| Audience moment                      | Watch the live tally. **+10s** extends, **Close now** ends it early, **Override… / Force** picks the result.                                                                                                                                                                                                 |
| Count people without a phone         | Buttons, pads or pedals mapped to **Count a vote** add to the tally, and **Add** on the moment adds a count you type: raised hands, coloured cards, an usher's tally. Negative numbers correct a mistake. The card says where the votes came from.                                                           |
| Shared tablets                       | **Shared tablet** in the audience panel gives a QR code for a tablet passed around: large print, and after each answer it says _pass it on_, so each person counts.                                                                                                                                          |
| Text entries                         | Approve ✓ or reject ✕ each entry; nothing reaches the stage unapproved.                                                                                                                                                                                                                                      |
| Keep an eye on a value               | In the **State** tab, pin it: it stays in the message strip above GO.                                                                                                                                                                                                                                        |
| Find out why something happened      | The **Log** tab names every rule that ran and what it checked; skipped rules fold into one line you can open.                                                                                                                                                                                                |
| See every key                        | Press **?** (not in Show mode).                                                                                                                                                                                                                                                                              |

## If something goes wrong

| Symptom                                                  | What to do                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| An output shows **Output window lost**                   | Press **Reopen**. It returns to the current picture.                                                                                  |
| The operator tab crashed or was closed                   | Reopen it from the library. The show resumes at the same cue, and the outputs and audience room reconnect.                            |
| The audience room shows **Reconnecting**                 | Carry on. Moments that get no input close with their designed default. Phones and remotes reconnect on their own.                     |
| A performer remote says **Link out of date**             | The room was replaced. Have them scan the current performer QR code.                                                                  |
| You went **off script** (forced a result, moved standby) | The **Off script** chip lists what changed; **Back to script** puts the next cue in running order on standby.                         |
| No sound from a video                                    | Click that output window once, then check **Outputs & audio** for the bus device on this machine.                                     |
| The operator view says the show **was taken over**       | Another tab or the installation page on this machine is running it. Hold **Take over here** to run it from this one; the other stops. |

## In rehearsal

- **Rehearse from here:** in the editor's Cues tab, pick a cue and choose **Rehearse from here** in _After this cue_. The operator view opens with everything before it already run, using the vote results you assumed.
- **Simulate phones:** while a moment is open, **Simulate phones** pretends a number of phones answered, on top of real phones, buttons and counts.
- **Simple view:** **Simple view** in the header (Rehearsal) shows one huge GO, Now and Next, Hold, Back and PANIC, sized for touch; **Full view** goes back. A tablet or phone always gets it. A show can open in it (Controls tab › Operator view).
- **Remote GO:** with _Performer remotes can press GO_ on (Controls tab), the performer remote shows GO, Hold and Back, for running the show from a tablet away from the show machine. It goes over the network: keep a key or pedal on the show machine ready.
- **Setlists:** arrange the running order under **Order**, then **Setlists › Keep this order as a setlist…** saves it in the show (Rehearsal only, since it edits the show).
- **Commands:** ⌘K (Ctrl+K) finds any command; ⌘, (Ctrl+,) opens Preferences.

## After the show

The **History** tab in the editor lists every run. Each log shows every cue fired, every audience result and every warning; read it before the next performance.
