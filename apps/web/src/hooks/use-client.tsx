/**
 * Active client (tenant) state. Resolves the current white-label client, persists the
 * choice, and applies the client's brand theme as CSS-variable overrides on the document
 * root (over the base design tokens). Exposes `isModuleEnabled` for nav/route gating.
 *
 * For the mock the active client comes from a dev switcher / localStorage; in production
 * it would be resolved from the domain or the logged-in user.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type Client, type ModuleKey } from '@oses/types';

import { DEFAULT_CLIENT_ID, clients, getClient } from '@/services/client.service';

interface ClientContextValue {
  client: Client;
  clients: Client[];
  setClientId: (id: string) => void;
  isModuleEnabled: (module: ModuleKey | undefined) => boolean;
}

const STORAGE_KEY = 'oses-client';

function readStoredClientId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_CLIENT_ID;
  } catch {
    return DEFAULT_CLIENT_ID;
  }
}

const fallbackClient: Client = getClient(DEFAULT_CLIENT_ID) ??
  clients[0] ?? { id: DEFAULT_CLIENT_ID, name: 'OSES', enabledModules: [] };

const ClientContext = createContext<ClientContextValue>({
  client: fallbackClient,
  clients,
  setClientId: () => undefined,
  isModuleEnabled: () => true,
});

/** Apply (or clear) the client's brand overrides on :root. */
function applyTheme(client: Client): void {
  const root = document.documentElement;
  const theme = client.theme;
  if (theme?.brand) root.style.setProperty('--brand', theme.brand);
  else root.style.removeProperty('--brand');
  if (theme?.brandFrom && theme?.brandTo) {
    root.style.setProperty(
      '--gradient-brand',
      `linear-gradient(180deg, ${theme.brandFrom} 0%, ${theme.brandTo} 100%)`,
    );
  } else {
    root.style.removeProperty('--gradient-brand');
  }
}

export function ClientProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [clientId, setClientIdState] = useState<string>(readStoredClientId);
  const client = getClient(clientId) ?? fallbackClient;

  useEffect(() => {
    applyTheme(client);
  }, [client]);

  const setClientId = useCallback((id: string): void => {
    setClientIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ClientContextValue>(
    () => ({
      client,
      clients,
      setClientId,
      isModuleEnabled: (module) => !module || client.enabledModules.includes(module),
    }),
    [client, setClientId],
  );

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClient(): ClientContextValue {
  return useContext(ClientContext);
}
