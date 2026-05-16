'use client';

import { useMemo } from 'react';

import { AppShell } from '@/components/AppShell';
import { ConnectionForm } from '@/components/ConnectionForm';
import { newProfile } from '@/store/connections';

export default function NewConnectionPage() {
  const initial = useMemo(() => newProfile('postgres'), []);
  return (
    <AppShell>
      <ConnectionForm initial={initial} />
    </AppShell>
  );
}
