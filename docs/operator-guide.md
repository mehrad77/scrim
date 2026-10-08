# Operator guide

A runbook for the stage manager or operator running a show in Scrim.

## Before the day

- [ ] Use Chrome or Edge on the show machine and keep it updated before tech week, not during the run.
- [ ] Open the show once while online, so the app is cached for offline use.
- [ ] In the library, choose **Keep my shows** so the browser will not clear storage.
- [ ] Export a `.scrim` backup to a USB stick. It is the master copy if the machine fails.
- [ ] For screens on other devices: import the same `.scrim` file on each device once.
- [ ] For more than about 50 audience phones, bring a dedicated Wi-Fi router.

## Before doors open

1. Open the show and choose **Run show**. If the show was interrupted, the operator view says so and resumes where it left off; choose **Start from the top** for a fresh run.
2. Choose **Go live: open all**. The first time, allow window management so each output opens full screen on its own display. Use **Detect displays** and assign each output to a display; Scrim remembers the assignment on this machine.
3. If an output says _Not full screen_ or _Click output once for sound_, click that output window once.
4. Press **Identify** to flash each output's name on its screen.
5. For audience or performer moments, choose **Open audience room**. Project or print the audience QR code, and give performers the performer QR code. Scan both with a phone to test.
6. Open **Pre-show check** and work down the list until it says **READY**.
7. Switch to **Show** mode. Editing is locked in every window until someone deliberately unlocks it.

## During the show

| Do this                              | How                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Fire the next cue                    | **GO** or Space (also from an output window). A second press within 0.3 s is ignored.                        |
| Look ahead                           | The **Standby** cue and its notes are shown above GO                                                         |
| Skip or go back                      | ↑ / ↓, or click a cue to put it on standby                                                                   |
| Pause auto-follows and moment timers | **Hold** (H); press again to resume                                                                          |
| Emergency                            | **PANIC** (Esc), from any Scrim window: every output goes black and all sound mutes. **Release** fades back. |
| Audience moment                      | Watch the live tally. **+10s** extends, **Close now** ends it early, **Override… / Force** picks the result. |
| Text entries                         | Approve ✓ or reject ✕ each entry; nothing reaches the stage unapproved.                                      |

## If something goes wrong

| Symptom                                          | What to do                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| An output shows **Output window lost**           | Press **Reopen**. It returns to the current picture.                                                              |
| The operator tab crashed or was closed           | Reopen it from the library. The show resumes at the same cue, and the outputs and audience room reconnect.        |
| The audience room shows **Reconnecting**         | Carry on. Moments that get no input close with their designed default. Phones and remotes reconnect on their own. |
| A performer remote says **Link no longer valid** | The room was replaced. Have them scan the current performer QR code.                                              |
| No sound from a video                            | Click that output window once, then check **Outputs & audio** for the bus device on this machine.                 |

## After the show

The **History** tab in the editor lists every run. Each log shows every cue fired, every audience result and every warning; read it before the next performance.
