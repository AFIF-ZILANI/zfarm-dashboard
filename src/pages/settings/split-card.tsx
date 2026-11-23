import { useState } from "react";
import { PieChart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/utils/NumaricInput";
import { useGetData, usePatchData } from "@/lib/api";
import { pctProblem } from "@/pages/finance/profit-split-math";
import { useRefreshSplit } from "@/pages/finance/use-refresh-split";

type Split = { split_reinvest: number; split_reserve: number; split_owner: number; split_tax: number };
const FIELDS: { key: keyof Split; label: string }[] = [
  { key: "split_reinvest", label: "Reinvestment (%)" },
  { key: "split_reserve", label: "Reserve (%)" },
  { key: "split_owner", label: "Owner (%)" },
  { key: "split_tax", label: "Tax, inside the reserve (%)" },
];
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

/** How a closed batch's profit is shared. One batch can still be split differently when it is decided. */
export function SplitCard() {
  const { data } = useGetData<Split>("/farm-settings", ["farm-settings"]);
  const [draft, setDraft] = useState<Record<keyof Split, string> | null>(null);
  const refresh = useRefreshSplit();
  const save = usePatchData<Split, Split>("/farm-settings", ["farm-settings"]);
  if (!data) return null;

  const saved = Object.fromEntries(FIELDS.map(({ key }) => [key, String(data[key])])) as Record<keyof Split, string>;
  const value = draft ?? saved;
  const split = Object.fromEntries(FIELDS.map(({ key }) => [key, num(value[key])])) as Split;
  const problem = pctProblem({ reinvest: split.split_reinvest, reserve: split.split_reserve, owner: split.split_owner, tax: split.split_tax });
  const changed = FIELDS.some(({ key }) => split[key] !== data[key]);

  const onSave = () =>
    save.mutate(split, {
      onSuccess: () => {
        refresh();
        toast.success("Profit split saved");
        setDraft(null);
      },
      onError: (error) => toast.error(Object.values(error.fields ?? {})[0] ?? error.message),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="size-4" />
          Profit split
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          How a closed batch's profit is shared. Changing it doesn't touch batches already split, and one batch can be split differently when you
          decide it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <NumericInput
                id={key}
                allowDecimal
                decimalPlaces={2}
                allowZero
                value={value[key]}
                onChange={(e) => setDraft({ ...value, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        {problem && changed && <p className="text-xs text-destructive">{problem}</p>}
        <Button className="w-fit" onClick={onSave} disabled={!!problem || !changed || save.isPending}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
