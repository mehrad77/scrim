import type { EngineState } from '@scrim/engine';
import type { Layer, Show } from '@scrim/format';
import type { StageVariant } from '../Stage.js';
import { CounterLayerView } from './CounterLayerView.js';
import { ImageLayerView } from './ImageLayerView.js';
import { StateLayerView } from './StateLayerView.js';
import { TextLayerView } from './TextLayerView.js';
import { VideoLayerView } from './VideoLayerView.js';

export interface LayerViewProps<L extends Layer = Layer> {
  layer: L;
  show: Show;
  state: EngineState;
  variant: StageVariant;
  clock: () => number;
  onMediaEnded?: ((layerId: string) => void) | undefined;
  onAudioBlocked?: (() => void) | undefined;
}

export function LayerView(props: LayerViewProps) {
  const { layer } = props;
  switch (layer.kind) {
    case 'image':
      return <ImageLayerView {...props} layer={layer} />;
    case 'video':
      return <VideoLayerView {...props} layer={layer} />;
    case 'text':
      return <TextLayerView {...props} layer={layer} />;
    case 'counter':
      return <CounterLayerView {...props} layer={layer} />;
    case 'state':
      return <StateLayerView {...props} layer={layer} />;
    case 'audio':
      return null;
  }
}
