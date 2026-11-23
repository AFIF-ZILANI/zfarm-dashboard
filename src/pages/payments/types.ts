export const PAYMENT_DIRECTIONS = ["INCOMING", "OUTGOING"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

// PAYROLL is absent on purpose: a salary payment is a PayrollPayout, which can
// require proof of transfer. See server/docs/employee-payroll-design.md.
export const PAYMENT_REF_TYPES = ["SALE", "BIRD_SALE", "PURCHASE", "EXPENSE"] as const;
export type PaymentRefType = (typeof PAYMENT_REF_TYPES)[number];

/** Cash-book money with no bill behind it. A TRANSFER moves between two of the farm's own accounts. */
export const NO_BILL_KINDS = ["OWNER_CAPITAL", "OWNER_DRAW", "OTHER_IN", "OTHER_OUT", "TRANSFER", "TAX_PAID"] as const;
export type NoBillKind = (typeof NO_BILL_KINDS)[number];
/** What a payment can be recorded as from the Record payment dialog. */
export type PaymentKind = PaymentRefType | NoBillKind;
/** Every kind a stored row can carry: PAYROLL comes from payouts, LOAN from the Loans tab, SUPPLIER_* from Pay supplier. */
export type StoredPaymentKind = PaymentKind | "PAYROLL" | "LOAN" | "SUPPLIER_OPENING" | "SUPPLIER_ADVANCE";

export const KIND_LABEL: Record<StoredPaymentKind, string> = {
  SALE: "Sale",
  BIRD_SALE: "Bird sale",
  PURCHASE: "Purchase",
  EXPENSE: "Expense",
  PAYROLL: "Payroll",
  LOAN: "Loan",
  OWNER_CAPITAL: "Owner capital",
  OWNER_DRAW: "Owner draw",
  OTHER_IN: "Other money in",
  OTHER_OUT: "Other money out",
  TRANSFER: "Transfer between accounts",
  TAX_PAID: "Tax paid",
  SUPPLIER_OPENING: "Supplier old balance",
  SUPPLIER_ADVANCE: "Supplier advance",
};

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MFS"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MFS_TYPES = ["BKASH", "NAGAD", "ROCKET"] as const;
export type MfsType = (typeof MFS_TYPES)[number];

export type SplitMove = "TO_REINVEST" | "TO_RESERVE" | "FROM_RESERVE";

export type Payment = {
  id: string;
  amount: string;
  payment_date: string;
  direction: PaymentDirection;
  ref_type: StoredPaymentKind;
  /** The bill paid; a row with no bill points at itself. */
  ref_id: string;
  /** One is set: the farm account the money left (money out) or landed in (money in). A TRANSFER sets both. */
  from_instrument_id: string | null;
  to_instrument_id: string | null;
  transaction_ref: string | null;
  handled_by_id: string | null;
  note: string | null;
  /** The one amount handed to a supplier that this row is part of. */
  supplier_payment_id: string | null;
  /** Set on a transfer that carries out a profit split. */
  split_move: SplitMove | null;
  created_at: string;
};

/** Which pot an account's money belongs to. Only OPERATING is cash the farm can spend. */
export const FUNDS = ["OPERATING", "REINVEST", "RESERVE"] as const;
export type Fund = (typeof FUNDS)[number];
export const FUND_LABEL: Record<Fund, string> = { OPERATING: "Operating", REINVEST: "Reinvestment", RESERVE: "Reserve" };

/** One of the farm's own accounts (Cash, a bank account, a mobile wallet). */
export type PaymentInstrument = {
  id: string;
  type: PaymentMethod;
  label: string;
  bank_name: string | null;
  account_no: string | null;
  mobile_no: string | null;
  mfs_type: MfsType | null;
  is_active: boolean;
  fund: Fund;
  created_at: string;
};

export type InstrumentBalance = {
  instrument_id: string;
  incoming: string;
  outgoing: string;
  balance: string;
};
