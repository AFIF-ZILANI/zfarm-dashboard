import { useQueryClient } from "@tanstack/react-query";

/** After a decision or a move: the split, the cash book, account balances and the finance figures all change. */
export function useRefreshSplit() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["profit-splits", "payments", "payment-instruments", "analytics"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}
