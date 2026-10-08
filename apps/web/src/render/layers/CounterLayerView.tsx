import { counterValue } from '@scrim/engine';
import type { CounterLayer } from '@scrim/format';
import { useEffect, useState } from 'react';
import { formatClock } from '../../lib/clock.js';
import type { LayerViewProps } from './LayerView.js';
import { textStyle } from './text.js';

export function CounterLayerView({ layer, state, clock }: LayerViewProps<CounterLayer>) {
  const c = state.layers[layer.id]?.counter;
  const read = () => (c ? counterValue(c, layer.mode, clock()) : layer.start);
  const [value, setValue] = useState(read);
  useEffect(() => {
    setValue(read());
    if (!c?.running || layer.mode === 'count') return;
    const id = setInterval(() => setValue(read()), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, layer.mode, layer.start, clock]);
  const shown =
    layer.format === 'clock'
      ? formatClock(layer.mode === 'countdown' ? Math.ceil(value) : Math.floor(value))
      : String(Math.round(value));
  return (
    <div className="flex size-full items-center tabular-nums" style={textStyle(layer)}>
      <span className="w-full">{shown}</span>
    </div>
  );
}
