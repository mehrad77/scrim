import { mediaPosition, type MediaClock } from '@scrim/engine';

const DRIFT_TOLERANCE = 0.25;

/** Keep a media element in line with the engine's media clock. */
export function syncMedia(
  el: HTMLMediaElement,
  clock: MediaClock | undefined,
  now: number,
  loop: boolean,
  onBlocked?: (e: Error) => void,
): void {
  if (!clock) return;
  let expected = mediaPosition(clock, now);
  const duration = el.duration;
  if (Number.isFinite(duration) && duration > 0) {
    expected = loop ? expected % duration : Math.min(expected, duration);
  }
  if (el.readyState >= 1 && Math.abs(el.currentTime - expected) > DRIFT_TOLERANCE) {
    el.currentTime = expected;
  }
  const ended = !loop && Number.isFinite(duration) && expected >= duration;
  if (clock.playing && !ended) {
    if (el.paused) {
      el.play().catch((e: Error) => {
        if (e.name === 'NotAllowedError' && !el.muted) {
          // Autoplay with sound was blocked: keep the picture running and report it.
          el.muted = true;
          onBlocked?.(e);
          void el.play().catch(() => undefined);
        }
      });
    }
  } else if (!el.paused) {
    el.pause();
  }
}

type SinkElement = HTMLMediaElement & {
  setSinkId?: (id: string) => Promise<void>;
  sinkId?: string;
};

export function applySink(el: HTMLMediaElement, deviceId: string | undefined): void {
  const s = el as SinkElement;
  const target = deviceId ?? '';
  if (s.setSinkId && s.sinkId !== target) void s.setSinkId(target).catch(() => undefined);
}
