import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/queryClient', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/queryClient')>()),
  apiRequest: vi.fn(),
}));

import { apiRequest, ApiRequestError } from '@/lib/queryClient';
import {
  syncToServer,
  flushSyncQueue,
  getPendingSyncCount,
  getDeadLetters,
  claimSyncQueue,
  clearSyncQueue,
  subscribeSyncRejected,
} from '@/lib/syncQueue';

const request = vi.mocked(apiRequest);
const ok = () => Promise.resolve(new Response('{}'));
const fail = (status: number) => () => Promise.reject(new ApiRequestError(status, 'nope'));
const networkDown = () => Promise.reject(new TypeError('Failed to fetch'));

// Lets the queue's flush loop run to completion.
const settle = async () => {
  await flushSyncQueue();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const sentUrls = () => request.mock.calls.map(([, url]) => url);

describe('sync queue', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(ok);
  });

  test('sends ops one at a time in the order they were made', async () => {
    // Given: the first request is slow
    let releaseFirst!: () => void;
    request.mockImplementationOnce(
      () => new Promise((resolve) => { releaseFirst = () => resolve(new Response('{}')); }),
    );

    // When: two changes are made back to back
    syncToServer('POST', '/api/accounts', { id: 'a' });
    syncToServer('POST', '/api/transactions', { id: 't' });

    // Then: the second waits for the first
    expect(sentUrls()).toEqual(['/api/accounts']);
    expect(getPendingSyncCount()).toBe(2);

    releaseFirst();
    await settle();
    expect(sentUrls()).toEqual(['/api/accounts', '/api/transactions']);
    expect(getPendingSyncCount()).toBe(0);
  });

  test('a request the server rejects is dead-lettered and does not block later ops', async () => {
    // Given: the server refuses the first op outright
    request.mockImplementationOnce(fail(422));
    const onRejected = vi.fn();
    const unsubscribe = subscribeSyncRejected(onRejected);

    // When: two changes are made
    syncToServer('POST', '/api/accounts', { id: 'bad' });
    syncToServer('PUT', '/api/assignments', { amount: 5 });
    await settle();
    unsubscribe();

    // Then: the bad op is set aside, the good one still syncs
    expect(sentUrls()).toEqual(['/api/accounts', '/api/assignments']);
    expect(getPendingSyncCount()).toBe(0);
    expect(getDeadLetters()).toHaveLength(1);
    expect(getDeadLetters()[0]).toMatchObject({ status: 422, op: { url: '/api/accounts' } });
    expect(onRejected).toHaveBeenCalled();
  });

  test('a 409 means the row already exists, so the op is dropped as applied', async () => {
    request.mockImplementationOnce(fail(409));

    syncToServer('POST', '/api/accounts', { id: 'dup' });
    await settle();

    expect(getPendingSyncCount()).toBe(0);
    expect(getDeadLetters()).toHaveLength(0);
  });

  test.each([
    ['a network failure', networkDown],
    ['an expired session (401)', fail(401)],
    ['a server error (500)', fail(500)],
  ])('%s keeps the op queued and stops the flush', async (_name, failure) => {
    // Given: the server can't take the first op right now
    request.mockImplementationOnce(failure);

    // When: two changes are made
    syncToServer('POST', '/api/accounts', { id: 'a' });
    syncToServer('POST', '/api/transactions', { id: 't' });
    await settle();

    // Then: both stay queued, in order, and nothing is dead-lettered
    expect(sentUrls()).toEqual(['/api/accounts']);
    expect(getPendingSyncCount()).toBe(2);
    expect(getDeadLetters()).toHaveLength(0);

    // And: they go out once the server recovers
    await settle();
    expect(sentUrls()).toEqual(['/api/accounts', '/api/accounts', '/api/transactions']);
    expect(getPendingSyncCount()).toBe(0);
  });

  test('a request that keeps crashing the server is eventually dead-lettered', async () => {
    // Given: an op that has been failing with 500 for over an hour
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      request.mockImplementation(fail(500));
      syncToServer('POST', '/api/accounts', { id: 'crash' });
      for (let i = 0; i < 4; i++) await flushSyncQueue();
      expect(getPendingSyncCount()).toBe(1);

      // When: it fails again after the retry window has passed
      vi.setSystemTime(Date.now() + 61 * 60 * 1000);
      await flushSyncQueue();

      // Then: it is set aside
      expect(getPendingSyncCount()).toBe(0);
      expect(getDeadLetters()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test('queued ops are discarded when a different user signs in', async () => {
    // Given: user A has an unsynced change
    request.mockImplementation(networkDown);
    claimSyncQueue('user-a');
    syncToServer('POST', '/api/tracking-accounts', { id: 'x' });
    await settle();
    expect(getPendingSyncCount()).toBe(1);

    // Then: the same user keeps it, a different user does not
    expect(claimSyncQueue('user-a')).toBe(false);
    expect(getPendingSyncCount()).toBe(1);
    expect(claimSyncQueue('user-b')).toBe(true);
    expect(getPendingSyncCount()).toBe(0);
  });

  test('clearSyncQueue removes queued and dead-lettered ops', async () => {
    request.mockImplementationOnce(fail(400)).mockImplementation(networkDown);
    syncToServer('POST', '/api/a');
    syncToServer('POST', '/api/b');
    await settle();
    expect(getDeadLetters()).toHaveLength(1);
    expect(getPendingSyncCount()).toBe(1);

    clearSyncQueue();

    expect(getDeadLetters()).toHaveLength(0);
    expect(getPendingSyncCount()).toBe(0);
  });
});
