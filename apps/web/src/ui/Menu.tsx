import type { ReactNode } from 'react';
import {
  Button,
  Keyboard,
  Menu as RACMenu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
} from 'react-aria-components';
import { cn } from '../lib/cn.js';
import { isEscapePanic } from './escape.js';

export interface MenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onAction: () => void;
}

/** A menu behind a button; every item also says what it does in words. */
export function MenuButton({
  label,
  icon,
  items,
  className,
  children,
}: {
  label: string;
  icon?: ReactNode;
  items: (MenuAction | 'separator')[];
  className?: string;
  children?: ReactNode;
}) {
  return (
    <MenuTrigger>
      <Button
        aria-label={children ? undefined : label}
        data-info={label}
        className={cn(
          'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-control px-2 text-caption font-medium text-fg-muted outline-none hover:bg-control-hover hover:text-fg',
          className,
        )}
      >
        {icon}
        {children}
      </Button>
      <MenuPopover items={items} />
    </MenuTrigger>
  );
}

export function MenuPopover({ items }: { items: (MenuAction | 'separator')[] }) {
  return (
    <Popover
      data-overlay-open
      isKeyboardDismissDisabled={isEscapePanic()}
      className="min-w-48 rounded-overlay border border-line-strong bg-raised p-1 shadow-overlay"
    >
      <RACMenu
        className="outline-none"
        disabledKeys={items.flatMap((i) => (i !== 'separator' && i.disabled ? [i.id] : []))}
        onAction={(k) =>
          items.find((i): i is MenuAction => i !== 'separator' && i.id === k)?.onAction()
        }
      >
        {items.map((i, n) =>
          i === 'separator' ? (
            <Separator key={`s${n}`} className="my-1 border-t border-line-subtle" />
          ) : (
            <MenuItem
              key={i.id}
              id={i.id}
              textValue={i.label}
              className={cn(
                'flex h-row cursor-default items-center gap-2 rounded-control px-2 text-ui outline-none data-[disabled]:opacity-40 data-[focused]:bg-control-hover',
                i.danger ? 'text-fault' : 'text-fg',
              )}
            >
              <span className="flex w-4 justify-center text-fg-icon">{i.icon}</span>
              <span className="flex-1">{i.label}</span>
              {i.shortcut && (
                <Keyboard className="label-caps text-fg-subtle">{i.shortcut}</Keyboard>
              )}
            </MenuItem>
          ),
        )}
      </RACMenu>
    </Popover>
  );
}
