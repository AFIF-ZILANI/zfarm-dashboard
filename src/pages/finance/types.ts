export const COST_TYPES = ["DIRECT", "SHARED_PERIOD", "SHARED_CAPITAL"] as const;
export type CostType = (typeof COST_TYPES)[number];
/** Every cost type an expense can carry: STOCK is a purchase's charge, only created through its purchase. */
export const EXPENSE_COST_TYPES = [...COST_TYPES, "STOCK"] as const;
export type ExpenseCostType = (typeof EXPENSE_COST_TYPES)[number];

export type Expense = {
  id: string;
  batch_id: string | null;
  category: string;
  cost_type: ExpenseCostType;
  purchase_id?: string | null;
  amount: string;
  date: string;
  remarks: string | null;
  recorded_by_id: string;
  created_at: string;
};

export type AssetDepreciation = {
  id: string;
  asset_id: string;
  batch_id: string;
  amount: string;
  computed_at: string;
  asset: {
    id: string;
    name: string;
    purchase_cost: string;
    purchase_date: string;
    useful_life_batches: number;
    status: string;
  };
};

export type FinancialDashboard = {
  month: string;
  revenue: string;
  expenses: string;
  gross_profit: string;
  outstanding_payables: string;
  outstanding_receivables: string;
  cash_position: string;
  cash_by_instrument: { instrument_id: string; label: string; balance: string }[];
};

export type FinanceAsset = {
  id: string;
  name: string;
};

export type BatchPnl = {
  batch_id: string;
  revenue: string;
  purchase_cost: string;
  consumption_cost: string;
  direct_expenses: string;
  depreciation_share: string;
  shared_period_expenses_unallocated: string;
  profit: string;
};

/** GET /analytics/finance/summary -- one period's figures. Costs count what was used (batch P&L rules). */
export type CostLine = {
  kind: "CHICKS" | "STOCK" | "EXPENSE" | "DEPRECIATION" | "STOCK_LOSS";
  code: string;
  label: string;
  amount: number;
};
export type FinancePeriod = {
  from: string;
  to: string;
  revenue: number;
  costs: number;
  net_profit: number;
  margin: number | null;
  /** balances at the end of the period */
  cash: number;
  receivables: number;
  payables: number;
  /** what is still owed on loans: their totals (principal + interest) less installments paid */
  loans_owed: number;
  cost_breakdown: CostLine[];
};
export type FinanceSummary = { current: FinancePeriod; previous: FinancePeriod };

/** GET /analytics/finance/monthly */
export type FinanceMonth = {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  cash_in: number;
  cash_out: number;
  cash_end: number;
};

/** GET /analytics/finance/owed */
export type OwedSide = {
  total: number;
  buckets: { d0_30: number; d31_60: number; d60_plus: number };
  count: number;
  top: { id: string; name: string; due: number; oldest: string; records: number }[];
};
export type FinanceOwed = { receivables: OwedSide; payables: OwedSide };

/** GET /analytics/batches/:id/pnl -> .statement, and each row of GET /analytics/batches-pnl. */
export type StatementSection = "CHICKS" | "FEED" | "HEALTH" | "SUPPLIES" | "DIRECT" | "DEPRECIATION";
export type BatchStatement = {
  batch: {
    id: string;
    batch_code: string;
    breed: string;
    status: "RUNNING" | "CLOSED" | "SOLD";
    starting_date: string;
    actual_end_date: string | null;
    age_days: number;
  };
  revenue: { gross: number; discounts: number; other_sales: number; net: number };
  cost_lines: { section: StatementSection; label: string; amount: number }[];
  costs: number;
  /** what the batch earned before its share of farm-wide costs */
  contribution: number;
  shared_costs: { total: number; by_category: { label: string; amount: number }[] };
  net_profit: number;
  margin: number | null;
  birds: { placed: number; died: number; sold: number; live: number; mortality_rate: number };
  kg: { sold: number; produced: number; feed: number | null };
  per_unit: {
    cost_per_bird: number | null;
    cost_per_kg: number | null;
    profit_per_bird: number | null;
    avg_price_per_kg: number | null;
    fcr: number | null;
  };
  money: { received: number; due: number };
};

/** GET /analytics/shared-costs -- farm-wide costs per month and their split by bird-days. */
export type SharedMonth = {
  month: string;
  total: number;
  allocated: number;
  overhead: number;
  bird_days: number;
  batches: { batch_id: string; batch_code: string; bird_days: number; share: number }[];
  expenses: { id: string; date: string; category: string; label: string; amount: number; remarks: string | null }[];
};

/** GET /expenses/summary -- the whole filtered set, not one page. */
export type ExpenseSummary = {
  count: number;
  total: number;
  direct: number;
  shared: number;
  capital: number;
  /** Purchase charges -- money out, but costed through stock (landed cost), not as an expense. */
  stock: number;
  paid: number;
  unpaid: number;
  by_category: { code: string; label: string; amount: number }[];
};

// ── loans ──────────────────────────────────────────────────────────────────────
export const LOAN_PURPOSES = ["BATCH", "FARM", "LOSS", "OLD_DEBT"] as const;
export type LoanPurpose = (typeof LOAN_PURPOSES)[number];
export const LOAN_TERMS = ["EMI", "FLAT", "NONE"] as const;
export type LoanTerms = (typeof LOAN_TERMS)[number];
export const LOAN_FREQUENCIES = ["MONTHLY", "WEEKLY", "ONE_OFF"] as const;
export type LoanFrequency = (typeof LOAN_FREQUENCIES)[number];

export const LOAN_PURPOSE_LABEL: Record<LoanPurpose, string> = {
  BATCH: "Run a batch",
  FARM: "Farm build-out",
  LOSS: "Cover a loss",
  OLD_DEBT: "Old debt",
};
export const LOAN_TERMS_LABEL: Record<LoanTerms, string> = {
  EMI: "Bank EMI",
  FLAT: "Flat total",
  NONE: "No interest",
};

/** GET /loans row: the loan plus where it stands. Money fields are decimal strings. */
export type Loan = {
  id: string;
  lender: string;
  purpose: LoanPurpose;
  batch_id: string | null;
  batch: { batch_code: string } | null;
  principal: string;
  terms: LoanTerms;
  annual_rate: string | null;
  total_payable: string;
  installment_amount: string;
  installment_count: number;
  frequency: LoanFrequency;
  first_due_on: string;
  received_on: string;
  note: string | null;
  created_at: string;
  paid: string;
  left: string;
  interest_total: string;
  interest_booked: string;
  next_due_on: string | null;
};

/** Wage and fee expenses, paid by their payroll payout. */
export const PAYROLL_CATEGORIES = ["SALARY", "FESTIVAL_BONUS", "SALARY_TRANSFER_FEE"];
/** Booked and paid by its loan (Loans tab), never entered by hand. */
export const LOAN_INTEREST = "LOAN_INTEREST";
/** Expenses some other payment settles: never owed, never offered for payment. */
export const settledElsewhere = (category: string) =>
  PAYROLL_CATEGORIES.includes(category) || category === LOAN_INTEREST;
