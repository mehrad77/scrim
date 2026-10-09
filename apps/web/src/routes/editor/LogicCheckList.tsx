import { ChevronRight, TriangleAlert } from 'lucide-react';
import type { LogicIssue } from '../../lib/logic.js';

/** The logic check's findings for one tab; a finding that can be shown is a button. */
export function LogicCheckList({
  issues,
  canReveal,
  onReveal,
}: {
  issues: LogicIssue[];
  canReveal: (i: LogicIssue) => boolean;
  onReveal: (i: LogicIssue) => void;
}) {
  return (
    <details className="group shrink-0 border-b border-line-subtle px-3 py-2" open>
      <summary className="flex cursor-default list-none items-center gap-1.5 text-caption text-warn [&::-webkit-details-marker]:hidden">
        <ChevronRight size={12} className="group-open:rotate-90" aria-hidden />
        <TriangleAlert size={13} aria-hidden />
        Logic check: {issues.length} thing{issues.length > 1 ? 's' : ''} to look at
      </summary>
      <ul className="mt-1 flex flex-col">
        {issues.map((i) => (
          <li key={i.id}>
            <button
              onClick={() => onReveal(i)}
              disabled={!canReveal(i)}
              className="w-full rounded-control px-2 py-0.5 text-left text-caption text-fg-muted enabled:hover:bg-control-hover enabled:hover:text-fg"
            >
              {i.text}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
