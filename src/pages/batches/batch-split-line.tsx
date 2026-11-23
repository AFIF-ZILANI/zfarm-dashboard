import { Link } from "react-router";
import { useGetData } from "@/lib/api";
import { formatDate, formatTk } from "@/lib/utils";
import type { ProfitSplitOverview } from "@/pages/finance/types";

/** A closed batch's decision in one line, or that it still waits for one. */
export function BatchSplitLine({ batchId }: { batchId: string }) {
  const { data } = useGetData<ProfitSplitOverview>("/profit-splits", ["profit-splits"]);
  const done = data?.done.find((d) => d.batch_id === batchId);
  const waiting = data?.waiting.some((w) => w.batch_id === batchId);
  if (!done && !waiting) return null;
  const profit = done ? Math.abs(parseFloat(done.net_profit)) : 0;
  return (
    <p className="text-sm text-muted-foreground">
      {!done
        ? "Waiting for a profit split. "
        : done.kind === "PROFIT"
          ? `Profit of ${formatTk(profit)} split on ${formatDate(done.approved_at)}. `
          : done.kind === "LOSS"
            ? `Loss of ${formatTk(profit)} settled on ${formatDate(done.approved_at)}: ${formatTk(done.loss_covered)} paid by the reserve. `
            : `Left out of the profit split on ${formatDate(done.approved_at)}. `}
      <Link to="/finance?tab=split" className="font-medium text-primary underline-offset-4 hover:underline">
        Profit split
      </Link>
    </p>
  );
}
