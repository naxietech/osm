import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePersistedState } from './use-persisted-state';

const KEY = 'oses.test.persisted';

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('usePersistedState', () => {
  it('starts from the initial value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState(KEY, { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('survives a remount — which is what a refresh looks like', () => {
    const first = renderHook(() => usePersistedState(KEY, { a: 1 }));
    act(() => first.result.current[1]({ a: 42 }));
    first.unmount();

    const second = renderHook(() => usePersistedState(KEY, { a: 1 }));
    expect(second.result.current[0]).toEqual({ a: 42 });
  });

  it('uses sessionStorage, so a chosen password does not outlive the tab', () => {
    const { result } = renderHook(() => usePersistedState(KEY, { a: 1 }));
    act(() => result.current[1]({ a: 7 }));

    expect(window.sessionStorage.getItem(KEY)).toContain('7');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('clears on demand', () => {
    const { result } = renderHook(() => usePersistedState(KEY, { a: 1 }));
    act(() => result.current[1]({ a: 9 }));
    act(() => result.current[2]());

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('ignores a stored value it cannot parse', () => {
    // Left by an older version of the form. Crashing on load is the one failure an applicant
    // has no way to recover from, so unreadable is treated as absent.
    window.sessionStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => usePersistedState(KEY, { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('ignores a stored value of the wrong shape', () => {
    window.sessionStorage.setItem(KEY, '"a string"');
    const { result } = renderHook(() => usePersistedState(KEY, { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('keeps working when storage throws', () => {
    // Safari private mode, a full quota, a hardened browser. The form must still work; it just
    // will not survive a refresh.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => usePersistedState(KEY, { a: 1 }));
    act(() => result.current[1]({ a: 5 }));
    expect(result.current[0]).toEqual({ a: 5 });
  });
});
