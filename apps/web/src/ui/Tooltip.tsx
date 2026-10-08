import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactElement,
} from 'react';
import { Focusable, Tooltip, TooltipTrigger } from 'react-aria-components';
import { X } from 'lucide-react';
import { writePrefs } from '../lib/prefs.js';
import { usePrefs } from '../lib/usePrefs.js';

/**
 * How help for a control is shown. The editor and Library use floating tooltips; the operator
 * uses only the Info strip, because a floating tooltip covers content and is dismissed with Esc,
 * which is PANIC there (UX_PRINCIPLES.md › Accessibility commitments, 1.4.13).
 */
const HelpModeContext = createContext<'tooltip' | 'strip'>('tooltip');
export const HelpMode = HelpModeContext.Provider;

type InfoProps = { 'data-info'?: string; 'data-info-key'?: string };
type FocusableChild = Parameters<typeof Focusable>[0]['children'];

/** Name a control: a tooltip with its shortcut, and a line in the Info strip. */
export function Tip({
  label,
  shortcut,
  disabled,
  children,
}: {
  label: string;
  shortcut?: string | undefined;
  disabled?: boolean | undefined;
  children: ReactElement<InfoProps>;
}) {
  const mode = useContext(HelpModeContext);
  const tagged = cloneElement(children, { 'data-info': label, 'data-info-key': shortcut });
  if (mode === 'strip' || disabled) return tagged;
  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      {/* Our Button forwards props and ref to its <button>, which is all Focusable needs. */}
      <Focusable>{tagged as unknown as FocusableChild}</Focusable>
      <Tooltip
        offset={6}
        className="pointer-events-none z-30 flex items-center gap-2 rounded-overlay border border-line-strong bg-raised px-2 py-1 text-caption text-fg shadow-overlay"
      >
        {label}
        {shortcut && (
          <kbd className="label-caps rounded-control border border-line-control px-1 text-fg-muted">
            {shortcut}
          </kbd>
        )}
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * One line along the bottom edge that names whatever is under the pointer or focused, with its
 * shortcut. It never covers other content. Hide it here; bring it back from the `?` sheet or
 * Preferences.
 */
export function InfoStrip({ fallback }: { fallback?: string }) {
  const on = usePrefs().infoStrip;
  const [info, setInfo] = useState<{ label: string; key: string | null } | null>(null);

  useEffect(() => {
    const read = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest?.('[data-info]');
      setInfo(
        el
          ? { label: el.getAttribute('data-info') ?? '', key: el.getAttribute('data-info-key') }
          : null,
      );
    };
    const onOver = (e: Event) => read(e.target);
    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onOver);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onOver);
    };
  }, []);

  if (!on) return null;
  return (
    <div
      role="status"
      className="flex h-7 shrink-0 items-center gap-2 border-t border-line-subtle bg-panel px-3 text-caption text-fg-muted"
    >
      {info ? (
        <>
          <span className="truncate">{info.label}</span>
          {info.key && (
            <kbd className="label-caps rounded-control border border-line-control px-1">
              {info.key}
            </kbd>
          )}
        </>
      ) : (
        <span className="truncate text-fg-subtle">
          {fallback ?? 'Point at anything to see what it does.'}
        </span>
      )}
      <span className="ml-auto shrink-0 text-fg-subtle">? for shortcuts</span>
      <button
        aria-label="Hide this line"
        data-info="Hide this line. Bring it back from the ? sheet or Preferences."
        onClick={() => writePrefs({ infoStrip: false })}
        className="-mr-1 rounded-control p-0.5 text-fg-icon outline-none hover:bg-control-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
      >
        <X size={12} />
      </button>
    </div>
  );
}
