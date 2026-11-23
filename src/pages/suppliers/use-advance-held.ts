import { useGetData } from "@/lib/api";
import type { SupplierBalance } from "@/pages/suppliers/supplier-money-types";

/** The advance a supplier holds now; 0 until known, or with no supplier picked. */
export function useAdvanceHeld(supplierId: string | undefined): number {
  const { data } = useGetData<SupplierBalance[]>("/suppliers/balances", ["suppliers", "balances"]);
  const held = parseFloat(data?.find((b) => b.supplier_id === supplierId)?.advance ?? "0");
  return held > 0 ? held : 0;
}
