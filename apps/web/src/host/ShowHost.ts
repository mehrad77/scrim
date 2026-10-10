import {
  Engine,
  clockOf,
  mediaPosition,
  relaxedSettings,
  runOrder,
  type EngineEvent,
  type EngineInput,
  type EngineState,
  type InputSource,
  type MomentState,
  type RunOrder,
  type TallySource,
} from '@scrim/engine';
import { DEFAULT_MARK } from '../lib/learn.js';
import { cueOrder, uid, type Command, type Show } from '@scrim/format';
import {
  CLOSE,
  type HostToRelay,
  type LocalMessage,
  type MomentSpec,
  type OutputStatus,
  type Presence,
  type RelayToHost,
  type RemoteView,
  type RunMode,
  type JoinInfo,
} from '@scrim/protocol';
import { epochNow } from '../lib/clock.js';
import { accessView } from '../lib/access.js';
import { orderChangeText } from '../lib/jumps.js';
import { conditionText, valueLabel } from '../lib/logic.js';
import { db, setSetting, type RunLogEntry, type RunRecord } from '../storage/db.js';
import { saveShow } from '../storage/shows.js';
import { ShowChannel } from '../transport/local.js';
import { RelayClient, type RelayStatus } from '../transport/relay.js';
import { AudioEngine } from './audio.js';
import {
  keyCommand,
  keyToCode,
  listenGamepads,
  listenMidi,
  midiCommand,
  type MidiEvent,
} from './inputs.js';
import { audienceUrl, createRoom, storedRoom, type RoomInfo } from './room.js';

const BEAT_MS = 500;
const LOST_AFTER_MS = 2000;
const JOURNAL_MS = 250;
const LOG_LIMIT = 500;
const DOUBLE_GO_MS = 300;
const KEPT_RETRY_MS = 60_000;
/** How often the host looks at the clock for opening hours; the minute is what counts. */
const CLOCK_CHECK_MS = 5_000;
/** A looping cue that keeps leaving out the same intense layer logs it once in this long. */
const LEFT_OUT_QUIET_MS = 10_000;

const SOURCE_NAMES: Record<TallySource, string> = {
  relay: 'phones',
  sim: 'pretend phones',
  buttons: 'buttons',
  counted: 'counted',
};

/** " · phones 31, buttons 9": where a moment's input came from, when not just phones. */
function sourceBreakdown(m: MomentState | undefined, type: string | undefined): string {
  const parts = Object.entries(m?.sources ?? {}).flatMap(([source, a]) => {
    const n = type === 'tap' ? a.count : a.n;
    return n > 0 ? [`${SOURCE_NAMES[source as TallySource]} ${n}`] : [];
  });
  return parts.length > 1 || (parts.length === 1 && !parts[0]!.startsWith('phones '))
    ? ` · ${parts.join(', ')}`
    : '';
}

/** State for output windows and the relay: they never need the Back snapshot. */
function publicState(state: EngineState): EngineState {
  const { back: _back, ...rest } = state;
  return rest;
}

export interface OutputLink {
  clientId: string;
  outputId: string;
  remote: boolean;
  lastBeat: number;
  status: OutputStatus | null;
}

export type OutputHealth = 'none' | 'ok' | 'lost';

export interface RelayInfo {
  status: RelayStatus | 'off';
  room: RoomInfo | null;
  presence: Presence;
  error: string | null;
}

export interface HostSnapshot {
  show: Show;
  state: EngineState;
  mode: RunMode;
  links: OutputLink[];
  health: Record<string, OutputHealth>;
  audioBlocked: string[];
  relay: RelayInfo;
  log: RunLogEntry[];
  wakeLock: boolean;
  midi: string[] | null;
  gamepads: string[];
  lastRunAt: number | null;
  resumedAt: string | null;
  /** The cue "Rehearse from here" started at, in the editor. */
  rehearsingFrom: string | null;
  /** The standby cue's performer has tapped Ready on their remote. */
  performerReady: boolean;
  /** Date.now() until which a second GO is ignored (the double-GO guard). */
  goLockedUntil: number;
  /** When a GO was last ignored by the guard, so the GO button can say so. */
  goDroppedAt: number | null;
  /** Deliberate deviations from the script this run (forced results, edits, moved standby). */
  offScript: OffScriptEntry[];
  /** How phones join the open room, for join codes and QR codes on stage. */
  join: JoinInfo | null;
  /** A GO being held down until the show's hold time passes; null when nothing is held. */
  goHold: { since: number; ms: number } | null;
  /** When a held GO was let go too soon, so the operator view can say how long to hold. */
  goHoldShortAt: number | null;
}

/** A controller press taken by Map mode instead of running its command. */
export type CapturedInput =
  { kind: 'midi'; event: MidiEvent } | { kind: 'gamepad'; button: number };

export interface OffScriptEntry {
  at: number;
  label: string;
}

/**
 * Everything that runs a show on the show machine: the engine, the local
 * output windows, the relay room, the crash journal, the run log, audio,
 * and hardware inputs. One per operator tab; UI reads it via `subscribe`.
 */
