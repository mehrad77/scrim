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
};

const TextStyle = {
  fontSize: z.number().positive().default(72),
  color: z.string().default('#ffffff'),
  fontFamily: z.string().default('system-ui, sans-serif'),
  fontWeight: z.number().int().default(600),
  align: AlignSchema.default('center'),
  background: z.string().default('transparent'),
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
  display: z.enum(['value', 'bars']).default('value'),
  ...TextStyle,
});

export const LayerSchema = z.discriminatedUnion('kind', [
  ImageLayerSchema,
  VideoLayerSchema,
  AudioLayerSchema,
  TextLayerSchema,
  CounterLayerSchema,
  StateLayerSchema,
]);
export type Layer = z.infer<typeof LayerSchema>;
export type LayerKind = Layer['kind'];
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type VideoLayer = z.infer<typeof VideoLayerSchema>;
export type AudioLayer = z.infer<typeof AudioLayerSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type CounterLayer = z.infer<typeof CounterLayerSchema>;
export type StateLayer = z.infer<typeof StateLayerSchema>;

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
  | { type: 'openMoment'; momentId: string }
  | { type: 'closeMoment'; momentId: string }
  | { type: 'stopAll'; duration: number }
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
    z.object({ type: z.literal('openMoment'), momentId: Ref }),
    z.object({ type: z.literal('closeMoment'), momentId: Ref }),
    z.object({ type: z.literal('stopAll'), duration: z.number().nonnegative().default(1) }),
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

/** A spike-tape colour (1–8) that tags a scene or cue in the editor and on printed sheets. */
export const TapeSchema = z.number().int().min(1).max(8);

export const SceneSchema = z.object({ id: Id, name: z.string(), tape: TapeSchema.optional() });
export type Scene = z.infer<typeof SceneSchema>;

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

export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('go') }),
  z.object({ type: z.literal('panic') }),
  z.object({ type: z.literal('hold') }),
  z.object({ type: z.literal('back') }),
  z.object({ type: z.literal('standbyNext') }),
  z.object({ type: z.literal('standbyPrev') }),
  z.object({ type: z.literal('trigger'), triggerId: Ref }),
]);
export type Command = z.infer<typeof CommandSchema>;

export const InputsSchema = z.object({
  keys: z.array(z.object({ key: z.string(), command: CommandSchema })),
  midi: z.array(
    z.object({
      kind: z.enum(['note', 'cc']),
      channel: z.number().int().min(1).max(16).nullable(),
      number: z.number().int().min(0).max(127),
      command: CommandSchema,
    }),
  ),
  gamepad: z.array(z.object({ button: z.number().int().nonnegative(), command: CommandSchema })),
});
export type Inputs = z.infer<typeof InputsSchema>;

export const AudioBusSchema = z.object({ id: Id, name: z.string() });

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
  /** The fade new show/hide actions start with (the editor's default; 1 s ease in-out if unset). */
  defaultFade: z.object({ duration: z.number().nonnegative(), easing: EasingSchema }).optional(),
});
export type Show = z.infer<typeof ShowSchema>;
