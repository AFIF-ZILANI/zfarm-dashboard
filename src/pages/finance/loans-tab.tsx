import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { CalendarClock, HandCoins, Landmark, Percent, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useDelete, useGetData } from "@/lib/api";
import { formatDate, formatTk } from "@/lib/utils";
import { LOAN_PURPOSE_LABEL, LOAN_TERMS_LABEL, type Loan } from "@/pages/finance/types";
import type { Payment } from "@/pages/payments/types";
import { PayInstallmentDialog, RecordLoanDialog } from "@/pages/finance/loan-forms";

const open = (l: Loan) => parseFloat(l.left) > 0.005;

/**
 * Money the farm owes. Principal is not a cost; interest is, and lands in Expenses as "Loan interest":
 * on its batch for a batch loan, shared across running batches for the rest.
 */
export function LoansTab() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("loan");

  const { data, isLoading, isError } = useGetData<Loan[]>("/loans", ["loans"]);
  const loans = data ?? [];
  const openLoans = loans.filter(open);
  const owed = openLoans.reduce((s, l) => s + parseFloat(l.left), 0);
  const interestBooked = loans.reduce((s, l) => s + parseFloat(l.interest_booked), 0);
  const nextDue = openLoans
    .map((l) => l.next_due_on)
    .filter((d): d is string => !!d)
    .sort()[0];

  const select = (id: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("loan", id);
      else next.delete("loan");
      return next;
    });

  const columns: Column<Loan>[] = [
    { key: "lender", header: "Lender", render: (l) => <span className="font-medium">{l.lender}</span>, sortValue: (l) => l.lender },
    {
      key: "purpose",
      header: "Purpose",
      render: (l) => (l.purpose === "BATCH" ? `Batch ${l.batch?.batch_code ?? ""}` : LOAN_PURPOSE_LABEL[l.purpose]),
    },
    { key: "terms", header: "Interest", render: (l) => (l.terms === "EMI" ? `EMI ${Number(l.annual_rate)}%` : LOAN_TERMS_LABEL[l.terms]) },
    { key: "total", header: "To repay", render: (l) => formatTk(l.total_payable), numeric: true, sortValue: (l) => parseFloat(l.total_payable) },
    { key: "paid", header: "Paid", render: (l) => formatTk(l.paid), numeric: true, sortValue: (l) => parseFloat(l.paid) },
    { key: "left", header: "Left", render: (l) => formatTk(l.left), numeric: true, sortValue: (l) => parseFloat(l.left) },
    {
      key: "next",
      header: "Next due",
      render: (l) => (open(l) ? (l.next_due_on ? formatDate(l.next_due_on) : "—") : <StatusBadge tone="success" label="Repaid" />),
      sortValue: (l) => l.next_due_on ?? "9999",
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (l) =>
        open(l) && (
          <Button
            size="sm"
            variant="outline"
            onClick={(ev) => {
              ev.stopPropagation();
              setPaying(l);
            }}
          >
            Pay
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Loans owed" money={owed} icon={Landmark} isLoading={isLoading} isError={isError} />
        <KPICard label="Open loans" value={openLoans.length} icon={HandCoins} isLoading={isLoading} isError={isError} />
        <KPICard
          label="Interest so far"
          money={interestBooked}
          icon={Percent}
          isLoading={isLoading}
          isError={isError}
          hint="Counted as a cost. The amount borrowed never is."
        />
        <KPICard label="Next due" value={nextDue ? formatDate(nextDue) : "—"} icon={CalendarClock} isLoading={isLoading} isError={isError} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setRecordOpen(true)}>
          <Plus />
          Record loan
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={loans}
        rowKey={(l) => l.id}
        isLoading={isLoading}
        onRowClick={(l) => select(l.id)}
        empty={{
          icon: Landmark,
          title: "No loans recorded",
          description: "Record money borrowed, or a debt owed from before FMS, and pay it off installment by installment.",
          action: { label: "Record loan", onClick: () => setRecordOpen(true) },
        }}
      />

      <RecordLoanDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <PayInstallmentDialog loan={paying} onOpenChange={(o) => !o && setPaying(null)} />
      <LoanDetailDialog id={selectedId} onClose={() => select(null)} onPay={setPaying} />
    </div>
  );
}

