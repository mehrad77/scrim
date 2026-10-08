import type { ImageLayer } from '@scrim/format';
import { useMediaUrl } from '../useMediaUrl.js';
import type { LayerViewProps } from './LayerView.js';

export function ImageLayerView({ layer }: LayerViewProps<ImageLayer>) {
  const url = useMediaUrl(layer.mediaId);
  if (!url) return <Missing />;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="size-full select-none"
      style={{ objectFit: layer.fit }}
    />
  );
}

export function Missing() {
  return (
    <div className="size-full bg-[repeating-linear-gradient(45deg,#222_0_10px,#2a2a2a_10px_20px)]" />
  );
}
