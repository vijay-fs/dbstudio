// SQL pretty-printer bound to the connection's engine.
//
// Wraps sql-formatter so callers don't need to know the dialect tag for
// each engine, and silently no-ops (returns the input verbatim) when the
// formatter throws — half-written SQL can produce parse errors mid-type
// and there's no value in surfacing those as toasts.

import { format as sqlFormat } from 'sql-formatter';
import type { DatabaseEngine } from './types';

type Dialect =
  | 'sql'
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'sqlite'
  | 'transactsql';

function dialectFor(engine: DatabaseEngine | null | undefined): Dialect {
  switch (engine) {
    case 'postgres':
    // CockroachDB speaks the PG wire protocol and PG SQL, so PG rules
    // produce the cleanest output here.
    case 'cockroachdb':
      return 'postgresql';
    case 'mysql':
      return 'mysql';
    case 'mariadb':
      return 'mariadb';
    case 'sqlite':
      return 'sqlite';
    default:
      return 'sql';
  }
}

export function formatSql(sql: string, engine: DatabaseEngine | null | undefined): string {
  if (!sql.trim()) return sql;
  try {
    return sqlFormat(sql, {
      language: dialectFor(engine),
      keywordCase: 'upper',
      tabWidth: 2,
      useTabs: false,
      linesBetweenQueries: 2,
    });
  } catch {
    return sql;
  }
}
