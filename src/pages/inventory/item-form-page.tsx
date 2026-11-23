import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumericInput } from "@/components/utils/NumaricInput";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useDelete, useGetData, usePatchData, usePostData, type ApiError, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import { EMPTY_STAGED, draftProblem, isCustom, withStaged, type UnitDraft } from "@/pages/inventory/item-units";
import { ItemUnitsCard } from "@/pages/inventory/item-units-card";
import type { Item, Organization } from "@/pages/inventory/types";
import { useUnitLabel, useUnits } from "@/pages/inventory/use-unit-label";
import type { LookupRow } from "@/pages/settings/lookup-types";

type MetaRow = { key: string; value: string };

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().min(1, "Select a category"),
  unit: z.string().min(1, "Select a unit"),
  lead_time_days: optionalNumber(z.coerce.number().int().nonnegative("Must be 0 or more")),
  organization_id: z.string().optional(),
  is_unit_tracked: z.boolean(),
  is_farm_made: z.boolean(),
});

// z.coerce fields make the schema's input type (raw form values) differ from
// its output type (parsed payload) — RHF's 3rd generic carries that through (same pattern as Purchases).
type ItemFormInput = z.input<typeof itemSchema>;
type ItemFormValues = z.output<typeof itemSchema>;

export function ItemFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  usePageTitle(isEdit ? "Edit item" : "Add item");

  const { data: cachedItem, isFetchedAfterMount } = useGetData<Item>(`/items/${id}`, ["items", id ?? ""], {
    enabled: isEdit,
  });
  // Wait for this visit's fetch -- prefilling from a stale cached copy would show old units, and the
  // one-shot reset below would never pick up the fresh data.
  const item = isFetchedAfterMount ? cachedItem : undefined;
  const manufacturerLink = item?.itemOrganizations?.find((o) => o.role === "MANUFACTURER");
  // hoisted out of the closures below -- React Compiler crashes on `x?.field` inside them
  const currentManufacturerId = manufacturerLink?.organization_id ?? "";

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormInput, unknown, ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      category: undefined,
      unit: undefined,
      lead_time_days: "",
      organization_id: "",
      is_unit_tracked: false,
      is_farm_made: false,
    },
  });

  const [unitRows, setUnitRows] = useState<UnitDraft[]>([]);
  const [stagedUnit, setStagedUnit] = useState(EMPTY_STAGED);
  const [stagedError, setStagedError] = useState<string | null>(null);
  const [reorderUnit, setReorderUnit] = useState("");
  const [reorderValue, setReorderValue] = useState("");
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [metaRows, setMetaRows] = useState<MetaRow[]>([]);

  // Loads the item's data into the form + local state once it arrives (edit), or resets to blank
  // (add). Adjusted during render rather than in a useEffect, per React's own "reset state on prop
  // change" pattern — this page component doesn't remount between /items/new and /items/:id/edit.
  const resetKey = isEdit ? (item ? item.id : null) : "__new__";
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey !== null && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setStagedUnit(EMPTY_STAGED);
    setStagedError(null);
    if (item) {
      reset({
        name: item.name,
        category: item.category,
        unit: item.unit,
        lead_time_days: item.lead_time_days ?? "",
        organization_id: currentManufacturerId,
        is_unit_tracked: item.is_unit_tracked,
        is_farm_made: item.is_farm_made,
      });
      setUnitRows(
        (item.itemUnits ?? []).map((u) => ({
          code: u.unit,
          name: "",
          factor_to_base: u.factor_to_base,
          is_purchasable: u.is_purchasable,
          is_usable: u.is_usable,
        }))
      );
      setReorderUnit(item.unit);
      setReorderValue(item.reorder_level ?? "");
      setMetaRows(Object.entries(item.meta_data ?? {}).map(([key, value]) => ({ key, value })));
    } else {
      reset({
        name: "",
        category: undefined,
        unit: undefined,
        lead_time_days: "",
        organization_id: "",
        is_unit_tracked: false,
      is_farm_made: false,
      });
      setUnitRows([]);
      setReorderUnit("");
      setReorderValue("");
      setMetaRows([]);
    }
  }

  const { data: organizations } = useGetData<Paginated<Organization>>("/organizations?limit=100", [
    "organizations",
  ]);
  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/item-categories?active=true&limit=100",
    ["item-categories", "active"]
  );
  const units = useUnits();
  const unitLabel = useUnitLabel();
  const originalUnits = (item?.itemUnits ?? []).map((u) => u.unit);

  // Saving an item can create units (custom names), so the unit list is refetched too.
  const queryClient = useQueryClient();
  const refreshUnits = { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["units"] }) };
  const createItem = usePostData<Item, Record<string, unknown>>("/items", ["items"], refreshUnits);
  const updateItem = usePatchData<Item, Record<string, unknown>>(`/items/${id}`, ["items"], refreshUnits);
  const mutation = isEdit ? updateItem : createItem;
  const linkOrganization = usePostData<unknown, { item_id: string; organization_id: string; role: string }>(
    "/item-organizations",
    ["organizations"]
  );
  const unlinkOrganization = useDelete<null, string>((linkId) => `/item-organizations/${linkId}`, ["organizations"]);

  const baseUnit = useWatch({ control, name: "unit" });
  // An item is QR-tracked or made on the farm, never both: each switch turns the other off.
  const unitTracked = useWatch({ control, name: "is_unit_tracked" });
  const farmMade = useWatch({ control, name: "is_farm_made" });
  // Reorder level is entered in whichever purchasable unit is convenient, then converted to the
  // item's base unit for storage -- Item.reorder_level has always been in base-unit terms.
  const purchasableUnits = [
    ...(baseUnit ? [{ code: baseUnit, label: unitLabel(baseUnit) }] : []),
    ...unitRows
      .filter((u) => u.is_purchasable)
      .map((u) => ({ code: u.code, label: isCustom(u) ? u.name : unitLabel(u.code) })),
  ];
  const reorderUnitValue = purchasableUnits.some((u) => u.code === reorderUnit) ? reorderUnit : (baseUnit ?? "");

  const addMetaRow = () => setMetaRows((prev) => [...prev, { key: "", value: "" }]);
  const buildMetaData = (): Record<string, string> | undefined => {
    const entries = metaRows
      .filter((r) => r.key.trim() !== "")
      .map((r) => [r.key.trim(), r.value] as const);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const onSubmit = async (values: ItemFormValues) => {
    setReorderError(null);
    const reorderFactor =
      reorderUnitValue === baseUnit
        ? 1
        : Number(unitRows.find((u) => u.code === reorderUnitValue)?.factor_to_base ?? 1);
    let reorder_level: number | undefined;
    if (reorderValue !== "") {
      const raw = Number(reorderValue);
      if (!Number.isFinite(raw) || raw < 0) {
        setReorderError("Enter a valid reorder level.");
        return;
      }
      reorder_level = raw * reorderFactor;
    }

    // A unit filled in on the add row but never clicked Add still counts -- otherwise it's silently dropped.
    const staged = withStaged(unitRows, stagedUnit, values.unit, units);
    if ("error" in staged) {
      setStagedError(staged.error);
      toast.error(`Finish adding the unit first: ${staged.error}`);
      return;
    }
    const rowProblem = staged.rows.map((u) => draftProblem(u, values.unit, units, originalUnits)).find(Boolean);
    if (rowProblem) {
      toast.error(rowProblem);
      return;
    }

    const { organization_id, unit, ...rest } = values;
    const payload: Record<string, unknown> = {
      ...rest,
      ...(!isEdit && { unit }),
      reorder_level,
      meta_data: buildMetaData(),
      // Saved with the item or not at all, so an item can't end up without its units.
      units: staged.rows.map((u) => ({
        ...(isCustom(u) ? { label: u.name } : { unit: u.code }),
        factor_to_base: Number(u.factor_to_base),
        is_purchasable: u.is_purchasable,
        is_usable: u.is_usable,
      })),
    };

    let savedItem: Item;
    try {
      savedItem = await mutation.mutateAsync(payload);
    } catch (e) {
      const error = e as ApiError;
      let hadFieldError = false;
      for (const key of ["name", "category", "unit", "lead_time_days"] as const) {
        const message = error.fieldError(key);
        if (message) {
          setError(key, { message });
          hadFieldError = true;
        }
      }
      const reorderMessage = error.fieldError("reorder_level");
      if (reorderMessage) {
        setReorderError(reorderMessage);
        hadFieldError = true;
      }
      if (!hadFieldError) toast.error(error.message);
      return;
    }

    if (organization_id !== currentManufacturerId) {
      try {
        if (manufacturerLink) await unlinkOrganization.mutateAsync(manufacturerLink.id);
        if (organization_id) {
          await linkOrganization.mutateAsync({ item_id: savedItem.id, organization_id, role: "MANUFACTURER" });
        }
      } catch (e) {
        toast.warning(`Item saved, but updating the manufacturer failed: ${(e as ApiError).message}`);
      }
    }

    toast.success(isEdit ? "Item updated" : "Item created");
    navigate("/inventory?tab=items");
  };

  if (isEdit && !item) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/inventory?tab=items")}>
          <ArrowLeft />
          Back to inventory
        </Button>
        <p className="text-sm text-muted-foreground">Loading item…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/inventory?tab=items")}>
        <ArrowLeft />
        Back to inventory
      </Button>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Item details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Starter Feed" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category}>
                        <SelectValue>
                          {(value: string) =>
                            value
                              ? (categories?.results.find((cat) => cat.code === value)?.label ?? humanizeEnum(value))
                              : "Select category"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(categories?.results ?? []).map((cat) => (
                          <SelectItem key={cat.code} value={cat.code}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit">Base unit</Label>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isEdit}>
                      <SelectTrigger id="unit" className="w-full" aria-invalid={!!errors.unit}>
                        <SelectValue>
                          {(value: string) =>
                            value
                              ? unitLabel(value)
                              : "Select unit"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {units
                          .filter((u) => u.is_base && u.is_active)
                          .map((unitOption) => (
                            <SelectItem key={unitOption.code} value={unitOption.code}>
                              {unitOption.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
                <p className="text-xs text-muted-foreground">
                  {isEdit
                    ? "Can't be changed after the item is created."
                    : "Stock is counted in this. Every unit below converts to it."}
                </p>
              </div>
            </div>

            <Controller
              control={control}
              name="is_unit_tracked"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    disabled={farmMade}
                    onCheckedChange={(c) => field.onChange(Boolean(c))}
                  />
                  Tracked by QR code (medicine, vaccine, equipment)
                </label>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Checked: this item is bound to individual QR-coded units (Bind Code, Stock
              Allocation). Unchecked: tracked only as an aggregate quantity (Move Stock). An item
              can only use one of the two.
            </p>

            <Controller
              control={control}
              name="is_farm_made"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value}
                    disabled={unitTracked}
                    onCheckedChange={(c) => field.onChange(Boolean(c))}
                  />
                  Made on the farm (not bought)
                </label>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Litter and other things the farm makes. They are sold as Farm-made sales without taking stock, and
              never appear on purchases. Can't be changed once the item has been bought or sold.
            </p>
          </CardContent>
        </Card>

        <ItemUnitsCard
          baseUnit={baseUnit ?? ""}
          units={units}
          unitLabel={unitLabel}
          original={originalUnits}
          rows={unitRows}
          onRowsChange={setUnitRows}
          staged={stagedUnit}
          onStagedChange={setStagedUnit}
          stagedError={stagedError}
          onStagedError={setStagedError}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company / manufacturer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organization_id">Manufacturer (optional)</Label>
              <Controller
                control={control}
                name="organization_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="organization_id" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          organizations?.results.find((org) => org.id === value)?.label_name ?? "Select organization"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(organizations?.results ?? []).map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.label_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {(organizations?.results ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No organizations yet — add one in the Organizations tab.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reorder &amp; lead time</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Reorder level (optional)</Label>
              <div className="flex gap-2">
                <NumericInput
                  allowDecimal
                  decimalPlaces={3}
                  className="flex-1"
                  value={reorderValue}
                  onChange={(e) => setReorderValue(e.target.value)}
                />
                <Select value={reorderUnitValue} onValueChange={(v) => setReorderUnit(v ?? "")}>
                  <SelectTrigger className="w-32">
                    <SelectValue>{(v: string) => (v ? unitLabel(v) : "Unit")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {purchasableUnits.map((u) => (
                      <SelectItem key={u.code} value={u.code}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reorderError && <p className="text-xs text-destructive">{reorderError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead_time_days">Lead time in days (optional)</Label>
              <Input id="lead_time_days" type="number" step="1" {...register("lead_time_days")} />
              {errors.lead_time_days && <p className="text-xs text-destructive">{errors.lead_time_days.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Metadata</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addMetaRow}>
              <Plus />
              Add
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {metaRows.length === 0 && (
              <p className="text-xs text-muted-foreground">Optional key/value pairs for anything else worth tracking on this item.</p>
            )}
            {metaRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="KEY"
                  className="w-48 font-mono uppercase"
                  value={row.key}
                  onChange={(e) =>
                    setMetaRows((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, key: e.target.value.toUpperCase() } : r))
                    )
                  }
                />
                <Input
                  placeholder="value"
                  className="flex-1 font-mono"
                  value={row.value}
                  onChange={(e) =>
                    setMetaRows((prev) => prev.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove metadata row"
                  onClick={() => setMetaRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/inventory?tab=items")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
