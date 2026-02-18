import { useEffect, type ReactNode } from "react";
import { useBudgetData } from "@/hooks/use-budget-data";
import { useStore } from "@/lib/store";

interface BudgetDataProviderProps {
  children: ReactNode;
}

export function BudgetDataProvider({ children }: BudgetDataProviderProps) {
  const { data, isLoading, error } = useBudgetData();
  const hydrateFromServer = useStore((state) => state.hydrateFromServer);
  const hasHydrated = useStore((state) => state._hasHydrated);

  useEffect(() => {
    if (data && !hasHydrated) {
      hydrateFromServer(data);
    }
  }, [data, hasHydrated, hydrateFromServer]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-white text-lg">Loading your budget data...</div>
        </div>
      </div>
    );
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

  return <>{children}</>;
}
