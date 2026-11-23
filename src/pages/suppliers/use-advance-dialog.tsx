import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetData, usePostData } from "@/lib/api";
import { formatTk } from "@/lib/utils";
import { SplitFields } from "@/pages/suppliers/split-fields";
import type { SupplierDues } from "@/pages/suppliers/supplier-money-types";
import { useRefreshSupplierMoney } from "@/pages/suppliers/use-refresh-supplier-money";
import { useSplit } from "@/pages/suppliers/use-split";

type Props = { supplierId: string; supplierName: string; open: boolean; onOpenChange: (open: boolean) => void };

/** Settles what's already due from the advance a supplier holds. No money changes hands. */
export function UseAdvanceDialog({ supplierId, supplierName, open, onOpenChange }: Props) {
  const { data: dues, error } = useGetData<SupplierDues>(`/suppliers/${supplierId}/dues`, ["suppliers", supplierId, "dues"], {
    enabled: open,
    staleTime: 0,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Use advance with {supplierName}</DialogTitle>
          <DialogDescription>
            Money you already paid ahead clears what you owe them now. Nothing leaves your accounts.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : dues ? (
          <UseAdvanceForm supplierId={supplierId} dues={dues} onDone={() => onOpenChange(false)} />
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UseAdvanceForm({ supplierId, dues, onDone }: { supplierId: string; dues: SupplierDues; onDone: () => void }) {
  const held = parseFloat(dues.advance);
  const split = useSplit(held, dues);
  const [tried, setTried] = useState(false);
  const used = Math.round((held - split.left) * 100) / 100;
  const problem = split.problem ?? (used > 0 ? null : "Enter how much to use on at least one due.");

  const refresh = useRefreshSupplierMoney();
  const use = usePostData<unknown, Record<string, unknown>>(`/suppliers/${supplierId}/use-advance`, ["suppliers"]);
  const save = () => {
    setTried(true);
    if (problem) return;
    void use.mutate(
      { split: split.body },
      {
        onSuccess: () => {
          refresh();
          toast.success(`${formatTk(used)} of the advance used`);
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
      <p className="text-sm">
        They hold <span className="font-medium tabular-nums">{formatTk(held)}</span>.
        {split.left > 0 && (
          <>
            {" "}
            <span className="font-medium tabular-nums">{formatTk(split.left)}</span> stays with them.
          </>
        )}
      </p>
      <SplitFields dues={dues} split={split} />
      {tried && problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={use.isPending}>
          {use.isPending && <Loader2 className="animate-spin" />}
          Use {used > 0 ? formatTk(used) : "advance"}
        </Button>
      </DialogFooter>
    </form>
  );
}
