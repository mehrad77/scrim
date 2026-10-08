import { createOutput, uid, type Output } from '@scrim/format';
import { Monitor, Plus, Speaker, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { audioOutputs, testTone, unlockDeviceLabels } from '../../host/audio.js';
import { AUDIO_DEVICES_KEY, readLocal, writeLocal } from '../../lib/local.js';
import { removeOutput } from '../../lib/refs.js';
import { useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { confirmDialog } from '../../ui/dialog.js';
import { CommitInput, Field, NumberInput, Select } from '../../ui/Field.js';
import { Panel } from '../../ui/Panel.js';
import { errorToast } from '../../ui/toast.js';

const PRESETS: [number, number, string][] = [
  [1920, 1080, '1080p (16:9)'],
  [1280, 720, '720p (16:9)'],
  [3840, 2160, '4K (16:9)'],
  [1920, 1200, 'WUXGA (16:10)'],
  [1024, 768, 'XGA (4:3)'],
  [1080, 1920, 'Portrait 1080×1920'],
];

export function OutputsTab() {
  return (
    <div className="grid h-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-px bg-line-subtle">
      <OutputsPanel />
      <AudioPanel />
    </div>
  );
}

function OutputsPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const set = (id: string, patch: Partial<Output>, coalesce?: string) =>
    update(
      (d) => {
        const o = d.outputs.find((x) => x.id === id);
        if (o) Object.assign(o, patch);
      },
      coalesce ? { coalesce: `${id}:${coalesce}` } : undefined,
    );
  return (
    <Panel
      title="Outputs"
      bodyClassName="p-3"
      actions={
        <Button
          size="sm"
          icon={<Plus size={13} />}
          onClick={() =>
            update((d) => void d.outputs.push(createOutput(`Output ${d.outputs.length + 1}`)))
          }
        >
          Output
        </Button>
      }
    >
      <p className="mb-3 text-caption text-fg-subtle">
        Each output is a clean, full-screen picture: a projector, a TV, or a screen on another
        device. Its canvas size is the pixel space you lay layers out in.
      </p>
      <div className="flex flex-col gap-3">
        {show.outputs.map((o) => (
          <div key={o.id} className="rounded-control border border-line-subtle p-3">
            <div className="mb-3 flex items-center gap-2">
              <Monitor size={16} className="text-fg-subtle" />
              <CommitInput
                value={o.name}
                onCommit={(name) => set(o.id, { name })}
                className="font-medium"
              />
              <IconButton
                label="Delete output"
                icon={<Trash2 size={13} />}
                disabled={show.outputs.length <= 1}
                onClick={async () => {
                  const n = show.layers.filter((l) => l.outputId === o.id).length;
                  if (
                    await confirmDialog(
                      'Delete output?',
                      `“${o.name}” and its ${n} layer(s) will be removed.`,
                      'Delete',
                      true,
                    )
                  ) {
                    update((d) => removeOutput(d, o.id));
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Size">
                <Select
                  value={
                    PRESETS.find(([w, h]) => w === o.width && h === o.height)
                      ? `${o.width}x${o.height}`
                      : 'custom'
                  }
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    if (w && h) set(o.id, { width: w, height: h });
                  }}
                >
                  {PRESETS.map(([w, h, label]) => (
                    <option key={label} value={`${w}x${h}`}>
                      {label}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </Select>
              </Field>
              <Field label="Width">
                <NumberInput
                  value={o.width}
                  min={64}
                  onCommit={(width) => set(o.id, { width })}
                  suffix="px"
                />
              </Field>
              <Field label="Height">
                <NumberInput
                  value={o.height}
                  min={64}
                  onCommit={(height) => set(o.id, { height })}
                  suffix="px"
                />
              </Field>
              <Field label="Background">
                <input
                  type="color"
                  value={o.background}
                  className="h-8 w-full rounded-control border border-line-subtle bg-panel"
                  onChange={(e) => set(o.id, { background: e.target.value }, 'bg')}
                />
              </Field>
              <Field label="Safe area guide">
                <NumberInput
                  value={Math.round(o.safeArea * 100)}
                  min={0}
                  max={25}
                  suffix="%"
                  onCommit={(v) => set(o.id, { safeArea: v / 100 })}
                />
              </Field>
            </div>
            <CornerPin output={o} onChange={(cornerPin) => set(o.id, { cornerPin })} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CornerPin({
  output,
  onChange,
}: {
  output: Output;
  onChange: (p: Output['cornerPin']) => void;
}) {
  const pin = output.cornerPin ?? [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const labels = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];
  return (
    <details className="mt-3 text-caption">
      <summary className="cursor-pointer text-fg-muted">
        Corner pin (keystone correction){output.cornerPin ? ' — on' : ''}
      </summary>
      <p className="my-2 text-fg-subtle">
        Move each corner of the picture by a number of pixels to square it up on a tilted surface.
        Adjust while the output is open.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {pin.map((p, i) => (
          <div key={i}>
            <div className="mb-1 text-fg-subtle">{labels[i]}</div>
            <div className="flex gap-1">
              {(['x', 'y'] as const).map((axis) => (
                <NumberInput
                  key={axis}
                  value={p[axis]}
                  suffix={axis}
                  onCommit={(v) => {
                    const next = pin.map((q) => ({ ...q })) as NonNullable<Output['cornerPin']>;
                    next[i]![axis] = v;
                    onChange(next);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {output.cornerPin && (
        <Button size="sm" className="mt-2" onClick={() => onChange(undefined)}>
          Reset
        </Button>
      )}
    </details>
  );
}

function AudioPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [map, setMap] = useState(() => readLocal<Record<string, string>>(AUDIO_DEVICES_KEY, {}));
  const refresh = () => void audioOutputs().then(setDevices);
  useEffect(refresh, []);
  const labelled = devices.some((d) => d.label);

  return (
    <Panel
      title="Audio buses"
      bodyClassName="p-3"
      actions={
        <Button
          size="sm"
          icon={<Plus size={13} />}
          onClick={() =>
            update(
              (d) =>
                void d.audioBuses.push({ id: uid('bus'), name: `Bus ${d.audioBuses.length + 1}` }),
            )
          }
        >
          Bus
        </Button>
      }
    >
      <p className="mb-3 text-caption text-fg-subtle">
        Sounds and video audio play through a bus. Choose which device each bus uses on{' '}
        <em>this machine</em>; the choice stays here, not in the show file.
      </p>
      {!labelled && (
        <Button
          size="sm"
          className="mb-3"
          onClick={async () => {
            try {
              await unlockDeviceLabels();
              refresh();
            } catch (e) {
              errorToast(e);
            }
          }}
        >
          Show device names
        </Button>
      )}
      {show.audioBuses.map((b) => (
        <div key={b.id} className="mb-2 flex items-center gap-2">
          <Speaker size={15} className="shrink-0 text-fg-subtle" />
          <CommitInput
            className="w-32"
            value={b.name}
            onCommit={(name) =>
              update((d) => {
                const x = d.audioBuses.find((y) => y.id === b.id);
                if (x) x.name = name;
              })
            }
          />
          <Select
            value={map[b.id] ?? ''}
            onChange={(e) => {
              const next = { ...map, [b.id]: e.target.value };
              if (!e.target.value) delete next[b.id];
              setMap(next);
              writeLocal(AUDIO_DEVICES_KEY, next);
            }}
          >
            <option value="">System default</option>
            {devices
              .filter((d) => d.deviceId && d.deviceId !== 'default')
              .map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Output ${i + 1}`}
                </option>
              ))}
          </Select>
          <IconButton
            label="Test tone"
            icon={<Volume2 size={14} />}
            onClick={() => void testTone(map[b.id]).catch(errorToast)}
          />
          <IconButton
            label="Delete bus"
            icon={<Trash2 size={12} />}
            disabled={show.audioBuses.length <= 1}
            onClick={() =>
              update((d) => {
                d.audioBuses = d.audioBuses.filter((x) => x.id !== b.id);
                const fallback = d.audioBuses[0]!.id;
                for (const l of d.layers)
                  if ((l.kind === 'audio' || l.kind === 'video') && l.bus === b.id)
                    l.bus = fallback;
              })
            }
          />
        </div>
      ))}
    </Panel>
  );
}
