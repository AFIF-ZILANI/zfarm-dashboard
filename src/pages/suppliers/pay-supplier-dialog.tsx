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
import { formatTk } from "@/lib/utils";
import { SplitFields } from "@/pages/suppliers/split-fields";
import type { SupplierDues } from "@/pages/suppliers/supplier-money-types";
import { useSplit } from "@/pages/suppliers/use-split";
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
  const [tried, setTried] = useState(false);

  const total = Number(amount) || 0;
  const split = useSplit(total, dues);
  const { owed, left: advance } = split;
  const problem = total <= 0 ? "Enter the amount paid." : (split.problem ?? (account ? null : "Select the account it was paid from."));

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
        split: split.body,
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
                  split.reset();
                  setAmount(String(owed));
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

      {owed > 0 ? (
        <SplitFields dues={dues} split={split} />
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
