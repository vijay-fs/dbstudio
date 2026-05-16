'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';

// Monaco is large (~3 MB) and cannot SSR. Load it client-side only.
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading editor...
    </div>
  ),
});

export interface SqlEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Called with the SQL to run — selection if any, otherwise full buffer. */
  onRun?: (sql: string) => void;
  height?: string | number;
}

export interface SqlEditorHandle {
  /** Run the current selection, or the full buffer if nothing is selected. */
  run: () => void;
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(function SqlEditor(
  { value, onChange, onRun, height = '100%' },
  ref,
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Keep the latest onRun reachable from Monaco's stable command closure.
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const runActive = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const selection = ed.getSelection();
    const selected =
      selection && !selection.isEmpty()
        ? ed.getModel()?.getValueInRange(selection)?.trim()
        : '';
    const sql = selected && selected.length > 0 ? selected : ed.getValue();
    onRunRef.current?.(sql);
  }, []);

  useImperativeHandle(ref, () => ({ run: runActive }), [runActive]);

  return (
    <MonacoEditor
      height={height}
      defaultLanguage="sql"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      theme="vs"
      options={{
        fontSize: 13,
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'gutter',
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
      }}
      onMount={(ed, monaco) => {
        editorRef.current = ed;
        ed.addAction({
          id: 'dbstudio.run-query',
          label: 'Run query (selection or whole buffer)',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1,
          run: () => runActive(),
        });
      }}
    />
  );
});
