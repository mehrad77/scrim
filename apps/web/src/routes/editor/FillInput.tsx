import { fillCss, parseFill, type Fill, type Stop } from '../../lib/fill.js';
import { ColorInput } from '../../ui/ColorInput.js';
import { Field, NumberInput, Select } from '../../ui/Field.js';

/**
 * A fill: nothing, one colour, or a straight two-colour gradient (the scrim behind text over a
 * picture), each colour with its opacity. A fill written some other way is kept until replaced.
 * `coalesce` names the drag being made, so dragging a colour is one undo step.
 */
export function FillInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (css: string, coalesce?: string) => void;
}) {
  const fill = parseFill(value);
  const set = (next: Fill, coalesce?: string) => onChange(fillCss(next), coalesce);
  const base: Stop =
    fill.kind === 'solid'
      ? fill.color
      : fill.kind === 'gradient'
        ? fill.to
        : { hex: '#000000', alpha: 1 };
  const switchTo = (kind: Fill['kind']) => {
    if (kind === 'none') return set({ kind: 'none' });
    if (kind === 'solid') return set({ kind: 'solid', color: base });
    if (kind === 'gradient')
      return set({ kind: 'gradient', angle: 180, from: { ...base, alpha: 0 }, to: base });
  };
  return (
    <div className="flex flex-col gap-2">
      <Field label={label}>
        <Select value={fill.kind} onChange={(e) => switchTo(e.target.value as Fill['kind'])}>
          <option value="none">None</option>
          <option value="solid">Colour</option>
          <option value="gradient">Gradient</option>
          {fill.kind === 'custom' && <option value="custom">Custom (as written)</option>}
        </Select>
      </Field>
      {fill.kind === 'solid' && (
        <StopInput
          label={`${label} colour`}
          stop={fill.color}
          onChange={(color, live) => set({ ...fill, color }, live ? 'fill' : undefined)}
        />
      )}
      {fill.kind === 'gradient' && (
        <>
          <StopInput
            label="From"
            stop={fill.from}
            onChange={(from, live) => set({ ...fill, from }, live ? 'from' : undefined)}
          />
          <StopInput
            label="To"
            stop={fill.to}
            onChange={(to, live) => set({ ...fill, to }, live ? 'to' : undefined)}
          />
          <Field label="Direction">
            <NumberInput
              aria-label="Gradient direction"
              value={fill.angle}
              min={0}
              max={360}
              suffix="°"
              onCommit={(angle, live) => set({ ...fill, angle }, live ? 'angle' : undefined)}
            />
          </Field>
          <p className="text-caption text-fg-subtle">180° runs top to bottom, 90° left to right.</p>
        </>
      )}
      {fill.kind === 'custom' && (
        <p className="truncate text-caption text-fg-subtle" title={fill.css}>
          {fill.css}
        </p>
      )}
    </div>
  );
}

function StopInput({
  label,
  stop,
  onChange,
}: {
  label: string;
  stop: Stop;
  onChange: (stop: Stop, live?: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-2">
      <Field label={label}>
        <ColorInput
          aria-label={`${label} colour`}
          value={stop.hex}
          onChange={(hex) => onChange({ ...stop, hex }, true)}
        />
      </Field>
      <Field label="Opacity">
        <NumberInput
          aria-label={`${label} opacity`}
          value={Math.round(stop.alpha * 100)}
          min={0}
          max={100}
          suffix="%"
          onCommit={(n, live) => onChange({ ...stop, alpha: n / 100 }, live)}
        />
      </Field>
    </div>
  );
}
