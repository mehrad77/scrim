import type { Easing } from '@scrim/format';

/** A value animating from `from` to `to`, starting at epoch ms `t0`, over `dur` ms. */
export interface Tween {
  from: number;
  to: number;
  t0: number;
  dur: number;
  easing: Easing;
}

const ease: Record<Easing, (x: number) => number> = {
  linear: (x) => x,
  easeIn: (x) => x * x,
  easeOut: (x) => 1 - (1 - x) * (1 - x),
  easeInOut: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
};

export function still(value: number): Tween {
  return { from: value, to: value, t0: 0, dur: 0, easing: 'linear' };
}

export function tweenValue(t: Tween, now: number): number {
  if (t.dur <= 0 || now >= t.t0 + t.dur) return t.to;
  if (now <= t.t0) return t.from;
  return t.from + (t.to - t.from) * ease[t.easing]((now - t.t0) / t.dur);
}

export function tweenActive(t: Tween, now: number): boolean {
  return t.dur > 0 && now < t.t0 + t.dur && t.from !== t.to;
}

/** Start a new tween from wherever `current` is at `now`. */
export function retarget(
  current: Tween,
  to: number,
  now: number,
  seconds: number,
  easing: Easing,
): Tween {
  const from = tweenValue(current, now);
  if (seconds <= 0) return still(to);
  return { from, to, t0: now, dur: seconds * 1000, easing };
}
