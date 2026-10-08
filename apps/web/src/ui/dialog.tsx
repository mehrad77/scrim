import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './Button.js';
import { TextInput } from './Field.js';

/**
 * In the operator view Esc is PANIC and nothing else, so dialogs there ignore it and close only
 * through their buttons. The operator route turns this on while it is mounted.
 */
let escapeIsPanic = false;
export function setEscapeIsPanic(on: boolean): void {
  escapeIsPanic = on;
}

interface Choice<T> {
  label: string;
  value: T;
  variant?: 'primary' | 'secondary' | 'danger';
}

/** Promise-based modal built on <dialog>; resolves with the chosen value or null. */
export function ask<T>(title: string, body: ReactNode, choices: Choice<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: T | null) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<Modal title={title} body={body} choices={choices} onDone={done} />);
  });
}

export function confirmDialog(
  title: string,
  body: ReactNode,
  confirmLabel = 'OK',
  danger = false,
): Promise<boolean> {
  return ask(title, body, [
    { label: 'Cancel', value: false },
    { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary' },
  ]).then((v) => v === true);
}

export function promptDialog(title: string, initial = '', label?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: string | null) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<PromptModal title={title} initial={initial} label={label} onDone={done} />);
  });
}

function Shell({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!escapeIsPanic) onCancel();
      }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-ink-700 bg-ink-850 p-0 text-ink-100 shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-5">
        <h2 id={titleId} className="mb-3 text-base font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

function Modal<T>({
  title,
  body,
  choices,
  onDone,
}: {
  title: string;
  body: ReactNode;
  choices: Choice<T>[];
  onDone: (v: T | null) => void;
}) {
  return (
    <Shell title={title} onCancel={() => onDone(null)}>
      <div className="text-sm text-ink-200">{body}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {choices.map((c, i) => (
          <Button
            key={i}
            variant={c.variant ?? 'secondary'}
            onClick={() => onDone(c.value)}
            autoFocus={i === choices.length - 1}
          >
            {c.label}
          </Button>
        ))}
      </div>
    </Shell>
  );
}

function PromptModal({
  title,
  initial,
  label,
  onDone,
}: {
  title: string;
  initial: string;
  label?: string | undefined;
  onDone: (v: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Shell title={title} onCancel={() => onDone(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onDone(value.trim());
        }}
      >
        {label && <div className="mb-1 text-xs text-ink-300">{label}</div>}
        <TextInput
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => onDone(null)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            OK
          </Button>
        </div>
      </form>
    </Shell>
  );
}
