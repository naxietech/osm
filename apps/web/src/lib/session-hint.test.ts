import { afterEach, describe, expect, it } from 'vitest';

import { SESSION_HINT_COOKIE } from '@oses/types';

import { clearSessionHint, hasSessionHint } from './session-hint';

afterEach(() => {
  document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
});

describe('hasSessionHint', () => {
  it('is false when the browser carries no marker', () => {
    expect(hasSessionHint()).toBe(false);
  });

  it('is true once the marker is set', () => {
    document.cookie = `${SESSION_HINT_COOKIE}=1; path=/`;
    expect(hasSessionHint()).toBe(true);
  });

  it('is not fooled by another cookie whose name ends the same way', () => {
    document.cookie = `not_${SESSION_HINT_COOKIE}=1; path=/`;
    expect(hasSessionHint()).toBe(false);
    document.cookie = `not_${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
  });
});

describe('clearSessionHint', () => {
  it('removes the marker', () => {
    document.cookie = `${SESSION_HINT_COOKIE}=1; path=/`;
    clearSessionHint();
    expect(hasSessionHint()).toBe(false);
  });

  it('leaves other cookies alone', () => {
    document.cookie = `${SESSION_HINT_COOKIE}=1; path=/`;
    document.cookie = 'keep_me=yes; path=/';
    clearSessionHint();
    expect(document.cookie).toContain('keep_me=yes');
    document.cookie = 'keep_me=; Max-Age=0; path=/';
  });

  it('is safe to call when there is nothing to clear', () => {
    expect(() => {
      clearSessionHint();
    }).not.toThrow();
    expect(hasSessionHint()).toBe(false);
  });
});
