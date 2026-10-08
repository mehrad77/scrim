import type { Show } from '@scrim/format';
import { FilePlus2, Layers, Radio, Sparkles, Vote, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { STARTERS } from '../../lib/starters.js';

const ICONS: Record<string, LucideIcon> = { vote: Vote, slides: Layers, counter: Radio };

/**
 * The start gallery (UX principle 8): a blank show, the demo, a few real starters and this
 * machine's saved templates. Every card makes an ordinary show.
 */
export function StartGallery({
  templates,
  onBlank,
  onDemo,
  onStarter,
  onTemplate,
  onDeleteTemplate,
}: {
  templates: Show[];
  onBlank: () => void;
  onDemo: () => void;
  onStarter: (id: string) => void;
  onTemplate: (t: Show) => void;
  onDeleteTemplate: (t: Show) => void;
}) {
  return (
    <section aria-labelledby="start-heading" className="flex flex-col gap-3">
      <h2 id="start-heading" className="font-display text-heading font-semibold">
        Start something new
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card
          tape={0}
          icon={FilePlus2}
          title="Blank show"
          blurb="One scene, ready for cues."
          onClick={onBlank}
        />
        <Card
          tape={7}
          icon={Sparkles}
          title="The demo"
          blurb="An interactive show with a vote. Safe to break."
          onClick={onDemo}
        />
        {STARTERS.map((s, i) => (
          <Card
            key={s.id}
            tape={[4, 6, 2][i] ?? 1}
            icon={ICONS[s.id] ?? FilePlus2}
            title={s.title}
            blurb={s.blurb}
            onClick={() => onStarter(s.id)}
          />
        ))}
        {templates.map((t) => (
          <Card
            key={t.id}
            tape={t.scenes[0]?.tape ?? 5}
            icon={Layers}
            title={t.name}
            blurb={`Your template · ${t.cues.length} cues`}
            onClick={() => onTemplate(t)}
            onRemove={() => onDeleteTemplate(t)}
          />
        ))}
      </ul>
    </section>
  );
}

const TAPE_BG = [
  'bg-line-strong',
  'bg-tape-1',
  'bg-tape-2',
  'bg-tape-3',
  'bg-tape-4',
  'bg-tape-5',
  'bg-tape-6',
  'bg-tape-7',
  'bg-tape-8',
];

function Card({
  tape,
  icon: Icon,
  title,
  blurb,
  onClick,
  onRemove,
}: {
  tape: number;
  icon: LucideIcon;
  title: string;
  blurb: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="group relative">
      <button
        onClick={onClick}
        className="flex h-full w-full flex-col gap-2 overflow-hidden rounded-control border border-line-subtle bg-panel p-4 pt-5 text-left outline-none hover:border-line-control hover:bg-control focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span
          aria-hidden
          className={cn('absolute inset-x-0 top-0 h-1', TAPE_BG[tape] ?? TAPE_BG[0])}
        />
        <Icon size={18} className="text-fg-icon" aria-hidden />
        <span className="font-display text-title font-semibold text-fg">{title}</span>
        <span className="text-caption text-fg-muted">{blurb}</span>
      </button>
      {onRemove && (
        <button
          aria-label={`Delete template ${title}`}
          onClick={onRemove}
          className="absolute top-2 right-2 rounded-control p-1 text-fg-icon opacity-0 outline-none group-hover:opacity-100 hover:bg-control-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X size={14} />
        </button>
      )}
    </li>
  );
}
