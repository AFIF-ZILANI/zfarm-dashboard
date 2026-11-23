/** Money fields are decimal strings. Positive = the farm owes the supplier, negative = they hold an advance. */
export type SupplierBalance = { supplier_id: string; opening_left: string; bills_due: string; owed: string; advance: string };

export type SupplierDues = {
  opening_left: string;
  advance: string;
  /** Something left to pay, oldest first. */
  bills: { id: string; invoice_no: string | null; purchase_date: string; total: string; due: string }[];
};

export type StatementLine = {
  id: string;
  kind: "OPENING" | "BILL" | "PAID_WITH_BILL" | "PAYMENT" | "REFUND";
  date: string;
  label: string;
  /** What it adds to the balance (old balance, bill, refund), or null for a payment. */
  adds: string | null;
  paid: string | null;
  balance: string;
  purchase_id: string | null;
  /** Set on what Pay supplier or Refund recorded: these can be removed. */
  supplier_payment_id: string | null;
  account: string | null;
  transaction_ref: string | null;
  note: string | null;
  settled: { label: string; amount: string }[];
};
export type SupplierStatement = { brought_forward: string; lines: StatementLine[]; closing: string; bought: string; paid: string };
