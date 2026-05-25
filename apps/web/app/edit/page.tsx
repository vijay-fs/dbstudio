'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { ConnectionForm } from '@/components/ConnectionForm';
import { useConnections } from '@/store/connections';

// Connection id flows in via the `cid` search param. Static
// routes only — no [id] segment — so the file ships at /sql/index.html
// (and similar) and the Tauri asset protocol always finds it.
function EditConnectionPageInner() {
  const id = useSearchParams().get('cid') ?? '';
  const profile = useConnections((s) => s.profiles.find((p) => p.id === id));

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
      <ConnectionForm initial={profile} />
    </AppShell>
  );
}

// Static export requires useSearchParams() to be inside a Suspense
// boundary so Next can split the client-bailout point. The inner
// component does the real work; this wrapper exists only to satisfy
// the build constraint.
export default function EditConnectionPage() {
  return (
    <Suspense fallback={null}>
      <EditConnectionPageInner />
    </Suspense>
  );
}
