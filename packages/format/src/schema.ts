import { z } from 'zod';

export const SHOW_FORMAT_VERSION = 1;

const Id = z.string().min(1);
/** A reference to another object; empty while the designer hasn't picked one. */
const Ref = z.string();

export const EasingSchema = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut']);
export type Easing = z.infer<typeof EasingSchema>;

export const PointSchema = z.object({ x: z.number(), y: z.number() });

export const OutputSchema = z.object({
  id: Id,
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  background: z.string().default('#000000'),
  /** Fraction of width/height kept clear of important content (guide only). */
  safeArea: z.number().min(0).max(0.25).default(0.05),
  /** Corner offsets in output pixels: top-left, top-right, bottom-right, bottom-left. */
  cornerPin: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]).optional(),
  /** Editor ruler guides in output pixels (design aid only; never drawn on the output). */
  guides: z.object({ x: z.array(z.number()), y: z.array(z.number()) }).optional(),
});
export type Output = z.infer<typeof OutputSchema>;

/** `font` files style text layers; they travel in the .scrim bundle so offline shows keep them. */
export const MediaKindSchema = z.enum(['image', 'video', 'audio', 'font']);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaSchema = z.object({
  id: Id,
  kind: MediaKindSchema,
  name: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  /** Seconds, for time-based media, when known. */
  duration: z.number().nonnegative().optional(),
  /** Pixel size, for visual media, when known. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type Media = z.infer<typeof MediaSchema>;

export const CropSchema = z.object({
  top: z.number().min(0).max(1),
  right: z.number().min(0).max(1),
  bottom: z.number().min(0).max(1),
  left: z.number().min(0).max(1),
});
export type Crop = z.infer<typeof CropSchema>;

export const FitSchema = z.enum(['contain', 'cover', 'fill']);
export const AlignSchema = z.enum(['left', 'center', 'right']);

/**
 * The output edges a top-level layer keeps its distance to when the output is resized or the
 * layer moves to another output. A layer that hugs its content grows away from its pin.
 */
export const PinSchema = z.object({
  x: z.enum(['left', 'center', 'right']),
  y: z.enum(['top', 'center', 'bottom']),
});
export type Pin = z.infer<typeof PinSchema>;

const LayerBase = {
  id: Id,
  name: z.string(),
  /** Output this layer is drawn on. Audio layers have none. */
  outputId: Id.nullable(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  z: z.number().int(),
  /** Opacity the layer has when shown. */
  opacity: z.number().min(0).max(1).default(1),
  /** Whether the layer is visible when the show starts. */
  visible: z.boolean().default(false),
  crop: CropSchema.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  /**
   * The frame this layer sits in, on the same output. Absent: it sits on the output. Inside a
   * frame, x and y are relative to the frame, and z orders it among the frame's children.
   */
  parentId: Id.optional(),
  /** Absent: left and top. Ignored while the layer is inside a frame. */
  pin: PinSchema.optional(),
  /** Editor only: the canvas can't select or move it, or anything inside it. */
  locked: z.boolean().optional(),
  /**
   * Loud, flashing or startling: a relaxed performance leaves it out (never shows or plays it),
   * and takes it off stage when relaxed is turned on.
   */
  intense: z.boolean().optional(),
};

const TextStyle = {
  fontSize: z.number().positive().default(72),
  color: z.string().default('#ffffff'),
  fontFamily: z.string().default('system-ui, sans-serif'),
  fontWeight: z.number().int().default(600),
  align: AlignSchema.default('center'),
  background: z.string().default('transparent'),
  /**
   * fixed: the box is w × h. autoWidth: one line per line of text, as wide as it needs.
   * autoHeight: w wide, as tall as the wrapped text. Absent: fixed.
   */
  sizing: z.enum(['fixed', 'autoWidth', 'autoHeight']).optional(),
};

export const ImageLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('image'),
  mediaId: Id,
  fit: FitSchema.default('contain'),
});

export const VideoLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('video'),
  mediaId: Id,
  fit: FitSchema.default('contain'),
  loop: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(1),
  bus: z.string().default('main'),
});

