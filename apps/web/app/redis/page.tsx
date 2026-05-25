'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { RedisBrowser } from '@/components/RedisBrowser';
import { useConnections } from '@/store/connections';
import { ENGINE_LABELS } from '@/lib/types';

// Connection id flows in via the `cid` search param. Static
// routes only — no [id] segment — so the file ships at /sql/index.html
// (and similar) and the Tauri asset protocol always finds it.
function RedisPageInner() {
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

  // Guard against hand-typed URLs that pair a non-Redis profile id
  // with the /redis route — the Redis API surface would explode on
  // the first call.
  if (profile.engine !== 'redis') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          <p>
            <span className="font-medium">{profile.name}</span> is a{' '}
            {ENGINE_LABELS[profile.engine]} connection — open it from the SQL
            workspace instead.
          </p>
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
            {ENGINE_LABELS[profile.engine]} · keyspace browser
          </p>
        </header>
        <div className="flex-1 overflow-hidden">
          <RedisBrowser profile={profile} />
        </div>
      </div>
    </AppShell>
  );
}

// Static export requires useSearchParams() to be inside a Suspense
// boundary so Next can split the client-bailout point. The inner
// component does the real work; this wrapper exists only to satisfy
// the build constraint.
export default function RedisPage() {
  return (
    <Suspense fallback={null}>
      <RedisPageInner />
    </Suspense>
  );
}
