import type { Action, VarValue } from '@scrim/format';

export type InputSource =
  'operator' | 'keyboard' | 'midi' | 'gamepad' | 'remote' | 'rule' | 'follow' | 'system';

export type EngineInput =
  | { type: 'go'; source?: InputSource }
  | { type: 'standby'; cueId: string }
  | { type: 'standbyNext' }
  | { type: 'standbyPrev' }
  | { type: 'fireCue'; cueId: string; source?: InputSource }
  | { type: 'hold'; on?: boolean }
  | { type: 'panic'; fade?: number }
  | { type: 'release'; fade?: number }
  | { type: 'trigger'; triggerId: string; source?: InputSource }
  | { type: 'tick' }
  | {
      type: 'momentAgg';
      momentId: string;
      tally?: Record<string, number>;
      count?: number;
      sum?: number;
      sumSq?: number;
      n?: number;
      entries?: { id: string; text: string }[];
    }
  | { type: 'openMoment'; momentId: string }
  | { type: 'closeMoment'; momentId: string; result?: VarValue }
  | { type: 'extendMoment'; momentId: string; seconds: number }
  | { type: 'moderate'; momentId: string; entryId: string; approve: boolean }
  | { type: 'mediaEnded'; layerId: string }
  | { type: 'setVar'; varId: string; value: VarValue }
  | { type: 'seek'; layerId: string; time: number }
  /** Apply one action directly (operator overrides in rehearsal). */
  | { type: 'action'; action: Action }
  | { type: 'reset' }
  /** Return to the state before the operator's last GO, fading over that cue's fade. */
  | { type: 'back' };

export type EngineEvent =
  | { type: 'cueFired'; cueId: string; name: string; source: InputSource }
  | { type: 'momentOpened'; momentId: string }
  | { type: 'momentClosed'; momentId: string; result: VarValue | null; usedDefault: boolean }
  | { type: 'varChanged'; varId: string; value: VarValue }
  | { type: 'trigger'; triggerId: string; source: InputSource }
  | { type: 'mediaEnded'; layerId: string }
  | { type: 'panic' }
  | { type: 'release' }
  | { type: 'hold'; on: boolean }
  | { type: 'reset' }
  | { type: 'back'; cueId: string; name: string }
  | { type: 'warning'; message: string };
