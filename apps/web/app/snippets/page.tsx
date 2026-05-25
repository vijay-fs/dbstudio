'use client';

import { Suspense } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { SnippetsPanel } from '@/components/SnippetsPanel';
import { useConnections } from '@/store/connections';
import { loadSqlInWorkspace } from '@/lib/openTable';
import { ENGINE_LABELS } from '@/lib/types';

// Connection id flows in via the `cid` search param. Static
// routes only — no [id] segment — so the file ships at /snippets/index.html
// and the Tauri asset protocol always finds it.
function SnippetsPageInner() {
  const id = useSearchParams().get('cid') ?? '';
  const profile = useConnections((s) => s.profiles.find((p) => p.id === id));
  const router = useRouter();

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
        <header className="border-b px-5 py-2.5">
          <h1 className="text-sm font-semibold">{profile.name}</h1>
          <p className="text-[11px] text-muted-foreground">
            {ENGINE_LABELS[profile.engine]} · Saved snippets
          </p>
        </header>
        <div className="flex-1 overflow-hidden">
          <SnippetsPanel
            connectionId={profile.id}
            onLoad={(sql) => loadSqlInWorkspace(router, profile, sql, false)}
            onRerun={(sql) => loadSqlInWorkspace(router, profile, sql, true)}
          />
        </div>
      </div>
    </AppShell>
  );
}

// Static export requires useSearchParams() to be inside a Suspense
// boundary so Next can split the client-bailout point. The inner
// component does the real work; this wrapper exists only to satisfy
// the build constraint.
export default function SnippetsPage() {
  return (
    <Suspense fallback={null}>
      <SnippetsPageInner />
    </Suspense>
  );
}
