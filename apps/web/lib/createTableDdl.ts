// Build a CREATE TABLE statement from the introspected schema.
//
// This is a *best-effort* re-creation — it captures columns, types,
// nullability, defaults, primary key, and foreign keys, which covers
// the everyday "copy CREATE TABLE for this table" use case. It does
// NOT capture engine-specific bits we don't introspect (triggers,
// generated columns, comments on the engine side, partition specs).
// For exact engine output the user can still run SHOW CREATE TABLE
// (MySQL) or query sqlite_master (SQLite) themselves.
//
// We keep this client-side on purpose: no Rust changes needed, and
// the output is dialect-quoted to the active connection's engine so
// the user can paste it straight back as a CREATE statement.

import type { Table } from '@dbstudio/erd';

import type { DatabaseEngine } from './types';
import { quoteIdent, quoteStyleForEngine } from './sqlIdent';

export function buildCreateTableDdl(engine: DatabaseEngine, table: Table): string {
  const style = quoteStyleForEngine(engine);
  const q = (name: string) => quoteIdent(name, style);

  const lines: string[] = [];
  const tableRef =
    engine === 'sqlite' || !table.schema
      ? q(table.name)
      : `${q(table.schema)}.${q(table.name)}`;

  lines.push(`CREATE TABLE ${tableRef} (`);

  const cols = [...table.columns].sort((a, b) => a.position - b.position);
  const colLines = cols.map((c) => {
    const parts: string[] = [`  ${q(c.name)} ${c.data_type}`];
    if (!c.nullable) parts.push('NOT NULL');
    if (c.default != null && c.default !== '') parts.push(`DEFAULT ${c.default}`);
    return parts.join(' ');
  });

  // Inline PRIMARY KEY constraint (most engines accept both inline-on-col
  // and table-level; table-level is the only form that works for composite
  // PKs, so we always use it).
  if (table.primary_key && table.primary_key.columns.length > 0) {
    const cols = table.primary_key.columns.map(q).join(', ');
    colLines.push(`  PRIMARY KEY (${cols})`);
  }

  // FK constraints — name them when we have a name so the user can drop
  // them later by name. Composite FKs are supported.
  for (const fk of table.foreign_keys) {
    const cons = fk.name ? `CONSTRAINT ${q(fk.name)} ` : '';
    const localCols = fk.columns.map(q).join(', ');
    const refTable =
      engine === 'sqlite' || !fk.references_schema
        ? q(fk.references_table)
        : `${q(fk.references_schema)}.${q(fk.references_table)}`;
    const refCols = fk.references_columns.map(q).join(', ');
    const onDelete = fk.on_delete ? ` ON DELETE ${refActionSql(fk.on_delete)}` : '';
    const onUpdate = fk.on_update ? ` ON UPDATE ${refActionSql(fk.on_update)}` : '';
    colLines.push(
      `  ${cons}FOREIGN KEY (${localCols}) REFERENCES ${refTable} (${refCols})${onDelete}${onUpdate}`,
    );
  }

  lines.push(colLines.join(',\n'));
  lines.push(');');

  // Non-PK indexes — emitted as separate CREATE INDEX statements after the
  // table so the syntax stays portable. The PK index is skipped because it's
  // already covered by the PRIMARY KEY constraint above.
  for (const idx of table.indexes) {
    if (idx.primary) continue;
    const unique = idx.unique ? 'UNIQUE ' : '';
    const cols = idx.columns.map(q).join(', ');
    lines.push('');
    lines.push(`CREATE ${unique}INDEX ${q(idx.name)} ON ${tableRef} (${cols});`);
  }

  return lines.join('\n');
}

function refActionSql(a: string): string {
  switch (a) {
    case 'cascade':
      return 'CASCADE';
    case 'set_null':
      return 'SET NULL';
    case 'set_default':
      return 'SET DEFAULT';
    case 'restrict':
      return 'RESTRICT';
    default:
      return 'NO ACTION';
  }
}

/** Engine-specific TRUNCATE statement. SQLite has no TRUNCATE; we emit a
 *  bare DELETE for it (the user sees what's about to run in the confirm
 *  dialog so the difference is obvious). */
export function buildTruncateSql(engine: DatabaseEngine, table: Table): string {
  const style = quoteStyleForEngine(engine);
  const q = (name: string) => quoteIdent(name, style);
  const ref =
    engine === 'sqlite' || !table.schema
      ? q(table.name)
      : `${q(table.schema)}.${q(table.name)}`;
  if (engine === 'sqlite') return `DELETE FROM ${ref};`;
  return `TRUNCATE TABLE ${ref};`;
}

export function buildDropTableSql(engine: DatabaseEngine, table: Table): string {
  const style = quoteStyleForEngine(engine);
  const q = (name: string) => quoteIdent(name, style);
  const ref =
    engine === 'sqlite' || !table.schema
      ? q(table.name)
      : `${q(table.schema)}.${q(table.name)}`;
  return `DROP TABLE ${ref};`;
}
