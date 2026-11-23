import { NumericInput } from "@/components/utils/NumaricInput";
import { formatDate, formatTk } from "@/lib/utils";
import type { SupplierDues } from "@/pages/suppliers/supplier-money-types";
import type { useSplit } from "@/pages/suppliers/use-split";

/** What an amount pays: the old balance and each open bill, with the part it takes. */
export function SplitFields({ dues, split }: { dues: SupplierDues; split: ReturnType<typeof useSplit> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">What it pays</span>
        {split.isEdited && (
          <button type="button" className="text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={split.reset}>
            Back to oldest first
          </button>
        )}
      </div>
      <ul className="divide-y rounded-lg border text-sm">
        {split.openingLeft > 0 && (
          <PartRow id="opening" label="Old balance" due={split.openingLeft} value={split.openingValue} onChange={split.editOpening} />
        )}
        {dues.bills.map((b) => (
          <PartRow
            key={b.id}
            id={b.id}
            label={b.invoice_no ? `Bill ${b.invoice_no}` : "Bill"}
            detail={formatDate(b.purchase_date)}
            due={parseFloat(b.due)}
            value={split.billValue(b.id)}
            onChange={(v) => split.editBill(b.id, v)}
          />
        ))}
      </ul>
    </div>
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
