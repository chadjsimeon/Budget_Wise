import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { ServerBudgetData } from "@/lib/store";

export function useBudgetData(enabled: boolean = true) {
  return useQuery<ServerBudgetData>({
    queryKey: ["/api/budget-data"],
    queryFn: getQueryFn<ServerBudgetData>({ on401: "throw" }),
    staleTime: Infinity,
    // A remount (after an error boundary reset, say) must not hydrate the store
    // from a snapshot cached earlier in the session.
    refetchOnMount: "always",
    enabled,
  });
}
