'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { QueryHistoryPanel } from '@/components/QueryHistoryPanel';
import { useConnections } from '@/store/connections';
import { loadSqlInWorkspace } from '@/lib/openTable';
import { ENGINE_LABELS } from '@/lib/types';

export default function HistoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
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
            {ENGINE_LABELS[profile.engine]} · Query history
          </p>
        </header>
        <div className="flex-1 overflow-hidden">
          <QueryHistoryPanel
            connectionId={profile.id}
            onLoad={(sql) => loadSqlInWorkspace(router, profile, sql, false)}
            onRerun={(sql) => loadSqlInWorkspace(router, profile, sql, true)}
          />
        </div>
      </div>
    </AppShell>
  );
}
