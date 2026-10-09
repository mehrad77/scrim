import { currentCaption, interpolate } from '@scrim/engine';
import type { TextLayer } from '@scrim/format';
import type { LayerViewProps } from './LayerView.js';
import { sizingClass, textStyle } from './text.js';

export function TextLayerView({ layer, show, state }: LayerViewProps<TextLayer>) {
  const text = state.layers[layer.id]?.text ?? layer.text;
  return (
    <div
      className={`flex items-center ${sizingClass(layer.sizing, 'overflow-hidden whitespace-pre-wrap')}`}
      style={textStyle(layer)}
    >
      <span className="w-full">
        {interpolate(text, show, state.vars, { caption: currentCaption(show, state.access) })}
      </span>
    </div>
  );
}
