import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const HOLD_MS = 500;

interface Hint {
  key: string;
  x: number;
  y: number;
}

/**
 * Hold Alt/Option on its own to see shortcuts on the buttons that have one
 * (UX_PRINCIPLES.md › Teach shortcuts where the eyes already are). Any other key, or letting
 * go, hides them, so Alt+arrow shortcuts never flash hints.
 */
export function KeyHints() {
  const [hints, setHints] = useState<Hint[] | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const hide = () => {
      clearTimeout(timer);
      setHints(null);
    };
    const show = () => {
      const out: Hint[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('[data-shortcut]')) {
        const key = el.dataset.shortcut;
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0;
        if (key && visible) out.push({ key, x: r.left + r.width / 2, y: r.top });
      }
      setHints(out);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !e.repeat && !e.metaKey && !e.ctrlKey) {
        clearTimeout(timer);
        timer = window.setTimeout(show, HOLD_MS);
      } else hide();
    };
    const onUp = (e: KeyboardEvent) => e.key === 'Alt' && hide();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', hide);
    window.addEventListener('pointerdown', hide);
    return () => {
      hide();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', hide);
      window.removeEventListener('pointerdown', hide);
    };
  }, []);

  if (!hints?.length) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
      {hints.map((h, i) => (
        <kbd
          key={i}
          className="label-caps absolute -translate-x-1/2 -translate-y-1/2 rounded-control border border-line-strong bg-fg px-1 py-0.5 text-app shadow-overlay"
          style={{ left: h.x, top: h.y }}
        >
          {h.key}
        </kbd>
      ))}
    </div>,
    document.body,
  );
}
