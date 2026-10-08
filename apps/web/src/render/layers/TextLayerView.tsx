import { interpolate } from '@scrim/engine';
import type { TextLayer } from '@scrim/format';
import type { LayerViewProps } from './LayerView.js';
import { textStyle } from './text.js';

export function TextLayerView({ layer, show, state }: LayerViewProps<TextLayer>) {
  const text = state.layers[layer.id]?.text ?? layer.text;
  return (
    <div
      className="flex size-full items-center overflow-hidden whitespace-pre-wrap"
      style={textStyle(layer)}
    >
      <span className="w-full">{interpolate(text, show, state.vars)}</span>
    </div>
  );
}
