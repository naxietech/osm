/**
 * Mock client (tenant) service — one deployed app serving multiple white-label clients.
 * Seeds a full-featured national client and a trimmed, re-themed demo client so module
 * gating and per-client branding are demonstrable. The active client is resolved by the
 * ClientProvider (see hooks/use-client).
 *
 * TODO: replace with a real clientsApi; resolve the active client from the domain / the
 * logged-in user rather than a dev switcher.
 */
import { type Client, type ModuleKey } from '@oses/types';

const ALL_MODULES: ModuleKey[] = [
  'dashboard',
  'institutes',
  'students',
  'checkers',
  'exams',
  'marking',
  'results',
  'roles',
  'users',
  'reference-data',
  'e-sheet',
  'questions',
];

export const DEFAULT_CLIENT_ID = 'client_oses';

export const clients: Client[] = [
  {
    id: DEFAULT_CLIENT_ID,
    name: 'OSES National',
    enabledModules: ALL_MODULES,
  },
  {
    id: 'client_demo',
    name: 'Demo Board (white-label)',
    // A trimmed feature set — no roles/users/reference-data/e-sheet/questions/marking.
    enabledModules: ['dashboard', 'institutes', 'students', 'exams', 'results'],
    theme: { brand: '#2563eb', brandFrom: '#0b3b6f', brandTo: '#2563eb' },
  },
];

export function listClients(): Client[] {
  return clients;
}

export function getClient(id: string): Client | undefined {
  return clients.find((c) => c.id === id);
}
