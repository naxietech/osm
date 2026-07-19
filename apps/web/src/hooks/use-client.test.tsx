import { type ReactElement, type ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ClientProvider, useClient } from './use-client';

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return <ClientProvider>{children}</ClientProvider>;
}

afterEach(() => {
  localStorage.clear();
});

describe('useClient', () => {
  it('defaults to the national client with every module enabled', () => {
    const { result } = renderHook(() => useClient(), { wrapper: Wrapper });
    expect(result.current.client.id).toBe('client_oses');
    expect(result.current.isModuleEnabled('roles')).toBe(true);
    expect(result.current.isModuleEnabled('reference-data')).toBe(true);
  });

  it('untagged items (no module) are always enabled', () => {
    const { result } = renderHook(() => useClient(), { wrapper: Wrapper });
    expect(result.current.isModuleEnabled(undefined)).toBe(true);
  });

  it('switching to the trimmed demo client gates modules it does not enable', () => {
    const { result } = renderHook(() => useClient(), { wrapper: Wrapper });
    act(() => result.current.setClientId('client_demo'));
    expect(result.current.client.id).toBe('client_demo');
    expect(result.current.isModuleEnabled('institutes')).toBe(true); // enabled
    expect(result.current.isModuleEnabled('roles')).toBe(false); // not enabled
    expect(result.current.isModuleEnabled('reference-data')).toBe(false);
  });

  it('persists the chosen client to localStorage', () => {
    const { result } = renderHook(() => useClient(), { wrapper: Wrapper });
    act(() => result.current.setClientId('client_demo'));
    expect(localStorage.getItem('oses-client')).toBe('client_demo');
  });
});
