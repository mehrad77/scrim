import { Download, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSong, MAX_LINES } from '../../../lib/build/song.js';
import { readLocal, writeLocal } from '../../../lib/local.js';
import {
  arrangementText,
  lyricsText,
  newSong,
  parseArrangement,
  slides,
  sungOrder,
  type Song,
} from '../../../lib/songs.js';
import { exportSongs, importSongs, listSongs, saveSong } from '../../../storage/songs.js';
import { Button } from '../../../ui/Button.js';
import { formDialog } from '../../../ui/dialog.js';
import { Field, NumberInput, Select, TextArea, TextInput, Toggle } from '../../../ui/Field.js';
import { errorToast, toast } from '../../../ui/toast.js';
import { Actions, Form } from '../recipes.js';
import { build, current, OutputField } from './parts.js';

/** The church or venue's song licence (CCLI) belongs to this machine, not to a show. */
const LICENCE_KEY = 'scrim.songLicence';

interface Answers {
  song: Song;
  keep: boolean;
  licence: string;
  linesPerSlide: number;
  outputId: string;
}

function SongForm({ done }: { done: (a: Answers | null) => void }) {
  const [library, setLibrary] = useState<Song[]>([]);
  const [pickedId, setPickedId] = useState('');
  const [title, setTitle] = useState('');
  const [credit, setCredit] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [arrangement, setArrangement] = useState('');
  const [linesPerSlide, setLines] = useState(4);
  const [licence, setLicence] = useState(() => readLocal(LICENCE_KEY, ''));
  const [keep, setKeep] = useState(true);
  const [outputId, setOutputId] = useState(current().outputs[0]?.id ?? '');
  const file = useRef<HTMLInputElement>(null);

  const reload = () => void listSongs().then(setLibrary).catch(errorToast);
  useEffect(reload, []);

  // What the form makes, recomputed as it is typed: sections, the order sung, slides.
  const song = useMemo(() => {
    const s = newSong(title.trim(), lyrics, credit.trim());
    const order = parseArrangement(arrangement, s.sections);
    return { ...s, id: pickedId || s.id, arrangement: order.length ? order : s.arrangement };
  }, [title, lyrics, credit, arrangement, pickedId]);
  const sung = sungOrder(song);
  const count = sung.reduce((n, s) => n + slides(s.lines, linesPerSlide).length, 0);

  const pick = (id: string) => {
    const s = library.find((x) => x.id === id);
    setPickedId(s?.id ?? '');
    if (!s) return;
    setTitle(s.title);
    setCredit(s.credit);
    setLyrics(lyricsText(s));
    setArrangement(arrangementText(s.arrangement));
  };

  return (
    <Form onSubmit={() => done({ song, keep, licence: licence.trim(), linesPerSlide, outputId })}>
      {library.length > 0 && (
        <Field label="From my songs">
          <Select
            aria-label="From my songs"
            value={pickedId}
            onChange={(e) => pick(e.target.value)}
          >
            <option value="">A new song…</option>
            {library.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Title">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Credit" hint="Who wrote it, and the song's licence number">
          <TextInput
            value={credit}
            placeholder="Words: John Newton · CCLI Song 22025"
            onChange={(e) => setCredit(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Words"
        hint="A blank line between sections. A line such as Chorus or [Verse 2] names the section below it; on its own, it repeats that section."
      >
        <TextArea
          rows={10}
          value={lyrics}
          placeholder={'Verse 1\nAmazing grace, how sweet the sound\n\nChorus\n…'}
          onChange={(e) => setLyrics(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <Field label="Order sung" hint="Empty: as written. Or short names: V1 C V2 C B C">
          <TextInput
            value={arrangement}
            placeholder="As written"
            onChange={(e) => setArrangement(e.target.value)}
          />
        </Field>
        <Field label="Lines at once">
          <NumberInput value={linesPerSlide} min={1} max={MAX_LINES} onCommit={setLines} />
        </Field>
      </div>
      <p className="text-caption text-fg-subtle" aria-live="polite">
        {sung.length
          ? `${count} cue${count === 1 ? '' : 's'}: ${sung.map((s) => s.label).join(' · ')}`
          : 'Paste the words to see the cues.'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Song licence (this machine)" hint="Shown with the credit, on every song">
          <TextInput
            value={licence}
            placeholder="CCLI licence number"
            onChange={(e) => setLicence(e.target.value)}
          />
        </Field>
        <OutputField value={outputId} onChange={setOutputId} />
      </div>
      <Toggle checked={keep} onChange={setKeep} label="Keep it in my songs for other shows" />
      <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
        <span className="text-caption text-fg-subtle">My songs:</span>
        <Button size="sm" icon={<Upload size={13} />} onClick={() => file.current?.click()}>
          Import…
        </Button>
        <Button
          size="sm"
          icon={<Download size={13} />}
          disabled={!library.length}
          onClick={() => void exportSongs().catch(errorToast)}
        >
          Export
        </Button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const n = await importSongs(f);
              toast(`${n} song${n === 1 ? '' : 's'} added to my songs`, 'good');
              reload();
            } catch (err) {
              errorToast(err);
            }
          }}
        />
      </div>
      <Actions
        ok="Add the song"
        onCancel={() => done(null)}
        disabled={!song.title || !song.sections.length}
      />
    </Form>
  );
}

export async function run(): Promise<void> {
  const a = await formDialog<Answers>('Add a song', (done) => <SongForm done={done} />, true);
  if (!a) return;
  const made = build((d) =>
    buildSong(d, a.song, {
      outputId: a.outputId,
      licence: a.licence,
      linesPerSlide: a.linesPerSlide,
    }),
  );
  if (!made) return;
  // Kept only once the song is really in the show.
  writeLocal(LICENCE_KEY, a.licence);
  if (a.keep) await saveSong(a.song).catch(errorToast);
  toast(
    `“${a.song.title}” added: ${made.cueIds.length - 1} cues, each named after its section, so a key can jump to the chorus`,
    'good',
  );
}
