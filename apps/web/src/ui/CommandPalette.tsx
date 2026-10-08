import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
  useFilter,
} from 'react-aria-components';
import { grouped, onOpenEvent, useCommandList } from '../lib/commands.js';
import { isEscapePanic } from './escape.js';

/**
 * ⌘K (Ctrl+K): every command this surface offers, searchable by title and aliases
 * (DESIGN_SYSTEM.md › Command palette). Library, editor and Rehearsal only; Show mode doesn't
 * mount it.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const commands = useCommandList().filter((c) => !c.disabled);
  const { contains } = useFilter({ sensitivity: 'base' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    const off = onOpenEvent('palette', () => setOpen(true));
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
    };
  }, []);

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={setOpen}
      isDismissable
      isKeyboardDismissDisabled={isEscapePanic()}
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
    >
      <Modal
        data-overlay-open
        className="w-[min(560px,calc(100vw-32px))] rounded-overlay border border-line-strong bg-overlay text-fg shadow-overlay"
      >
        <Dialog aria-label="Commands" className="outline-none">
          <Autocomplete filter={contains}>
            <SearchField
              aria-label="Search commands"
              autoFocus
              className="border-b border-line-subtle"
            >
              <div className="flex items-center gap-2 px-3">
                <Search size={16} className="shrink-0 text-fg-icon" aria-hidden />
                <Input
                  placeholder="Type a command…"
                  className="h-11 w-full bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
                />
              </div>
            </SearchField>
            <Menu
              aria-label="Commands"
              className="max-h-[50vh] overflow-auto p-1 outline-none"
              onAction={(id) => {
                setOpen(false);
                // Let the palette close and focus return before the command runs.
                requestAnimationFrame(() => commands.find((c) => c.id === id)?.run());
              }}
              renderEmptyState={() => (
                <div className="p-4 text-center text-ui text-fg-subtle">No command matches.</div>
              )}
            >
              {grouped(commands).map(([group, items]) => (
                <MenuSection key={group} id={group}>
                  <Header className="label-caps px-2 pt-2 pb-1 text-fg-subtle">{group}</Header>
                  {items.map((c) => (
                    <MenuItem
                      key={c.id}
                      id={c.id}
                      textValue={[c.title, ...(c.aliases ?? [])].join(' ')}
                      className="flex h-row cursor-default items-center gap-2 rounded-control px-2 text-ui text-fg outline-none data-[focused]:bg-control-hover"
                    >
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      {c.shortcut && (
                        <Keyboard className="label-caps text-fg-subtle">{c.shortcut}</Keyboard>
                      )}
                    </MenuItem>
                  ))}
                </MenuSection>
              ))}
            </Menu>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
