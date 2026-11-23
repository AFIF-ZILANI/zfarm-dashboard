import { Link } from "react-router";
import { useGetData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { formatDate, formatTk } from "@/lib/utils";
import type { BatchSplit } from "@/pages/finance/types";

/** A closed batch's decision in one line, or that it still waits for one. */
export function BatchSplitLine({ batchId }: { batchId: string }) {
  const { data: done, isSuccess } = useGetData<BatchSplit | null>(`/profit-splits/batch/${batchId}`, ["profit-splits", "batch", batchId]);
  if (!isSuccess) return null;
  const on = done ? formatDate(farmToday(new Date(done.approved_at))) : "";
  const profit = done ? Math.abs(parseFloat(done.net_profit)) : 0;
  return (
    <p className="text-sm text-muted-foreground">
      {!done
        ? "Waiting for a profit split. "
        : done.kind === "PROFIT"
          ? `Profit of ${formatTk(profit)} split on ${on}. `
          : done.kind === "LOSS"
            ? `Loss of ${formatTk(profit)} settled on ${on}: ${formatTk(done.loss_covered)} paid by the reserve. `
            : `Left out of the profit split on ${on}. `}
      <Link to="/finance?tab=split" className="font-medium text-primary underline-offset-4 hover:underline">
        Profit split
      </Link>
    </p>
  );
}
