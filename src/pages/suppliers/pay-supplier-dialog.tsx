import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { useGetData, usePostData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { formatDate, formatTk } from "@/lib/utils";
import { advanceOf, splitOldestFirst, splitProblem, type Split } from "@/pages/suppliers/supplier-split";
import type { SupplierDues } from "@/pages/suppliers/supplier-money-types";
import { useRefreshSupplierMoney } from "@/pages/suppliers/use-refresh-supplier-money";

type Props = { supplierId: string; supplierName: string; open: boolean; onOpenChange: (open: boolean) => void };

export function PaySupplierDialog({ supplierId, supplierName, open, onOpenChange }: Props) {
  const { data: dues, error } = useGetData<SupplierDues>(`/suppliers/${supplierId}/dues`, ["suppliers", supplierId, "dues"], {
    enabled: open,
    staleTime: 0,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pay {supplierName}</DialogTitle>
          <DialogDescription>
            Enter what you hand over. It clears the oldest dues first, and anything left over is kept as an advance.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : dues ? (
          <PayForm supplierId={supplierId} supplierName={supplierName} dues={dues} onDone={() => onOpenChange(false)} />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ supplierId, supplierName, dues, onDone }: { supplierId: string; supplierName: string; dues: SupplierDues; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(farmToday());
  const [account, setAccount] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  // Null until the owner changes a part: then their split stands, whatever amount is typed after.
  const [edited, setEdited] = useState<{ opening: string; bills: Record<string, string> } | null>(null);
  const [tried, setTried] = useState(false);

  const total = Number(amount) || 0;
  const openingLeft = parseFloat(dues.opening_left);
  const bills = dues.bills.map((b) => ({ id: b.id, due: parseFloat(b.due) }));
  const auto = splitOldestFirst(total, openingLeft, bills);
  const split: Split = edited
    ? {
        opening: Number(edited.opening) || 0,
        bills: Object.fromEntries(Object.entries(edited.bills).map(([id, v]) => [id, Number(v) || 0])),
      }
    : auto;
  const advance = advanceOf(total, split);
  const owed = openingLeft + bills.reduce((s, b) => s + b.due, 0);
  const problem =
    total <= 0 ? "Enter the amount paid." : (splitProblem(total, openingLeft, bills, split) ?? (account ? null : "Select the account it was paid from."));

  const shown = (v: number | undefined) => (v ? String(v) : "");
  const startEdit = () => edited ?? { opening: shown(auto.opening), bills: Object.fromEntries(bills.map((b) => [b.id, shown(auto.bills[b.id])])) };
  const editOpening = (v: string) => setEdited({ ...startEdit(), opening: v });
  const editBill = (id: string, v: string) => {
    const base = startEdit();
    setEdited({ ...base, bills: { ...base.bills, [id]: v } });
  };

  const refresh = useRefreshSupplierMoney();
  const pay = usePostData<unknown, Record<string, unknown>>(`/suppliers/${supplierId}/payments`, ["suppliers"]);
  const save = () => {
    setTried(true);
    if (problem) return;
    void pay.mutate(
      {
        amount: total,
        payment_date: date,
        from_instrument_id: account,
        ...(ref.trim() && { transaction_ref: ref.trim() }),
        ...(note.trim() && { note: note.trim() }),
        // Exactly what's on screen: if a due changed meanwhile the server refuses rather than re-splitting.
        split: {
          ...(split.opening > 0 && { opening: split.opening }),
          bills: Object.entries(split.bills)
            .filter(([, v]) => v > 0)
            .map(([purchase_id, v]) => ({ purchase_id, amount: v })),
        },
      },
      {
        onSuccess: () => {
          refresh();
          toast.success(
            advance > 0 ? `${formatTk(total)} paid to ${supplierName}, ${formatTk(advance)} kept as an advance` : `${formatTk(total)} paid to ${supplierName}`
          );
          onDone();
        },
        onError: (error) => toast.error(Object.values(error.fields ?? {})[0] ?? error.message),
      }
    );
  };

  return (
    <form
      className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="sp_amount">Amount (৳)</Label>
            {owed > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setEdited(null);
                  setAmount(String(Math.round(owed * 100) / 100));
                }}
              >
                Pay all {formatTk(owed)}
              </button>
            )}
          </div>
          <NumericInput id="sp_amount" allowDecimal decimalPlaces={2} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sp_date">Date</Label>
          <Input id="sp_date" type="date" required max={farmToday()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {openingLeft > 0 || bills.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">What it pays</span>
            {edited && (
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setEdited(null)}
              >
                Back to oldest first
              </button>
            )}
          </div>
          <ul className="divide-y rounded-lg border text-sm">
            {openingLeft > 0 && (
              <PartRow
                id="opening"
                label="Old balance"
                due={openingLeft}
                value={edited ? edited.opening : shown(auto.opening)}
                onChange={editOpening}
              />
            )}
            {dues.bills.map((b) => (
              <PartRow
                key={b.id}
                id={b.id}
                label={b.invoice_no ? `Bill ${b.invoice_no}` : "Bill"}
                detail={formatDate(b.purchase_date)}
                due={parseFloat(b.due)}
                value={edited ? (edited.bills[b.id] ?? "") : shown(auto.bills[b.id])}
                onChange={(v) => editBill(b.id, v)}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">Nothing is due, so all of this is an advance.</p>
      )}
      {advance > 0 && (
        <p className="text-sm">
          <span className="font-medium tabular-nums">{formatTk(advance)}</span> is kept as an advance, used on their next bills.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sp_account">Paid from</Label>
          <FarmAccountSelect id="sp_account" value={account} onChange={setAccount} invalid={tried && !account} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sp_ref">Transaction ref (optional)</Label>
          <Input id="sp_ref" placeholder="Cheque no., bKash TrxID…" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sp_note">Note (optional)</Label>
        <Input id="sp_note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {tried && problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pay.isPending}>
          {pay.isPending && <Loader2 className="animate-spin" />}
          Pay {total > 0 ? formatTk(total) : "supplier"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PartRow({
  id,
  label,
  detail,
  due,
  value,
  onChange,
}: {
  id: string;
  label: string;
  detail?: string;
  due: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <label htmlFor={`part-${id}`} className="min-w-0">
        <span className="block truncate">{label}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {detail ? `${detail}, ` : ""}
          {formatTk(due)} due
        </span>
      </label>
      <NumericInput
        id={`part-${id}`}
        className="w-32 text-right"
        allowDecimal
        decimalPlaces={2}
        allowZero
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </li>
  );
}
