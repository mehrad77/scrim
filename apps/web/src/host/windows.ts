export interface ScreenChoice {
  index: number;
  label: string;
  primary: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ScreenDetailed {
  label?: string;
  isPrimary?: boolean;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

type WindowWithScreens = Window & {
  getScreenDetails?: () => Promise<{ screens: ScreenDetailed[] }>;
};

export function windowManagementSupported(): boolean {
  return 'getScreenDetails' in window;
}

/** List attached displays. Asks for the Window Management permission once. */
export async function listScreens(): Promise<ScreenChoice[]> {
  const w = window as WindowWithScreens;
  if (!w.getScreenDetails) return [];
  const details = await w.getScreenDetails();
  return details.screens.map((s, index) => ({
    index,
    label: s.label || `Display ${index + 1}`,
    primary: !!s.isPrimary,
    left: s.left,
    top: s.top,
    width: s.width,
    height: s.height,
  }));
}

/**
 * Open (or focus) an output window on a display. Chromium opens it straight
 * into full screen when the Window Management permission is granted; other
 * browsers get a window the size of the display and a click-to-fullscreen.
 */
export function openOutputWindow(
  url: string,
  outputId: string,
  screen?: ScreenChoice,
): Window | null {
  const features = screen
    ? `popup,fullscreen,left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`
    : 'popup,width=960,height=540';
  return window.open(url, `scrim-output-${outputId}`, features);
}
