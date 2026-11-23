import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/utils/NumaricInput";
import { usePostData } from "@/lib/api";
import { formatTk } from "@/lib/utils";
import { pctProblem, settleLoss, splitProfit, type Pct } from "@/pages/finance/profit-split-math";
import type { ProfitSplitOverview, SplitWaiting } from "@/pages/finance/types";
import { useRefreshSplit } from "@/pages/finance/use-refresh-split";

type Props = { batch: SplitWaiting | null; overview: ProfitSplitOverview; onClose: () => void };

/** Split a closed batch's profit, or settle its loss. The profit shown is the one approved: if it has changed, the server refuses. */
export function SplitDecisionDialog({ batch, overview, onClose }: Props) {
  return (
    <Dialog open={!!batch} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {batch && <Decision key={batch.batch_id} batch={batch} overview={overview} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Decision({ batch, overview, onClose }: { batch: SplitWaiting; overview: ProfitSplitOverview; onClose: () => void }) {
  const d = overview.defaults;
  const [text, setText] = useState({
    reinvest: String(d.split_reinvest),
    reserve: String(d.split_reserve),
    owner: String(d.split_owner),
    tax: String(d.split_tax),
  });
  const pct: Pct = { reinvest: num(text.reinvest), reserve: num(text.reserve), owner: num(text.owner), tax: num(text.tax) };
  const profit = parseFloat(batch.net_profit);
  const isLoss = profit < 0;
  const problem = isLoss ? null : pctProblem(pct);
  const s = splitProfit(Math.max(0, profit), parseFloat(overview.carried_loss), parseFloat(overview.principal_waiting), pct);
  const loss = settleLoss(Math.max(0, -profit), parseFloat(overview.reserve.available));
  const outside = parseFloat(overview.not_in_batches.total);

  const refresh = useRefreshSplit();
  const decide = usePostData<unknown, Record<string, unknown>>("/profit-splits", ["profit-splits"]);
  const save = () => {
    if (problem) return;
    void decide.mutate(
      { batch_id: batch.batch_id, expected_profit: profit, ...(!isLoss && { pct }) },
      {
        onSuccess: () => {
          refresh();
          toast.success(isLoss ? `Loss of batch ${batch.batch_code} settled` : `Batch ${batch.batch_code} split`);
          onClose();
        },
        onError: (error) => {
          refresh(); // most likely the profit changed: show the new one
          toast.error(Object.values(error.fields ?? {})[0] ?? error.message);
        },
      }
    );
  };

  const field = (key: keyof Pct, label: string, amount: number, note?: string) => (
    <div className="grid grid-cols-[1fr_6rem_8rem] items-center gap-3 px-3 py-2">
      <Label htmlFor={`pct_${key}`} className="block">
        <span className="block text-sm">{label} (%)</span>
        {note && <span className="block text-xs font-normal text-muted-foreground">{note}</span>}
      </Label>
      <NumericInput
        id={`pct_${key}`}
        className="text-right"
        allowDecimal
        decimalPlaces={2}
        allowZero
        value={text[key]}
        onChange={(e) => setText({ ...text, [key]: e.target.value })}
        aria-label={`${label}, percent`}
      />
      <span className="text-right font-medium tabular-nums">{problem ? "—" : formatTk(amount)}</span>
    </div>
  );

  return (
    <form
      className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {isLoss ? "Settle the loss of" : "Split the profit of"} batch {batch.batch_code}
        </DialogTitle>
        <DialogDescription>
          {isLoss
            ? "The reserve pays first, never with the tax money. What it can't pay comes out of the next profit."
            : "This sets the money aside. You move it at the bank, then record it here."}
        </DialogDescription>
      </DialogHeader>

      <dl className="divide-y rounded-lg border text-sm">
        <Row label={isLoss ? "Loss" : "Profit"} value={formatTk(Math.abs(profit))} strong />
        {isLoss ? (
          <>
            <Row label="Reserve pays" value={formatTk(loss.covered)} />
            <Row label="Carried to the next profit" value={formatTk(loss.carried)} strong />
          </>
        ) : (
          <>
            {s.recovered > 0 && <Row label="Recovers earlier losses" value={`−${formatTk(s.recovered)}`} />}
            <Row label="To share" value={formatTk(s.base)} strong />
          </>
        )}
      </dl>

      {!isLoss && (
        <>
          <div className="divide-y rounded-lg border">
            {field("reinvest", "Reinvestment", s.reinvest, s.principalTaken > 0 && !problem ? `${formatTk(s.principalTaken)} stays in Operating for loans and old debts already paid` : undefined)}
            {field("reserve", "Reserve", s.reserve)}
            {field("owner", "Owner", s.owner)}
            {field("tax", "Tax, inside the reserve", s.tax, "Kept for tax, never used for a loss")}
          </div>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
        </>
      )}

      {outside > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatTk(outside)} of costs no batch carries{overview.not_in_batches.since ? " since the last decision" : " so far"} (shared costs in
          months with no birds, stock written off, capital spending) isn't taken off this profit.
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={decide.isPending || !!problem}>
          {decide.isPending && <Loader2 className="animate-spin" />}
          {isLoss ? "Settle loss" : "Split profit"}
        </Button>
      </DialogFooter>
    </form>
  );
}

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}
