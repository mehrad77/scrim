/**
 * What this browser lets the show do, under this machine's site settings and any administrator
 * policy (school and venue machines are often managed). The pre-show check says plainly what
 * is blocked and who can change it. Policy names are Chrome's (Edge uses the same ones).
 */

export interface Capability {
  id: 'windows' | 'popups' | 'midi' | 'fullscreen';
  title: string;
  state: 'ok' | 'ask' | 'blocked' | 'unsupported';
  detail: string;
}

let popupsBlocked = false;

/** "Go live" could not open an output window: the browser blocked the pop-up. */
export function notePopupBlocked(): void {
  popupsBlocked = true;
}

async function permission(...names: string[]): Promise<PermissionState | 'unsupported'> {
  for (const name of names) {
    try {
      return (await navigator.permissions.query({ name } as unknown as PermissionDescriptor)).state;
    } catch {
      // not a permission this browser knows; try the older name
    }
  }
  return 'unsupported';
}

export async function checkCapabilities(needs: {
  outputs: boolean;
  midi: boolean;
}): Promise<Capability[]> {
  const out: Capability[] = [];
  if (needs.outputs) {
    const windows = await permission('window-management', 'window-placement');
    out.push({
      id: 'windows',
      title: 'Window management',
      state:
        windows === 'granted'
          ? 'ok'
          : windows === 'prompt'
            ? 'ask'
            : windows === 'denied'
              ? 'blocked'
              : 'unsupported',
      detail:
        windows === 'granted'
          ? 'Outputs open full screen on their own displays.'
          : windows === 'prompt'
            ? '“Go live: open all” asks for it once.'
            : windows === 'denied'
              ? 'Blocked, so each output must be dragged to its display and clicked for full screen. Allow it in this site’s settings, or ask your administrator to add this site to WindowManagementAllowedForUrls.'
              : 'Not in this browser: drag each output to its display and click it for full screen.',
    });
    if (popupsBlocked)
      out.push({
        id: 'popups',
        title: 'Pop-ups',
        state: 'blocked',
        detail:
          'The browser blocked an output window. Allow pop-ups for this site, or ask your administrator to add it to PopupsAllowedForUrls.',
      });
    if (!document.fullscreenEnabled)
      out.push({
        id: 'fullscreen',
        title: 'Full screen',
        state: 'blocked',
        detail: 'Full screen is turned off in this browser, often by an administrator.',
      });
  }
  if (needs.midi) {
    const midi = 'requestMIDIAccess' in navigator ? await permission('midi') : 'unsupported';
    out.push({
      id: 'midi',
      title: 'MIDI',
      state:
        midi === 'granted'
          ? 'ok'
          : midi === 'prompt'
            ? 'ask'
            : midi === 'denied'
              ? 'blocked'
              : 'unsupported',
      detail:
        midi === 'granted'
          ? 'Pads and pedals can reach the show.'
          : midi === 'prompt'
            ? '“Enable MIDI” asks for it once.'
            : midi === 'denied'
              ? 'Blocked for this site, in its settings or by your administrator: mapped pads and pedals will not work.'
              : 'This browser has no Web MIDI. Use Chrome or Edge, or map keys instead.',
    });
  }
  return out;
}
