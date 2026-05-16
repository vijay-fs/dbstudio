import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';

import type { Column } from './types';
import type { TableNodeData } from './layout';

interface TableNodeProps {
  data: TableNodeData;
  selected?: boolean;
}

/**
 * Visual representation of a database table for the ER diagram.
 *
 * Each column row owns a pair of (invisible) handles — one target on the left
 * and one source on the right. Edges produced by `layoutSchema` reference
 * these by id, so an FK relationship lands on the exact column it represents
 * instead of generic top-of-table connectors. Handles are styled invisibly so
 * unused ones don't leave stray dots in the canvas.
 */
export function TableNode({ data, selected }: TableNodeProps) {
  const { table } = data;
  const pkColumns = new Set(table.primary_key?.columns ?? []);
  const fkColumns = new Set<string>();
  for (const fk of table.foreign_keys) {
    for (const c of fk.columns) fkColumns.add(c);
  }

  return (
    <div
      className={clsx(
        'min-w-[280px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow',
        selected ? 'ring-2 ring-ring shadow-md' : 'ring-0',
      )}
    >
      <div className="border-b bg-secondary/60 px-3 py-1.5 text-[11px] font-semibold tracking-wide">
        <span className="text-muted-foreground">{table.schema}.</span>
        <span>{table.name}</span>
      </div>
      <ul className="divide-y text-xs">
        {table.columns.map((col) => (
          <ColumnRow
            key={col.name}
            column={col}
            isPk={pkColumns.has(col.name)}
            isFk={fkColumns.has(col.name)}
          />
        ))}
      </ul>
    </div>
  );
}

// Handles are functional but visually invisible — connection lines still
// anchor here, but no dot is drawn at the row edges.
const HANDLE_HIDDEN =
  '!h-[6px] !w-[6px] !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent !opacity-0';

function ColumnRow({
  column,
  isPk,
  isFk,
}: {
  column: Column;
  isPk: boolean;
  isFk: boolean;
}) {
  return (
    <li
      className={clsx(
        'relative flex items-center gap-2 px-3 py-1 font-mono',
        isPk && 'bg-amber-50/70 dark:bg-amber-500/5',
        !isPk && isFk && 'bg-sky-50/60 dark:bg-sky-500/5',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={`${column.name}::target`}
        className={HANDLE_HIDDEN}
        isConnectable={false}
      />

      <span className="flex w-5 shrink-0 items-center justify-center">
        {isPk && <KeyIcon className="h-3 w-3 text-amber-500" title="Primary key" />}
        {!isPk && isFk && <LinkIcon className="h-3 w-3 text-sky-500" title="Foreign key" />}
      </span>

      <span
        className={clsx(
          'flex-1 truncate',
          column.nullable ? 'text-foreground/80' : 'font-semibold',
        )}
      >
        {column.name}
      </span>

      <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground">
        {column.data_type}
        {!column.nullable && <span className="ml-1 text-foreground/60">·NOT NULL</span>}
      </span>

      <Handle
        type="source"
        position={Position.Right}
        id={`${column.name}::source`}
        className={HANDLE_HIDDEN}
        isConnectable={false}
      />
    </li>
  );
}

function KeyIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-3 3" />
      <path d="m18 5 3 3" />
    </svg>
  );
}

function LinkIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  );
}