export class ShowHost {
  readonly hostId = uid('host');
  readonly engine: Engine;
  #mode: RunMode;
  #channel: ShowChannel;
  #audio = new AudioEngine();
  #links = new Map<string, OutputLink>();
  #everConnected = new Set<string>();
  #audioBlocked = new Set<string>();
  #relay: RelayClient<RelayToHost, HostToRelay> | null = null;
  #relayInfo: RelayInfo = {
    status: 'off',
    room: null,
    presence: { audience: 0, remotes: 0, outputs: 0 },
    error: null,
  };
  #run: RunRecord;
  #lastRunAt: number | null;
  #resumedAt: string | null;
  #rehearsingFrom: string | null;
  /** The cue a performer said they're ready for; only counts while it's on standby. */
  #readyFor: string | null = null;
  #wakeLock: WakeLockSentinel | null = null;
  #midi: string[] | null = null;
  #gamepads: string[] = [];
  #seq = 0;
  #listeners = new Set<() => void>();
  #snapshot!: HostSnapshot;
  #timers: ReturnType<typeof setInterval>[] = [];
  #mediaTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #cleanups: (() => void)[] = [];
  #journalAt = 0;
  #journalTimer: ReturnType<typeof setTimeout> | null = null;
  #logTimer: ReturnType<typeof setTimeout> | null = null;
  #lastMoments = '';
  #lastRemoteView = '';
  #lastAccess = '';
  #disposed = false;
  #lastGo = 0;
  #goDroppedAt: number | null = null;
  #offScript: OffScriptEntry[] = [];
  #capture: ((input: CapturedInput) => void) | null = null;
  /** Inputs held down for a hold-to-confirm GO, by physical input; the timer fires it. */
  #holds = new Map<string, { since: number; timer: ReturnType<typeof setTimeout> | null }>();
  #goHoldShortAt: number | null = null;
  /** When each button last counted a vote, so a bouncing contact counts once. */
  #lastCount = new Map<string, number>();
  /** When each intense layer was last noted as left out, so a looping cue logs it once. */
  #leftOut = new Map<string, number>();
  #keptRetry: ReturnType<typeof setTimeout> | null = null;
  #relayCalls = 0;
  /** The minute last sent to the engine, for opening hours. */
  #minute = -1;

  constructor(
    show: Show,
    opts: {
      state?: EngineState;
      mode?: RunMode;
      lastRunAt?: number | null;
      resumed?: boolean;
      /** Started by "Rehearse from here" at this cue. */
      from?: string;
      /** An unattended installation (the /kiosk page). */
      kiosk?: boolean;
    } = {},
  ) {
    this.engine = new Engine(show, epochNow, opts.state);
    this.#mode = opts.mode ?? 'rehearsal';
    this.#lastRunAt = opts.lastRunAt ?? null;
    const standby = cueOrder(show).find((c) => c.id === this.engine.state.lastFired);
    this.#resumedAt = opts.resumed ? (standby?.name ?? 'the top') : null;
    this.#rehearsingFrom = opts.from ?? null;
    this.#run = {
      id: uid('run'),
      showId: show.id,
      showName: show.name,
      startedAt: Date.now(),
      endedAt: Date.now(),
      cuesFired: 0,
      entries: [],
    };
    this.#channel = new ShowChannel(show.id);
    this.#channel.on((m) => this.#onLocal(m));
    this.engine.subscribe((state, events) => this.#onEngine(state, events));
    this.#audio.onEnded = (layerId) => this.dispatch({ type: 'mediaEnded', layerId });
    this.#timers.push(setInterval(() => this.#beat(), BEAT_MS));
    // Opening hours: the time of day, as each minute turns (and at once).
    this.#timers.push(setInterval(() => this.#clock(), CLOCK_CHECK_MS));
    this.#clock();
    this.#log(
      'info',
      opts.kiosk
        ? `Installation started${opts.resumed ? ` at ${this.#resumedAt}` : ''}`
        : opts.from
          ? `Rehearsing from “${opts.from}”`
          : opts.resumed
            ? `Resumed after reload at ${this.#resumedAt}`
            : 'Operator view opened',
    );
    this.#build();
    this.#broadcastShow();
    this.#broadcastState();
    this.#audio.update(show, this.engine.state);
    this.#scheduleMediaEnds();
    void this.#acquireWakeLock();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void this.#acquireWakeLock();
      // Waking from sleep: the opening hours may have changed while timers were paused.
      this.#clock();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.#cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));
    this.#cleanups.push(
      listenGamepads(
        (button) => this.#gamepad(button),
        (names) => this.#set(() => (this.#gamepads = names)),
        (button) => this.release(`pad:${button}`),
      ),
    );
    if (show.inputs.midi.length) void this.enableMidi();
  }

  // ---- React binding ----

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): HostSnapshot => this.#snapshot;

  // ---- commands ----

  dispatch(input: EngineInput): void {
    if (this.#disposed) return;
    const off = this.#offScriptLabel(input);
    if (input.type === 'reset') this.#offScript = [];
    else if (off) this.#offScript = [...this.#offScript, { at: Date.now(), label: off }].slice(-50);
    this.engine.dispatch(input);
    // Back at the top, the opening hours set the scene again.
    if (input.type === 'reset') this.#clock(true);
  }

  /** Clear the deviations and put the next cue in tonight's running order on standby. */
  backToScript(): void {
    const order = runOrder(this.engine.show, this.engine.state.order ?? null);
    const i = order.findIndex((c) => c.id === this.engine.state.lastFired);
    const next = order[i + 1] ?? order[0];
    this.#offScript = [];
    if (next) this.engine.dispatch({ type: 'standby', cueId: next.id });
    else this.#build();
  }

  #offScriptLabel(input: EngineInput): string | null {
    const show = this.engine.show;
    switch (input.type) {
      case 'setVar':
        return `Changed ${show.vars.find((v) => v.id === input.varId)?.name ?? 'a value'}`;
      case 'closeMoment':
        return input.result === undefined
          ? null
          : `Forced the result of ${show.moments.find((m) => m.id === input.momentId)?.name ?? 'a moment'}`;
      case 'standby':
      case 'standbyNext':
      case 'standbyPrev':
        return 'Moved standby';
      case 'action':
        return 'Ran an action by hand';
      case 'clear':
        return input.what === 'text' ? 'Cleared text from the stage' : 'Cleared pictures and video';
      case 'mute':
        // Unmuting goes back toward the script; only muting is a deviation.
        return (input.on ?? this.engine.state.mute?.to !== 1) ? 'Muted sound' : null;
      case 'seek':
        return 'Scrubbed media';
      default:
        return null;
    }
  }

  /** Tonight's running order: reorder or skip scenes live; null goes back to the show's order. */
  setOrder(order: RunOrder | null): void {
    this.dispatch({ type: 'setOrder', order });
  }

  /** Play a prepared setlist: its scenes in its order, every other scene skipped. */
  useSetlist(setlistId: string): void {
    const show = this.engine.show;
    const list = show.setlists?.find((l) => l.id === setlistId);
    if (!list) return;
    const scenes = list.scenes.filter((id) => show.scenes.some((s) => s.id === id));
    const skipped = show.scenes.map((s) => s.id).filter((id) => !scenes.includes(id));
    this.#log('info', `Setlist “${list.name}”`);
    this.setOrder({ scenes: [...scenes, ...skipped], skipped });
  }

  /** Keep tonight's order in the show as a setlist (Rehearsal: it edits the show). */
  saveSetlist(name: string): Promise<void> {
    const order = this.engine.state.order ?? null;
    const scenes = runOrder(this.engine.show, order).map((c) => c.sceneId);
    return this.saveShowEdit((show) => ({
      ...show,
      setlists: [...(show.setlists ?? []), { id: uid('set'), name, scenes: [...new Set(scenes)] }],
    }));
  }

  deleteSetlist(setlistId: string): Promise<void> {
    return this.saveShowEdit((show) => ({
      ...show,
      setlists: (show.setlists ?? []).filter((l) => l.id !== setlistId),
    }));
  }

  /** Double-GO protection: a bounced key or pedal must not skip a cue. */
  #goGuard(): boolean {
    const now = Date.now();
    if (now - this.#lastGo < DOUBLE_GO_MS) {
      // Never drop a GO silently: the GO button flashes its lockout ring.
      this.#set(() => (this.#goDroppedAt = now));
      return false;
    }
    this.#lastGo = now;
    return true;
  }

  command(c: Command, source: InputSource): void {
    switch (c.type) {
      case 'go':
        if (this.#goGuard()) this.dispatch({ type: 'go', source });
        return;
      case 'jump':
        // A jump that fires is a GO on another cue, so it gets the same guard.
        if (!c.fire || this.#goGuard())
          this.dispatch({ type: 'jump', target: c.target, fire: c.fire, source });
        return;
      case 'countVote': {
        // A bouncing button contact must count one person once.
        const key = `${source}:${c.option}`;
        const now = Date.now();
        if (now - (this.#lastCount.get(key) ?? 0) < DOUBLE_GO_MS) return;
        this.#lastCount.set(key, now);
        this.dispatch({
          type: 'countVote',
          option: c.option,
          source: 'buttons',
          ...(c.momentId ? { momentId: c.momentId } : {}),
        });
        return;
      }
      case 'panic':
        return this.dispatch({ type: 'panic' });
      case 'hold':
        return this.dispatch({ type: 'hold' });
      case 'back':
        return this.dispatch({ type: 'back' });
      case 'clearText':
      case 'clearMedia': {
        // One key does both: clear, and if this kind was just cleared, bring it back.
        const what = c.type === 'clearText' ? 'text' : 'media';
        return this.dispatch({
          type: this.engine.state.cleared?.[what] ? 'unclear' : 'clear',
          what,
        });
      }
      case 'mute':
        return this.dispatch({ type: 'mute' });
      case 'standbyNext':
        return this.dispatch({ type: 'standbyNext' });
      case 'standbyPrev':
        return this.dispatch({ type: 'standbyPrev' });
      case 'trigger':
        return this.dispatch({ type: 'trigger', triggerId: c.triggerId, source });
    }
  }

  /**
   * Map mode: send the next MIDI and gamepad presses here instead of running their commands.
   * Pass null to stop. Keys are taken by the operator view itself; Esc always panics.
   */
  captureInputs(fn: ((input: CapturedInput) => void) | null): void {
    this.#capture = fn;
  }

  /** Save a new key, MIDI and gamepad map into the show (Map mode). */
  setInputs(inputs: Show['inputs']): Promise<void> {
    return this.saveShowEdit((show) => ({ ...show, inputs }));
  }

  /** Keyboard input from this tab or any other Scrim window of this show. */
  key(key: string, source: InputSource = 'keyboard', code?: string): boolean {
    const c = keyCommand(this.engine.show.inputs, key, code);
    if (!c) return false;
    this.press(c, source, `key:${code || keyToCode(key)}`);
    return true;
  }

  keyUp(key: string, code?: string): void {
    this.release(`key:${code || keyToCode(key)}`);
  }

  /**
   * A key, pedal, pad or the GO button went down. With a hold time set, GO fires only once the
   * same input has been held that long (UX_PRINCIPLES › inclusive operation); everything else
   * acts on the press.
   */
  press(c: Command, source: InputSource, input: string): void {
    const ms = this.engine.show.operator?.goHoldMs ?? 0;
    if (c.type !== 'go' || ms <= 0) return this.command(c, source);
    if (this.#holds.has(input)) return;
    const hold = { since: Date.now(), timer: null as ReturnType<typeof setTimeout> | null };
    hold.timer = setTimeout(() => {
      hold.timer = null;
      this.command({ type: 'go' }, source);
      this.#build();
    }, ms);
    this.#holds.set(input, hold);
    this.#build();
  }

  /** That input came back up. A GO let go before its hold time doesn't fire. */
  release(input: string, early = true): void {
    const hold = this.#holds.get(input);
    if (!hold) return;
    this.#holds.delete(input);
    if (hold.timer) {
      clearTimeout(hold.timer);
      if (early) this.#goHoldShortAt = Date.now();
    }
    this.#build();
  }

  /** Let go of everything held, as when the window loses focus mid-press. */
  releaseAll(): void {
    for (const input of [...this.#holds.keys()]) this.release(input, false);
  }

  setMode(mode: RunMode): void {
    this.#set(() => (this.#mode = mode));
    this.#log('info', mode === 'show' ? 'Show mode: editing locked' : 'Rehearsal mode');
    this.#broadcastState();
    this.#journal(true);
  }

  /** Apply an edit made while the show is loaded (rehearsal live edits). */
  setShow(show: Show): void {
    this.engine.setShow(show);
    this.#broadcastShow();
    this.#build();
  }

  async saveShowEdit(recipe: (show: Show) => Show): Promise<void> {
    const next = { ...recipe(structuredClone(this.engine.show)), updatedAt: Date.now() };
    await saveShow(next);
    this.setShow(next);
    this.#channel.post({ t: 'showSaved', show: next });
  }

  identify(outputId: string | null): void {
    this.#channel.post({ t: 'identify', outputId });
  }

  dismissOutput(outputId: string): void {
    this.#set(() => this.#everConnected.delete(outputId));
  }

  refreshAudioDevices(): void {
    this.#audio.refreshDevices();
  }

  async enableMidi(): Promise<void> {
    try {
      const stop = await listenMidi(
        (e) => {
          const input = `midi:${e.kind}:${e.channel}:${e.number}`;
          if (e.release) return this.release(input);
          if (this.#capture) return this.#capture({ kind: 'midi', event: e });
          const c = midiCommand(this.engine.show.inputs, e);
          if (c) this.press(c, 'midi', input);
        },
        (names) => this.#set(() => (this.#midi = names)),
      );
      this.#cleanups.push(stop);
    } catch (e) {
      this.#log('warning', `MIDI unavailable: ${(e as Error).message}`);
      this.#set(() => (this.#midi = null));
    }
  }

  // ---- relay ----

  async connectRelay(opts: { fresh?: boolean; keep?: boolean } = {}): Promise<void> {
    if (this.#disposed) return;
    if (this.#keptRetry) clearTimeout(this.#keptRetry);
    this.#keptRetry = null;
    // Only the latest call may build a client: one awaiting storage when another starts gives up.
    const call = ++this.#relayCalls;
    this.#relay?.close();
    this.#relay = null;
    const showId = this.engine.show.id;
    // Remembered so a reload mid-show reopens the room by itself.
    void setSetting(`roomActive:${showId}`, true);
    let room = opts.fresh ? undefined : await storedRoom(showId);
    try {
      room ??= await createRoom(showId, undefined, opts.keep);
    } catch (e) {
      if (call !== this.#relayCalls || this.#disposed) return;
      this.#set(
        () =>
          (this.#relayInfo = { ...this.#relayInfo, status: 'failed', error: (e as Error).message }),
      );
      this.#log('warning', `Audience room unavailable: ${(e as Error).message}`);
      return;
    }
    if (call !== this.#relayCalls || this.#disposed) return;
    const relay = new RelayClient<RelayToHost, HostToRelay>({
      relay: room.relay,
      code: room.code,
      role: 'host',
      key: room.hostKey,
      client: this.hostId.replace('_', '-'),
      fatal: [CLOSE.unauthorized, CLOSE.notFound, CLOSE.replaced],
    });
    this.#relay = relay;
    this.#set(
      () =>
        (this.#relayInfo = { ...this.#relayInfo, room: room!, status: 'connecting', error: null }),
    );
    relay.onStatus((status) => {
      if (this.#relay !== relay) return;
      if (status === 'open') {
        this.#lastMoments = '';
        this.#lastRemoteView = '';
        this.#lastAccess = '';
        relay.send({ t: 'show', show: this.engine.show });
        // Whether the room is kept is the stored room's to say: kept from the editor or a room
        // pass, or let go.
        relay.send({ t: 'keep', keep: !!room!.keep });
        this.#syncRelay(true);
        this.#log('info', `Audience room ${room!.code} connected`);
      }
      if (status === 'failed') {
        const code = relay.lastClose?.code;
        if (code === CLOSE.notFound || code === CLOSE.unauthorized) {
          // A kept code is printed on QR codes in the room: never swap it silently. Say so and
          // keep trying; staff can open a new code from the installation panel.
          if (room!.keep) {
            this.#log(
              'warning',
              `The kept room code ${room!.code} isn't answering; trying again every minute`,
            );
            this.#keptRetry = setTimeout(() => void this.connectRelay(), KEPT_RETRY_MS);
          } else {
            // The room expired; open a fresh one.
            void this.connectRelay({ fresh: true });
            return;
          }
        }
        this.#log('warning', relay.lastClose?.reason || 'Audience room closed');
      }
      if (status === 'connecting' && this.#relayInfo.status === 'open') {
        this.#log('warning', 'Audience room connection lost; reconnecting');
      }
      this.#set(
        () =>
          (this.#relayInfo = {
            ...this.#relayInfo,
            status,
            error: status === 'failed' ? relay.lastClose?.reason || 'Disconnected' : null,
            // Counts are unknown while offline; the relay resends them on reconnect.
            presence:
              status === 'open'
                ? this.#relayInfo.presence
                : { audience: 0, remotes: 0, outputs: 0 },
          }),
      );
    });
    relay.onMessage((msg) => this.#onRelay(msg));
  }

  disconnectRelay(): void {
    // A connect still waiting on storage must not bring the room back.
    this.#relayCalls++;
    if (this.#keptRetry) clearTimeout(this.#keptRetry);
    this.#keptRetry = null;
    void setSetting(`roomActive:${this.engine.show.id}`, false);
    this.#relay?.close();
    this.#relay = null;
    for (const link of [...this.#links.values()])
      if (link.remote) this.#links.delete(link.clientId);
    this.#set(
      () =>
        (this.#relayInfo = {
          ...this.#relayInfo,
          status: 'off',
          presence: { audience: 0, remotes: 0, outputs: 0 },
        }),
    );
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#channel.post({ t: 'closing', hostId: this.hostId });
    this.#timers.forEach(clearInterval);
    this.#mediaTimers.forEach(clearTimeout);
    for (const h of this.#holds.values()) if (h.timer) clearTimeout(h.timer);
    this.#cleanups.forEach((c) => c());
    if (this.#keptRetry) clearTimeout(this.#keptRetry);
    this.#audio.dispose();
    this.#relay?.close();
    this.engine.dispose();
    this.#channel.close();
    void this.#wakeLock?.release().catch(() => undefined);
    if (this.#journalTimer) clearTimeout(this.#journalTimer);
    this.#flushLog();
    this.#listeners.clear();
  }

  // ---- internals ----

  /** Tell the engine the time of day when the minute changes; it sets the opening hours. */
  #clock(force = false): void {
    if (!this.engine.show.schedule) return;
    // The wall clock: opening hours follow the venue's time, not the show's.
    const now = new Date();
    const minute = Math.floor(now.getTime() / 60_000);
    if (minute === this.#minute && !force) return;
    // The first look at the clock announces the hours even if the value is already right.
    const first = this.#minute === -1;
    this.#minute = minute;
    this.dispatch({ type: 'clock', ...clockOf(now), force: force || first });
  }

  #onEngine(state: EngineState, events: EngineEvent[]): void {
    this.#logEvents(events);
    this.#broadcastState();
    this.#audio.update(this.engine.show, state);
    this.#scheduleMediaEnds();
    this.#syncRelay(false);
    this.#journal(events.some((e) => e.type === 'cueFired' || e.type === 'panic'));
    this.#build();
  }

  #onLocal(msg: LocalMessage): void {
    switch (msg.t) {
      case 'hello':
        if (msg.role === 'output' && msg.outputId)
          this.#touchLink(msg.clientId, msg.outputId, false, null);
        this.#broadcastShow();
        this.#broadcastState();
        this.#channel.post({ t: 'join', join: this.#join });
        return;
      case 'outputBeat':
        this.#touchLink(msg.clientId, msg.outputId, false, msg.status);
        return;
      case 'bye':
        if (this.#links.delete(msg.clientId)) this.#build();
        return;
      case 'mediaEnded':
        this.dispatch({ type: 'mediaEnded', layerId: msg.layerId });
        return;
      case 'roomChanged':
        // Only a show that has its room open follows; it picks the stored room up again.
        if (this.#relay) void this.connectRelay();
        return;
      case 'showSaved':
        this.setShow(msg.show);
        return;
      case 'key':
        this.key(msg.key, 'keyboard', msg.code);
        return;
      case 'keyUp':
        this.keyUp(msg.key, msg.code);
        return;
      case 'audioBlocked':
        if (!this.#audioBlocked.has(msg.outputId)) {
          this.#audioBlocked.add(msg.outputId);
          this.#log(
            'warning',
            `Output "${this.#outputName(msg.outputId)}" blocked sound: click it once`,
          );
          this.#build();
        }
        return;
      default:
        return;
    }
  }

  #onRelay(msg: RelayToHost): void {
    switch (msg.t) {
      case 'totals':
        for (const t of msg.totals) {
          this.dispatch({
            type: 'momentAgg',
            momentId: t.momentId,
            tally: t.tally,
            count: t.count,
            sum: t.sum,
            sumSq: t.sumSq,
            n: t.n,
            entries: t.entries,
          });
        }
        return;
      case 'presence':
        this.#set(() => (this.#relayInfo = { ...this.#relayInfo, presence: msg.presence }));
        return;
      case 'trigger':
        this.dispatch({ type: 'trigger', triggerId: msg.triggerId, source: 'remote' });
        return;
      case 'command':
        // Remote GO puts the network on GO's path, so it runs only when the show asks for it.
        if (!this.engine.show.operator?.remoteGo)
          return this.#log('warning', 'A remote pressed GO, but Remote GO is off for this show');
        this.command({ type: msg.command }, 'remote');
        return;
      case 'ready': {
        const show = this.engine.show;
        const cue = show.cues.find((c) => c.id === msg.cueId);
        if (!cue || cue.id !== this.engine.state.standby || this.#readyFor === cue.id) return;
        this.#readyFor = cue.id;
        const who = show.triggers.find((t) => t.id === cue.waitFor)?.name ?? 'Performer';
        this.#log('trigger', `${who} is ready for “${cue.name}”`);
        this.#syncRelay(true);
        this.#build();
        return;
      }
      case 'outputBeat':
        this.#touchLink(msg.clientId, msg.outputId, true, msg.status);
        return;
      case 'outputGone':
        if (this.#links.delete(msg.clientId)) this.#build();
        return;
      case 'error':
        this.#log('warning', msg.message);
        return;
      default:
        return;
    }
  }

  #touchLink(
    clientId: string,
    outputId: string,
    remote: boolean,
    status: OutputStatus | null,
  ): void {
    const known = this.#links.get(clientId);
    const link: OutputLink = {
      clientId,
      outputId,
      remote,
      lastBeat: Date.now(),
      status: status ?? known?.status ?? null,
    };
    this.#links.set(clientId, link);
    if (status?.fullscreen) this.#audioBlocked.delete(outputId);
    if (
      !this.#everConnected.has(outputId) ||
      !known ||
      JSON.stringify(known.status) !== JSON.stringify(link.status)
    ) {
      if (!known)
        this.#log(
          'info',
          `Output "${this.#outputName(outputId)}" connected${remote ? ' (remote)' : ''}`,
        );
      this.#everConnected.add(outputId);
      this.#build();
    }
  }

  #beat(): void {
    this.#channel.post({ t: 'beat', hostId: this.hostId });
    const now = Date.now();
    let changed = false;
    for (const [id, link] of this.#links) {
      if (now - link.lastBeat > LOST_AFTER_MS) {
        this.#links.delete(id);
        this.#log('warning', `Output "${this.#outputName(link.outputId)}" stopped responding`);
        changed = true;
      }
    }
    if (changed) this.#build();
  }

  #broadcastShow(): void {
    this.#channel.post({ t: 'show', show: this.engine.show });
    this.#relay?.send({ t: 'show', show: this.engine.show });
  }

  #broadcastState(): void {
    this.#seq += 1;
    const state = publicState(this.engine.state);
    this.#channel.post({
      t: 'state',
      seq: this.#seq,
      state,
      mode: this.#mode,
      offset: 0,
    });
    if (this.#relay?.status === 'open') {
      this.#relay.send({
        t: 'state',
        state,
        mode: this.#mode,
        offset: this.#serverOffset(),
      });
    }
  }

  /** Engine time + offset = relay server time. */
  #serverOffset(): number {
    return Date.now() - epochNow() + (this.#relay?.offset ?? 0);
  }

  #syncRelay(force: boolean): void {
    const relay = this.#relay;
    if (!relay || relay.status !== 'open') return;
    const show = this.engine.show;
    const state = this.engine.state;
    if (force)
      relay.send({
        t: 'state',
        state: publicState(state),
        mode: this.#mode,
        offset: this.#serverOffset(),
      });
    const offset = this.#serverOffset();
    const open: MomentSpec[] = show.moments
      .filter((m) => state.moments[m.id]?.status === 'open')
      .map((m) => {
        const closesAt = state.moments[m.id]!.closesAt;
        return {
          id: m.id,
          type: m.type,
          prompt: m.prompt,
          options: m.options,
          min: m.min,
          max: m.max,
          variants: m.variants,
          moderated: m.moderated,
          closesAt: closesAt === null || state.held ? null : Math.round(closesAt + offset),
          ...(m.i18n ? { i18n: m.i18n } : {}),
        };
      });
    const moments = JSON.stringify(open);
    if (force || moments !== this.#lastMoments) {
      this.#lastMoments = moments;
      relay.send({ t: 'moments', title: show.name, open });
    }
    const order = cueOrder(show);
    const standby = order.find((c) => c.id === state.standby);
    const fired = order.find((c) => c.id === state.lastFired);
    const view: Omit<RemoteView, 'connected'> = {
      showName: show.name,
      triggers: show.triggers.map((t) => ({ id: t.id, name: t.name, color: t.color })),
      standby: standby?.name ?? null,
      lastFired: fired?.name ?? null,
      standbyId: standby?.id ?? null,
      waitFor: standby?.waitFor ?? null,
      ready: !!standby && this.#readyFor === standby.id,
      firedFor: fired?.waitFor ?? null,
      cueTriggers: [...new Set(show.cues.flatMap((c) => (c.waitFor ? [c.waitFor] : [])))],
      canGo: !!show.operator?.remoteGo,
      held: state.held,
      goHoldMs: show.operator?.goHoldMs ?? 0,
    };
    const viewJson = JSON.stringify(view);
    // The access channel goes to phones only when it changes; the relay keeps it for late joiners.
    // None goes too, so phones hear that a relaxed performance ended, even after a reconnect.
    const access = accessView(show, state);
    const accessJson = access ? JSON.stringify(access) : '';
    if (force || accessJson !== this.#lastAccess) {
      this.#lastAccess = accessJson;
      relay.send({ t: 'access', view: access });
    }
    if (force || viewJson !== this.#lastRemoteView) {
      this.#lastRemoteView = viewJson;
      relay.send({ t: 'remoteView', view });
    }
  }

  /** Fire mediaEnded from known durations, so it works with no local output open. */
  #scheduleMediaEnds(): void {
    const show = this.engine.show;
    const state = this.engine.state;
    const now = epochNow();
    const wanted = new Map<string, number>();
    for (const layer of show.layers) {
      if ((layer.kind !== 'video' && layer.kind !== 'audio') || layer.loop) continue;
      const clock = state.layers[layer.id]?.media;
      const duration = show.media.find((m) => m.id === layer.mediaId)?.duration;
      if (!clock?.playing || !duration) continue;
      wanted.set(layer.id, Math.max(0, (duration - mediaPosition(clock, now)) * 1000) + 100);
    }
    for (const [id, t] of this.#mediaTimers) {
      if (!wanted.has(id)) {
        clearTimeout(t);
        this.#mediaTimers.delete(id);
      }
    }
    for (const [id, ms] of wanted) {
      clearTimeout(this.#mediaTimers.get(id));
      this.#mediaTimers.set(
        id,
        setTimeout(() => {
          this.#mediaTimers.delete(id);
          this.dispatch({ type: 'mediaEnded', layerId: id });
        }, ms),
      );
    }
  }

  #journal(now: boolean): void {
    const write = () => {
      this.#journalTimer = null;
      this.#journalAt = Date.now();
      void db().then((d) =>
        d.put('journal', {
          showId: this.engine.show.id,
          runId: this.#run.id,
          mode: this.#mode,
          savedAt: Date.now(),
          // Lean and fast to write; Back isn't offered after a crash.
          state: publicState(this.engine.state),
        }),
      );
    };
    if (now || Date.now() - this.#journalAt > JOURNAL_MS) {
      if (this.#journalTimer) clearTimeout(this.#journalTimer);
      write();
    } else {
      this.#journalTimer ??= setTimeout(write, JOURNAL_MS);
    }
  }

  /**
   * Log what happened and why (UX principle 7). Rules that ran get a line each; the ones a
   * trigger checked but skipped fold into one "N skipped" line that says what each one saw.
   */
  #logEvents(events: EngineEvent[]): void {
    const show = this.engine.show;
    let skipped: string[] = [];
    const flush = () => {
      if (!skipped.length) return;
      this.#log('rule', `${skipped.length} rule${skipped.length > 1 ? 's' : ''} skipped`, skipped);
      skipped = [];
    };
    for (const e of events) {
      if (e.type !== 'ruleEvaluated') {
        flush();
        this.#logEvent(e);
        continue;
      }
      const name = show.rules.find((r) => r.id === e.ruleId)?.name ?? 'A rule';
      const checks = e.checks.map((c) => {
        const said = conditionText(show, { varId: c.varId, op: c.op, value: c.expected });
        return c.ok
          ? `${said} ✓`
          : `${said} ✗ (it was ${c.actual ? valueLabel(show, c.varId, c.actual) : 'empty'})`;
      });
      if (e.ran)
        this.#log('rule', `Rule “${name}” ran${checks.length ? `: ${checks.join(', ')}` : ''}`);
      else skipped.push(`“${name}”: ${checks.filter((c) => c.endsWith(')')).join(', ')}`);
    }
    flush();
  }

  #logEvent(e: EngineEvent): void {
    const show = this.engine.show;
    switch (e.type) {
      case 'cueFired':
        this.#run.cuesFired += 1;
        return this.#log(
          'cue',
          `${e.name}${e.source !== 'operator' && e.source !== 'keyboard' ? ` (${e.source})` : ''}`,
        );
      case 'momentOpened':
        return this.#log(
          'moment',
          `Opened "${show.moments.find((m) => m.id === e.momentId)?.name ?? e.momentId}"`,
        );
      case 'momentClosed': {
        const def = show.moments.find((m) => m.id === e.momentId);
        const name = def?.name ?? e.momentId;
        const option = def?.type === 'vote' && def.options.find((o) => o.id === e.result);
        const result = Array.isArray(e.result)
          ? `${e.result.length} entries`
          : option
            ? option.label
            : String(e.result ?? '');
        return this.#log(
          'moment',
          `Closed "${name}": ${result}${e.usedDefault ? ` ${DEFAULT_MARK}` : ''}${sourceBreakdown(this.engine.state.moments[e.momentId], def?.type)}`,
        );
      }
      case 'trigger':
        return this.#log(
          'trigger',
          `${show.triggers.find((t) => t.id === e.triggerId)?.name ?? e.triggerId} (${e.source})`,
        );
      case 'panic':
        return this.#log('panic', 'PANIC — all outputs to black');
      case 'release':
        return this.#log('panic', 'Released from blackout');
      case 'hold':
        return this.#log('info', e.on ? 'Hold' : 'Resumed');
      case 'reset':
        return this.#log('info', 'Reset to top');
      case 'back':
        return this.#log('cue', `Back to before “${e.name}”`);
      case 'cleared': {
        const kind = e.what === 'text' ? 'text' : 'pictures and video';
        return this.#log(
          'panic',
          e.layers
            ? `Cleared ${kind} (${e.layers} layer${e.layers > 1 ? 's' : ''})`
            : `No ${kind} on stage to clear`,
        );
      }
      case 'uncleared':
        return this.#log(
          'panic',
          `Brought ${e.what === 'text' ? 'text' : 'pictures and video'} back`,
        );
      case 'mute':
        return this.#log('panic', e.on ? 'Sound muted' : 'Sound back on');
      case 'relaxed': {
        const r = relaxedSettings(show);
        const pct = (n: number) => `${Math.round(n * 100)}%`;
        return this.#log(
          'info',
          e.on
            ? `Relaxed performance: outputs at ${pct(r.brightness)}, sound at ${pct(r.volume)}, fades at least ${r.minFade} s`
            : 'Relaxed performance off',
        );
      }
      case 'leftOut': {
        const now = Date.now();
        if (now - (this.#leftOut.get(e.layerId) ?? 0) < LEFT_OUT_QUIET_MS) return;
        this.#leftOut.set(e.layerId, now);
        return this.#log('info', `Relaxed: left out “${e.name}”`);
      }
      case 'orderChanged':
        return this.#log('info', orderChangeText(show, e.prev, e.order));
      case 'warning':
        return this.#log('warning', e.message);
      default:
        return;
    }
  }

  #log(kind: RunLogEntry['kind'], text: string, detail?: string[]): void {
    this.#run.entries.push({ at: Date.now(), kind, text, ...(detail ? { detail } : {}) });
    if (this.#run.entries.length > LOG_LIMIT * 4)
      this.#run.entries.splice(0, this.#run.entries.length - LOG_LIMIT * 4);
    this.#logTimer ??= setTimeout(() => this.#flushLog(), 1000);
    if (this.#snapshot) this.#build();
  }

  #flushLog(): void {
    if (this.#logTimer) clearTimeout(this.#logTimer);
    this.#logTimer = null;
    this.#run.endedAt = Date.now();
    const record = structuredClone(this.#run);
    void db().then((d) => d.put('runs', record));
  }

  #goHold(): HostSnapshot['goHold'] {
    const ms = this.engine.show.operator?.goHoldMs ?? 0;
    const waiting = [...this.#holds.values()].filter((h) => h.timer);
    if (!ms || !waiting.length) return null;
    return { since: Math.min(...waiting.map((h) => h.since)), ms };
  }

  #gamepad(button: number): void {
    if (this.#capture) return this.#capture({ kind: 'gamepad', button });
    const m = this.engine.show.inputs.gamepad.find((g) => g.button === button);
    if (m) this.press(m.command, 'gamepad', `pad:${button}`);
  }

  async #acquireWakeLock(): Promise<void> {
    if (this.#disposed || !('wakeLock' in navigator) || this.#wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      this.#wakeLock = lock;
      lock.addEventListener('release', () => {
        this.#wakeLock = null;
        if (!this.#disposed) this.#build();
      });
      this.#build();
    } catch {
      // not visible or not allowed; retried when the tab becomes visible
    }
  }

  #outputName(outputId: string): string {
    return this.engine.show.outputs.find((o) => o.id === outputId)?.name ?? outputId;
  }

  #join: JoinInfo | null = null;

  #set(fn: () => void): void {
    fn();
    this.#build();
  }

  #build(): void {
    const health: Record<string, OutputHealth> = {};
    const links = [...this.#links.values()];
    // Outputs show the join code while the room is open.
    // While the room is open or coming back: a reconnect mustn't blank the code on a wall.
    const live = this.#relayInfo.status === 'open' || this.#relayInfo.status === 'connecting';
    const room = live ? this.#relayInfo.room : null;
    const join = room ? { code: room.code, url: audienceUrl(room) } : null;
    if (JSON.stringify(join) !== JSON.stringify(this.#join)) {
      this.#join = join;
      this.#channel.post({ t: 'join', join });
    }
    for (const o of this.engine.show.outputs) {
      const live = links.some((l) => l.outputId === o.id);
      health[o.id] = live ? 'ok' : this.#everConnected.has(o.id) ? 'lost' : 'none';
    }
    this.#snapshot = {
      show: this.engine.show,
      state: this.engine.state,
      mode: this.#mode,
      links,
      health,
      audioBlocked: [...this.#audioBlocked],
      relay: this.#relayInfo,
      log: this.#run.entries.slice(-LOG_LIMIT),
      wakeLock: !!this.#wakeLock,
      midi: this.#midi,
      gamepads: this.#gamepads,
      lastRunAt: this.#lastRunAt,
      resumedAt: this.#resumedAt,
      rehearsingFrom: this.#rehearsingFrom,
      performerReady: this.#readyFor !== null && this.#readyFor === this.engine.state.standby,
      goLockedUntil: this.#lastGo + DOUBLE_GO_MS,
      goDroppedAt: this.#goDroppedAt,
      offScript: this.#offScript,
      join: this.#join,
      goHold: this.#goHold(),
      goHoldShortAt: this.#goHoldShortAt,
    };
    for (const l of this.#listeners) l();
  }
}
