import type { Show } from '@scrim/format';
import { ArrowRight, FilePlus2, Layers, Sparkles, X, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn.js';
import { TEMPLATES } from '../../templates/index.js';
import { thumbnailOf } from '../../templates/types.js';

/**
 * The start gallery (UX principle 8): a blank show, the demo, the template gallery and this
 * machine's saved templates. Every card makes an ordinary show.
 */
export function StartGallery({
  templates,
  onBlank,
  onDemo,
  onTemplate,
  onDeleteTemplate,
}: {
  templates: Show[];
  onBlank: () => void;
  onDemo: () => void;
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
        <BrowseTemplates />
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

/** The way into the template gallery, showing a few of its shows. */
function BrowseTemplates() {
  const shown = TEMPLATES.slice(0, 4);
  return (
    <li className="sm:col-span-2 lg:col-span-3">
      <Link
        to="/templates"
        className="group relative flex h-full min-h-40 overflow-hidden rounded-control border border-line-subtle bg-panel outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-accent" />
        <span className="flex flex-1 flex-col gap-2 p-4 pt-5">
          <Layers size={18} className="text-fg-icon" aria-hidden />
          <span className="font-display text-title font-semibold text-fg">Templates</span>
          <span className="text-caption text-fg-muted">
            Whole shows with real pictures and music, for a school play, a gathering, a care home, a
            museum, a party or a gig.
          </span>
          <span className="mt-auto flex items-center gap-1 text-caption text-fg">
            Browse templates <ArrowRight size={13} aria-hidden />
          </span>
        </span>
        {shown.length > 0 && (
          <span aria-hidden className="hidden w-1/2 grid-cols-2 gap-px bg-line-subtle sm:grid">
            {shown.map((t) => (
              <img
                key={t.id}
                src={`${import.meta.env.BASE_URL}${thumbnailOf(t)}`}
                alt=""
                loading="lazy"
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                className="aspect-video size-full bg-black object-cover"
              />
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}
