import { X } from 'lucide-react';
import { useState } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { writeLocal } from '../../lib/local.js';
import { writePrefs } from '../../lib/prefs.js';
import { NEW_SHOW_KEY, type NewShowDefaults } from '../../lib/starters.js';
import { Button, IconButton } from '../../ui/Button.js';

export const WELCOMED_KEY = 'scrim.welcomed';

const TOOLS = [
  { id: 'qlab', label: 'QLab' },
  { id: 'slides', label: 'PowerPoint or Keynote' },
  { id: 'figma', label: 'Figma' },
  { id: 'none', label: 'None of these' },
];
const HINT: Record<string, string> = {
  qlab: 'GO, Hold on [ and Esc work the way you expect. Cues live in scenes.',
  slides: 'A cue is like a slide click: everything in it happens together.',
  figma: 'The Stage tab is a canvas: drag, snap, align and nudge with the arrows.',
  none: 'Open the demo to see a whole show; it is safe to break.',
};
const GO_KEYS = [
  { code: 'Space', label: 'Space' },
  { code: 'Enter', label: 'Enter' },
  { code: 'PageDown', label: 'Page Down (clicker or pedal)' },
];

/**
 * First run (UX principle 8): at most three questions, all changeable later. Answers set this
 * machine's theme and the keys new shows start with.
 */
export function FirstRun({ onDone }: { onDone: () => void }) {
  const [tool, setTool] = useState('none');
  const [theme, setTheme] = useState<'booth' | 'paper'>('booth');
  const [goKey, setGoKey] = useState('Space');
  const finish = (save: boolean) => {
    if (save) {
      writePrefs({ theme });
      writeLocal(NEW_SHOW_KEY, { goKey, qlabKeys: tool === 'qlab' } satisfies NewShowDefaults);
    }
    writeLocal(WELCOMED_KEY, true);
    onDone();
  };
  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative flex flex-col gap-5 rounded-control border border-line-strong bg-panel p-5"
    >
      <IconButton
        label="Skip"
        icon={<X size={14} />}
        className="absolute top-3 right-3"
        onClick={() => finish(false)}
      />
      <div>
        <h2 id="welcome-heading" className="font-display text-heading font-semibold">
          Welcome to Scrim
        </h2>
        <p className="text-ui text-fg-muted">
          Three quick questions. You can change all of them later in Preferences.
        </p>
      </div>
      <Question
        label="Which tool do you know best?"
        value={tool}
        onChange={setTool}
        options={TOOLS.map((t) => ({ id: t.id, label: t.label }))}
      />
      <p className="-mt-3 text-caption text-fg-subtle">{HINT[tool]}</p>
      <Question
        label="How should Scrim look?"
        value={theme}
        onChange={(v) => {
          setTheme(v as 'booth' | 'paper');
          writePrefs({ theme: v as 'booth' | 'paper' });
        }}
        options={[
          { id: 'booth', label: 'Booth: dark, for the tech table' },
          { id: 'paper', label: 'Paper: light, for daytime work' },
        ]}
      />
      <Question
        label="Which key fires GO?"
        value={goKey}
        onChange={setGoKey}
        options={GO_KEYS.map((k) => ({ id: k.code, label: k.label }))}
      />
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => finish(true)}>
          Done
        </Button>
        <Button variant="ghost" onClick={() => finish(false)}>
          Skip
        </Button>
      </div>
    </section>
  );
}

function Question({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      orientation="horizontal"
      className="flex flex-col gap-2"
      aria-label={label}
    >
      <span className="text-ui font-medium text-fg">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Radio
            key={o.id}
            value={o.id}
            className="flex h-control cursor-default items-center rounded-control border border-line-control bg-control px-3 text-ui text-fg-muted outline-none hover:bg-control-hover data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus data-[selected]:border-accent data-[selected]:bg-accent-subtle data-[selected]:text-fg"
          >
            {o.label}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
