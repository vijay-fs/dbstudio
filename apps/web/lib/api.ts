// Unified API client. In desktop, calls Tauri commands. In web (SaaS),
// calls the Axum server. Both surfaces return the same shapes.

import type { Schema } from '@dbstudio/erd';

import { isDesktop } from './runtime';
import type {
  CommandError,
  ConnectionProfile,
  DatabaseEngine,
  QueryRequest,
  QueryResult,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_DBSTUDIO_API ?? 'http://localhost:8080/api/v1';

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (isDesktop()) {
    const tauri = await import('@tauri-apps/api/core');
    return tauri.invoke<T>(cmd, args);
  }
  throw {
    code: 'desktop_only',
    message: `${cmd} is only available in the desktop app for Phase 1.`,
  } as CommandError;
}

export type SecretSlot =
  | 'password'
  | 'ssh_passphrase'
  | 'ssh_tunnel_passphrase'
  | 'ssh_tunnel_password';

export const api = {
  listEngines(): Promise<DatabaseEngine[]> {
    return invoke('list_engines', {});
  },

  testConnection(profile: ConnectionProfile): Promise<null> {
    return invoke('test_connection', { profile });
  },

  getSchema(profile: ConnectionProfile): Promise<Schema> {
    return invoke('get_schema', { profile });
  },

  runQuery(profile: ConnectionProfile, request: QueryRequest): Promise<QueryResult> {
    return invoke('run_query', { profile, request });
  },

  setSecret(profileId: string, slot: SecretSlot, value: string): Promise<null> {
    return invoke('set_secret', { profileId, slot, value });
  },

  hasSecret(profileId: string, slot: SecretSlot): Promise<boolean> {
    return invoke('has_secret', { profileId, slot });
  },

  deleteSecret(profileId: string, slot: SecretSlot): Promise<null> {
    return invoke('delete_secret', { profileId, slot });
  },

  deleteSecrets(profileId: string): Promise<null> {
    return invoke('delete_secrets', { profileId });
  },

  // One-shot SSH handshake. Returns the bastion's SHA256 host-key fingerprint
  // (OpenSSH format: `SHA256:<base64-no-pad>`) so the UI can show it for
  // the user to verify before pinning it on the profile.
  discoverHostKey(host: string, port: number): Promise<string> {
    return invoke('discover_host_key', { host, port });
  },
};

export async function httpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!resp.ok) throw new Error(`http ${resp.status}`);
  return (await resp.json()) as T;
}
