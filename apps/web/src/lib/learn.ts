import type { Show } from '@scrim/format';
import type { RunRecord } from '../storage/db.js';
import { readLocal, writeLocal } from './local.js';

/**
 * The demo is disposable and teaches by doing (UX principle 8): a short Learn checklist whose
 * items tick themselves when the person actually does them.
 */
export interface DemoRecord {
  id: string;
  /** The demo's key map when it was made, to notice a mapped key. */
  inputs: string;
}

const DEMO_KEY = 'scrim.demo';

export function demoRecord(): DemoRecord | null {
  return readLocal<DemoRecord | null>(DEMO_KEY, null);
}

export function rememberDemo(show: Show): void {
  setDemoRecord({ id: show.id, inputs: JSON.stringify(show.inputs) });
}

export function setDemoRecord(record: DemoRecord): void {
  writeLocal(DEMO_KEY, record);
}

export interface LearnStep {
  id: string;
  title: string;
  hint: string;
  done: boolean;
}

export function learnSteps(show: Show, runs: RunRecord[], demo: DemoRecord): LearnStep[] {
  const said = (test: (text: string, kind: string) => boolean) =>
    runs.some((r) => r.entries.some((e) => test(e.text, e.kind)));
  return [
    { id: 'open', title: 'Open the demo', hint: 'Done.', done: true },
    {
      id: 'go',
      title: 'Press GO in Rehearsal',
      hint: 'Run the show, then press Space.',
      done: runs.some((r) => r.cuesFired > 0),
    },
    {
      id: 'edit',
      title: 'Change a cue',
      hint: 'In the editor’s Cues tab, change a fade or a name.',
      done: show.cues.some((c) => c.updatedAt > show.createdAt + 1000),
    },
    {
      id: 'vote',
      title: 'Vote from your phone',
      hint: 'Open the audience room in Rehearsal and scan the QR code.',
      done: said(
        (t, kind) => kind === 'moment' && t.startsWith('Closed') && !t.includes('default'),
      ),
    },
    {
      id: 'map',
      title: 'Map a key',
      hint: 'In the operator view, use Map keys and press a key for Hold.',
      done: JSON.stringify(show.inputs) !== demo.inputs,
    },
    {
      id: 'show',
      title: 'Switch to Show mode',
      hint: 'The lock in the operator header: the calm state for performances.',
      done: said((t) => t.startsWith('Show mode')),
    },
  ];
}
