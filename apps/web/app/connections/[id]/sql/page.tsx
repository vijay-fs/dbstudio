'use client';

import { use, useRef, useState } from 'react';
import { Loader2, Play, AlertCircle } from 'lucide-react';

import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { SqlEditor, type SqlEditorHandle } from '@/components/SqlEditor';
import { ResultTable } from '@/components/ResultTable';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useConnections } from '@/store/connections';
import { api } from '@/lib/api';
import { ENGINE_LABELS, type QueryResult } from '@/lib/types';

const STARTER_SQL = `-- Cmd/Ctrl + Enter to run
SELECT now(), version();
`;

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; result: QueryResult }
  | { kind: 'error'; code: string; message: string };

export default function SqlPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const profile = useConnections((s) => s.profiles.find((p) => p.id === id));
  const [sql, setSql] = useState(STARTER_SQL);
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const editorRef = useRef<SqlEditorHandle>(null);

  const onRun = async (sqlToRun: string) => {
    if (!profile) return;
    setState({ kind: 'running' });
    try {
      const result = await api.runQuery(profile, { sql: sqlToRun });
      setState({ kind: 'ok', result });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setState({
        kind: 'error',
        code: err.code ?? 'unknown',
        message: err.message ?? String(e),
      });
    }
  };

  if (!profile) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Connection not found.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b px-5 py-2.5">
          <div>
            <h1 className="text-sm font-semibold">{profile.name}</h1>
            <p className="text-[11px] text-muted-foreground">
              {ENGINE_LABELS[profile.engine]} · SQL workspace
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => editorRef.current?.run()}
            disabled={state.kind === 'running'}
          >
            {state.kind === 'running' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Run
          </Button>
        </header>

        <ResizablePanelGroup
          direction="vertical"
          autoSaveId="dbstudio.sql-split"
          className="flex-1"
        >
          <ResizablePanel defaultSize={55} minSize={15}>
            <div className="h-full overflow-hidden">
              <SqlEditor ref={editorRef} value={sql} onChange={setSql} onRun={onRun} />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={45} minSize={15}>
            <div className="h-full overflow-hidden">
              {state.kind === 'idle' && (
                <p className="p-4 text-xs text-muted-foreground">
                  Run a query to see results here.
                </p>
              )}
              {state.kind === 'running' && (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Running...
                </div>
              )}
              {state.kind === 'error' && (
                <div className="p-5">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold">Query failed</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{state.code}</span> · {state.message}
                  </p>
                </div>
              )}
              {state.kind === 'ok' && <ResultTable result={state.result} />}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </AppShell>
  );
}
