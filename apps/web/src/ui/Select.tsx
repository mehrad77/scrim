import { Check, ChevronDown } from 'lucide-react';
import {
  Children,
  Fragment,
  isValidElement,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Button,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select as RACSelect,
  SelectValue,
} from 'react-aria-components';
import { cn } from '../lib/cn.js';
import { isEscapePanic } from './escape.js';

interface Option {
  key: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
}
interface Group {
  label: string;
  options: Option[];
}

/** React Aria keys can't be empty strings; the native placeholder option uses one. */
const EMPTY = '\u0000empty';
const toKey = (v: string) => (v === '' ? EMPTY : v);
const fromKey = (k: string) => (k === EMPTY ? '' : k);

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** Read native `<option>` and `<optgroup>` children, so call sites keep their markup. */
function parse(children: ReactNode): (Option | Group)[] {
  const out: (Option | Group)[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{
      value?: string | number;
      label?: string;
      disabled?: boolean;
      children?: ReactNode;
    }>;
    if (el.type === Fragment) out.push(...parse(el.props.children));
    else if (el.type === 'optgroup')
      out.push({
        label: el.props.label ?? '',
        options: parse(el.props.children).filter((o): o is Option => 'key' in o),
      });
    else if (el.type === 'option') {
      const text = textOf(el.props.children);
      out.push({
        key: toKey(String(el.props.value ?? text)),
        label: el.props.children,
        text,
        disabled: !!el.props.disabled,
      });
    }
  });
  return out;
}

export interface SelectProps {
  value?: string | number | readonly string[] | undefined;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * A searchable, keyboard-friendly select built on React Aria. It takes native `<option>` and
 * `<optgroup>` children and calls `onChange` with `{ target: { value } }`, like `<select>`.
 */
export function Select({
  value,
  onChange,
  children,
  className,
  disabled,
  'aria-label': ariaLabel,
}: SelectProps) {
  const items = parse(children);
  const option = (o: Option) => (
    <ListBoxItem
      key={o.key}
      id={o.key}
      textValue={o.text}
      isDisabled={o.disabled}
      className="flex h-row cursor-default items-center gap-2 rounded-control px-2 text-ui text-fg outline-none data-[disabled]:opacity-40 data-[focused]:bg-control-hover"
    >
      {({ isSelected }) => (
        <>
          <span className="min-w-0 flex-1 truncate">{o.label}</span>
          {isSelected && <Check size={14} className="text-fg-muted" />}
        </>
      )}
    </ListBoxItem>
  );
  return (
    <RACSelect
      aria-label={ariaLabel ?? 'Choose'}
      selectedKey={toKey(String(value ?? ''))}
      onSelectionChange={(k) =>
        onChange?.({
          target: { value: fromKey(String(k)) },
        } as unknown as ChangeEvent<HTMLSelectElement>)
      }
      isDisabled={disabled}
      className={cn('min-w-0', className)}
    >
      <Button
        data-select-trigger
        className="flex h-control w-full min-w-0 items-center gap-1 rounded-control border border-line-control bg-control px-2 text-left text-ui text-fg outline-none hover:bg-control-hover disabled:opacity-50"
      >
        <SelectValue className="min-w-0 flex-1 truncate data-[placeholder]:text-fg-subtle" />
        <ChevronDown size={14} className="shrink-0 text-fg-icon" />
      </Button>
      <Popover
        data-overlay-open
        isKeyboardDismissDisabled={isEscapePanic()}
        className="max-h-80 min-w-(--trigger-width) overflow-auto rounded-overlay border border-line-strong bg-raised p-1 shadow-overlay"
      >
        <ListBox className="outline-none">
          {items.map((it, i) =>
            'key' in it ? (
              option(it)
            ) : (
              <ListBoxSection key={`g${i}`} id={`g${i}`}>
                <Header className="label-caps px-2 pt-2 pb-1 text-fg-subtle">{it.label}</Header>
                {it.options.map(option)}
              </ListBoxSection>
            ),
          )}
        </ListBox>
      </Popover>
    </RACSelect>
  );
}
