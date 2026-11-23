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
import { moveWarning } from "@/pages/finance/profit-split-math";
import { useRefreshSplit } from "@/pages/finance/use-refresh-split";
import type { SplitMove } from "@/pages/payments/types";

export type MoveAsk = { move: SplitMove; left: number; account: string };

const TITLE: Record<SplitMove, string> = {
  TO_REINVEST: "Move money to reinvestment",
  TO_RESERVE: "Move money to the reserve",
  FROM_RESERVE: "Bring money back from the reserve",
};

/** Records money already moved at the bank between Operating and a fund. */
export function MoveMoneyDialog({ ask, spendable, onClose }: { ask: MoveAsk | null; spendable: number; onClose: () => void }) {
  return (
    <Dialog open={!!ask} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{ask && <MoveForm key={ask.move} ask={ask} spendable={spendable} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function MoveForm({ ask, spendable, onClose }: { ask: MoveAsk; spendable: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(ask.left));
  const [date, setDate] = useState(farmToday());
  const [account, setAccount] = useState("");
  const [ref, setRef] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const back = ask.move === "FROM_RESERVE";
  const value = Number(amount) || 0;
  const warning = back ? null : moveWarning(value, spendable);
  const refresh = useRefreshSplit();
  const post = usePostData<unknown, Record<string, unknown>>("/profit-splits/moves", ["profit-splits"]);

  const save = () => {
    if (value <= 0) return setProblem("Enter the amount moved.");
    if (value > ask.left) return setProblem(`Only ${formatTk(ask.left)} is left to move.`);
    if (!account) return setProblem(back ? "Select the account it came into." : "Select the account it left.");
    setProblem(null);
    void post.mutate(
      { move: ask.move, amount: value, payment_date: date, operating_instrument_id: account, ...(ref.trim() && { transaction_ref: ref.trim() }) },
      {
        onSuccess: () => {
          refresh();
          toast.success(`${formatTk(value)} moved ${back ? "back from" : "to"} ${ask.account}`);
          onClose();
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
      <DialogHeader>
        <DialogTitle>{TITLE[ask.move]}</DialogTitle>
        <DialogDescription>
          {back
            ? `The reserve holds ${formatTk(ask.left)} more than its share. Record what came back from ${ask.account}.`
            : `${formatTk(ask.left)} is set aside and not moved yet. Record what you moved to ${ask.account}.`}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mv_amount">Amount (৳)</Label>
          <NumericInput id="mv_amount" allowDecimal decimalPlaces={2} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mv_date">Date</Label>
          <Input id="mv_date" type="date" required max={farmToday()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mv_account">{back ? "Into" : "From"}</Label>
          <FarmAccountSelect id="mv_account" fund="OPERATING" value={account} onChange={setAccount} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mv_ref">Transaction ref (optional)</Label>
          <Input id="mv_ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
      </div>
      {warning && <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{warning}</p>}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={post.isPending}>
          {post.isPending && <Loader2 className="animate-spin" />}
          Record {value > 0 ? formatTk(value) : "move"}
        </Button>
      </DialogFooter>
    </form>
  );
}
