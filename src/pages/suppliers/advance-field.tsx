import { Checkbox } from "@/components/ui/checkbox";
import { formatTk } from "@/lib/utils";

/** "Use advance" on a new bill. Nothing to show unless the supplier holds one. */
export function AdvanceField({
  held,
  used,
  checked,
  onChange,
}: {
  held: number;
  /** What this bill would take of it. */
  used: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (held <= 0) return null;
  return (
    <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>
        <span className="block font-medium">Use advance{used > 0 ? ` ${formatTk(used)}` : ""}</span>
        <span className="block text-xs text-muted-foreground">
          This supplier holds {formatTk(held)} you paid ahead.
          {used > 0 && used < held ? ` ${formatTk(Math.round((held - used) * 100) / 100)} stays with them.` : ""}
        </span>
      </span>
    </label>
  );
}
