import type { AccessView } from '@scrim/protocol';
import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '../lib/cn.js';
import { speak, type AccessPrefs } from './access.js';
import { languageName, useStrings } from './strings.js';

/**
 * The phone's access choices: language, captions, text size, audio description, vibration and
 * content warnings. Loaded only when opened, so phones that never need it never download it.
 */
export default function AccessSheet({
  prefs,
  lang,
  view,
  onChange,
  onClose,
}: {
  prefs: AccessPrefs;
  /** The language the show's words are in now. */
  lang: string;
  view: AccessView | null;
  onChange: (p: AccessPrefs) => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => done.current?.focus(), []);
  const set = (p: Partial<AccessPrefs>) => onChange({ ...prefs, ...p });
  const languages = view ? [view.languages.base, ...view.languages.others] : [];

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-app/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.access}
        className="aud-enter max-h-[90vh] w-full overflow-auto rounded-t-control border-t border-line-control bg-panel px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2 className="font-display text-2xl font-semibold">{s.access}</h2>
        <p className="mt-1 text-ui text-fg-subtle">{s.accessHint}</p>

        {languages.length > 1 && (
          <fieldset className="mt-5">
            <legend className="label-caps text-fg-subtle">{s.language}</legend>
            <div className="mt-2 flex flex-col gap-2">
              {languages.map((l) => (
                <button
                  key={l}
                  role="radio"
                  aria-checked={l === lang}
                  lang={l}
                  onClick={() => set({ lang: l })}
                  className={cn(
                    'flex items-center justify-between rounded-control border-2 px-4 py-3 text-left text-lg',
                    l === lang ? 'border-accent' : 'border-line-control',
                  )}
                >
                  {languageName(l)}
                  {l === lang && <Check size={20} aria-hidden />}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {view && (
            <Switch
              label={s.captions}
              hint={s.captionsHint}
              on={prefs.captions}
              onChange={(captions) => set({ captions })}
            />
          )}
          {view && 'speechSynthesis' in window && (
            <Switch
              label={s.describe}
              hint={s.describeHint}
              on={prefs.describe}
              onChange={(describe) => {
                // Speaking once inside the tap unlocks speech on phones that need a gesture.
                if (describe) speak(s.describeOn, lang);
                set({ describe });
              }}
            />
          )}
          {view && 'vibrate' in navigator && (
            <Switch
              label={s.vibrate}
              hint={s.vibrateHint}
              on={prefs.buzz}
              onChange={(buzz) => {
                if (buzz) navigator.vibrate(60);
                set({ buzz });
              }}
            />
          )}
          {view && (
            <Switch
              label={s.warnings}
              hint={s.warningsHint}
              on={prefs.warnings}
              onChange={(warnings) => set({ warnings })}
            />
          )}
        </div>

        <fieldset className="mt-5">
          <legend className="label-caps text-fg-subtle">{s.textSize}</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                [1, s.sizeStandard],
                [1.25, s.sizeLarge],
                [1.5, s.sizeLargest],
              ] as const
            ).map(([size, label]) => (
              <button
                key={size}
                role="radio"
                aria-checked={prefs.size === size}
                onClick={() => set({ size })}
                className={cn(
                  'rounded-control border-2 py-3 font-semibold',
                  prefs.size === size ? 'border-accent' : 'border-line-control',
                )}
                style={{ fontSize: `${size}rem` }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          ref={done}
          onClick={onClose}
          className="mt-6 w-full rounded-control bg-accent py-4 text-lg font-semibold text-accent-fg"
        >
          {s.done}
        </button>
      </div>
    </div>
  );
}

function Switch({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-4 rounded-control border border-line-control px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{label}</span>
        <span className="block text-ui text-fg-subtle">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'flex h-7 w-12 shrink-0 items-center rounded-full p-1',
          on ? 'justify-end bg-accent' : 'justify-start bg-control-hover',
        )}
      >
        <span className={cn('size-5 rounded-full', on ? 'bg-accent-fg' : 'bg-fg-subtle')} />
      </span>
    </button>
  );
}
