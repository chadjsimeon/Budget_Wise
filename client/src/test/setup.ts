import { beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear(); // Critical: Zustand uses localStorage persistence
});
