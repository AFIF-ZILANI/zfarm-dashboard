import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/utils/NumaricInput";
import { usePatchData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import type { Supplier } from "@/pages/suppliers/types";
import { useRefreshSupplierMoney } from "@/pages/suppliers/use-refresh-supplier-money";

type Props = { supplier: Supplier; open: boolean; onOpenChange: (open: boolean) => void };

/** What the farm owed this supplier before FMS, whose bills were never entered. */
export function OpeningDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Old balance</DialogTitle>
          <DialogDescription>
            What you owed {props.supplier.profile.name} before FMS, for bills not entered here. It adds no stock and no cost.
          </DialogDescription>
        </DialogHeader>
        {props.open && <OpeningForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function OpeningForm({ supplier, onOpenChange }: Props) {
  const [amount, setAmount] = useState(Number(supplier.opening_due) > 0 ? String(Number(supplier.opening_due)) : "");
  const [date, setDate] = useState(supplier.opening_date?.slice(0, 10) ?? farmToday());
  const [note, setNote] = useState(supplier.opening_note ?? "");
  const refresh = useRefreshSupplierMoney();
  const save = usePatchData<unknown, Record<string, unknown>>(`/suppliers/${supplier.id}/opening`, ["suppliers"]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save.mutate(
          { opening_due: Number(amount) || 0, opening_date: date, ...(note.trim() && { opening_note: note.trim() }) },
          {
            onSuccess: () => {
              refresh();
              toast.success("Old balance saved");
              onOpenChange(false);
            },
            onError: (error) => toast.error(Object.values(error.fields ?? {})[0] ?? error.message),
          }
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob_amount">Amount owed (৳)</Label>
          <NumericInput id="ob_amount" allowDecimal decimalPlaces={2} allowZero value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob_date">As of</Label>
          <Input id="ob_date" type="date" required max={farmToday()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob_note">Note (optional)</Label>
        <Input id="ob_note" placeholder="Page in the old khata, what it was for" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save old balance
        </Button>
      </DialogFooter>
    </form>
  );
}
