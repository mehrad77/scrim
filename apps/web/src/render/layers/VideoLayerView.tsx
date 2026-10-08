import { tweenValue } from '@scrim/engine';
import type { VideoLayer } from '@scrim/format';
import { useEffect, useRef } from 'react';
import { AUDIO_DEVICES_KEY, readLocal } from '../../lib/local.js';
import { applySink, syncMedia } from '../sync.js';
import { useMediaUrl } from '../useMediaUrl.js';
import { Missing } from './ImageLayerView.js';
import type { LayerViewProps } from './LayerView.js';

export function VideoLayerView({
  layer,
  state,
  variant,
  clock,
  onMediaEnded,
  onAudioBlocked,
}: LayerViewProps<VideoLayer>) {
  const url = useMediaUrl(layer.mediaId);
  const ref = useRef<HTMLVideoElement>(null);
  const ls = state.layers[layer.id];
  const silent = variant !== 'output';

  // Position and play state follow the engine; re-check periodically for drift.
  useEffect(() => {
    const el = ref.current;
    if (!el || variant === 'editor') return;
    const tick = () => syncMedia(el, ls?.media, clock(), layer.loop, onAudioBlocked);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [ls?.media, layer.loop, clock, variant, url, onAudioBlocked]);

  // Volume follows opacity, so fades and panic also fade sound.
  useEffect(() => {
    const el = ref.current;
    if (!el || silent) return;
    applySink(el, readLocal<Record<string, string>>(AUDIO_DEVICES_KEY, {})[layer.bus]);
    const id = setInterval(() => {
      if (!ls) return;
      const now = clock();
      const v = layer.volume * tweenValue(ls.opacity, now) * (1 - tweenValue(state.blackout, now));
      el.volume = Math.min(1, Math.max(0, v));
    }, 40);
    return () => clearInterval(id);
  }, [ls, state.blackout, layer.volume, layer.bus, clock, silent]);

  if (!url) return <Missing />;
  return (
    <video
      ref={ref}
      src={url}
      className="size-full"
      style={{ objectFit: layer.fit }}
      muted={silent}
      loop={layer.loop}
      playsInline
      preload={variant === 'editor' ? 'metadata' : 'auto'}
      onLoadedMetadata={(e) => {
        if (variant === 'editor')
          e.currentTarget.currentTime = Math.min(0.1, e.currentTarget.duration || 0);
      }}
      onEnded={() => variant === 'output' && !layer.loop && onMediaEnded?.(layer.id)}
    />
  );
}
