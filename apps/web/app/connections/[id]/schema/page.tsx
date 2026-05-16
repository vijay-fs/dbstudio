'use client';

import { use, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { useConnections } from '@/store/connections';
import { api } from '@/lib/api';
import { ENGINE_LABELS } from '@/lib/types';
import { ERDiagram, type Schema } from '@dbstudio/erd';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; schema: Schema }
  | { kind: 'error'; code: string; message: string };

export default function SchemaPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const profile = useConnections((s) => s.profiles.find((p) => p.id === id));
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  const load = async () => {
    if (!profile) return;
    setState({ kind: 'loading' });
    try {
      const schema = await api.getSchema(profile);
      setState({ kind: 'ok', schema });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setState({
        kind: 'error',
        code: err.code ?? 'unknown',
        message: err.message ?? String(e),
      });
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
              {ENGINE_LABELS[profile.engine]} · {profile.host}:{profile.port}/{profile.database}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={state.kind === 'loading'}>
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </header>

        <div className="relative flex-1 overflow-hidden">
          {state.kind === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading schema...
              </div>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-5">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <h2 className="mt-3 text-sm font-semibold text-destructive">
                  Could not load schema
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{state.code}</span> · {state.message}
                </p>
              </div>
            </div>
          )}
          {state.kind === 'ok' && <ERDiagram schema={state.schema} />}
        </div>
      </div>
    </AppShell>
  );
}
