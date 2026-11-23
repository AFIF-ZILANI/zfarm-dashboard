import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostData } from "@/lib/api";
import { formatDate, formatTk } from "@/lib/utils";
import type { StatementLine } from "@/pages/suppliers/supplier-money-types";
import { useRefreshSupplierMoney } from "@/pages/suppliers/use-refresh-supplier-money";

/** One payment or refund: what it settled, and a way to take it out if it was a mistake. */
export function PaymentDetailDialog({ supplierId, line, onClose }: { supplierId: string; line: StatementLine | null; onClose: () => void }) {
  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{line && <Detail supplierId={supplierId} line={line} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Detail({ supplierId, line, onClose }: { supplierId: string; line: StatementLine; onClose: () => void }) {
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const refresh = useRefreshSupplierMoney();
  const paymentId = line.supplier_payment_id;
  const remove = usePostData<unknown, Record<string, unknown>>(`/suppliers/${supplierId}/payments/${paymentId}/remove`, ["suppliers"]);
  const amount = line.paid ?? line.adds ?? "0";
  const refund = line.kind === "REFUND";

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {refund ? "Refund of" : "Paid"} {formatTk(amount)}
        </DialogTitle>
        <DialogDescription>
          {formatDate(line.date)}
          {line.account ? `, ${refund ? "into" : "from"} ${line.account}` : ""}
          {line.transaction_ref ? `, ref ${line.transaction_ref}` : ""}
          {line.note ? `. ${line.note}` : ""}
        </DialogDescription>
      </DialogHeader>
      {line.settled.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {line.settled.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{s.label}</span>
              <span className="font-medium tabular-nums">{formatTk(s.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rm_reason">Why is it removed?</Label>
          <Input id="rm_reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {refund ? "The advance comes back." : "What it paid becomes due again."} A copy is kept in the Audit Log.
          </p>
        </div>
      )}
      <DialogFooter className="sm:justify-between">
        {!paymentId ? (
          <p className="text-xs text-muted-foreground">Recorded on the bill itself, so it can't be removed on its own.</p>
        ) : removing ? (
          <Button
            variant="destructive"
            disabled={remove.isPending || reason.trim().length < 3}
            onClick={() =>
              void remove.mutate(
                { reason: reason.trim() },
                {
                  onSuccess: () => {
                    refresh();
                    toast.success(refund ? "Refund removed" : "Payment removed");
                    onClose();
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            {remove.isPending && <Loader2 className="animate-spin" />}
            Remove {refund ? "refund" : "payment"}
          </Button>
        ) : (
          <Button variant="ghost" className="text-destructive" onClick={() => setRemoving(true)}>
            Entered by mistake
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
