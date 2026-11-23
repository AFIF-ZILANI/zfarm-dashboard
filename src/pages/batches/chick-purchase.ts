import { useGetData, usePostData, type Paginated } from "@/lib/api";
import type { Item, Warehouse } from "@/pages/inventory/types";
import type { Supplier } from "@/pages/suppliers/types";
import type { Purchase } from "@/pages/purchases/types";
import { CHICK_ITEM_NAME, chickTotals, type ChickPurchase } from "@/pages/batches/chick-purchase-math";
import { useAdvanceHeld } from "@/pages/suppliers/use-advance-held";
import { useRefreshSupplierMoney } from "@/pages/suppliers/use-refresh-supplier-money";

/**
 * Chicks are bought only from a batch (batch-management-design.md §3): the delivery that starts it on
 * New batch, any later one with "Add chick delivery" on the batch page. Either way it is a normal
 * Purchase whose one line carries the batch's id, so its cost lands in the batch P&L. The Purchases
 * page leaves chicks out of its item list.
 */

export * from "@/pages/batches/chick-purchase-math";

/** Everything a chick purchase needs from the server, and the call that records one for a batch.
 * `held` is the advance the chosen supplier holds. */
export function useChickPurchase(supplierId: string) {
  const held = useAdvanceHeld(supplierId);
  const refresh = useRefreshSupplierMoney();
  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { data: chickItems } = useGetData<Paginated<Item>>("/items?category=CHICKS&limit=100", ["items", "CHICKS"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const createItem = usePostData<Item, Record<string, unknown>>("/items", ["items"]);
  const createPurchase = usePostData<Purchase, Record<string, unknown>>("/purchases", ["purchases"]);
  const chickItem = chickItems?.results.find((i) => i.is_active) ?? null;

  const record = async (batchId: string, chicks: ChickPurchase, defaultBilled: number, purchaseDate: string) => {
    const { billed, unitPrice, advanceUsed, paymentAmount } = chickTotals(chicks, defaultBilled, held);
    const item =
      chickItem ?? (await createItem.mutateAsync({ name: CHICK_ITEM_NAME, category: "CHICKS", unit: "PCS" }));
    const paying = chicks.status !== "UNPAID";
    const purchase = await createPurchase.mutateAsync({
      supplier_id: chicks.supplier_id || undefined,
      // Chick lines post no warehouse stock; the purchase is just filed under the first warehouse.
      warehouse_id: warehouses!.results[0]!.id,
      invoice_no: chicks.invoice_no.trim() || undefined,
      purchase_date: purchaseDate,
      paid_amount: paying ? paymentAmount : 0,
      ...(advanceUsed > 0 && { use_advance: advanceUsed }),
      ...(paying && {
        paid_from_instrument_id: chicks.from_instrument_id,
        payment_date: chicks.payment_date || undefined,
        payment_transaction_ref: chicks.transaction_ref.trim() || undefined,
      }),
      items: [{ item_id: item.id, batch_id: batchId, quantity: billed, unit: item.unit, unit_price: unitPrice }],
    });
    // The bill, its payment and the advance it used: the supplier's balance, the cash book and figures changed.
    refresh();
    return purchase;
  };

  return { suppliers, held, chickItem, hasWarehouse: !!warehouses?.results.length, record };
}
