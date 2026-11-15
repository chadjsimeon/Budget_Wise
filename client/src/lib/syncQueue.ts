import { apiRequest, ApiRequestError } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

// Offline write queue. The app is local-first: mutations update Zustand
// (persisted to localStorage) immediately, then call syncToServer to push the
// change to the backend. Every op goes through this single FIFO queue
// (persisted), so requests reach the server strictly in the order they were
// made — a "create" always lands before a later "update" of the same entity —
// and an op only leaves the queue once the server has answered it.
//
// How a failed op is handled depends on why it failed:
//   - network error, 401, 408, 429: transient. The op stays at the head and the
//     flush stops; it is retried on reconnect, on the next mutation, on the
//     next app start, and after login.
//   - 409: the server already has this row (a replay of a request whose
//     response was lost). Treated as applied and dropped.
//   - any other 4xx: the server will never accept it. The op is moved to the
//     dead-letter list so it cannot block everything queued behind it.
//   - 5xx: retried, but dead-lettered once it has failed MAX_SERVER_ATTEMPTS
//     times over at least SERVER_RETRY_WINDOW_MS, so a request that reliably
//     crashes the server cannot block the queue forever either.

const QUEUE_KEY = "bw-sync-queue";
const DEAD_KEY = "bw-sync-dead";
const OWNER_KEY = "bw-sync-owner";

const MAX_SERVER_ATTEMPTS = 5;
const SERVER_RETRY_WINDOW_MS = 60 * 60 * 1000;
const MAX_DEAD_LETTERS = 20;

export interface SyncOp {
  method: string;
  url: string;
  data?: unknown;
  /** Number of 5xx responses this op has received. */
  attempts?: number;
  /** Timestamp (ms) of this op's first 5xx response. */
  firstFailedAt?: number;
}

export interface DeadLetter {
  op: SyncOp;
  status?: number;
  message: string;
  at: number;
}

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();
const rejectedListeners = new Set<() => void>();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readQueue(): SyncOp[] {
  return readJson<SyncOp[]>(QUEUE_KEY, []);
}

function writeQueue(queue: SyncOp[]) {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore persistence errors */
  }
  listeners.forEach((l) => l(queue.length));
}

export function getPendingSyncCount(): number {
  return readQueue().length;
}

export function subscribeSyncQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fires when the server refused an op, i.e. local state is ahead of the server. */
export function subscribeSyncRejected(listener: () => void): () => void {
  rejectedListeners.add(listener);
  return () => {
    rejectedListeners.delete(listener);
  };
}

// Bumped on every mutation. Lets a caller tell whether a server snapshot it
// fetched could predate a local change (compare before the fetch and after).
let generation = 0;

export function getSyncGeneration(): number {
  return generation;
}

export function getDeadLetters(): DeadLetter[] {
  return readJson<DeadLetter[]>(DEAD_KEY, []);
}

function deadLetter(op: SyncOp, err: unknown) {
  const entry: DeadLetter = {
    op,
    status: err instanceof ApiRequestError ? err.status : undefined,
    message: err instanceof Error ? err.message : String(err),
    at: Date.now(),
  };
  console.error("[sync] server rejected a change; dropping it", entry);
  try {
    const dead = [...getDeadLetters(), entry].slice(-MAX_DEAD_LETTERS);
    localStorage.setItem(DEAD_KEY, JSON.stringify(dead));
  } catch {
    /* ignore persistence errors */
  }
}

/** Drops every queued and dead-lettered op. */
export function clearSyncQueue() {
  try {
    localStorage.removeItem(DEAD_KEY);
  } catch {
    /* ignore */
  }
  writeQueue([]);
}

/**
 * Ties the queue to the signed-in user. Queued ops carry no identity of their
 * own, so ops left behind by one user must never be replayed under another
 * user's session. Returns true if another user's ops were discarded.
 */
export function claimSyncQueue(userId: string): boolean {
  let previousOwner: string | null = null;
  try {
    previousOwner = localStorage.getItem(OWNER_KEY);
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* ignore */
  }
  if (previousOwner && previousOwner !== userId) {
    clearSyncQueue();
    return true;
  }
  return false;
}

type Verdict = "retry" | "retry-counted" | "applied" | "reject";

function classify(err: unknown, op: SyncOp): Verdict {
  if (!(err instanceof ApiRequestError)) return "retry"; // network failure
  const { status } = err;
  if (status === 401 || status === 408 || status === 429) return "retry";
  if (status === 409) return "applied";
  if (status < 500) return "reject";
  const attempts = (op.attempts ?? 0) + 1;
  const firstFailedAt = op.firstFailedAt ?? Date.now();
  const exhausted =
    attempts >= MAX_SERVER_ATTEMPTS &&
    Date.now() - firstFailedAt >= SERVER_RETRY_WINDOW_MS;
  return exhausted ? "reject" : "retry-counted";
}

function dropHead() {
  // Re-read before dropping so ops enqueued mid-request are preserved.
  writeQueue(readQueue().slice(1));
}

let flushing = false;
let syncErrorShown = false;

export async function flushSyncQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  let rejected = 0;
  let serverDiverged = false;
  try {
    while (true) {
      const op = readQueue()[0];
      if (!op) break;
      try {
        await apiRequest(op.method, op.url, op.data);
        syncErrorShown = false;
        dropHead();
      } catch (err) {
        const verdict = classify(err, op);
        if (verdict === "applied") {
          serverDiverged = true;
          dropHead();
          continue;
        }
        if (verdict === "reject") {
          deadLetter(op, err);
          rejected++;
          serverDiverged = true;
          dropHead();
          continue;
        }
        if (verdict === "retry-counted") {
          const queue = readQueue();
          queue[0] = {
            ...queue[0],
            attempts: (op.attempts ?? 0) + 1,
            firstFailedAt: op.firstFailedAt ?? Date.now(),
          };
          writeQueue(queue);
        }
        if (!syncErrorShown) {
          syncErrorShown = true;
          toast({
            title: "Changes saved locally",
            description: "We'll sync them to the server when you're back online.",
          });
        }
        // Stop at the first transient failure; the rest stay queued in order.
        break;
      }
    }
  } finally {
    flushing = false;
  }

  if (rejected > 0) {
    toast({
      title: rejected === 1 ? "A change couldn't be saved" : `${rejected} changes couldn't be saved`,
      description: "The server rejected it, so it has been undone. Your other changes are safe.",
      variant: "destructive",
    });
  }
  if (serverDiverged) rejectedListeners.forEach((l) => l());
}

export function syncToServer(method: string, url: string, data?: unknown) {
  generation++;
  const queue = readQueue();
  queue.push({ method, url, data });
  writeQueue(queue);
  void flushSyncQueue();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncErrorShown = false;
    void flushSyncQueue();
  });
  // Drain any backlog left over from a previous session.
  void flushSyncQueue();
}
