import { readBundle, type Show } from '@scrim/format';
import { useState } from 'react';
import { importScenes, type ImportPlan } from '../../lib/merge.js';
import { deleteMediaFile, mediaFile, mediaWriter } from '../../storage/media.js';
import { canEdit, useEditor } from '../../state/editor.js';
import { formDialog } from '../../ui/dialog.js';
import { Field, Select, Toggle } from '../../ui/Field.js';
import { errorToast, toast } from '../../ui/toast.js';
import { Actions, Form } from './recipes.js';

/** Media a first read of the bundle skips: only the show is wanted then. */
const skip = { write() {}, close() {} };

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.scrim,application/zip';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function ImportForm({
  source,
  target,
  done,
}: {
  source: Show;
  target: Show;
  done: (plan: ImportPlan | null) => void;
}) {
  const [sceneIds, setSceneIds] = useState<string[]>([]);
  const [outputMap, setOutputMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      source.outputs.map((o, i) => [o.id, (target.outputs[i] ?? target.outputs[0])?.id ?? '']),
    ),
  );
  const cues = (id: string) => source.cues.filter((c) => c.sceneId === id).length;
  const toggle = (id: string, on: boolean) =>
    setSceneIds(on ? [...sceneIds, id] : sceneIds.filter((x) => x !== id));
  return (
    <Form onSubmit={() => done({ sceneIds, outputMap })}>
      <p className="text-ui text-fg-muted">
        From <span className="font-medium text-fg">{source.name}</span>: pick the scenes to bring
        in. Their cues come with everything they use (layers, moments, values, triggers and rules),
        with new ids, after this show’s scenes.
      </p>
      <fieldset className="flex flex-col gap-1 text-caption text-fg-muted">
        <legend className="mb-1">Scenes</legend>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-auto rounded-control border border-line-subtle p-2">
          {source.scenes.map((s) => (
            <Toggle
              key={s.id}
              checked={sceneIds.includes(s.id)}
              onChange={(on) => toggle(s.id, on)}
              label={
                <span>
                  {s.name}{' '}
                  <span className="text-fg-subtle">
                    · {cues(s.id)} cue{cues(s.id) === 1 ? '' : 's'}
                  </span>
                </span>
              }
            />
          ))}
        </div>
      </fieldset>
      {target.outputs.length > 1 &&
        source.outputs.map((o) => (
          <Field key={o.id} label={`What was on “${o.name}” goes on`}>
            <Select
              value={outputMap[o.id] ?? ''}
              onChange={(e) => setOutputMap({ ...outputMap, [o.id]: e.target.value })}
            >
              {target.outputs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      <Actions
        ok={`Import ${sceneIds.length || ''} scene${sceneIds.length === 1 ? '' : 's'}`}
        onCancel={() => done(null)}
        disabled={!sceneIds.length}
      />
    </Form>
  );
}

/** Thrown to stop the first read once the show is known: its media isn't needed yet. */
class GotShow extends Error {
  constructor(readonly show: Show) {
    super('got the show');
  }
}

/** Read just the show from a bundle, without streaming every media file through. */
async function readShowOnly(file: File): Promise<Show> {
  try {
    return await readBundle(file.stream(), {
      openMedia: (_id, show) => {
        throw new GotShow(show);
      },
    });
  } catch (e) {
    if (e instanceof GotShow) return e.show;
    throw e;
  }
}

/** A stored file that is the whole of this media, not a copy cut short. */
async function complete(id: string, size: number): Promise<boolean> {
  return (await mediaFile(id))?.size === size;
}

/** Import scenes from a .scrim file: a group's work into the class show, a song into a set. */
export async function run(): Promise<void> {
  if (!canEdit()) return;
  const file = await pickFile();
  if (!file) return;
  toast(`Reading ${file.name}…`, 'info');
  let source: Show;
  try {
    source = await readShowOnly(file);
  } catch (e) {
    errorToast(e);
    return;
  }
  const target = useEditor.getState().show;
  if (!target) return;
  const plan = await formDialog<ImportPlan>(
    'Import scenes',
    (done) => <ImportForm source={source} target={target} done={done} />,
    true,
  );
  if (!plan) return;
  // The files first, so the show never points at media this machine doesn't have. A file a
  // failed copy left short is copied again, and a copy that fails now is removed.
  const sizes = new Map(source.media.map((m) => [m.id, m.size]));
  const want = new Set<string>();
  for (const id of importScenes(structuredClone(target), source, plan).media)
    if (!(await complete(id, sizes.get(id) ?? -1))) want.add(id);
  if (want.size) {
    toast(`Copying ${want.size} media file${want.size === 1 ? '' : 's'}…`, 'info');
    try {
      await readBundle(file.stream(), {
        openMedia: (id) => (want.has(id) ? mediaWriter(id) : skip),
      });
    } catch (e) {
      for (const id of want) await deleteMediaFile(id).catch(() => undefined);
      errorToast(e);
      return;
    }
  }
  const { show, update, select } = useEditor.getState();
  // Another show may have opened while the files were copied: it isn't the one asked about.
  if (show?.id !== target.id)
    return toast('The import was for another show; nothing changed', 'error');
  const before = new Set(show.cues.map((c) => c.id));
  let result: ReturnType<typeof importScenes> | null = null;
  update((d) => void (result = importScenes(d, source, plan)));
  const done = result as ReturnType<typeof importScenes> | null;
  if (!done) return void canEdit();
  const first = useEditor.getState().show!.cues.find((c) => !before.has(c.id));
  if (first) select({ cueId: first.id });
  toast(
    `Imported ${done.scenes} scene${done.scenes === 1 ? '' : 's'} and ${done.cues} cue${done.cues === 1 ? '' : 's'}${
      done.dropped
        ? `. ${done.dropped} jump${done.dropped === 1 ? '' : 's'} went to scenes left behind: the logic check lists them`
        : ''
    }`,
    'good',
  );
}
