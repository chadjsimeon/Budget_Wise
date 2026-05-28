import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

// Offline write queue. The app is local-first: mutations update Zustand
// (persisted to localStorage) immediately, then call syncToServer to push the
// change to the backend. When offline or when a request fails, the op is queued
// here (FIFO, persisted) and replayed in order once connectivity returns, so a
// "create" always reaches the server before a later "update" of the same entity.

const QUEUE_KEY = "bw-sync-queue";

export interface SyncOp {
  method: string;
  url: string;
  data?: unknown;
}

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();

function readQueue(): SyncOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncOp[]) : [];
  } catch {
    return [];
  }
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

function enqueue(op: SyncOp) {
  const queue = readQueue();
  queue.push(op);
  writeQueue(queue);
}

let flushing = false;

export async function flushSyncQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    while (readQueue().length > 0) {
      const op = readQueue()[0];
      try {
        await apiRequest(op.method, op.url, op.data);
      } catch {
        // Stop on the first failure; remaining ops stay queued in order and are
        // retried on the next 'online' event.
        break;
      }
      // Re-read before dropping the head so ops enqueued mid-flush are preserved.
      writeQueue(readQueue().slice(1));
    }
  } finally {
    flushing = false;
  }
}

let syncErrorShown = false;

export async function syncToServer(method: string, url: string, data?: unknown) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  // Preserve ordering: if we're offline or already have a backlog, queue rather
  // than racing a fresh request ahead of pending ones.
  if (offline || getPendingSyncCount() > 0) {
    enqueue({ method, url, data });
    if (!offline) void flushSyncQueue();
    return;
  }

  try {
    await apiRequest(method, url, data);
    syncErrorShown = false;
  } catch {
    enqueue({ method, url, data });
    if (!syncErrorShown) {
      syncErrorShown = true;
      toast({
        title: "Changes saved locally",
        description: "We'll sync them to the server when you're back online.",
      });
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncErrorShown = false;
    void flushSyncQueue();
  });
  // Drain any backlog left over from a previous session.
  void flushSyncQueue();
}
