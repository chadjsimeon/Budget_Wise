import { useEffect, useRef, type ReactNode } from "react";
import { useBudgetData } from "@/hooks/use-budget-data";
import { useStore, DEFAULT_BUDGET_ID } from "@/lib/store";
import {
  flushSyncQueue,
  getPendingSyncCount,
  getSyncGeneration,
  subscribeSyncQueue,
  subscribeSyncRejected,
} from "@/lib/syncQueue";

interface BudgetDataProviderProps {
  children: ReactNode;
}

export function BudgetDataProvider({ children }: BudgetDataProviderProps) {
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useBudgetData();
  const hydrateFromServer = useStore((state) => state.hydrateFromServer);
  const clearHydrated = useStore((state) => state.clearHydrated);
  const keepLocalState = useStore((state) => state.keepLocalState);
  const hasHydrated = useStore((state) => state._hasHydrated);
  const addBudget = useStore((state) => state.addBudget);
  const seedDefaultCategories = useStore((state) => state.seedDefaultCategories);
  // The store boots with a placeholder budget, so "has budgets" is always true;
  // only budgets that came from the server count as real local data.
  const hasLocalData = useStore((state) =>
    state.budgets.some((b) => b.id !== DEFAULT_BUDGET_ID),
  );

  // dataUpdatedAt of the snapshot currently applied to the store.
  const appliedAt = useRef(0);
  // Sync generation when the in-flight (or latest) fetch started.
  const fetchGeneration = useRef(getSyncGeneration());
  // A fresh snapshot is wanted as soon as the sync queue is empty.
  const needsRefresh = useRef(false);

  // Reset hydration flag on mount so fresh server data is always fetched
  useEffect(() => {
    clearHydrated();
  }, [clearHydrated]);

  useEffect(() => {
    if (!isFetching) return;
    // Writes still in the queue when a fetch starts may land after the server
    // has read its snapshot, so that snapshot can't be trusted either: record
    // a generation that never matches.
    fetchGeneration.current = getPendingSyncCount() > 0 ? -1 : getSyncGeneration();
  }, [isFetching]);

  useEffect(() => {
    if (!data || isFetching) return;
    if (hasHydrated && dataUpdatedAt === appliedAt.current) return;

    // A server snapshot must never replace local state that the server has not
    // caught up with: either writes are still queued, or a change was made
    // after this snapshot was requested. Keep local state, let the queue
    // drain, then fetch a snapshot that includes those writes.
    const pending = getPendingSyncCount() > 0;
    const outdated = getSyncGeneration() !== fetchGeneration.current;
    if ((pending || outdated) && (hasHydrated || hasLocalData)) {
      if (!hasHydrated) keepLocalState();
      needsRefresh.current = true;
      if (pending) void flushSyncQueue();
      else void refetch();
      return;
    }

    appliedAt.current = dataUpdatedAt;
    hydrateFromServer(data);

    if (data.budgets.length === 0) {
      // Brand new user with no budget — create one (also seeds categories)
      addBudget({
        name: "My Budget",
        currency: "TTD",
        currencyPlacement: "before",
        numberFormat: "1,234.56",
        dateFormat: "DD/MM/YYYY",
      });
    } else if (data.categoryGroups.length === 0) {
      // Budget exists but has no category groups — seed defaults now.
      // Handles users registered before the server-side category seeding was added.
      // seedDefaultCategories is idempotent: skips if categories already exist.
      seedDefaultCategories();
    }
  }, [
    data,
    dataUpdatedAt,
    isFetching,
    hasHydrated,
    hasLocalData,
    hydrateFromServer,
    keepLocalState,
    addBudget,
    seedDefaultCategories,
    refetch,
  ]);

  // Once the queue is empty, pull a fresh snapshot if one is owed: either a
  // hydration was skipped above, or the server refused a change and local state
  // has to be brought back in line with it.
  useEffect(() => {
    const refreshIfIdle = (pending: number) => {
      if (pending === 0 && needsRefresh.current) {
        needsRefresh.current = false;
        void refetch();
      }
    };
    const unsubscribeQueue = subscribeSyncQueue(refreshIfIdle);
    const unsubscribeRejected = subscribeSyncRejected(() => {
      needsRefresh.current = true;
      refreshIfIdle(getPendingSyncCount());
    });
    return () => {
      unsubscribeQueue();
      unsubscribeRejected();
    };
  }, [refetch]);

  // If the server is unreachable (offline) but we already have data persisted
  // locally, fall back to it instead of blocking the whole app.
  if (error && hasLocalData) {
    return <>{children}</>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center text-white">
          <div className="text-red-400 text-xl mb-2">Failed to load budget data</div>
          <div className="text-slate-400">{error.message}</div>
        </div>
      </div>
    );
  }

  if (isLoading || !hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-white text-lg">Loading your budget data...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
