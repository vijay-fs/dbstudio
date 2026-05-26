// Per-connection SQL editor tabs. Each tab keeps its own buffer; run results
// stay in component memory (not persisted) — only the SQL text survives a
// reload, which is what we'd want anyway (rerunning is one Cmd+Enter away).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TableRef {
  schema: string;
  table: string;
}

export interface SqlTab {
  id: string;
  title: string;
  sql: string;
  /** ms epoch — used only as a stable creation-order tiebreaker. */
  createdAt: number;
  /** Snapshot of `sql` at the moment of the last successful run. Drives
   *  the dirty-tab indicator: if the live buffer differs from this we
   *  know the user has typed changes that haven't been executed yet. */
  lastRunSql?: string;
  /** When present, this tab is bound to a specific table — opened from
   *  the sidebar / ER diagram / palette as a "browse this table" tab.
   *  Clicking the same table again re-focuses this tab and refreshes
   *  its SQL with the current row-limit, instead of creating a new
   *  tab every time. The marker is sticky; editing the buffer doesn't
   *  clear it (the user can still type freely and re-run). */
  tableRef?: TableRef;
}

interface PerConnection {
  tabs: SqlTab[];
  activeId: string | null;
}

interface SqlTabsState {
  byConnection: Record<string, PerConnection>;
  /** Returns the per-connection slot, creating a default if absent. */
  ensure: (connectionId: string, defaultSql: string) => PerConnection;
  setActive: (connectionId: string, tabId: string) => void;
  newTab: (connectionId: string, sql?: string) => SqlTab;
  closeTab: (connectionId: string, tabId: string) => void;
  setSql: (connectionId: string, tabId: string, sql: string) => void;
  /** Stamp `lastRunSql` on a tab after a successful Run. The next typed
   *  edit will then flip the dirty indicator on. */
  markRan: (connectionId: string, tabId: string, sql: string) => void;
  /** Overwrite + activate the named tab. Used by the command palette's
   *  "load recent query" flow so it lands in a dedicated tab instead of
   *  trampling whatever the user had open. */
  loadIntoNewTab: (connectionId: string, sql: string) => SqlTab;
  /** Open (or re-focus) a tab bound to a specific table. If a tab with
   *  matching `tableRef` already exists, refreshes its SQL with the new
   *  buffer and activates it. Otherwise creates a new table-bound tab.
   *  Returns the tab plus an `isNew` flag so callers can decide
   *  whether to auto-run the SELECT — re-clicking an open table tab
   *  should be a pure focus, not another query execution. */
  openOrFocusTableTab: (
    connectionId: string,
    sql: string,
    ref: TableRef,
  ) => { tab: SqlTab; isNew: boolean };
}

function defaultTab(sql: string, tableRef?: TableRef): SqlTab {
  return {
    id: crypto.randomUUID(),
    title: tableRef ? formatTableTitle(tableRef) : deriveTitle(sql),
    sql,
    createdAt: Date.now(),
    tableRef,
  };
}

function formatTableTitle(ref: TableRef): string {
  return ref.schema ? `${ref.schema}.${ref.table}` : ref.table;
}

export function deriveTitle(sql: string): string {
  const firstLine = sql
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('--') && !l.startsWith('/*'));
  if (!firstLine) return 'Untitled';
  const trimmed = firstLine.length > 32 ? firstLine.slice(0, 30) + '…' : firstLine;
  // Strip trailing semicolons / commas so titles read cleanly.
  return trimmed.replace(/[;,]+$/, '');
}

