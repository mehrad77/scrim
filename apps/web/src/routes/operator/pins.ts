import { useEffect, useState } from 'react';
import { readLocal, writeLocal } from '../../lib/local.js';

/** State values pinned to the operator's message strip, per show, on this machine. */
const key = (showId: string) => `scrim.pins.${showId}`;
const EVENT = 'scrim:pins';

export function usePins(showId: string): [string[], (varId: string) => void] {
  const [pins, setPins] = useState<string[]>(() => readLocal(key(showId), []));
  useEffect(() => {
    const on = () => setPins(readLocal(key(showId), []));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [showId]);
  const toggle = (varId: string) => {
    const next = pins.includes(varId) ? pins.filter((p) => p !== varId) : [...pins, varId];
    writeLocal(key(showId), next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [pins, toggle];
}
