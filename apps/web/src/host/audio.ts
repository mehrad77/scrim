import { tweenValue, type EngineState } from '@scrim/engine';
import type { AudioLayer, Show } from '@scrim/format';
import { epochNow } from '../lib/clock.js';
import { AUDIO_DEVICES_KEY, readLocal } from '../lib/local.js';
import { applySink, syncMedia } from '../render/sync.js';
import { mediaUrl } from '../storage/media.js';

/**
 * Plays audio layers in the operator's tab, so sound comes from the show
 * machine even when every output is on another device. Volume follows the
 * layer's opacity (fades), the panic blackout and the sound mute.
 */
export class AudioEngine {
  #els = new Map<string, { el: HTMLAudioElement; layer: AudioLayer }>();
  #show: Show | null = null;
  #state: EngineState | null = null;
  #timer: ReturnType<typeof setInterval>;
  onEnded: ((layerId: string) => void) | null = null;

  constructor() {
    this.#timer = setInterval(() => this.#frame(), 40);
  }

  update(show: Show, state: EngineState): void {
    this.#show = show;
    this.#state = state;
    const layers = show.layers.filter((l): l is AudioLayer => l.kind === 'audio');
    const ids = new Set(layers.map((l) => l.id));
    for (const [id, { el }] of this.#els) {
      if (!ids.has(id)) {
        el.pause();
        el.removeAttribute('src');
        this.#els.delete(id);
      }
    }
    for (const layer of layers) {
      let entry = this.#els.get(layer.id);
      if (!entry || entry.layer.mediaId !== layer.mediaId) {
        entry?.el.pause();
        const el = new Audio();
        el.preload = 'auto';
        el.onended = () => this.onEnded?.(layer.id);
        void mediaUrl(layer.mediaId).then((url) => {
          if (url) el.src = url;
        });
        entry = { el, layer };
        this.#els.set(layer.id, entry);
      }
      entry.layer = layer;
      entry.el.loop = layer.loop;
      applySink(entry.el, readLocal<Record<string, string>>(AUDIO_DEVICES_KEY, {})[layer.bus]);
      syncMedia(entry.el, state.layers[layer.id]?.media, epochNow(), layer.loop);
    }
  }

  /** Re-apply output devices after the operator changes them. */
  refreshDevices(): void {
    const devices = readLocal<Record<string, string>>(AUDIO_DEVICES_KEY, {});
    for (const { el, layer } of this.#els.values()) applySink(el, devices[layer.bus]);
  }

  dispose(): void {
    clearInterval(this.#timer);
    for (const { el } of this.#els.values()) {
      el.pause();
      el.removeAttribute('src');
    }
    this.#els.clear();
  }

  #frame(): void {
    const state = this.#state;
    if (!state || !this.#show) return;
    const now = epochNow();
    // PANIC's blackout and the sound mute both silence everything.
    const black =
      (1 - tweenValue(state.blackout, now)) * (1 - (state.mute ? tweenValue(state.mute, now) : 0));
    for (const [id, { el, layer }] of this.#els) {
      const ls = state.layers[id];
      if (!ls) continue;
      el.volume = Math.min(1, Math.max(0, layer.volume * tweenValue(ls.opacity, now) * black));
      if (Math.floor(now / 250) !== Math.floor((now - 40) / 250))
        syncMedia(el, ls.media, now, layer.loop);
    }
  }
}

/** Play a short tone on a device, for the pre-show check. */
export async function testTone(deviceId?: string): Promise<void> {
  const ctx = new AudioContext();
  const sinkCtx = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (deviceId && sinkCtx.setSinkId) await sinkCtx.setSinkId(deviceId);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.65);
  await new Promise((r) => setTimeout(r, 700));
  await ctx.close();
}

export async function audioOutputs(): Promise<MediaDeviceInfo[]> {
  const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
  return devices.filter((d) => d.kind === 'audiooutput');
}

/** Device labels are hidden until the page has had microphone permission once. */
export async function unlockDeviceLabels(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}
