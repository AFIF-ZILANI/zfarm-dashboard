import { advanceToUse } from "../suppliers/supplier-split";

// Apart from chick-purchase.ts so `bun test` can load it: that one imports the API hooks.

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
};

export type ChickPurchase = {
  supplier_id: string;
  invoice_no: string;
  /** "" = the default count the caller passes (the chicks placed, on New batch). */
  billed: string;
  unit_price: string;
  status: PaymentStatus;
  amount: string;
  /** Let the advance the supplier holds settle what it can. */
  use_advance: boolean;
  from_instrument_id: string;
  payment_date: string;
  transaction_ref: string;
};

export const CHICK_ITEM_NAME = "Day-old chick";

export const blankChickPurchase = (today: string): ChickPurchase => ({
  supplier_id: "",
  invoice_no: "",
  billed: "",
  unit_price: "",
  status: "UNPAID",
  amount: "",
  use_advance: true,
  from_instrument_id: "",
  payment_date: today,
  transaction_ref: "",
});

/** The numbers a chick purchase works out to. `defaultBilled` fills an empty "Chicks billed"; `held` is the
 * advance the supplier holds. "Paid in full" pays whatever the advance leaves. */
export function chickTotals(chicks: ChickPurchase, defaultBilled: number, held = 0) {
  const billed = chicks.billed === "" ? defaultBilled : Number(chicks.billed);
  const unitPrice = Number(chicks.unit_price);
  const total = Number.isFinite(billed * unitPrice) ? Math.round(billed * unitPrice * 100) / 100 : 0;
  const typed = chicks.status === "PARTIAL" ? Number(chicks.amount) : 0;
  const advanceUsed = advanceToUse(total, typed, held, chicks.use_advance);
  const paymentAmount = chicks.status === "PAID" ? Math.round((total - advanceUsed) * 100) / 100 : Number(chicks.amount);
  return { billed, unitPrice, total, advanceUsed, paymentAmount };
}

/** What's wrong with the purchase/payment, checked before anything is saved. */
export function chickProblem(chicks: ChickPurchase, defaultBilled: number, hasWarehouse: boolean, held = 0): string | null {
  const { billed, unitPrice, total, advanceUsed, paymentAmount } = chickTotals(chicks, defaultBilled, held);
  if (!chicks.supplier_id) return "Select the supplier.";
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return "Enter the price per chick.";
  if (!Number.isInteger(billed) || billed <= 0) return "Enter how many chicks were billed.";
  if (!hasWarehouse) return "Add a warehouse first — every purchase is filed under one.";
  if (chicks.status !== "UNPAID") {
    if (chicks.status === "PAID" && advanceUsed >= total) return "The advance covers this bill, so nothing is paid now. Choose “Unpaid”.";
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return "Enter a valid payment amount.";
    if (chicks.status === "PARTIAL" && paymentAmount >= total)
      return 'A partial payment must be less than the total — pick "Paid in full" instead.';
    if (!chicks.from_instrument_id) return "Select which account the payment came from.";
  }
  return null;
}
