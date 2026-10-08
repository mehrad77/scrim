import type { Show } from '@scrim/format';
import { nextWakeup, step } from './reducer.js';
import { initialState, reconcile, type EngineState } from './state.js';
import type { EngineEvent, EngineInput } from './types.js';

export type Clock = () => number;
export type EngineListener = (state: EngineState, events: EngineEvent[]) => void;

/** Stateful wrapper around `step`, with listeners and self-scheduled ticks. */
export class Engine {
  #show: Show;
  #state: EngineState;
  #listeners = new Set<EngineListener>();
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    show: Show,
    private readonly clock: Clock,
    state?: EngineState,
  ) {
    this.#show = show;
    this.#state = state ? reconcile(show, state) : initialState(show);
    this.#schedule();
  }

  get show(): Show {
    return this.#show;
  }

  get state(): EngineState {
    return this.#state;
  }

  dispatch(input: EngineInput): EngineEvent[] {
    const { state, events } = step(this.#show, this.#state, input, this.clock());
    this.#state = state;
    this.#emit(events);
    return events;
  }

  /** Swap in an edited show, keeping the run going. */
  setShow(show: Show): void {
    this.#show = show;
    this.#state = reconcile(show, this.#state);
    this.#emit([]);
  }

  subscribe(listener: EngineListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#listeners.clear();
  }

  #emit(events: EngineEvent[]): void {
    this.#schedule();
    for (const l of this.#listeners) l(this.#state, events);
  }

  #schedule(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const at = nextWakeup(this.#state);
    if (at === null) return;
    this.#timer = setTimeout(() => this.dispatch({ type: 'tick' }), Math.max(0, at - this.clock()));
  }
}
