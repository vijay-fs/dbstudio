// Data diff: row-by-row, cell-by-cell comparison of two tables.
//
// Caller arranges the SELECTs (so we can be transport-agnostic and
// reuse the standard runQuery path). We're given two QueryResult-
// shaped payloads + the PK column list, and we produce three
// buckets the UI can render and emit sync SQL for.
//
// Same-engine only — see `engineCanDiff`. Cross-engine adds type-
// coercion gnarls that don't belong in a v1.

import type { QueryResult } from './types';

export interface DataRow {
  /** Raw row indexed by column position; mirrors QueryResult.rows. */
  values: unknown[];
  /** Cached PK signature — concatenated PK column values joined by a
   *  sentinel. Used as a Map key for O(1) source↔target alignment. */
  key: string;
}

export interface CellChange {
  column: string;
  source: unknown;
  target: unknown;
}

export interface MismatchedRow {
  key: string;
  /** PK values in column order, for display + sync-SQL WHERE clauses. */
  pkValues: unknown[];
  sourceValues: unknown[];
  targetValues: unknown[];
  /** Only the columns whose values actually differ. The result grid
   *  highlights these; the sync-SQL emits SET only for these. */
  changes: CellChange[];
}

export interface DataDiffResult {
  /** Column order is the source's — sync SQL targets the source. */
  columns: string[];
  pkColumns: string[];
  /** Rows present on the source side but not on the target. */
  onlyInSource: DataRow[];
  /** Rows present on the target side but not on the source. */
  onlyInTarget: DataRow[];
  /** Rows present on both sides with at least one differing cell. */
  mismatched: MismatchedRow[];
  /** Total rows we considered on each side — surfaces the row-limit
   *  story so the UI can warn when a side hit the cap. */
  sourceCount: number;
  targetCount: number;
}

/** Sentinel for PK joining; \x1f (Unit Separator) is illegal in
 *  SQL identifiers and rare in real data, so collisions are
 *  vanishingly unlikely. JSON-encoded for primitive ↔ string
 *  consistency (numeric `1` and string `"1"` produce different keys). */
const SEP = '\x1f';

function rowKey(row: unknown[], pkPositions: number[]): string {
  return pkPositions.map((i) => JSON.stringify(row[i] ?? null)).join(SEP);
}

/** Compare two cell values for equality. Numbers, strings, booleans
 *  use ===. JSON-shaped values (objects/arrays from jsonb / json
 *  columns) use stable-stringify; dates are normalized to ISO. */
function cellsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Compute the diff between two result sets aligned by primary key.
 * Both sides must share the same column set and order; the caller
 * generates the same `SELECT cols... FROM table ORDER BY pk` against
 * each connection to guarantee that.
 *
 * Throws when the PK columns aren't all present in the result —
 * we'd otherwise silently mismatch rows with NULL keys.
 */
export function diffData(
  source: QueryResult,
  target: QueryResult,
  pkColumns: string[],
): DataDiffResult {
  const cols = source.columns.map((c) => c.name);
  const pkPositions = pkColumns.map((pk) => {
    const idx = cols.indexOf(pk);
    if (idx < 0) {
      throw new Error(
        `PK column "${pk}" missing from the result set — diff aligned by PK requires every PK column in SELECT`,
      );
    }
    return idx;
  });

  const sourceMap = new Map<string, unknown[]>();
  for (const row of source.rows) {
    sourceMap.set(rowKey(row, pkPositions), row);
  }
  const targetMap = new Map<string, unknown[]>();
  for (const row of target.rows) {
    targetMap.set(rowKey(row, pkPositions), row);
  }

  const onlyInSource: DataRow[] = [];
  const mismatched: MismatchedRow[] = [];
  for (const [key, sRow] of sourceMap) {
    const tRow = targetMap.get(key);
    if (!tRow) {
      onlyInSource.push({ values: sRow, key });
      continue;
    }
    const changes: CellChange[] = [];
    for (let i = 0; i < cols.length; i++) {
      const colName = cols[i];
      if (colName == null) continue;
      if (!cellsEqual(sRow[i], tRow[i])) {
        changes.push({ column: colName, source: sRow[i], target: tRow[i] });
      }
    }
    if (changes.length > 0) {
      mismatched.push({
        key,
        pkValues: pkPositions.map((i) => sRow[i]),
        sourceValues: sRow,
        targetValues: tRow,
        changes,
      });
    }
  }

  const onlyInTarget: DataRow[] = [];
  for (const [key, tRow] of targetMap) {
    if (!sourceMap.has(key)) {
      onlyInTarget.push({ values: tRow, key });
    }
  }

  return {
    columns: cols,
    pkColumns,
    onlyInSource,
    onlyInTarget,
    mismatched,
    sourceCount: source.rows.length,
    targetCount: target.rows.length,
  };
}

/** Engines we'll permit for data diff. NoSQL engines are excluded
 *  because their row model isn't relational; relational ones all
 *  pass. The UI uses this to disable the target picker entries
 *  that don't match the source engine. */
export function engineCanDiff(engine: string): boolean {
  return (
    engine === 'postgres' ||
    engine === 'mysql' ||
    engine === 'mariadb' ||
    engine === 'sqlite' ||
    engine === 'cockroachdb'
  );
}
