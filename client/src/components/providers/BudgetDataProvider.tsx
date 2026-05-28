import { useEffect, type ReactNode } from "react";
import { useBudgetData } from "@/hooks/use-budget-data";
import { useStore } from "@/lib/store";

interface BudgetDataProviderProps {
  children: ReactNode;
}

export function BudgetDataProvider({ children }: BudgetDataProviderProps) {
  const { data, isLoading, error } = useBudgetData();
  const hydrateFromServer = useStore((state) => state.hydrateFromServer);
  const clearHydrated = useStore((state) => state.clearHydrated);
  const hasHydrated = useStore((state) => state._hasHydrated);
  const addBudget = useStore((state) => state.addBudget);
  const seedDefaultCategories = useStore((state) => state.seedDefaultCategories);

  // Reset hydration flag on mount so fresh server data is always fetched
  useEffect(() => {
    clearHydrated();
  }, [clearHydrated]);

  useEffect(() => {
    if (data && !hasHydrated) {
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
    }
  }, [data, hasHydrated, hydrateFromServer, addBudget, seedDefaultCategories]);

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
