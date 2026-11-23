import { useState } from "react";
import { advanceOf, splitOldestFirst, splitProblem, type Split } from "@/pages/suppliers/supplier-split";
import type { SupplierDues } from "@/pages/suppliers/supplier-money-types";

const shown = (v: number | undefined) => (v ? String(v) : "");

/** How `total` is shared over what a supplier is owed: oldest first, until the owner changes a part. */
export function useSplit(total: number, dues: SupplierDues) {
  // Null until a part is changed: then that split stands, whatever the total becomes.
  const [edited, setEdited] = useState<{ opening: string; bills: Record<string, string> } | null>(null);

  const openingLeft = parseFloat(dues.opening_left);
  const bills = dues.bills.map((b) => ({ id: b.id, due: parseFloat(b.due) }));
  const auto = splitOldestFirst(total, openingLeft, bills);
  const split: Split = edited
    ? {
        opening: Number(edited.opening) || 0,
        bills: Object.fromEntries(Object.entries(edited.bills).map(([id, v]) => [id, Number(v) || 0])),
      }
    : auto;
  const startEdit = () => edited ?? { opening: shown(auto.opening), bills: Object.fromEntries(bills.map((b) => [b.id, shown(auto.bills[b.id])])) };

  return {
    openingLeft,
    owed: Math.round((openingLeft + bills.reduce((s, b) => s + b.due, 0)) * 100) / 100,
    /** What the split leaves over. */
    left: advanceOf(total, split),
    problem: splitProblem(total, openingLeft, bills, split),
    /** Exactly what's on screen: if a due changed meanwhile the server refuses rather than re-splitting. */
    body: {
      ...(split.opening > 0 && { opening: split.opening }),
      bills: Object.entries(split.bills)
        .filter(([, v]) => v > 0)
        .map(([purchase_id, amount]) => ({ purchase_id, amount })),
    },
    isEdited: edited !== null,
    reset: () => setEdited(null),
    openingValue: edited ? edited.opening : shown(auto.opening),
    billValue: (id: string) => (edited ? (edited.bills[id] ?? "") : shown(auto.bills[id])),
    editOpening: (v: string) => setEdited({ ...startEdit(), opening: v }),
    editBill: (id: string, v: string) => {
      const base = startEdit();
      setEdited({ ...base, bills: { ...base.bills, [id]: v } });
    },
  };
}
