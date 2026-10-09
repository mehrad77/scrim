import { formatVar, step, type EngineState } from '@scrim/engine';
import { type Show, type VarValue } from '@scrim/format';
import { Bookmark, CircleCheck, MoreHorizontal, Play, Route, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { valueLabel } from '../../lib/logic.js';
import {
  bookmarkPath,
  checkPath,
  momentsBefore,
  prepareRehearsal,
  previewAt,
  readPaths,
  stateBefore,
  writePaths,
  type Assume,
  type PathBookmark,
} from '../../lib/simulate.js';
import { Stage } from '../../render/Stage.js';
import { flushSave, useEditor, useShow } from '../../state/editor.js';
import { Button, IconButton } from '../../ui/Button.js';
import { promptDialog } from '../../ui/dialog.js';
import { NumberInput, Select } from '../../ui/Field.js';
import { MenuButton } from '../../ui/Menu.js';
import { Panel } from '../../ui/Panel.js';
import { toast } from '../../ui/toast.js';
import { cueEnd } from './CueDock.js';

const T0 = 1e9;

/**
 * "After this cue" (UX principle 7): the picture and the state right after the selected cue,
 * following the branches that the assumed audience results lead to. Play runs the cue with
 * its real fades; the path can be rehearsed in the operator view or saved to replay later.
 */
export function AfterThisCue() {
  const show = useShow();
  const cueId = useEditor((s) => s.selection.cueId);
  const select = useEditor((s) => s.select);
  const cue = show.cues.find((c) => c.id === cueId);
  const [assume, setAssume] = useState<Assume>({});
  const [paths, setPaths] = useState<PathBookmark[]>(() => readPaths(show.id));
  const savePaths = (next: PathBookmark[]) => {
    setPaths(next);
    writePaths(show.id, next);
  };

  const preview = useMemo(() => previewAt(show, cueId, assume), [show, cueId, assume]);
  const asked = useMemo(
    () => (cueId ? momentsBefore(show, cueId, assume) : []),
    [show, cueId, assume],
  );
  const before = useMemo(
    () => (cueId ? stateBefore(show, cueId, assume) : null),
    [show, cueId, assume],
  );

  // Play the cue with its real fades and delays: the state just before it, fired at T0, read at
  // T0 + t. Editor only; outputs never animate from here.
  const [t, setT] = useState<number | null>(null);
  const length = cue ? Math.max(0.5, cueEnd(cue)) : 0;
  const playing = useMemo(() => {
    if (!cue || !before || t === null) return null;
    const fired = step(
      show,
      before,
      { type: 'fireCue', cueId: cue.id, source: 'system' },
      T0,
    ).state;
    return step(show, fired, { type: 'tick' }, T0 + t * 1000).state;
  }, [show, cue, before, t]);
  useEffect(() => setT(null), [cueId]);
  useEffect(() => {
    if (t === null || t >= length) return;
    const start = performance.now() - t * 1000;
    let raf = 0;
    const loop = () => {
      const next = (performance.now() - start) / 1000;
      if (next >= length) return setT(length);
      setT(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // Restart the loop only when play starts, not on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t === null, length]);
  const state = playing ?? preview.state;

  const rehearse = async () => {
    if (!cueId) return;
    prepareRehearsal(show, cueId, assume);
    await flushSave();
    window.open(`/show/${show.id}/run`, `scrim-run-${show.id}`);
  };
  const savePath = async () => {
    if (!cue) return;
    const name = await promptDialog('Save this path', `To “${cue.name}”`, 'Name');
    if (!name) return;
    savePaths([...paths, bookmarkPath(show, cue.id, assume, name)]);
    toast('Path saved. It replays after every edit and warns when it breaks.', 'good');
  };

  return (
    <Panel
      title="After this cue"
      className="h-full"
      bodyClassName="flex flex-col gap-3 p-2"
      actions={
        cue && (
          <>
            <Button
              size="sm"
              icon={<Play size={13} />}
              onClick={() => setT(0)}
              title="Play this cue with its fades and delays"
            >
              Play
            </Button>
            <MenuButton
              label="More for this cue"
              icon={<MoreHorizontal size={15} />}
              items={[
                {
                  id: 'rehearse',
                  label: 'Rehearse from here',
                  icon: <Route size={14} />,
                  onAction: () => void rehearse(),
                },
                {
                  id: 'save',
                  label: 'Save this path…',
                  icon: <Bookmark size={14} />,
                  onAction: () => void savePath(),
                },
              ]}
            />
          </>
        )
      }
    >
      {asked.length > 0 && (
        <AssumeChips show={show} moments={asked} assume={assume} onChange={setAssume} />
      )}
      {cue && !preview.onPath && (
        <p className="flex items-start gap-1.5 text-caption text-warn">
          <TriangleAlert size={13} className="mt-px shrink-0" aria-hidden />
          These results don't lead to this cue, so the picture follows the running order.
        </p>
      )}
      {show.outputs.map((o) => (
        <div key={o.id}>
          <div className="mb-1 text-caption text-fg-subtle">{o.name}</div>
          <div className="aspect-video overflow-hidden rounded-control border border-line-subtle bg-black">
            <Stage
              show={show}
              state={state}
              outputId={o.id}
              variant="editor"
              clock={() => (playing ? T0 + (t ?? 0) * 1000 : Date.now())}
            />
          </div>
        </div>
      ))}
      {cue && (
        <input
          type="range"
          aria-label="Scrub through this cue"
          min={0}
          max={length}
          step={0.05}
          value={t ?? length}
          onChange={(e) => setT(Number(e.target.value))}
          className="w-full accent-accent"
        />
      )}
      <StateValues show={show} state={state} before={before} />
      <SavedPaths
        show={show}
        paths={paths}
        onOpen={(p) => {
          setAssume(p.assume);
          select({ cueId: p.cueId });
        }}
        onRemove={(id) => savePaths(paths.filter((p) => p.id !== id))}
      />
    </Panel>
  );
}

/** "Assume Door vote returned [The red door]": set what earlier moments returned. */
function AssumeChips({
  show,
  moments,
  assume,
  onChange,
}: {
  show: Show;
  moments: string[];
  assume: Assume;
  onChange: (a: Assume) => void;
}) {
  const set = (id: string, v: VarValue | undefined) => {
    const next = { ...assume };
    if (v === undefined) delete next[id];
    else next[id] = v;
    onChange(next);
  };
  return (
    <section aria-label="Assume" className="flex flex-col gap-1">
      <h3 className="label-caps text-fg-subtle">Assume</h3>
      {moments.map((id) => {
        const m = show.moments.find((x) => x.id === id);
        if (!m) return null;
        const value = assume[id];
        return (
          <div key={id} className="flex flex-wrap items-center gap-1.5 text-ui">
            <span className="text-fg-muted">{m.name} returned</span>
            {m.type === 'vote' ? (
              <Select
                variant="chip"
                aria-label={`What ${m.name} returned`}
                value={value === undefined ? '' : String(value)}
                onChange={(e) => set(id, e.target.value || undefined)}
              >
                <option value="">
                  the default ({m.options.find((o) => o.id === m.defaultResult)?.label ?? '—'})
                </option>
                {m.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : m.type === 'tap' || m.type === 'slider' ? (
              <NumberInput
                aria-label={`What ${m.name} returned`}
                className="w-24"
                value={typeof value === 'number' ? value : Number(m.defaultResult) || 0}
                onCommit={(v) => set(id, v)}
              />
            ) : (
              <span className="text-fg">the default</span>
            )}
          </div>
        );
      })}
    </section>
  );
}

const shown = (show: Show, varId: string, v: VarValue | undefined) =>
  typeof v === 'string' || typeof v === 'number'
    ? valueLabel(show, varId, v) || '—'
    : formatVar(show, varId, v) || '—';

/** State as values people read, with what this cue changed marked. */
function StateValues({
  show,
  state,
  before,
}: {
  show: Show;
  state: EngineState;
  before: EngineState | null;
}) {
  if (!show.vars.length) return null;
  return (
    <section aria-label="State values" className="text-caption">
      <h3 className="label-caps mb-1 text-fg-subtle">State</h3>
      <dl>
        {show.vars.map((v) => {
          const now = shown(show, v.id, state.vars[v.id]);
          const was = before ? shown(show, v.id, before.vars[v.id]) : now;
          return (
            <div key={v.id} className="flex items-baseline gap-2 border-b border-line-subtle py-1">
              <dt className="font-mono text-fg-muted">{v.name}</dt>
              <dd className={cn('ml-auto text-right', now !== was ? 'text-fg' : 'text-fg-muted')}>
                {now !== was && <span className="text-fg-subtle">{was} → </span>}
                {now}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function SavedPaths({
  show,
  paths,
  onOpen,
  onRemove,
}: {
  show: Show;
  paths: PathBookmark[];
  onOpen: (p: PathBookmark) => void;
  onRemove: (id: string) => void;
}) {
  const status = useMemo(
    () => new Map(paths.map((p) => [p.id, checkPath(show, p)])),
    [show, paths],
  );
  if (!paths.length) return null;
  return (
    <section aria-label="Saved paths" className="text-caption">
      <h3 className="label-caps mb-1 text-fg-subtle">Saved paths</h3>
      <ul>
        {paths.map((p) => {
          const s = status.get(p.id);
          return (
            <li key={p.id} className="flex items-center gap-1.5 border-b border-line-subtle py-0.5">
              {s === 'ok' ? (
                <CircleCheck size={13} className="shrink-0 text-go" aria-label="Still works" />
              ) : (
                <TriangleAlert size={13} className="shrink-0 text-warn" aria-label="Changed" />
              )}
              <button
                onClick={() => onOpen(p)}
                className="min-w-0 flex-1 truncate text-left text-fg hover:underline"
              >
                {p.name}
              </button>
              {s !== 'ok' && (
                <span className="shrink-0 text-warn">
                  {s === 'broken' ? 'no longer gets there' : 'takes a new route'}
                </span>
              )}
              <IconButton
                label="Forget this path"
                icon={<X size={12} />}
                onClick={() => onRemove(p.id)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