export const AudioLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('audio'),
  mediaId: Id,
  loop: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(1),
  bus: z.string().default('main'),
});

export const TextLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('text'),
  /** May contain {{varName}} placeholders, filled from show state. */
  text: z.string(),
  ...TextStyle,
});

export const CounterLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('counter'),
  mode: z.enum(['countdown', 'countup', 'count']),
  /** Seconds for timers, a number for plain counters. */
  start: z.number().default(0),
  format: z.enum(['clock', 'number']).default('clock'),
  ...TextStyle,
});

export const StateLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('state'),
  varId: Ref,
  /** value: one line of text. bars: a vote's tally as bars. list: one entry per line, newest last. */
  display: z.enum(['value', 'bars', 'list']).default('value'),
  ...TextStyle,
});

export const FrameLayoutSchema = z.object({
  /** free: children sit where they are put. row, column: children line up in list order. */
  mode: z.enum(['free', 'row', 'column']).default('free'),
  gap: z.number().min(0).default(0),
  padX: z.number().min(0).default(0),
  padY: z.number().min(0).default(0),
  /** Across the line. */
  align: z.enum(['start', 'center', 'end']).default('center'),
  /** Along the line. */
  justify: z.enum(['start', 'center', 'end', 'between']).default('start'),
  /** Row and column frames only: grow and shrink with their content on that axis. */
  hugW: z.boolean().default(false),
  hugH: z.boolean().default(false),
});
export type FrameLayout = z.infer<typeof FrameLayoutSchema>;

/** A group of layers that moves, fades and clears as one, with an optional fill. */
export const FrameLayerSchema = z.object({
  ...LayerBase,
  kind: z.literal('frame'),
  fill: z.string().default('transparent'),
  radius: z.number().min(0).default(0),
  /** Cut children off at the frame's edge. */
  clip: z.boolean().default(false),
  layout: FrameLayoutSchema.prefault({}),
});

export const LayerSchema = z.discriminatedUnion('kind', [
  ImageLayerSchema,
  VideoLayerSchema,
  AudioLayerSchema,
  TextLayerSchema,
  CounterLayerSchema,
  StateLayerSchema,
  FrameLayerSchema,
]);
export type Layer = z.infer<typeof LayerSchema>;
export type LayerKind = Layer['kind'];
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type VideoLayer = z.infer<typeof VideoLayerSchema>;
export type AudioLayer = z.infer<typeof AudioLayerSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type CounterLayer = z.infer<typeof CounterLayerSchema>;
export type StateLayer = z.infer<typeof StateLayerSchema>;
export type FrameLayer = z.infer<typeof FrameLayerSchema>;

export const VarValueSchema = z.union([
  z.number(),
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.number()),
]);
export type VarValue = z.infer<typeof VarValueSchema>;

export const VarSchema = z.object({
  id: Id,
  /** Used in {{name}} placeholders and in the rule builder. */
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  type: z.enum(['number', 'text', 'choice', 'tally', 'list']),
  initial: VarValueSchema,
  /** Allowed values, for choice and tally vars. */
  options: z.array(z.string()).optional(),
});
export type Var = z.infer<typeof VarSchema>;

export const ConditionSchema = z.object({
  varId: Ref,
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']),
  value: z.union([z.string(), z.number()]),
});
export type Condition = z.infer<typeof ConditionSchema>;

const Fade = {
  duration: z.number().nonnegative().default(0),
  easing: EasingSchema.default('linear'),
};

/** Seconds after the cue fires before a layer action starts (the cue dock's bar offset). */
const Timing = { delay: z.number().nonnegative().optional() };

