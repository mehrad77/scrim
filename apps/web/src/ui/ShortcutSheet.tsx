import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, Heading, Keyboard, Modal, ModalOverlay } from 'react-aria-components';
import { isTyping } from '../host/inputs.js';
import { grouped, onOpenEvent, useCommandList } from '../lib/commands.js';
import { writePrefs } from '../lib/prefs.js';
import { usePrefs } from '../lib/usePrefs.js';
import { IconButton } from './Button.js';
import { isEscapePanic } from './escape.js';
import { Toggle } from './Field.js';

export interface SheetRow {
  title: string;
  keys: string[];
}

/**
 * `?`: the shortcuts for this surface, with the show's running keys first when there are any,
 * then every registered command; commands without a key are listed too, so people can find
 * them in the palette (UX_PRINCIPLES.md › Commands, shortcuts and the palette).
 */
export function ShortcutSheet({ first }: { first?: { group: string; rows: SheetRow[] } }) {
  const [open, setOpen] = useState(false);
  const commands = useCommandList();
  const prefs = usePrefs();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    const off = onOpenEvent('sheet', () => setOpen(true));
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
    };
  }, []);

  const groups: [string, SheetRow[]][] = [
    ...(first ? ([[first.group, first.rows]] as [string, SheetRow[]][]) : []),
    ...grouped(commands).map(
      ([g, cs]) =>
        [g, cs.map((c) => ({ title: c.title, keys: c.shortcut ? [c.shortcut] : [] }))] as [
          string,
          SheetRow[],
        ],
    ),
    [
      'Help',
      [
        { title: 'Commands', keys: ['⌘K'] },
        { title: 'This sheet', keys: ['?'] },
        { title: 'Show shortcuts on buttons', keys: ['Hold ⌥'] },
        { title: 'Preferences', keys: ['⌘,'] },
      ],
    ],
  ];

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={setOpen}
      isDismissable
      isKeyboardDismissDisabled={isEscapePanic()}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
    >
      <Modal
        data-overlay-open
        className="flex max-h-[min(720px,calc(100vh-32px))] w-[min(760px,calc(100vw-32px))] flex-col rounded-overlay border border-line-strong bg-overlay text-fg shadow-overlay"
      >
        <Dialog aria-label="Keyboard shortcuts" className="flex min-h-0 flex-col outline-none">
          <header className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
            <Heading slot="title" className="text-title font-semibold">
              Keyboard shortcuts
            </Heading>
            <IconButton
              label="Close"
              icon={<X size={14} />}
              className="ml-auto"
              onClick={() => setOpen(false)}
            />
          </header>
          <div className="grid min-h-0 gap-x-8 gap-y-5 overflow-auto p-4 sm:grid-cols-2">
            {groups.map(([group, rows]) => (
              <section key={group} aria-label={group}>
                <h3 className="label-caps mb-1 text-fg-subtle">{group}</h3>
                <ul>
                  {rows.map((r) => (
                    <li
                      key={r.title}
                      className="flex items-center gap-2 border-b border-line-subtle py-1 text-ui"
                    >
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {r.keys.length ? (
                        r.keys.map((k) => (
                          <Keyboard
                            key={k}
                            className="label-caps rounded-control border border-line-control px-1.5 py-0.5 text-fg-muted"
                          >
                            {k}
                          </Keyboard>
                        ))
                      ) : (
                        <span className="text-caption text-fg-subtle">⌘K</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <footer className="flex items-center gap-4 border-t border-line-subtle px-4 py-2">
            <Toggle
              checked={prefs.infoStrip}
              onChange={(infoStrip) => writePrefs({ infoStrip })}
              label="Info strip along the bottom"
            />
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
