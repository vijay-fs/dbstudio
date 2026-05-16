// Local-only connection profile store. Persists to localStorage in browser dev
// and to OS-keychain-backed SQLite in desktop (Phase 1.5 — currently localStorage
// in both contexts for simplicity).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ConnectionProfile, DatabaseEngine } from '@/lib/types';

interface ConnectionsState {
  profiles: ConnectionProfile[];
  upsert: (profile: ConnectionProfile) => void;
  remove: (id: string) => void;
  get: (id: string) => ConnectionProfile | undefined;
}

export const useConnections = create<ConnectionsState>()(
  persist(
    (set, getState) => ({
      profiles: [],
      upsert: (profile) =>
        set((s) => {
          const idx = s.profiles.findIndex((p) => p.id === profile.id);
          if (idx >= 0) {
            const next = [...s.profiles];
            next[idx] = profile;
            return { profiles: next };
          }
          return { profiles: [...s.profiles, profile] };
        }),
      remove: (id) => set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),
      get: (id) => getState().profiles.find((p) => p.id === id),
    }),
    { name: 'dbstudio.connections' },
  ),
);

export function newProfile(engine: DatabaseEngine = 'postgres'): ConnectionProfile {
  if (engine === 'sqlite') {
    return {
      id: crypto.randomUUID(),
      name: 'New SQLite connection',
      engine,
      host: '',
      port: 0,
      database: '',
      auth: { kind: 'none' },
      tls: 'disable',
      ssh_tunnel: null,
      options: {},
      file_path: '',
    };
  }
  const defaultPort = engine === 'mysql' || engine === 'mariadb' ? 3306 : 5432;
  return {
    id: crypto.randomUUID(),
    name: 'New connection',
    engine,
    host: 'localhost',
    port: defaultPort,
    database: 'postgres',
    auth: { kind: 'password', username: 'postgres', password_ref: '' },
    tls: 'prefer',
    ssh_tunnel: null,
    options: {},
    file_path: null,
  };
}