type Delay = { delay?: number | undefined };
type ActionShape =
  | ({ type: 'show'; layerId: string; duration: number; easing: Easing } & Delay)
  | ({ type: 'hide'; layerId: string; duration: number; easing: Easing } & Delay)
  | ({ type: 'fade'; layerId: string; opacity: number; duration: number; easing: Easing } & Delay)
  | ({ type: 'play'; layerId: string; restart: boolean } & Delay)
  | ({ type: 'pause'; layerId: string } & Delay)
  | ({ type: 'seek'; layerId: string; time: number } & Delay)
  | ({ type: 'setText'; layerId: string; text: string } & Delay)
  | ({
      type: 'counter';
      layerId: string;
      op: 'start' | 'pause' | 'reset' | 'add';
      value?: number | undefined;
    } & Delay)
  | { type: 'setVar'; varId: string; value: VarValue }
  | { type: 'addVar'; varId: string; amount: number }
  | { type: 'jumpScene'; sceneId: string; fire: boolean }
  | { type: 'goToCue'; cueId: string; fire: boolean }
  | { type: 'jumpSection'; section: string; fire: boolean }
  | { type: 'openMoment'; momentId: string }
  | { type: 'closeMoment'; momentId: string }
  | { type: 'stopAll'; duration: number }
  | { type: 'relaxed'; on: boolean }
  | { type: 'branch'; if: Condition[]; then: ActionShape[]; else: ActionShape[] };

export const ActionSchema: z.ZodType<ActionShape, unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('show'), layerId: Ref, ...Fade, ...Timing }),
    z.object({ type: z.literal('hide'), layerId: Ref, ...Fade, ...Timing }),
    z.object({
      type: z.literal('fade'),
      layerId: Ref,
      opacity: z.number().min(0).max(1),
      ...Fade,
      ...Timing,
    }),
    z.object({
      type: z.literal('play'),
      layerId: Ref,
      restart: z.boolean().default(false),
      ...Timing,
    }),
    z.object({ type: z.literal('pause'), layerId: Ref, ...Timing }),
    z.object({ type: z.literal('seek'), layerId: Ref, time: z.number().nonnegative(), ...Timing }),
    z.object({ type: z.literal('setText'), layerId: Ref, text: z.string(), ...Timing }),
    z.object({
      type: z.literal('counter'),
      layerId: Ref,
      op: z.enum(['start', 'pause', 'reset', 'add']),
      value: z.number().optional(),
      ...Timing,
    }),
    z.object({ type: z.literal('setVar'), varId: Ref, value: VarValueSchema }),
    z.object({ type: z.literal('addVar'), varId: Ref, amount: z.number() }),
    z.object({ type: z.literal('jumpScene'), sceneId: Ref, fire: z.boolean().default(false) }),
    z.object({ type: z.literal('goToCue'), cueId: Ref, fire: z.boolean().default(false) }),
    /** The next cue in the current scene with this section (Chorus), or the latest one. */
    z.object({
      type: z.literal('jumpSection'),
      section: z.string(),
      fire: z.boolean().default(false),
    }),
    z.object({ type: z.literal('openMoment'), momentId: Ref }),
    z.object({ type: z.literal('closeMoment'), momentId: Ref }),
    z.object({ type: z.literal('stopAll'), duration: z.number().nonnegative().default(1) }),
    /** Turn the relaxed performance on or off, as the operator's switch does. */
    z.object({ type: z.literal('relaxed'), on: z.boolean() }),
    z.object({
      type: z.literal('branch'),
      if: z.array(ConditionSchema),
      then: z.array(ActionSchema),
      else: z.array(ActionSchema).default([]),
    }),
  ]),
) as z.ZodType<ActionShape, unknown>;
export type Action = ActionShape;
export type ActionType = Action['type'];

/** What a cue says to people who need it, in one language. */
export const AccessTextSchema = z.object({
  /** What is said or sung from this cue on. Empty clears the caption; absent keeps the last. */
  caption: z.string().optional(),
  /** What is seen, read aloud on phones that ask for it, once when the cue fires. */
  description: z.string().optional(),
  /** Shown on phones while this cue is on standby: loud bangs, flashing light, a scare. */
  warning: z.string().optional(),
});
export type AccessText = z.infer<typeof AccessTextSchema>;

