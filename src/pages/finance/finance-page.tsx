import { SectionPage } from "@/components/layout/section-page";
import { OverviewTab } from "@/pages/finance/overview-tab";
import { ExpensesTab } from "@/pages/finance/expenses-tab";
import { DepreciationTab } from "@/pages/finance/depreciation-tab";
import { BatchPnlTab } from "@/pages/finance/batch-pnl-tab";
import { SharedCostsTab } from "@/pages/finance/shared-costs-tab";
import { LoansTab } from "@/pages/finance/loans-tab";
import { ProfitSplitTab } from "@/pages/finance/profit-split-tab";
import { PaymentsTab } from "@/pages/payments/payments-tab";
import { InstrumentsTab } from "@/pages/payments/instruments-tab";

// The bird-days formula itself stays v2 (system-design-arc.md §7) — see SharedCostsTab for the visibility-only queue.
export function FinancePage() {
  return (
    <SectionPage
      title="Finance"
      sections={[
        { id: "overview", label: "Overview", content: <OverviewTab /> },
        // Every taka in and out, and the accounts it moves through (was the Payments page).
        { id: "cash-book", label: "Cash book", content: <PaymentsTab /> },
        { id: "accounts", label: "Farm accounts", content: <InstrumentsTab /> },
        { id: "loans", label: "Loans", content: <LoansTab /> },
        { id: "split", label: "Profit split", content: <ProfitSplitTab /> },
        { id: "expenses", label: "Expenses", content: <ExpensesTab /> },
        { id: "depreciation", label: "Depreciation", content: <DepreciationTab /> },
        { id: "shared-costs", label: "Shared costs", content: <SharedCostsTab /> },
        { id: "pnl", label: "Batch P&L", content: <BatchPnlTab /> },
      ]}
    />
  );
}
