import type { Action, Condition, VarValue } from '@scrim/format';

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
  | { type: 'back' }
  /** PANIC's secondary clears: fade out what's on stage of one kind, remembering it for undo. */
  | { type: 'clear'; what: ClearKind; fade?: number }
  /** Bring back what the last clear of that kind took off, until the next cue fires. */
  | { type: 'unclear'; what: ClearKind; fade?: number }
  /** Mute every sound, like a blackout for audio; toggles when `on` is left out. */
  | { type: 'mute'; on?: boolean; fade?: number };

/** Text: text, counter and live-value layers. Media: pictures and video. */
export type ClearKind = 'text' | 'media';

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
  | { type: 'cleared'; what: ClearKind; layers: number }
  | { type: 'uncleared'; what: ClearKind; layers: number }
  | { type: 'mute'; on: boolean }
  /** A rule's trigger matched: whether it ran, and each check with the value it saw. */
  | { type: 'ruleEvaluated'; ruleId: string; ran: boolean; checks: ConditionCheck[] }
  | { type: 'warning'; message: string };

export interface ConditionCheck {
  varId: string;
  op: Condition['op'];
  expected: string | number;
  /** The variable's value when the rule was checked, formatted for people. */
  actual: string;
  ok: boolean;
}
