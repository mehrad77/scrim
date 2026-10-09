import type { Show } from '@scrim/format';
import type { ReactNode } from 'react';
import { useEditor } from '../../../state/editor.js';
import { Field, Select } from '../../../ui/Field.js';

/** The show being edited, and its update, outside React (the wizards run from menus). */
export const current = () => useEditor.getState().show!;

/**
 * Apply a builder to the show, then select what it made so the editor shows it. Null when the
 * show couldn't change (Show mode locked it after the dialog opened).
 */
export function build<T extends { cueIds?: string[] }>(fn: (d: Show) => T): T | null {
  let made: T | null = null;
  useEditor.getState().update((d) => void (made = fn(d)));
  const first = (made as T | null)?.cueIds?.[0];
  if (first) useEditor.getState().select({ cueId: first });
  return made;
}

/** Which output it goes on; only asked when the show has more than one. */
export function OutputField({
  value,
  onChange,
}: {
  value: string;
  onChange: (outputId: string) => void;
}) {
  const outputs = current().outputs;
  if (outputs.length < 2) return null;
  return (
    <Field label="On the output">
      <Select aria-label="On the output" value={value} onChange={(e) => onChange(e.target.value)}>
        {outputs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * A labelled list of controls. A field's <label> would hand every click on its words or gaps to
 * the first control inside, so a list gets a fieldset and a legend instead.
 */
export function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1 text-caption text-fg-muted">
      <legend className="mb-1">{legend}</legend>
      {children}
    </fieldset>
  );
}
