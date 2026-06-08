'use client';

// Searchable single-select dropdown. Wraps cmdk (already shipped for
// the command palette) so keyboard and search behavior matches the
// rest of the app. Native <select> doesn't filter, and our diff
// pages outgrow it the moment a workspace has more than ~20
// connections or a schema has hundreds of tables.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ComboboxOption<V extends string = string> {
  /** Stable identity — passed back through onChange. */
  value: V;
  /** Primary label shown in the trigger + list. */
  label: string;
  /** Optional secondary line (e.g. engine label below a connection
   *  name) shown muted under the label. Helps disambiguate similarly-
   *  named entries. */
  hint?: string;
  /** Anything that should be matchable in the search box beyond the
   *  visible label — alternate names, engines, schemas. */
  keywords?: string[];
  /** Disabled rows still render but can't be picked. Used to filter
   *  cross-engine targets in the data-diff page without hiding them
   *  entirely, so the user sees the reason. */
  disabled?: boolean;
}

interface ComboboxProps<V extends string = string> {
  value: V | '';
  onChange: (next: V) => void;
  options: ComboboxOption<V>[];
  placeholder?: string;
  /** Text shown when the option list is empty — e.g. "Pick a
   *  connection first" before tables are loaded. */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  emptyLabel = 'No matches.',
  disabled,
  className,
}: ComboboxProps<V>) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape close. Containment check via ref so a
  // click inside the dropdown doesn't dismiss before the option
  // click handler fires.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded border border-input bg-background px-2 text-left text-xs',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <>
              <span>{selected.label}</span>
              {selected.hint && (
                <span className="ml-1 text-muted-foreground">
                  ({selected.hint})
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md"
        >
          <Command shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-1 border-b px-2">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
              <Command.Input
                value={filter}
                onValueChange={setFilter}
                placeholder="Search…"
                className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <Command.List className="scrollbar-thin max-h-72 overflow-y-auto p-1">
              <FilteredOptions
                options={options}
                filter={filter}
                value={value}
                onPick={(v) => {
                  onChange(v);
                  setFilter('');
                  setOpen(false);
                }}
                emptyLabel={emptyLabel}
              />
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}

function FilteredOptions<V extends string>({
  options,
  filter,
  value,
  onPick,
  emptyLabel,
}: {
  options: ComboboxOption<V>[];
  filter: string;
  value: V | '';
  onPick: (next: V) => void;
  emptyLabel: string;
}) {
  // Case-insensitive substring match across the label, hint, and any
  // additional keywords. cmdk's built-in fuzzy filter is heavier and
  // we don't need its scoring here — connections + tables are short
  // lists where straight contains() reads more predictably.
  const needle = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return options;
    return options.filter((o) => {
      const hay = [o.label, o.hint, ...(o.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [options, needle]);

  if (visible.length === 0) {
    return (
      <Command.Empty className="px-2 py-3 text-center text-[11px] text-muted-foreground">
        {emptyLabel}
      </Command.Empty>
    );
  }
  return (
    <>
      {visible.map((o) => (
        <Command.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          onSelect={() => {
            if (!o.disabled) onPick(o.value);
          }}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs',
            'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
            o.disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <span className="flex h-3 w-3 shrink-0 items-center justify-center">
            {value === o.value && <Check className="h-3 w-3" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate">{o.label}</div>
            {o.hint && (
              <div className="truncate text-[10px] text-muted-foreground">
                {o.hint}
              </div>
            )}
          </div>
        </Command.Item>
      ))}
    </>
  );
}
