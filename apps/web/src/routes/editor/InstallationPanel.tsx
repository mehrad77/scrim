import { scheduleValue, timeText } from '@scrim/engine';
import { uid, type Schedule, type SchedulePeriod, type Show } from '@scrim/format';
import { Download, ExternalLink, Plus, Printer, Trash2, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import {
  appBase,
  audienceUrl,
  createRoom,
  readRoomPass,
  roomExists,
  roomPassFile,
  saveRoom,
  setKept,
  storedRoom,
  type RoomInfo,
} from '../../host/room.js';
import { checkCapabilities, type Capability } from '../../lib/capabilities.js';
import { cn } from '../../lib/cn.js';
import { useEditor, useShow } from '../../state/editor.js';
import { ShowChannel } from '../../transport/local.js';
import { Button, IconButton } from '../../ui/Button.js';
import { confirmDialog } from '../../ui/dialog.js';
import { Select, Toggle } from '../../ui/Field.js';
import { Panel } from '../../ui/Panel.js';
import { errorToast, toast } from '../../ui/toast.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const kioskUrl = (show: Show, outputId: string) =>
  `${appBase()}/kiosk/${show.id}?output=${outputId}`;

/** A running show (an installation on this machine) picks its room up again. */
function roomChanged(showId: string): void {
  const ch = new ShowChannel(showId);
  ch.post({ t: 'roomChanged' });
  ch.close();
}

/**
 * Everything an unattended installation needs (users-and-journey › museum): the page each screen
 * opens, a room code that lasts for printed QR codes, opening hours, and what this browser
 * allows. docs/installation-guide.md covers the machine itself.
 */
export function InstallationPanel() {
  return (
    <Panel title="Installation" className="h-full" bodyClassName="flex flex-col gap-5 p-3">
      <Pages />
      <KeptRoom />
      <OpeningHours />
      <Browser />
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="label-caps text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

function Pages() {
  const show = useShow();
  return (
    <Section title="Run unattended">
      <p className="text-caption text-fg-muted">
        Open this page on the installation’s machine (set it as the browser’s start page). It runs
        the show in Show mode, carries on from where it stopped after a power cut, and opens the
        other outputs where the browser allows. Esc is PANIC; hold Ctrl+Alt+Shift+E for two seconds
        to leave.
      </p>
      {show.outputs.map((o) => (
        <div key={o.id} className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-control bg-control px-2 py-1 font-mono text-caption">
            {kioskUrl(show, o.id)}
          </code>
          <Button
            size="sm"
            onClick={() =>
              void navigator.clipboard
                .writeText(kioskUrl(show, o.id))
                .then(() => toast(`The page for “${o.name}” is copied`, 'good'), errorToast)
            }
          >
            Copy
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        className="w-fit"
        icon={<ExternalLink size={13} />}
        onClick={() =>
          window.open(kioskUrl(show, show.outputs[0]?.id ?? ''), `scrim-kiosk-${show.id}`)
        }
      >
        Test as installation
      </Button>
    </Section>
  );
}

function KeptRoom() {
  const show = useShow();
  const [room, setRoom] = useState<RoomInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => void storedRoom(show.id).then((r) => setRoom(r ?? null)), [show.id]);

  /** Do it with the room as stored now: a running show may have swapped in another one. */
  const work = async (fn: (stored: RoomInfo | null) => Promise<RoomInfo | null>) => {
    setBusy(true);
    try {
      const next = await fn((await storedRoom(show.id)) ?? null);
      if (next) await saveRoom(show.id, next);
      setRoom(next ?? (await storedRoom(show.id)) ?? null);
      roomChanged(show.id);
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };

  const keep = (on: boolean) =>
    work(async (stored) => {
      if (!stored) return null;
      // The relay holds the code only if it still has the room, and only for its host key.
      await setKept(stored, on);
      const next: RoomInfo = { ...stored, keep: on };
      if (!on) delete next.keep;
      return next;
    });

  const fresh = async () => {
    if (
      room &&
      !(await confirmDialog(
        'Make a new kept code?',
        <>QR codes printed for {room.code} stop working; print the new one.</>,
        'New code',
      ))
    )
      return;
    await work(async () => {
      const next = await createRoom(show.id, undefined, true);
      if (room) toast(`New kept code ${next.code}: print its QR code`, 'good');
      return next;
    });
  };

  const print = async () => {
    if (!room) return;
    if ((await roomExists(room)) === false)
      return toast(`Room ${room.code} has ended: make a new kept code first`, 'error');
    const url = audienceUrl(room);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 600 });
    const w = window.open('', '_blank');
    if (!w) return toast('The browser blocked the print window', 'error');
    w.document.title = `${show.name}: join on your phone`;
    w.document.body.style.cssText = 'font-family: system-ui; text-align: center; padding: 48px';
    w.document.body.innerHTML = `<h1></h1><img alt="QR code" style="width: 60%"><p style="font-size: 32px">Room code <b></b></p><p></p>`;
    w.document.querySelector('h1')!.textContent = show.name;
    w.document.querySelector('img')!.src = qr;
    w.document.querySelector('b')!.textContent = room.code;
    w.document.querySelectorAll('p')[1]!.textContent = url;
    w.print();
  };

  return (
    <Section title="Room code for visitors’ phones">
      {room === undefined ? null : room ? (
        <>
          <p className="text-ui">
            Code <span className="font-mono font-semibold">{room.code}</span>
            <span className="text-fg-subtle">
              {room.keep ? ' · kept for this installation' : ' · ends a day after its last use'}
            </span>
          </p>
          <Toggle
            checked={!!room.keep}
            onChange={(on) => !busy && void keep(on)}
            label="Keep this code, so printed QR codes keep working (90 days after its last use)"
          />
        </>
      ) : (
        <p className="text-caption text-fg-muted">
          No room yet. A kept code lasts for printed QR codes; phones need the internet to reach it.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {room !== undefined && (
          <Button size="sm" disabled={busy} onClick={() => void fresh()}>
            {room ? 'New kept code…' : 'Make a kept code'}
          </Button>
        )}
        {room && (
          <Button
            size="sm"
            icon={<Printer size={13} />}
            onClick={() => void print().catch(errorToast)}
          >
            Print QR code
          </Button>
        )}
        {room && (
          <Button
            size="sm"
            icon={<Download size={13} />}
            title="For a replacement machine: the same code and keys. Keep it like a password."
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(
                new Blob([roomPassFile(show.id, room)], { type: 'application/json' }),
              );
              a.download = `${room.code}.scrim-room.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
            }}
          >
            Save room pass
          </Button>
        )}
        <Button size="sm" icon={<Upload size={13} />} onClick={() => file.current?.click()}>
          Load room pass
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
              const pass = readRoomPass(await f.text());
              if (pass.showId !== show.id)
                return toast('That room pass is for another show', 'error');
              await work(async () => pass.room);
              toast(`Room ${pass.room.code} is this machine’s now`, 'good');
            } catch (err) {
              errorToast(err);
            }
          }}
        />
      </div>
    </Section>
  );
}

function OpeningHours() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const hours = show.schedule;
  const choices = show.vars.filter((v) => v.type === 'choice');
  const v = show.vars.find((x) => x.id === hours?.varId);
  const values = v?.options?.length ? v.options : ['open', 'closed'];
  const [tryDay, setTryDay] = useState(new Date().getDay());
  const [tryTime, setTryTime] = useState('12:00');

  const set = (fn: (s: Schedule) => void) =>
    update((d) => {
      if (d.schedule) fn(d.schedule);
    });
  const setPeriod = (i: number, patch: Partial<SchedulePeriod>) =>
    set((s) => void Object.assign(s.periods[i]!, patch));

  const start = (varId: string) =>
    update((d) => {
      let id = varId;
      if (!id) {
        id = uid('var');
        d.vars.push({
          id,
          name: 'opening',
          type: 'choice',
          initial: 'closed',
          options: ['open', 'closed'],
        });
      }
      const opts = d.vars.find((x) => x.id === id)?.options ?? ['open', 'closed'];
      d.schedule = {
        varId: id,
        periods: [{ days: [1, 2, 3, 4, 5], from: 600, to: 1020, value: opts[0] ?? 'open' }],
        otherwise: opts[1] ?? opts[0] ?? 'closed',
      };
    });

  const minutes = (t: string) => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    return h * 60 + m;
  };

  if (!hours)
    return (
      <Section title="Opening hours">
        <p className="text-caption text-fg-muted">
          The clock sets a value, and rules switch scenes when it changes: an attract loop when the
          gallery is open, a quiet screen when it closes.
        </p>
        <Select
          aria-label="Set a value by opening hours"
          className="w-64"
          value=""
          onChange={(e) => start(e.target.value === '+new' ? '' : e.target.value)}
        >
          <option value="">Set a value by opening hours…</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="+new">A new value: opening (open, closed)</option>
        </Select>
      </Section>
    );

  return (
    <Section title={`Opening hours set “${v?.name ?? '?'}”`}>
      {hours.periods.map((p, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-2 rounded-control border border-line-subtle p-2"
        >
          <div role="group" aria-label="Days it starts on" className="flex gap-0.5">
            {DAYS.map((d, n) => (
              <button
                key={d}
                type="button"
                aria-pressed={p.days.includes(n)}
                onClick={() =>
                  setPeriod(i, {
                    days: p.days.includes(n)
                      ? p.days.filter((x) => x !== n)
                      : [...p.days, n].sort(),
                  })
                }
                className={cn(
                  'h-7 w-9 rounded-control border text-caption',
                  p.days.includes(n)
                    ? 'border-fg bg-fg text-app'
                    : 'border-line-control text-fg-muted hover:bg-control-hover',
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            type="time"
            aria-label="From"
            className="h-7 rounded-control border border-line-control bg-control px-1 text-ui"
            value={timeText(p.from)}
            onChange={(e) => setPeriod(i, { from: minutes(e.target.value) })}
          />
          <span className="text-caption text-fg-subtle">to</span>
          <input
            type="time"
            aria-label="To"
            className="h-7 rounded-control border border-line-control bg-control px-1 text-ui"
            value={timeText(p.to)}
            onChange={(e) => setPeriod(i, { to: minutes(e.target.value) })}
          />
          <Select
            aria-label="Value"
            className="w-28"
            value={p.value}
            onChange={(e) => setPeriod(i, { value: e.target.value })}
          >
            {values.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <IconButton
            label={`Remove period ${i + 1}`}
            icon={<Trash2 size={12} />}
            onClick={() => set((s) => void s.periods.splice(i, 1))}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
        <Button
          size="sm"
          icon={<Plus size={12} />}
          onClick={() =>
            set(
              (s) => void s.periods.push({ days: [6, 0], from: 600, to: 1080, value: values[0]! }),
            )
          }
        >
          Period
        </Button>
        Otherwise
        <Select
          aria-label="Otherwise"
          className="w-28"
          value={hours.otherwise}
          onChange={(e) => set((s) => void (s.otherwise = e.target.value))}
        >
          {values.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={() => update((d) => void delete d.schedule)}>
          No opening hours
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
        Try a time:
        <Select
          aria-label="Day"
          className="w-24"
          value={String(tryDay)}
          onChange={(e) => setTryDay(Number(e.target.value))}
        >
          {DAYS.map((d, n) => (
            <option key={d} value={n}>
              {d}
            </option>
          ))}
        </Select>
        <input
          type="time"
          aria-label="Time"
          className="h-7 rounded-control border border-line-control bg-control px-1 text-ui"
          value={tryTime}
          onChange={(e) => setTryTime(e.target.value)}
        />
        <span aria-live="polite" className="text-fg">
          → {v?.name ?? 'value'} is “{scheduleValue(hours, tryDay, minutes(tryTime))}”
        </span>
      </div>
      <p className="text-caption text-fg-subtle">
        A period that ends before it starts runs past midnight; the same start and end is all day.
        Times are this machine’s.
      </p>
    </Section>
  );
}

function Browser() {
  const show = useShow();
  const [caps, setCaps] = useState<Capability[] | null>(null);
  useEffect(
    () =>
      void checkCapabilities({ outputs: true, midi: show.inputs.midi.length > 0 }).then(setCaps),
    [show.inputs.midi.length],
  );
  return (
    <Section title="This browser">
      <ul className="flex flex-col gap-1 text-caption">
        {(caps ?? []).map((c) => (
          <li key={c.id} className={c.state === 'ok' ? 'text-fg-muted' : 'text-warn'}>
            {c.title}: {c.detail}
          </li>
        ))}
      </ul>
      <p className="text-caption text-fg-subtle">
        Unattended, nobody can click “allow”: set the browser’s policies for full screen, sound,
        pop-ups and window placement. The installation guide lists them.
      </p>
    </Section>
  );
}
