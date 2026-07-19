/**
 * Dev-only client (tenant) switcher — a small floating control to preview white-label
 * clients live: switching re-themes the app and re-gates the nav by the client's enabled
 * modules. In production the active client is resolved from the domain / logged-in user,
 * not a switcher.
 */
import { type ReactElement } from 'react';

import { useClient } from '@/hooks';

export function ClientSwitcher(): ReactElement {
  const { client, clients, setClientId } = useClient();

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
      <span className="text-muted-foreground">Client</span>
      <select
        aria-label="Active client (preview)"
        className="bg-transparent font-medium text-foreground outline-none"
        value={client.id}
        onChange={(e) => setClientId(e.target.value)}
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ClientSwitcher;
