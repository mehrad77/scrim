import { notePopupBlocked } from '../lib/capabilities.js';
import { readLocal } from '../lib/local.js';
import {
  listScreens,
  openOutputWindow,
  windowManagementSupported,
  type ScreenChoice,
} from './windows.js';

/** Which display each output goes on, on this machine (Detect displays). */
export const SCREENS_KEY = 'scrim.outputScreens';

/**
 * Open one output on its assigned display. False when the browser blocked the window; the
 * pre-show check then says so.
 */
export function openOutput(
  showId: string,
  outputId: string,
  screens: ScreenChoice[] | null,
  assigned: Record<string, string>,
): boolean {
  const screen = screens?.find((s) => s.label === assigned[outputId]);
  const w = openOutputWindow(`/output/${showId}/${outputId}`, outputId, screen);
  if (!w) notePopupBlocked();
  return !!w;
}

/** "Go live": every output on its assigned display. False if the browser blocked any. */
export async function openAllOutputs(show: {
  id: string;
  outputs: { id: string }[];
}): Promise<boolean> {
  const assigned = readLocal<Record<string, string>>(SCREENS_KEY, {});
  const screens = windowManagementSupported() ? await listScreens().catch(() => null) : null;
  let ok = true;
  for (const o of show.outputs) ok = openOutput(show.id, o.id, screens, assigned) && ok;
  return ok;
}
