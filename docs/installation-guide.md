# Installation guide

How to run a Scrim show unattended: a museum or gallery piece, a lobby loop, a waiting-room screen. The show runs on one machine that starts by itself, recovers from power cuts, and needs nobody to click anything.

## 1. Prepare the show

In the editor, **Outputs & audio › Installation**:

- **Run unattended** lists the page each machine opens: `/kiosk/<show id>?output=<output id>`. The page runs the show in Show mode, draws that output in its own tab, and opens the show's other outputs where the browser allows it. **Test as installation** opens it here.
- **Room code for visitors' phones** (only if visitors join on their phones):
  - **Keep this code** asks the relay to hold the code for 90 days after it was last used, so QR codes can be printed. An ordinary room ends a day after its last use. The host never swaps a kept code for a new one: if the relay can't find it, the run log says so and Scrim tries again every minute.
  - **Print QR code** prints the code, the QR and the link.
  - **Save room pass** writes the code and its keys to a file, and **Load room pass** puts them on a replacement machine, so the printed codes keep working. The pass holds the room's host key: keep it like a password.
  - Phones reach the room over the internet, so an installation that depends on phones depends on the network. Without it, the show still runs and moments use their defaults.
- **Opening hours** set a choice value from the clock. For example, `opening` is `open` on weekdays from 10:00 to 17:00 and `closed` otherwise.
  - Rules react when it changes ("when opening changes, and opening is open, go to Attract loop"), so a machine that boots mid-afternoon is set at once.
  - A period that ends before it starts runs past midnight, and one that ends when it starts lasts all day.
  - When the page starts, and after a Reset, the value is announced even if it hasn't changed, so the rules set the right scene for the hours it wakes into.
  - **Try a time** shows the value at any day and time.
  - The times are the machine's own, so set its time zone.

## 2. Set up the machine

Use Chrome, or another Chromium browser.

**Start Scrim with the machine.**

| System   | How                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows  | A shortcut in `shell:startup` to `chrome.exe --kiosk --autoplay-policy=no-user-gesture-required "<kiosk page>"`                                                            |
| macOS    | **System Settings › General › Login Items** with a small script running `open -a "Google Chrome" --args --kiosk --autoplay-policy=no-user-gesture-required "<kiosk page>"` |
| Linux    | A `.desktop` file in `~/.config/autostart` running `google-chrome --kiosk --autoplay-policy=no-user-gesture-required "<kiosk page>"`                                       |
| ChromeOS | Managed devices: kiosk or managed-guest sessions in the admin console, with the policies below. Ctrl+Shift+Q signs ChromeOS out, so Scrim's exit is Ctrl+Alt+Shift+E       |

- `--kiosk` opens full screen with no browser interface; Ctrl+Alt+Shift+E held for two seconds leaves Scrim for the Library, and the browser's own exit still works.
- `--autoplay-policy=no-user-gesture-required` lets sound start without a click. On managed machines use the `AutoplayAllowlist` policy instead.
- For more than one output, give each display its own app window: `--app="<kiosk page>?output=<id>"` with `--window-position`, or allow the kiosk page to open them itself (below).

**Policies on managed machines** (`chrome://policy` shows what is set). Each takes the Scrim address:

| Policy                              | What it allows                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `AutomaticFullscreenAllowedForUrls` | Full screen without a click (Chrome 124 and later on Windows; check your platform) |
| `AutoplayAllowlist`                 | Sound and video with sound without a click                                         |
| `PopupsAllowedForUrls`              | The kiosk page opening the other outputs                                           |
| `WindowManagementAllowedForUrls`    | Placing each output on its own display                                             |

**Keep it awake and keep it on.**

- Turn display sleep, screen savers and automatic updates during opening hours off. Scrim also holds a screen wake lock while its page is visible.
- Set the BIOS or firmware to power on after a power cut ("Restore on AC power loss"), and sign in automatically.
- Turn notifications off.

## 3. How it recovers

- **Power cut or crash:** the machine restarts, the browser opens the kiosk page, and the show carries on from the crash journal, at the cue it had reached, with the opening hours applied at once.
- **Errors:** five errors within a minute make the page start over, from the journal.
- **Network:** the show runs offline. A kept room reconnects by itself when the network returns.
- **Staff:** opening the show's operator view on the same machine offers **Take over**; the installation stops until its page is opened again. Esc is always PANIC.

## 4. Before you leave it

- Open the operator view's **Pre-show check** once, with the outputs open, and work down the list.
- Unplug the network for a minute and plug it back in. Pull the power, and watch it come back.
- If phones join, scan the printed QR with a phone on the visitors' Wi-Fi.
