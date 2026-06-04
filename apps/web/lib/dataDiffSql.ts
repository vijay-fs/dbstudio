// Generate INSERT / UPDATE / DELETE statements that bring the
// source side in line with the target. Same-engine only — the
// data-diff page enforces that, so the emitter assumes both ends
// share dialect quirks.
//
// Statements are inlined-literal, not parameterized — the user
// reviews + edits the SQL before running, same flow as schema diff.

import { quoteIdent, quoteStyleForEngine } from './sqlIdent';
import type { DatabaseEngine } from './types';
import type { DataDiffResult } from './dataDiff';

function tableRef(
  engine: DatabaseEngine,
  schema: string,
  table: string,
): string {
  const style = quoteStyleForEngine(engine);
  const t = quoteIdent(table, style);
  if (engine === 'sqlite' || !schema) return t;
  return `${quoteIdent(schema, style)}.${t}`;
}

/** SQL-literal serialisation. Mirrors lib/openTable's sqlLiteral but
 *  is exported here so the data-diff UI can preview values inline. */
function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

export interface SyncSqlOptions {
  /** Apply direction: should source become like target (default), or
   *  should target become like source (reverse)? "Make source like
   *  target" is the schema-diff convention we mirror here. */
  direction?: 'source-to-target' | 'target-to-source';
}

export interface SyncStatements {
  /** Rows missing on source that we'll INSERT. */
  inserts: string[];
  /** Rows whose cells differ — one UPDATE per row, only the
   *  differing columns in the SET list. */
  updates: string[];
  /** Rows missing on target that we'll DELETE from source. */
  deletes: string[];
}

/**
 * Build the three statement lists. "source" is the side we'll
 * modify; "target" is the desired state. Direction reversal flips
 * which side we read from + write to.
 */
export function buildSyncStatements(
  engine: DatabaseEngine,
  schema: string,
  table: string,
  diff: DataDiffResult,
  opts: SyncSqlOptions = {},
): SyncStatements {
  const style = quoteStyleForEngine(engine);
  const ref = tableRef(engine, schema, table);
  const direction = opts.direction ?? 'source-to-target';
  const inserts: string[] = [];
  const updates: string[] = [];
  const deletes: string[] = [];

  // "Make source like target": source is missing → INSERT into source.
  // "Make target like source": target is missing → INSERT into target.
  const rowsToInsert =
    direction === 'source-to-target' ? diff.onlyInTarget : diff.onlyInSource;
  const rowsToDelete =
    direction === 'source-to-target' ? diff.onlyInSource : diff.onlyInTarget;

  // INSERTs: full column list. We always emit every column rather
  // than omitting ones that match defaults — the source row is the
  // authoritative shape and omitting columns risks silent defaulting.
  const colList = diff.columns.map((c) => quoteIdent(c, style)).join(', ');
  for (const row of rowsToInsert) {
    const values = row.values.map(sqlLiteral).join(', ');
    inserts.push(`INSERT INTO ${ref} (${colList}) VALUES (${values});`);
  }

  // UPDATEs: only the differing columns appear in SET, and we never
  // touch PK columns (those are how we found the row). Direction
  // swaps which side provides the desired value.
  const pkSet = new Set(diff.pkColumns);
  for (const m of diff.mismatched) {
    const setClauses = m.changes
      .filter((c) => !pkSet.has(c.column))
      .map((c) => {
        const v = direction === 'source-to-target' ? c.target : c.source;
        return `${quoteIdent(c.column, style)} = ${sqlLiteral(v)}`;
      });
    if (setClauses.length === 0) continue;
    const whereClauses = diff.pkColumns.map((pk, idx) => {
      const v = m.pkValues[idx];
      return `${quoteIdent(pk, style)} = ${sqlLiteral(v)}`;
    });
    updates.push(
      `UPDATE ${ref} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(
        ' AND ',
      )};`,
    );
  }

  // DELETEs: one statement per row, keyed by PK. Composite PKs
  // produce an AND-joined WHERE.
  for (const row of rowsToDelete) {
    const pkPositions = diff.pkColumns.map((pk) => diff.columns.indexOf(pk));
    const whereClauses = diff.pkColumns.map((pk, idx) => {
      const pos = pkPositions[idx] ?? -1;
      const v = pos >= 0 ? row.values[pos] : null;
      return `${quoteIdent(pk, style)} = ${sqlLiteral(v)}`;
    });
    deletes.push(`DELETE FROM ${ref} WHERE ${whereClauses.join(' AND ')};`);
  }

  return { inserts, updates, deletes };
}
