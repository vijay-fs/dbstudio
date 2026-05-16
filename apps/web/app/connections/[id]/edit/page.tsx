'use client';

import { use } from 'react';

import { AppShell } from '@/components/AppShell';
import { ConnectionForm } from '@/components/ConnectionForm';
import { useConnections } from '@/store/connections';

export default function EditConnectionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
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
