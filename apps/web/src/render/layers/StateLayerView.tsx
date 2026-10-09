import { formatValue } from '@scrim/engine';
import type { StateLayer } from '@scrim/format';
import type { LayerViewProps } from './LayerView.js';
import { sizingClass, textStyle } from './text.js';

export function StateLayerView({ layer, show, state }: LayerViewProps<StateLayer>) {
  const def = show.vars.find((v) => v.id === layer.varId);
  const value = state.vars[layer.varId];
  if (layer.display === 'bars' && value && typeof value === 'object' && !Array.isArray(value)) {
    const labels = labelsFor(show, layer.varId);
    const entries = Object.entries(value);
    const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
    return (
      <div
        className="flex size-full flex-col justify-center gap-[0.3em]"
        style={{ ...textStyle(layer), fontSize: layer.fontSize * 0.6 }}
      >
        {entries.map(([key, n]) => (
          <div key={key} className="flex items-center gap-[0.5em]">
            <span className="w-[30%] truncate text-right">{labels[key] ?? key}</span>
            <div className="relative h-[1.2em] flex-1 overflow-hidden rounded-[0.2em] bg-white/15">
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-300"
                style={{ width: `${(n / total) * 100}%`, background: layer.color }}
              />
            </div>
            <span className="w-[3ch] tabular-nums">{n}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className={`flex items-center ${sizingClass(layer.sizing, 'whitespace-pre-wrap')}`}
      style={textStyle(layer)}
    >
      <span className="w-full">{def ? formatValue(value) : ''}</span>
    </div>
  );
}

/** Option labels for tally vars filled by a vote or prop moment. */
function labelsFor(show: LayerViewProps['show'], varId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of show.moments) {
    if (m.tallyVarId !== varId) continue;
    for (const o of m.options) out[o.id] = o.label;
    for (const v of m.variants) out[v.id] = v.label;
  }
  return out;
}