export const useSqlTabs = create<SqlTabsState>()(
  persist(
    (set, get) => ({
      byConnection: {},

      ensure: (connectionId, defaultSql) => {
        const existing = get().byConnection[connectionId];
        if (existing && existing.tabs.length > 0) return existing;
        const tab = defaultTab(defaultSql);
        const slot: PerConnection = { tabs: [tab], activeId: tab.id };
        set((s) => ({
          byConnection: { ...s.byConnection, [connectionId]: slot },
        }));
        return slot;
      },

      setActive: (connectionId, tabId) =>
        set((s) => {
          const slot = s.byConnection[connectionId];
          if (!slot) return s;
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: { ...slot, activeId: tabId },
            },
          };
        }),

      newTab: (connectionId, sql = '') => {
        const tab = defaultTab(sql);
        set((s) => {
          const slot = s.byConnection[connectionId] ?? { tabs: [], activeId: null };
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: {
                tabs: [...slot.tabs, tab],
                activeId: tab.id,
              },
            },
          };
        });
        return tab;
      },

      closeTab: (connectionId, tabId) =>
        set((s) => {
          const slot = s.byConnection[connectionId];
          if (!slot) return s;
          const idx = slot.tabs.findIndex((t) => t.id === tabId);
          if (idx < 0) return s;
          const remaining = slot.tabs.filter((t) => t.id !== tabId);
          // Last tab closing: keep the slot, drop everything — caller will
          // ensure() a fresh starter tab on next mount.
          if (remaining.length === 0) {
            return {
              byConnection: {
                ...s.byConnection,
                [connectionId]: { tabs: [], activeId: null },
              },
            };
          }
          // Pick the neighbor: tab to the right if it existed, else the new last.
          const nextActive =
            slot.activeId === tabId
              ? (remaining[idx]?.id ?? remaining[remaining.length - 1]?.id ?? null)
              : slot.activeId;
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: { tabs: remaining, activeId: nextActive },
            },
          };
        }),

      setSql: (connectionId, tabId, sql) =>
        set((s) => {
          const slot = s.byConnection[connectionId];
          if (!slot) return s;
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: {
                ...slot,
                tabs: slot.tabs.map((t) =>
                  t.id === tabId ? { ...t, sql, title: deriveTitle(sql) } : t,
                ),
              },
            },
          };
        }),

      markRan: (connectionId, tabId, sql) =>
        set((s) => {
          const slot = s.byConnection[connectionId];
          if (!slot) return s;
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: {
                ...slot,
                tabs: slot.tabs.map((t) =>
                  t.id === tabId ? { ...t, lastRunSql: sql } : t,
                ),
              },
            },
          };
        }),

      loadIntoNewTab: (connectionId, sql) => {
        const tab = defaultTab(sql);
        set((s) => {
          const slot = s.byConnection[connectionId] ?? { tabs: [], activeId: null };
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: {
                tabs: [...slot.tabs, tab],
                activeId: tab.id,
              },
            },
          };
        });
        return tab;
      },

      openOrFocusTableTab: (connectionId, sql, ref) => {
        const slot = get().byConnection[connectionId];
        const existing = slot?.tabs.find(
          (t) =>
            t.tableRef &&
            t.tableRef.schema === ref.schema &&
            t.tableRef.table === ref.table,
        );
        if (existing) {
          // Re-focus the existing table tab. We intentionally do NOT
          // overwrite the buffer or the title — re-clicking an open
          // table tab should be a pure focus, not a destructive
          // refresh. If the user wants a different limit applied,
          // they can change the limit selector and click Run; the
          // currently visible result stays in place until then.
          set((s) => {
            const cur = s.byConnection[connectionId];
            if (!cur) return s;
            return {
              byConnection: {
                ...s.byConnection,
                [connectionId]: { ...cur, activeId: existing.id },
              },
            };
          });
          return { tab: existing, isNew: false };
        }
        const tab = defaultTab(sql, ref);
        set((s) => {
          const cur = s.byConnection[connectionId] ?? { tabs: [], activeId: null };
          return {
            byConnection: {
              ...s.byConnection,
              [connectionId]: {
                tabs: [...cur.tabs, tab],
                activeId: tab.id,
              },
            },
          };
        });
        return { tab, isNew: true };
      },
    }),
    { name: 'dbstudio.sqlTabs' },
  ),
);
