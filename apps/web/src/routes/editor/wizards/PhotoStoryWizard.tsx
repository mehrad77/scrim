import type { Media } from '@scrim/format';
import { useState } from 'react';
import { buildPhotoStory } from '../../../lib/build/photoStory.js';
import { addMediaFile, kindOf } from '../../../storage/media.js';
import { formDialog } from '../../../ui/dialog.js';
import { Field, NumberInput, TextInput, Toggle } from '../../../ui/Field.js';
import { errorToast, toast } from '../../../ui/toast.js';
import { Actions, Form } from '../recipes.js';
import { build, current, OutputField } from './parts.js';

interface Answers {
  title: string;
  photos: File[];
  music: File | null;
  seconds: number;
  fade: number;
  loop: boolean;
  outputId: string;
}

const fileButton =
  'text-ui text-fg-muted file:mr-3 file:h-control file:rounded-control file:border file:border-line-control file:bg-control file:px-3 file:text-ui file:text-fg hover:file:bg-control-hover';

function PhotoForm({ done }: { done: (a: Answers | null) => void }) {
  const [a, setA] = useState<Answers>({
    title: 'Photo story',
    photos: [],
    music: null,
    seconds: 6,
    fade: 2,
    loop: true,
    outputId: current().outputs[0]?.id ?? '',
  });
  const minutes = (a.photos.length * Math.max(a.seconds, a.fade + 1)) / 60;
  return (
    <Form onSubmit={() => done(a)}>
      <Field label="Name">
        <TextInput
          autoFocus
          value={a.title}
          onChange={(e) => setA({ ...a, title: e.target.value })}
        />
      </Field>
      <Field
        label="Pictures, in the order shown"
        hint="Choose several at once; they are sorted by name."
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className={fileButton}
          onChange={(e) =>
            setA({
              ...a,
              photos: [...(e.target.files ?? [])].sort((x, y) =>
                x.name.localeCompare(y.name, undefined, { numeric: true }),
              ),
            })
          }
        />
      </Field>
      <Field label="Music under them (optional)">
        <input
          type="file"
          accept="audio/*"
          className={fileButton}
          onChange={(e) => setA({ ...a, music: e.target.files?.[0] ?? null })}
        />
      </Field>
      <div className="grid grid-cols-[8rem_8rem_1fr] items-end gap-2">
        <Field label="Each picture">
          <NumberInput
            value={a.seconds}
            min={2}
            suffix="s"
            onCommit={(seconds) => setA({ ...a, seconds })}
          />
        </Field>
        <Field label="Dissolve">
          <NumberInput
            value={a.fade}
            min={0.5}
            max={10}
            step={0.5}
            suffix="s"
            onCommit={(fade) => setA({ ...a, fade })}
          />
        </Field>
        <OutputField value={a.outputId} onChange={(outputId) => setA({ ...a, outputId })} />
      </div>
      <Toggle
        checked={a.loop}
        onChange={(loop) => setA({ ...a, loop })}
        label="Go round again, music too; “next scene” ends it"
      />
      <p className="text-caption text-fg-subtle" aria-live="polite">
        {a.photos.length
          ? `${a.photos.length} pictures, about ${minutes < 1 ? 'a minute' : `${Math.round(minutes)} minutes`} once through.`
          : 'Choose the pictures to see how long it runs.'}
      </p>
      <Actions ok="Add the photo story" onCancel={() => done(null)} disabled={!a.photos.length} />
    </Form>
  );
}

export async function run(): Promise<void> {
  const a = await formDialog<Answers>('A photo story', (done) => <PhotoForm done={done} />, true);
  if (!a) return;
  // Only pictures among the pictures and sound for the music: a file dropped on the picker
  // skips its filter. One at a time, saying how far it has got.
  const pictures = a.photos.filter((f) => kindOf(f.type, f.name) === 'image');
  const song = a.music && kindOf(a.music.type, a.music.name) === 'audio' ? a.music : null;
  let skipped = a.photos.length - pictures.length + (a.music && !song ? 1 : 0);
  const stored = async (f: File): Promise<Media | null> => {
    try {
      return await addMediaFile(f);
    } catch (e) {
      errorToast(e);
      skipped += 1;
      return null;
    }
  };
  const photos: Media[] = [];
  for (const [i, f] of pictures.entries()) {
    if (i % 10 === 0) toast(`Adding pictures: ${i + 1} of ${pictures.length}…`, 'info');
    const m = await stored(f);
    if (m) photos.push(m);
  }
  const music = song ? await stored(song) : null;
  if (!photos.length) return void toast('None of those files is a picture', 'error');
  if (!build((d) => buildPhotoStory(d, { ...a, title: a.title.trim(), photos, music }))) return;
  toast(
    `Photo story added: GO starts it, and the pictures change on their own${
      skipped
        ? `. ${skipped} file${skipped === 1 ? ' was' : 's were'} left out: not a picture or sound, or unreadable`
        : ''
    }`,
    'good',
  );
}
