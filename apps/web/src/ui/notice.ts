import { useEffect, useState } from 'react';

/**
 * Short operator notices ("Next: X (was Y)") shown for a few seconds in the operator's fixed
 * message strip, so nothing pops up over GO.
 */
const NOTICE_EVENT = 'scrim:notice';

export function notice(text: string): void {
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: text }));
}

export function useNotice(ms = 4000): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = window.setTimeout(() => setText(null), ms);
    };
    window.addEventListener(NOTICE_EVENT, on);
    return () => {
      window.removeEventListener(NOTICE_EVENT, on);
      clearTimeout(timer);
    };
  }, [ms]);
  return text;
}
