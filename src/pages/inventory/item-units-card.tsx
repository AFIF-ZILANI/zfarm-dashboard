import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/utils/NumaricInput";
import {
  CUSTOM,
  EMPTY_STAGED,
  addableUnits,
  draftProblem,
  isCustom,
  withStaged,
  type UnitDraft,
} from "@/pages/inventory/item-units";
import type { UnitRow } from "@/pages/inventory/types";

const PICKER_ID = "add-unit";

type ItemUnitsCardProps = {
  baseUnit: string;
  units: UnitRow[];
  unitLabel: (code: string) => string;
  /** codes already saved on the item */
  original: string[];
  rows: UnitDraft[];
  onRowsChange: (rows: UnitDraft[]) => void;
  staged: UnitDraft;
  onStagedChange: (staged: UnitDraft) => void;
  stagedError: string | null;
  onStagedError: (error: string | null) => void;
};

export function ItemUnitsCard({
  baseUnit,
  units,
  unitLabel,
  original,
  rows,
  onRowsChange,
  staged,
  onStagedChange,
  stagedError,
  onStagedError,
}: ItemUnitsCardProps) {
  // Names the size box "1 Small Bag =" while it's typed; a custom unit has no name until then.
  const baseLabel = baseUnit ? unitLabel(baseUnit) : "";
  const custom = staged.code === CUSTOM;
  const stagedName = custom ? staged.name.trim() || "unit" : staged.code ? unitLabel(staged.code) : "";
  const fixedFactor = (code: string) => units.find((u) => u.code === code)?.fixed_factor ?? null;
  const options = addableUnits(units, baseUnit, rows);
  const [removed, setRemoved] = useState("");

  const stage = (patch: Partial<UnitDraft>) => {
    onStagedError(null);
    onStagedChange({ ...staged, ...patch });
  };
  const clearStaged = () => {
    onStagedError(null);
    onStagedChange(EMPTY_STAGED);
    document.getElementById(PICKER_ID)?.focus();
  };
  const add = () => {
    const result = withStaged(rows, staged, baseUnit, units);
    if ("error" in result) {
      onStagedError(result.error);
      return;
    }
    onRowsChange(result.rows);
    clearStaged();
  };
  const change = (code: string, patch: Partial<UnitDraft>) =>
    onRowsChange(rows.map((r) => (r.code === code ? { ...r, ...patch } : r)));

  // Enter in a box here must not save the whole item; in the add row it adds the unit. Captured, because the
  // checkbox submits the form from its own key handler.
  const stopEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter" || e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    if (!(e.target instanceof HTMLInputElement)) e.stopPropagation();
  };
  const enterAdds = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) add();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Unit conversions</CardTitle>
        <p className="text-xs text-muted-foreground">
          The other units this item is bought or used in, and how much one of each holds. Pick "Custom unit…" to name
          your own, e.g. Small Bag and Big Bag. Units like Metric Ton have a fixed size.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2" onKeyDownCapture={stopEnter}>
        {baseUnit && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm">
            <span>{baseLabel}</span>
            <span className="text-xs text-muted-foreground">base unit · always purchasable &amp; usable</span>
          </div>
        )}

        {rows.map((row) => {
          const name = isCustom(row) ? row.name : unitLabel(row.code);
          const fixed = fixedFactor(row.code);
          const problem = draftProblem(row, baseUnit, units, original);
          return (
            <div key={row.code} className="flex flex-col gap-1.5 rounded-md border border-border px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <UnitSize
                  name={name}
                  baseLabel={baseLabel}
                  value={fixed ?? row.factor_to_base}
                  disabled={fixed !== null}
                  onChange={(factor_to_base) => change(row.code, { factor_to_base })}
                />
                <UnitFlags value={row} onChange={(flags) => change(row.code, flags)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={`Remove ${name}`}
                  onClick={() => {
                    onRowsChange(rows.filter((r) => r.code !== row.code));
                    setRemoved(name);
                  }}
                >
                  <X />
                </Button>
              </div>
              {problem && <p className="text-xs text-destructive">{problem}</p>}
            </div>
          );
        })}
        <span className="sr-only" role="status">
          {removed && `${removed} removed`}
        </span>

        <div
          role="group"
          aria-label="Add a unit"
          className="flex flex-col gap-1.5 rounded-md border border-dashed border-border px-2.5 py-2"
          onKeyDown={enterAdds}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Select
              value={staged.code}
              disabled={!baseUnit}
              onValueChange={(v) => {
                const code = v ?? "";
                stage({ code, name: "", factor_to_base: fixedFactor(code) ?? "" });
              }}
            >
              <SelectTrigger id={PICKER_ID} className="w-40" aria-label="Unit to add">
                <SelectValue>
                  {(v: string) => (v === CUSTOM ? "Custom unit…" : v ? unitLabel(v) : "Add a unit")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.map((u) => (
                  <SelectItem key={u.code} value={u.code}>
                    {u.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>Custom unit…</SelectItem>
              </SelectContent>
            </Select>
            {!baseUnit && <span className="text-xs text-muted-foreground">Choose a base unit first.</span>}
            {custom && (
              <Input
                className="w-40"
                placeholder="e.g. Small Bag"
                aria-label="Custom unit name"
                maxLength={40}
                autoFocus
                value={staged.name}
                onChange={(e) => stage({ name: e.target.value })}
              />
            )}
            {staged.code && (
              <>
                <UnitSize
                  name={stagedName}
                  baseLabel={baseLabel}
                  value={staged.factor_to_base}
                  disabled={fixedFactor(staged.code) !== null}
                  onChange={(factor_to_base) => stage({ factor_to_base })}
                />
                <UnitFlags value={staged} onChange={stage} />
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={add}>
                    <Plus />
                    Add
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearStaged}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
          {stagedError && (
            <p role="alert" className="text-xs text-destructive">
              {stagedError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UnitSize({
  name,
  baseLabel,
  value,
  disabled,
  onChange,
}: {
  name: string;
  baseLabel: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <span className="min-w-0 text-sm [overflow-wrap:anywhere]">1 {name} =</span>
      <div className="flex items-center gap-2">
        <NumericInput
          allowDecimal
          decimalPlaces={4}
          className="w-24"
          placeholder="e.g. 50"
          aria-label={`Size of 1 ${name} in ${baseLabel}`}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{baseLabel}</span>
      </div>
    </div>
  );
}

function UnitFlags({
  value,
  onChange,
}: {
  value: Pick<UnitDraft, "is_purchasable" | "is_usable">;
  onChange: (flags: Partial<Pick<UnitDraft, "is_purchasable" | "is_usable">>) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-1.5 text-xs">
        <Checkbox
          checked={value.is_purchasable}
          onCheckedChange={(checked) => onChange({ is_purchasable: Boolean(checked) })}
        />
        Purchasable
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <Checkbox checked={value.is_usable} onCheckedChange={(checked) => onChange({ is_usable: Boolean(checked) })} />
        Usable
      </label>
    </div>
  );
}