/** A cue's access track (the personal access channel): the show's own language, then others. */
export const CueAccessSchema = AccessTextSchema.extend({
  /** Phones that ask for it vibrate when the cue fires: a sound cue, a moment opening. */
  buzz: z.boolean().optional(),
  /** The same texts in other languages, by language code (fr, es, ar…). */
  i18n: z.record(z.string(), AccessTextSchema).optional(),
});
export type CueAccess = z.infer<typeof CueAccessSchema>;

/** A spike-tape colour (1–8) that tags a scene or cue in the editor and on printed sheets. */
export const TapeSchema = z.number().int().min(1).max(8);

export const SceneSchema = z.object({ id: Id, name: z.string(), tape: TapeSchema.optional() });
export type Scene = z.infer<typeof SceneSchema>;

/** A prepared running order: these scenes, in this order; the others are skipped. */
export const SetlistSchema = z.object({ id: Id, name: z.string(), scenes: z.array(Ref) });
export type Setlist = z.infer<typeof SetlistSchema>;

export const CueSchema = z.object({
  id: Id,
  sceneId: Id,
  name: z.string(),
  actions: z.array(ActionSchema),
  /** Fire the next cue automatically, `delay` seconds after this one. */
  follow: z
    .object({ auto: z.boolean(), delay: z.number().nonnegative() })
    .default({ auto: false, delay: 0 }),
  notes: z.string().default(''),
  /** Overrides the scene's tape colour. */
  tape: TapeSchema.optional(),
  /** The part of a song or scene this cue is (Verse, Chorus), so a key can jump to it. */
  section: z.string().optional(),
  access: CueAccessSchema.optional(),
  /**
   * What the cue does instead in a relaxed performance: softer, slower, or nothing (empty).
   * Absent: the same actions, with relaxed's limits.
   */
  gentle: z.array(ActionSchema).optional(),
  /**
   * A performer trigger this cue waits for. While the cue is on standby, that trigger's remotes
   * show "Your cue · tap Ready" and the operator sees when the performer is ready.
   */
  waitFor: Ref.optional(),
  /** Epoch ms of the last edit; rehearsal mode highlights cues changed since the last run. */
  updatedAt: z.number().default(0),
});
export type Cue = z.infer<typeof CueSchema>;

export const MomentOptionSchema = z.object({ id: Id, label: z.string() });

export const MomentSchema = z.object({
  id: Id,
  name: z.string(),
  type: z.enum(['vote', 'tap', 'slider', 'text', 'prop']),
  prompt: z.string(),
  /** Vote options (2–6). */
  options: z.array(MomentOptionSchema).default([]),
  /** Slider range. */
  min: z.number().default(0),
  max: z.number().default(10),
  /** Personal prop variants; each joined phone gets one. */
  variants: z
    .array(
      z.object({ id: Id, label: z.string(), content: z.string(), weight: z.number().positive() }),
    )
    .default([]),
  /** Close automatically after this many seconds; 0 = operator closes it. */
  durationSec: z.number().nonnegative().default(0),
  /** Var that receives the result: winner, count, average or approved list. */
  resultVarId: Id.nullable().default(null),
  /** Var that receives the per-option tally (vote, prop). */
  tallyVarId: Id.nullable().default(null),
  /** Result used when no input arrives. */
  defaultResult: z.union([z.string(), z.number()]).default(''),
  /** Text entries need operator approval before they reach state. */
  moderated: z.boolean().default(true),
  /** The prompt and option labels in other languages, by language code. */
  i18n: z
    .record(
      z.string(),
      z.object({
        prompt: z.string().optional(),
        /** By option id. */
        options: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
});
export type Moment = z.infer<typeof MomentSchema>;
export type MomentType = Moment['type'];

export const TriggerSchema = z.object({
  id: Id,
  name: z.string(),
  color: z.string().default('#e11d48'),
});
export type Trigger = z.infer<typeof TriggerSchema>;

export const RuleWhenSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('trigger'), triggerId: Ref }),
  z.object({ type: z.literal('momentClosed'), momentId: Ref }),
  z.object({ type: z.literal('varChanged'), varId: Ref }),
  z.object({ type: z.literal('cueFired'), cueId: Ref }),
  z.object({ type: z.literal('mediaEnded'), layerId: Ref }),
]);
export type RuleWhen = z.infer<typeof RuleWhenSchema>;

