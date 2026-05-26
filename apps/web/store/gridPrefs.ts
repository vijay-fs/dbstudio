// Global UI preferences for the result grid + table-open flow.
//
// Currently just one knob: the default LIMIT applied when the user
// opens a table by clicking it in the sidebar / ER diagram. Lives
// in a tiny separate store so the SQL workspace toolbar and the
// sidebar can both read + write it without prop-drilling.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** UI value `null` means "no LIMIT clause" (the All option). The
 *  callers handle that case explicitly so the generated SQL stays
 *  the user's intent. */
export type RowLimit = number | null;

interface GridPrefsState {
  rowLimit: RowLimit;
  setRowLimit: (next: RowLimit) => void;
}

export const ROW_LIMIT_OPTIONS: ReadonlyArray<{ label: string; value: RowLimit }> = [
  { label: '10', value: 10 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: 'All', value: null },
];

export const useGridPrefs = create<GridPrefsState>()(
  persist(
    (set) => ({
      rowLimit: 10,
      setRowLimit: (next) => set({ rowLimit: next }),
    }),
    { name: 'dbstudio.gridPrefs' },
  ),
);
