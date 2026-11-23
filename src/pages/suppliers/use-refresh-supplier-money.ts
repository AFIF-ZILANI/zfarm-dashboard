import { useQueryClient } from "@tanstack/react-query";

/** After money moves with a supplier: their statement, bills' dues, the cash book, balances and figures all change. */
export function useRefreshSupplierMoney() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["suppliers", "purchases", "payments", "payment-instruments", "analytics"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}