export const RuleSchema = z.object({
  id: Id,
  name: z.string(),
  enabled: z.boolean().default(true),
  when: RuleWhenSchema,
  if: z.array(ConditionSchema).default([]),
  then: z.array(ActionSchema),
});
export type Rule = z.infer<typeof RuleSchema>;

/**
 * Where a jump command goes: a scene or cue, the current scene's next cue with a section, or the
 * scene after, before or of the cue that is live, in tonight's running order.
 */
export const JumpTargetSchema = z.discriminatedUnion('to', [
  z.object({ to: z.literal('scene'), sceneId: Ref }),
  z.object({ to: z.literal('cue'), cueId: Ref }),
  z.object({ to: z.literal('section'), section: z.string() }),
  z.object({ to: z.literal('nextScene') }),
  z.object({ to: z.literal('prevScene') }),
  z.object({ to: z.literal('restartScene') }),
]);
export type JumpTarget = z.infer<typeof JumpTargetSchema>;

export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('go') }),
  z.object({ type: z.literal('panic') }),
  z.object({ type: z.literal('hold') }),
  z.object({ type: z.literal('back') }),
  z.object({ type: z.literal('standbyNext') }),
  z.object({ type: z.literal('standbyPrev') }),
  z.object({ type: z.literal('trigger'), triggerId: Ref }),
  /** PANIC's secondary clears: fade text or media off stage (again: bring it back); mute sound. */
  z.object({ type: z.literal('clearText') }),
  z.object({ type: z.literal('clearMedia') }),
  z.object({ type: z.literal('mute') }),
  /** Put a cue on standby, or fire it at once (through the double-GO guard). */
  z.object({ type: z.literal('jump'), target: JumpTargetSchema, fire: z.boolean().default(false) }),
  /**
   * A vote for option N (1–6) of the newest open vote, or a tap for a tap moment, from a button,
   * pad or pedal in the room: taking part without a phone.
   */
  z.object({
    type: z.literal('countVote'),
    option: z.number().int().min(1).max(6),
    momentId: Ref.optional(),
  }),
]);
export type Command = z.infer<typeof CommandSchema>;

export const InputsSchema = z.object({
  keys: z.array(z.object({ key: z.string(), command: CommandSchema })),
  midi: z.array(
    z.object({
      kind: z.enum(['note', 'cc', 'program']),
      channel: z.number().int().min(1).max(16).nullable(),
      number: z.number().int().min(0).max(127),
      command: CommandSchema,
    }),
  ),
  gamepad: z.array(z.object({ button: z.number().int().nonnegative(), command: CommandSchema })),
});
export type Inputs = z.infer<typeof InputsSchema>;

export const AudioBusSchema = z.object({ id: Id, name: z.string() });

/** How this show is run; it travels with the show, like the key map. */
export const OperatorSettingsSchema = z.object({
  /**
   * GO fires only after a key, pedal or button is held this long, in ms: against accidental
   * presses, for tremor and for nervous volunteers. Absent or 0: on press.
   */
  goHoldMs: z.number().int().min(0).max(3000).optional(),
  /**
   * The operator view this show opens in: `simple` is one huge GO, now and next, Hold, Back and
   * PANIC, sized for touch. Windows under 1024 px always get it.
   */
  layout: z.enum(['full', 'simple']).optional(),
  /**
   * Performer remotes may press GO, Hold and Back: for a leader running the show from a tablet
   * that is not the show machine. It puts the network on GO's path, so it is off unless set.
   */
  remoteGo: z.boolean().optional(),
});
export type OperatorSettings = z.infer<typeof OperatorSettingsSchema>;

