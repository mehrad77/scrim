import type { Layer, Show } from '@scrim/format';
import { AlignCenter, Copy, Maximize, Trash2, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { createCue, uid } from '@scrim/format';
import { layerUsage, removeLayer } from '../../lib/refs.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button } from '../../ui/Button.js';
import { CommitInput, Field, NumberInput, Select, TextArea, Toggle } from '../../ui/Field.js';
import { Empty } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';

const FONTS = [
  ['system-ui, sans-serif', 'System sans'],
  ['Georgia, serif', 'Serif'],
  ['ui-monospace, monospace', 'Monospace'],
  ['Impact, Haettenschweiler, sans-serif', 'Impact'],
  ['"Comic Sans MS", cursive', 'Handwritten'],
] as const;

export function LayerInspector() {
  const show = useShow();
  const layerId = useEditor((s) => s.selection.layerId);
  const layer = show.layers.find((l) => l.id === layerId);
  if (!layer) return <Empty>Select a layer to edit it.</Empty>;
  return <Inspector key={layer.id} show={show} layer={layer} />;
}

function Inspector({ show, layer }: { show: Show; layer: Layer }) {
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const output = show.outputs.find((o) => o.id === layer.outputId);
  const set = (patch: Partial<Layer>, coalesce?: string) =>
    update(
      (d) => {
        const l = d.layers.find((x) => x.id === layer.id);
        if (l) Object.assign(l, patch);
      },
      coalesce ? { coalesce: `${layer.id}:${coalesce}` } : undefined,
    );
  const usage = layerUsage(show, layer.id);
  const visual = layer.kind !== 'audio';

  return (
    <div className="flex flex-col gap-4 p-3">
      <Field label="Name">
        <CommitInput value={layer.name} onCommit={(name) => set({ name })} />
      </Field>
      <p className="-mt-2 text-caption text-fg-subtle">
        Used by {usage} cue or rule action{usage === 1 ? '' : 's'}.
      </p>

      {'mediaId' in layer && (
        <Field label="Media">
          <Select
            value={layer.mediaId}
            onChange={(e) => set({ mediaId: e.target.value } as Partial<Layer>)}
          >
            {show.media
              .filter((m) =>
                layer.kind === 'audio'
                  ? m.kind === 'audio'
                  : layer.kind === 'video'
                    ? m.kind === 'video'
                    : m.kind === 'image',
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        </Field>
      )}

      {visual && (
        <Section title="Position">
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <NumberInput value={layer.x} onCommit={(x) => set({ x })} suffix="px" />
            </Field>
            <Field label="Y">
              <NumberInput value={layer.y} onCommit={(y) => set({ y })} suffix="px" />
            </Field>
            <Field label="Width">
              <NumberInput value={layer.w} min={1} onCommit={(w) => set({ w })} suffix="px" />
            </Field>
            <Field label="Height">
              <NumberInput value={layer.h} min={1} onCommit={(h) => set({ h })} suffix="px" />
            </Field>
          </div>
          {output && (
            <div className="flex gap-2">
              <Button
                size="sm"
                icon={<Maximize size={13} />}
                onClick={() => set({ x: 0, y: 0, w: output.width, h: output.height })}
              >
                Fill stage
              </Button>
              <Button
                size="sm"
                icon={<AlignCenter size={13} />}
                onClick={() =>
                  set({
                    x: Math.round((output.width - layer.w) / 2),
                    y: Math.round((output.height - layer.h) / 2),
                  })
                }
              >
                Center
              </Button>
            </div>
          )}
          <Field label="Crop (% from each edge)">
            <div className="grid grid-cols-4 gap-1">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <NumberInput
                  key={side}
                  value={Math.round(layer.crop[side] * 100)}
                  min={0}
                  max={100}
                  onCommit={(v) => set({ crop: { ...layer.crop, [side]: v / 100 } })}
                />
              ))}
            </div>
          </Field>
        </Section>
      )}

      <Section title={visual ? 'Appearance' : 'Sound'}>
        <Field
          label={
            visual
              ? `Opacity when shown: ${Math.round(layer.opacity * 100)}%`
              : `Level when faded in: ${Math.round(layer.opacity * 100)}%`
          }
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layer.opacity}
            className="accent-accent"
            onChange={(e) => set({ opacity: Number(e.target.value) }, 'opacity')}
          />
        </Field>
        <Toggle
          checked={layer.visible}
          onChange={(visible) => set({ visible })}
          label={visual ? 'Visible when the show starts' : 'Faded in when the show starts'}
        />
        {(layer.kind === 'image' || layer.kind === 'video') && (
          <Field label="Fit">
            <Select
              value={layer.fit}
              onChange={(e) => set({ fit: e.target.value as 'contain' } as Partial<Layer>)}
            >
              <option value="contain">Contain (letterbox)</option>
              <option value="cover">Cover (crop to fill)</option>
              <option value="fill">Stretch</option>
            </Select>
          </Field>
        )}
        {(layer.kind === 'video' || layer.kind === 'audio') && (
          <>
            <Toggle
              checked={layer.loop}
              onChange={(loop) => set({ loop } as Partial<Layer>)}
              label="Loop"
            />
            <Field label={`Volume: ${Math.round(layer.volume * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.volume}
                className="accent-accent"
                onChange={(e) =>
                  set({ volume: Number(e.target.value) } as Partial<Layer>, 'volume')
                }
              />
            </Field>
            <Field label="Audio bus">
              <Select
                value={layer.bus}
                onChange={(e) => set({ bus: e.target.value } as Partial<Layer>)}
              >
                {show.audioBuses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
      </Section>

      {layer.kind === 'counter' && (
        <Section title="Counter">
          <Field label="Kind">
            <Select
              value={layer.mode}
              onChange={(e) =>
                set({
                  mode: e.target.value as 'count',
                  format: e.target.value === 'count' ? 'number' : 'clock',
                } as Partial<Layer>)
              }
            >
              <option value="countdown">Countdown timer</option>
              <option value="countup">Stopwatch</option>
              <option value="count">Counter (changed by cues)</option>
            </Select>
          </Field>
          <Field label={layer.mode === 'count' ? 'Starting number' : 'Starting time (seconds)'}>
            <NumberInput
              value={layer.start}
              min={0}
              onCommit={(start) => set({ start } as Partial<Layer>)}
            />
          </Field>
          <Field label="Display">
            <Select
              value={layer.format}
              onChange={(e) => set({ format: e.target.value as 'clock' } as Partial<Layer>)}
            >
              <option value="clock">Clock (m:ss)</option>
              <option value="number">Plain number</option>
            </Select>
          </Field>
        </Section>
      )}

      {layer.kind === 'state' && (
        <Section title="State value">
          <Field
            label="Show this value"
            hint={
              show.vars.length ? undefined : 'Create state values in the Interaction tab first.'
            }
          >
            <Select
              value={layer.varId}
              onChange={(e) => set({ varId: e.target.value } as Partial<Layer>)}
            >
              <option value="">—</option>
              {show.vars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Display">
            <Select
              value={layer.display}
              onChange={(e) => set({ display: e.target.value as 'bars' } as Partial<Layer>)}
            >
              <option value="value">As text</option>
              <option value="bars">As tally bars (for votes)</option>
            </Select>
          </Field>
        </Section>
      )}

      {layer.kind === 'text' && (
        <Section title="Text">
          <TextArea
            rows={4}
            defaultValue={layer.text}
            key={layer.text}
            onBlur={(e) =>
              e.target.value !== layer.text && set({ text: e.target.value } as Partial<Layer>)
            }
          />
          <p className="text-caption text-fg-subtle">
            Insert live state with <code className="text-fg-muted">{'{{name}}'}</code>
            {show.vars.length ? `, e.g. {{${show.vars[0]!.name}}}` : ''}.
          </p>
        </Section>
      )}

      {(layer.kind === 'text' || layer.kind === 'counter' || layer.kind === 'state') && (
        <Section title="Type">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <NumberInput
                value={layer.fontSize}
                min={4}
                onCommit={(fontSize) => set({ fontSize } as Partial<Layer>)}
                suffix="px"
              />
            </Field>
            <Field label="Weight">
              <Select
                value={layer.fontWeight}
                onChange={(e) => set({ fontWeight: Number(e.target.value) } as Partial<Layer>)}
              >
                {[300, 400, 600, 800].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Color">
              <input
                type="color"
                value={layer.color}
                className="h-8 w-full rounded border border-line-subtle bg-panel"
                onChange={(e) => set({ color: e.target.value } as Partial<Layer>, 'color')}
              />
            </Field>
            <Field label="Align">
              <Select
                value={layer.align}
                onChange={(e) => set({ align: e.target.value as 'left' } as Partial<Layer>)}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </Select>
            </Field>
          </div>
          <Field label="Font">
            <Select
              value={layer.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value } as Partial<Layer>)}
            >
              {FONTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              {!FONTS.some(([v]) => v === layer.fontFamily) && (
                <option value={layer.fontFamily}>{layer.fontFamily}</option>
              )}
            </Select>
          </Field>
          <Field label="Background">
            <div className="flex gap-2">
              <input
                type="color"
                value={layer.background.startsWith('#') ? layer.background : '#000000'}
                className="h-8 w-12 rounded border border-line-subtle bg-panel"
                onChange={(e) => set({ background: e.target.value } as Partial<Layer>, 'bg')}
              />
              <Button
                size="sm"
                onClick={() => set({ background: 'transparent' } as Partial<Layer>)}
              >
                None
              </Button>
            </div>
          </Field>
        </Section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line-subtle pt-3">
        <Button
          size="sm"
          icon={<Zap size={13} />}
          title="Add a cue that brings this layer in"
          onClick={() => {
            const cueId = useEditor.getState().selection.cueId;
            const after = show.cues.find((c) => c.id === cueId) ?? show.cues.at(-1);
            const sceneId = after?.sceneId ?? show.scenes[0]?.id;
            if (!sceneId) return;
            const cue = createCue(
              sceneId,
              `${layer.kind === 'audio' ? 'Sound' : 'Show'}: ${layer.name}`,
            );
            cue.actions.push({ type: 'show', layerId: layer.id, duration: 1, easing: 'easeInOut' });
            if (layer.kind === 'video' || layer.kind === 'audio')
              cue.actions.push({ type: 'play', layerId: layer.id, restart: true });
            update((d) => {
              const i = after ? d.cues.findIndex((c) => c.id === after.id) : -1;
              d.cues.splice(i + 1, 0, cue);
            });
            select({ cueId: cue.id });
            toast(`Added cue “${cue.name}”`, 'good');
          }}
        >
          New cue
        </Button>
        <Button
          size="sm"
          icon={<Copy size={13} />}
          onClick={() => {
            const copy = {
              ...structuredClone(layer),
              id: uid('lyr'),
              name: `${layer.name} copy`,
              x: layer.x + 40,
              y: layer.y + 40,
              z: layer.z + 1,
            };
            update((d) => void d.layers.push(copy));
            select({ layerId: copy.id });
          }}
        >
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-fault"
          icon={<Trash2 size={13} />}
          onClick={() => {
            update((d) => removeLayer(d, layer.id));
            select({ layerId: null });
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label-caps mb-1 text-fg-subtle">{title}</legend>
      {children}
    </fieldset>
  );
}
