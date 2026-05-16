'use client';

import { useMemo } from 'react';

import type { QueryResult } from '@/lib/types';

const MAX_ROWS_RENDERED = 1000;
const COLUMN_MIN_WIDTH = 140; // px
const COLUMN_MAX_WIDTH = 360; // px

/**
 * Simple result grid for Phase 1. Renders up to 1000 rows in a plain table.
 * The table is `min-w-full`, so when the natural column widths exceed the
 * container the grid scrolls horizontally instead of squashing columns.
 * Virtualization (TanStack Virtual) lands in Phase 2.
 */
export function ResultTable({ result }: { result: QueryResult }) {
  const rows = useMemo(
    () => result.rows.slice(0, MAX_ROWS_RENDERED),
    [result.rows],
  );
  const overflow = result.rows.length - rows.length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
          {result.rows_affected != null && ` · ${result.rows_affected} affected`}
          {result.columns.length > 0 && ` · ${result.columns.length} col${result.columns.length === 1 ? '' : 's'}`}
        </span>
        <span className="font-mono">{result.elapsed_ms} ms</span>
      </header>

      {result.columns.length === 0 && result.rows.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">No rows returned.</p>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="min-w-full border-collapse text-xs" style={{ tableLayout: 'auto' }}>
            <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
              <tr>
                {result.columns.map((c) => (
                  <th
                    key={c.name}
                    className="border-b border-r px-3 py-1.5 text-left font-semibold align-top whitespace-nowrap"
                    style={{ minWidth: COLUMN_MIN_WIDTH, maxWidth: COLUMN_MAX_WIDTH }}
                  >
                    <div className="truncate">{c.name}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {c.data_type}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((row, ri) => (
                <tr key={ri} className="even:bg-muted/30">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-r px-3 py-1 align-top whitespace-nowrap"
                      style={{ minWidth: COLUMN_MIN_WIDTH, maxWidth: COLUMN_MAX_WIDTH }}
                      title={renderCell(cell)}
                    >
                      <div className="truncate">{renderCell(cell)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {overflow > 0 && (
            <p className="sticky bottom-0 border-t bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
              Showing first {MAX_ROWS_RENDERED.toLocaleString()} rows; {overflow.toLocaleString()}{' '}
              more not shown.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
