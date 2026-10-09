import { cueOrder } from '@scrim/format';
import { useEffect, useRef, useState } from 'react';
import type { RunLogEntry } from '../../storage/db.js';
import { useHost } from './Operator.js';

/** How long announcements gather before they are read out together. */
const GATHER_MS = 250;

/**
 * The operator view, read aloud (UX_PRINCIPLES › inclusive operation): what fired and what is
 * next, moments opening and closing, and, at once, PANIC and warnings. It reads the run log and
 * standby, so it never adds work to the show's path, and gathers bursts into one message.
 */
export function Announcer() {
  const [, snap] = useHost();
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const seen = useRef<RunLogEntry | null>(snap.log.at(-1) ?? null);
  const standby = useRef(snap.state.standby);
  const queue = useRef<{ polite: string[]; assertive: string[] }>({ polite: [], assertive: [] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = queue.current;
    const i = seen.current ? snap.log.lastIndexOf(seen.current) : -1;
    const fresh =
      i >= 0 ? snap.log.slice(i + 1) : snap.log.filter((e) => e.at > (seen.current?.at ?? 0));
    seen.current = snap.log.at(-1) ?? seen.current;
    for (const e of fresh) {
      if (e.kind === 'panic' || e.kind === 'warning') q.assertive.push(e.text);
      else if (e.kind === 'cue')
        q.polite.push(e.text.startsWith('Back to') ? e.text : `Fired ${e.text}`);
      else if (e.kind === 'moment' || e.kind === 'trigger') q.polite.push(e.text);
    }
    if (snap.state.standby !== standby.current) {
      standby.current = snap.state.standby;
      const next = cueOrder(snap.show).find((c) => c.id === snap.state.standby);
      q.polite.push(next ? `Next: ${next.name}` : 'End of show');
    }
    if (!q.polite.length && !q.assertive.length) return;
    timer.current ??= setTimeout(() => {
      timer.current = null;
      // Only the latest few: a burst of rule lines must not keep a screen reader busy.
      if (q.polite.length) setPolite(q.polite.slice(-3).join('. '));
      if (q.assertive.length) setAssertive(q.assertive.slice(-2).join('. '));
      q.polite = [];
      q.assertive = [];
    }, GATHER_MS);
  }, [snap.log, snap.state.standby, snap.show]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <>
      <div className="sr-only" aria-live="polite" data-testid="announce-polite">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive" data-testid="announce-assertive">
        {assertive}
      </div>
    </>
  );
}
