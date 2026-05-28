import { beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Node 25 ships a built-in localStorage that lacks standard Web Storage methods.
// Polyfill it so Zustand persist middleware and test cleanup work correctly.
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  } as Storage;
}

beforeEach(() => {
  localStorage.clear();
});