type LoanDetail = Loan & { payments: (Payment & { interest: string | null })[] };

function LoanDetailDialog({ id, onClose, onPay }: { id: string | null; onClose: () => void; onPay: (l: Loan) => void }) {
  const { data: loan, error } = useGetData<LoanDetail>(`/loans/${id}`, ["loans", id], { enabled: !!id });
  const { confirm, confirmDialog } = useConfirm();
  const remove = useDelete<null, string>((loanId) => `/loans/${loanId}`, ["loans"]);
  const queryClient = useQueryClient();
  const installments = (loan?.payments ?? []).filter((p) => p.direction === "OUTGOING");
  const receipt = (loan?.payments ?? []).find((p) => p.direction === "INCOMING");

  const removeLoan = async (l: LoanDetail) => {
    const ok = await confirm({
      title: "Remove this loan?",
      description:
        "For a loan entered by mistake. The money received and any interest booked are taken out too, and a copy is kept in the Audit Log. Not possible once an installment is paid.",
      confirmLabel: "Remove loan",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(l.id, {
      onSuccess: () => {
        // Its receipt and any interest went with it: balances, cash book, expenses and figures all changed.
        for (const key of ["payments", "payment-instruments", "expenses", "analytics"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
        toast.success("Loan removed");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const fact = (label: string, value: string) => (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {error ? (
          <DialogHeader>
            <DialogTitle>Loan not found</DialogTitle>
            <DialogDescription>{error.message}</DialogDescription>
          </DialogHeader>
        ) : !loan ? (
          <>
            <DialogTitle className="sr-only">Loan</DialogTitle>
            <Skeleton className="h-60 w-full" />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{loan.lender}</DialogTitle>
              <DialogDescription>
                {loan.purpose === "BATCH" ? `Batch ${loan.batch?.batch_code}` : LOAN_PURPOSE_LABEL[loan.purpose]}
                {" · "}
                {loan.terms === "EMI" ? `EMI at ${Number(loan.annual_rate)}% a year` : LOAN_TERMS_LABEL[loan.terms]}
                {loan.note ? ` · ${loan.note}` : ""}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {fact(loan.purpose === "OLD_DEBT" ? "Owed at start" : "Borrowed", formatTk(loan.principal))}
              {fact("Interest", formatTk(loan.interest_total))}
              {fact("To repay", formatTk(loan.total_payable))}
              {fact("Installment", `${formatTk(loan.installment_amount)} × ${loan.installment_count}`)}
              {fact("Paid", formatTk(loan.paid))}
              {fact("Left", formatTk(loan.left))}
            </dl>
            <p className="text-xs text-muted-foreground">
              {receipt ? `Received ${formatDate(receipt.payment_date)}. ` : ""}
              {loan.purpose === "BATCH"
                ? `All ${formatTk(loan.interest_total)} of interest is a cost of batch ${loan.batch?.batch_code}.`
                : `${formatTk(loan.interest_booked)} of interest counted as a farm-wide cost so far.`}
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Installments</span>
              {installments.length === 0 ? (
                <p className="text-sm text-muted-foreground">None paid yet. First due {formatDate(loan.first_due_on)}.</p>
              ) : (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm">
                  {installments.map((p) => {
                    const interest = p.interest;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="tabular-nums">{formatDate(p.payment_date)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {interest ? `${formatTk(interest)} interest` : ""}
                        </span>
                        <span className="font-medium tabular-nums">{formatTk(p.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              {installments.length === 0 ? (
                <Button variant="ghost" className="text-destructive" onClick={() => void removeLoan(loan)} disabled={remove.isPending}>
                  Remove loan
                </Button>
              ) : (
                <span />
              )}
              {open(loan) && <Button onClick={() => onPay(loan)}>Pay installment</Button>}
            </DialogFooter>
          </>
        )}
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}