/**
 * A relaxed performance (for sensory-sensitive audiences, care homes, schools): outputs dimmed,
 * sound capped, nothing faster than the minimum fade, intense layers left out. The operator turns
 * it on per performance; these are its limits, and whether the show starts relaxed.
 */
export const RelaxedSettingsSchema = z.object({
  /** Performances start relaxed: a care-home session, a quiet visiting hour. */
  default: z.boolean().optional(),
  /** How bright outputs are while relaxed, from 0.2 to 1. Absent: 0.7. */
  brightness: z.number().min(0.2).max(1).optional(),
  /** The loudest any sound plays while relaxed, from 0 to 1. Absent: 0.6. */
  volume: z.number().min(0).max(1).optional(),
  /** Shows, hides and fades take at least this long, in seconds. Absent: 1. */
  minFade: z.number().min(0).max(10).optional(),
});
export type RelaxedSettings = z.infer<typeof RelaxedSettingsSchema>;

/**
 * How the editor opens this show: `simple` folds rules, values and control mappings behind a
 * labelled step, for teachers, volunteers and young creators. It travels with the show and only
 * changes when someone flips it.
 */
export const EditorSettingsSchema = z.object({ mode: z.enum(['simple', 'full']).optional() });
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

/**
 * Opening hours for an installation: a choice value the clock sets, so ordinary rules (when it
 * changes) switch scenes. A period that ends before it starts runs past midnight.
 */
export const SchedulePeriodSchema = z.object({
  /** Days it starts on: 0 Sunday to 6 Saturday. */
  days: z.array(z.number().int().min(0).max(6)),
  /** Minutes after midnight it starts and ends. */
  from: z.number().int().min(0).max(1440),
  to: z.number().int().min(0).max(1440),
  value: z.string(),
});
export type SchedulePeriod = z.infer<typeof SchedulePeriodSchema>;

export const ScheduleSchema = z.object({
  varId: Ref,
  periods: z.array(SchedulePeriodSchema),
  /** The value outside every period. */
  otherwise: z.string(),
});
export type Schedule = z.infer<typeof ScheduleSchema>;

/** Safeguarding for shows with children or vulnerable people. */
export const SafetySchema = z.object({
  /** Phones can't send words: text moments don't open, and the editor won't add one. */
  noFreeText: z.boolean().optional(),
});
export type Safety = z.infer<typeof SafetySchema>;

export const ShowSchema = z.object({
  format: z.literal('scrim-show'),
  version: z.literal(SHOW_FORMAT_VERSION),
  id: Id,
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  outputs: z.array(OutputSchema),
  media: z.array(MediaSchema),
  layers: z.array(LayerSchema),
  scenes: z.array(SceneSchema),
  cues: z.array(CueSchema),
  vars: z.array(VarSchema),
  moments: z.array(MomentSchema),
  triggers: z.array(TriggerSchema),
  rules: z.array(RuleSchema),
  inputs: InputsSchema,
  audioBuses: z.array(AudioBusSchema),
  /** Prepared running orders the operator can switch to; the show order is the default. */
  setlists: z.array(SetlistSchema).optional(),
  operator: OperatorSettingsSchema.optional(),
  /**
   * The language the show is written in, and the others its captions, descriptions, warnings
   * and moments are translated into, as language codes (en, fr, ar…).
   */
  languages: z.object({ base: z.string(), others: z.array(z.string()) }).optional(),
  relaxed: RelaxedSettingsSchema.optional(),
  editor: EditorSettingsSchema.optional(),
  safety: SafetySchema.optional(),
  schedule: ScheduleSchema.optional(),
  /** The fade new show/hide actions start with (the editor's default; 1 s ease in-out if unset). */
  defaultFade: z.object({ duration: z.number().nonnegative(), easing: EasingSchema }).optional(),
});
export type Show = z.infer<typeof ShowSchema>;
