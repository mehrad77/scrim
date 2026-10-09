import type { Show } from '@scrim/format';
import { useId } from 'react';
import { sectionsOf } from '../../lib/jumps.js';
import { CommitInput } from '../../ui/Field.js';

const COMMON = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Outro'];

/** A section name (Verse, Chorus), suggesting the show's own sections first. */
export function SectionInput({
  show,
  value,
  onCommit,
  className,
  label = 'Section',
  info,
}: {
  show: Show;
  value: string;
  onCommit: (section: string) => void;
  className?: string;
  label?: string;
  /** One line for the Info strip. */
  info?: string;
}) {
  const id = useId();
  const own = sectionsOf(show);
  const lower = new Set(own.map((s) => s.toLowerCase()));
  return (
    <>
      <CommitInput
        aria-label={label}
        list={id}
        value={value}
        placeholder="e.g. Chorus"
        data-info={info}
        className={className}
        onCommit={(v) => onCommit(v.trim())}
      />
      <datalist id={id}>
        {[...own, ...COMMON.filter((s) => !lower.has(s.toLowerCase()))].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
