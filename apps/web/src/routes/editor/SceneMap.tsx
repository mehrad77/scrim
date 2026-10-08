import { cueOrder, type Show } from '@scrim/format';
import { useMemo } from 'react';
import { cn } from '../../lib/cn.js';
import { sceneGraph, type SceneEdge } from '../../lib/logic.js';
import { tapeOf } from '../../lib/tape.js';
import { useEditor } from '../../state/editor.js';

const W = 140;
const H = 44;
const GAP_X = 20;
const GAP_Y = 48;
const PAD = 16;
/** Room on the right for lines that loop back up. */
const LOOP = 48;
const ANY = '\u0000any';

const EDGE_TONE: Record<SceneEdge['kind'], string> = {
  next: 'text-fg-subtle',
  jump: 'text-fg-muted',
  rule: 'text-accent-text',
};

/**
 * The scene map (UX principle 7): a read-only picture of where the show can go, derived from
 * running order, jumps and rules. Clicking a scene selects its first cue. The cue list stays the
 * thing you edit.
 */
export function SceneMap({ show }: { show: Show }) {
  const select = useEditor((s) => s.select);
  const cueId = useEditor((s) => s.selection.cueId);
  const graph = useMemo(() => sceneGraph(show), [show]);
  const order = useMemo(() => cueOrder(show), [show]);
  const current = show.cues.find((c) => c.id === cueId)?.sceneId;

  const layout = useMemo(() => {
    const hasAny = graph.edges.some((e) => e.from === null);
    const depth = new Map<string, number>();
    if (graph.start) depth.set(graph.start, hasAny ? 1 : 0);
    if (hasAny) depth.set(ANY, 0);
    // Breadth walk from the start; edges back to an earlier row loop round the side.
    for (let changed = true, guard = 0; changed && guard < 50; guard++) {
      changed = false;
      for (const e of graph.edges) {
        const from = e.from ?? ANY;
        const d = depth.get(from);
        if (d === undefined || depth.has(e.to)) continue;
        depth.set(e.to, d + 1);
        changed = true;
      }
    }
    const deepest = Math.max(0, ...depth.values());
    for (const s of graph.scenes) if (!depth.has(s.id)) depth.set(s.id, deepest + 1);
    const rows: string[][] = [];
    const ids = [...(hasAny ? [ANY] : []), ...graph.scenes.map((s) => s.id)];
    for (const id of ids) (rows[depth.get(id)!] ??= []).push(id);
    const span = (k: number) => k * W + (k - 1) * GAP_X;
    const widest = Math.max(1, ...rows.map((r) => r?.length ?? 0));
    const pos = new Map<string, { x: number; y: number }>();
    rows.forEach((row, d) => {
      const offset = PAD + (span(widest) - span(row.length)) / 2;
      row.forEach((id, i) =>
        pos.set(id, { x: offset + i * (W + GAP_X), y: PAD + d * (H + GAP_Y) }),
      );
    });
    return {
      pos,
      width: PAD * 2 + span(widest) + LOOP,
      height: PAD * 2 + rows.length * H + (rows.length - 1) * GAP_Y,
    };
  }, [graph]);

  if (!graph.scenes.length) {
    return <p className="p-4 text-ui text-fg-subtle">Add cues to see the shape of the show.</p>;
  }

  // One line per scene pair and kind, with its labels combined.
  const lines = new Map<string, SceneEdge[]>();
  for (const e of graph.edges) {
    const k = `${e.from ?? ANY}>${e.to}>${e.kind}`;
    lines.set(k, [...(lines.get(k) ?? []), e]);
  }

  return (
    <div className="h-full overflow-auto">
      <svg
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label={`Scene map: ${graph.scenes.length} scenes`}
        className="block"
      >
        {[...lines.values()].map((es) => {
          const e = es[0]!;
          const a = layout.pos.get(e.from ?? ANY);
          const b = layout.pos.get(e.to);
          if (!a || !b) return null;
          const back = b.y <= a.y;
          // Down from the bottom edge to the top edge; back up round the right-hand side.
          const [x1, y1] = back ? [a.x + W, a.y + H / 2] : [a.x + W / 2, a.y + H];
          const [x2, y2] = back ? [b.x + W, b.y + H / 2] : [b.x + W / 2, b.y];
          const side = Math.max(x1, x2) + LOOP - 8;
          const [cx, cy] = back ? [side, y2] : [x2, y2 - GAP_Y / 2];
          const d = back
            ? `M${x1},${y1} C${side},${y1} ${cx},${cy} ${x2},${y2}`
            : `M${x1},${y1} C${x1},${y1 + GAP_Y / 2} ${cx},${cy} ${x2},${y2}`;
          // Arrowhead along the last control-point tangent.
          const ang = Math.atan2(y2 - cy, x2 - cx);
          const tip = (o: number) => `${x2 - 7 * Math.cos(ang + o)},${y2 - 7 * Math.sin(ang + o)}`;
          const label = e.kind === 'rule' ? es.map((x) => x.label).join(' / ') : null;
          return (
            <g key={`${e.from}>${e.to}>${e.kind}`} className={EDGE_TONE[e.kind]}>
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray={e.kind === 'next' ? '4 4' : undefined}
              >
                <title>
                  {e.kind === 'next' ? 'Then, in running order' : es.map((x) => x.label).join('\n')}
                </title>
              </path>
              <polygon points={`${x2},${y2} ${tip(0.45)} ${tip(-0.45)}`} fill="currentColor" />
              {label && (
                <text
                  x={back ? side + 4 : x2}
                  y={back ? (y1 + y2) / 2 : y2 - 10}
                  textAnchor={back ? 'start' : 'middle'}
                  className="fill-current stroke-panel text-caption [paint-order:stroke]"
                  strokeWidth={4}
                >
                  {label.length > 22 ? `${label.slice(0, 21)}…` : label}
                </text>
              )}
            </g>
          );
        })}
        {layout.pos.has(ANY) && (
          <g>
            <rect
              x={layout.pos.get(ANY)!.x}
              y={layout.pos.get(ANY)!.y}
              width={W}
              height={H}
              rx={2}
              className="fill-none stroke-line-control"
              strokeDasharray="3 3"
            />
            <text
              x={layout.pos.get(ANY)!.x + 10}
              y={layout.pos.get(ANY)!.y + H / 2 + 4}
              className="fill-fg-muted text-caption"
            >
              Any time (triggers)
            </text>
          </g>
        )}
        {graph.scenes.map((s) => {
          const p = layout.pos.get(s.id)!;
          const cues = order.filter((c) => c.sceneId === s.id);
          const reachable = graph.reachable.has(s.id);
          const tape = tapeOf(undefined, s);
          return (
            <g
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={`${s.name}, ${cues.length} cues${reachable ? '' : ', unreachable'}`}
              onClick={() => cues[0] && select({ cueId: cues[0].id })}
              onKeyDown={(ev) => {
                if ((ev.key === 'Enter' || ev.key === ' ') && cues[0]) {
                  ev.preventDefault();
                  select({ cueId: cues[0].id });
                }
              }}
              className={cn('cursor-default outline-none', !reachable && 'opacity-50')}
            >
              <rect
                x={p.x}
                y={p.y}
                width={W}
                height={H}
                rx={2}
                className={cn(
                  'fill-control',
                  s.id === current ? 'stroke-accent' : 'stroke-line-control',
                )}
                strokeWidth={s.id === current ? 2 : 1}
                strokeDasharray={reachable ? undefined : '4 3'}
              />
              {tape && <rect x={p.x} y={p.y} width={4} height={H} className={tape.fill} />}
              <text x={p.x + 12} y={p.y + 20} className="fill-fg text-ui font-medium">
                {s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}
              </text>
              <text x={p.x + 12} y={p.y + 37} className="fill-fg-subtle text-caption">
                {s.id === graph.start ? 'Start · ' : ''}
                {cues.length} cue{cues.length === 1 ? '' : 's'}
                {reachable ? '' : ' · unreachable'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
