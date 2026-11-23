import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { usePostData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { formatTk } from "@/lib/utils";
import { useRefreshSupplierMoney } from "@/pages/suppliers/use-refresh-supplier-money";

type Props = { supplierId: string; supplierName: string; advance: number; open: boolean; onOpenChange: (open: boolean) => void };

/** Money a supplier gives back out of the advance they hold. */
export function SupplierRefundDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund from {props.supplierName}</DialogTitle>
          <DialogDescription>They hold an advance of {formatTk(props.advance)}. Record what they gave back.</DialogDescription>
        </DialogHeader>
        {props.open && <RefundForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function RefundForm({ supplierId, supplierName, advance, onOpenChange }: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(farmToday());
  const [account, setAccount] = useState("");
  const [ref, setRef] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const refresh = useRefreshSupplierMoney();
  const refund = usePostData<unknown, Record<string, unknown>>(`/suppliers/${supplierId}/refunds`, ["suppliers"]);
  const value = Number(amount) || 0;

  const save = () => {
    if (value <= 0) return setProblem("Enter the amount given back.");
    if (value > advance) return setProblem(`They hold an advance of ${formatTk(advance)}.`);
    if (!account) return setProblem("Select the account it came into.");
    setProblem(null);
    void refund.mutate(
      { amount: value, payment_date: date, to_instrument_id: account, ...(ref.trim() && { transaction_ref: ref.trim() }) },
      {
        onSuccess: () => {
          refresh();
          toast.success(`${formatTk(value)} refunded by ${supplierName}`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(Object.values(error.fields ?? {})[0] ?? error.message),
      }
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rf_amount">Amount (৳)</Label>
          <NumericInput id="rf_amount" allowDecimal decimalPlaces={2} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rf_date">Date</Label>
          <Input id="rf_date" type="date" required max={farmToday()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rf_account">Received into</Label>
          <FarmAccountSelect id="rf_account" value={account} onChange={setAccount} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rf_ref">Transaction ref (optional)</Label>
          <Input id="rf_ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={refund.isPending}>
          {refund.isPending && <Loader2 className="animate-spin" />}
          Record refund
        </Button>
      </DialogFooter>
    </form>
  );
}
