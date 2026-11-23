import { GENERIC_ITEM_UNITS, type UnitRow } from "./types";

/** One conversion on the item form. `code` is the unit's code, or `custom:KEY` for a name typed here that
 * becomes a unit when the item is saved (lower case, so it can't match a real code). */
export type UnitDraft = {
  code: string;
  name: string;
  factor_to_base: string;
  is_purchasable: boolean;
  is_usable: boolean;
};

const CUSTOM_PREFIX = "custom:";
export const isCustom = (draft: Pick<UnitDraft, "code">) => draft.code.startsWith(CUSTOM_PREFIX);

/** How two unit names are compared. Mirrors the server's generateUnitCode (lib/code-gen.ts). */
export function unitKey(label: string): string {
  const key = label
    .normalize("NFC")
    .replace(/[‌‍]/g, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{M}\p{N}.]+/gu, " ")
    .replace(/(?<!\p{N})\.|\.(?!\p{N})/gu, " ")
    .trim()
    .replace(/\s+/g, "_");
  return /[\p{L}\p{N}]/u.test(key) ? key : "";
}

const fits = (unit: UnitRow, baseUnit: string) =>
  !unit.is_base && (unit.base_unit === baseUnit || GENERIC_ITEM_UNITS.has(unit.code));

/** Units the picker offers: this base's own plus the generic ones, minus what's already on the list. */
export function addableUnits(units: UnitRow[], baseUnit: string, rows: UnitDraft[]) {
  const used = new Set(rows.map((r) => r.code));
  return units.filter((u) => u.is_active && !used.has(u.code) && fits(u, baseUnit));
}

/** What a typed name stands for: a unit that's already there, a new one, or why it can't be used. */
export function resolveCustomName(
  typed: string,
  baseUnit: string,
  units: UnitRow[],
  rows: UnitDraft[]
): { code: string; name: string } | { error: string } {
  const name = typed.trim().replace(/\s+/g, " ");
  const key = unitKey(name);
  if (!key) return { error: "A unit name needs at least one letter or number." };
  const existing = units.find((u) => unitKey(u.label) === key);
  const code = existing ? existing.code : CUSTOM_PREFIX + key;
  if (rows.some((r) => r.code === code)) return { error: `"${name}" is already added.` };
  if (!existing) return { code, name };
  if (!existing.is_active) return { error: `"${existing.label}" is deactivated. Reactivate it in Settings.` };
  if (!fits(existing, baseUnit)) return { error: `A unit named "${existing.label}" already exists. Pick another name.` };
  if (existing.fixed_factor !== null) return { error: `"${existing.label}" has a fixed size. Pick it from the list.` };
  return { code, name: existing.label };
}

/** Why this row can't be saved, or null. `original` = codes already on the item, which keep whatever base they had. */
export function draftProblem(
  draft: UnitDraft,
  baseUnit: string,
  units: UnitRow[],
  original: string[]
): string | null {
  const unit = units.find((u) => u.code === draft.code);
  if (unit && !original.includes(unit.code) && !fits(unit, baseUnit)) {
    const base = units.find((u) => u.code === baseUnit)?.label ?? baseUnit;
    return `"${unit.label}" can't be used on an item counted in ${base}. Remove it or change the base unit.`;
  }
  const size = Number(draft.factor_to_base);
  if (!Number.isFinite(size) || size < 0.0001) return "Enter the size.";
  if (size > 1_000_000) return "The size can't be more than 1,000,000.";
  if (!draft.is_purchasable && !draft.is_usable) return "Tick Purchasable or Usable.";
  return null;
}

/** Value of the "Custom unit…" choice in the picker. */
export const CUSTOM = "custom";

export const EMPTY_STAGED: UnitDraft = { code: "", name: "", factor_to_base: "", is_purchasable: true, is_usable: false };

/** The list with the add row's unit on it, or why that unit can't be added yet. An untouched add row adds nothing. */
export function withStaged(
  rows: UnitDraft[],
  staged: UnitDraft,
  baseUnit: string,
  units: UnitRow[]
): { rows: UnitDraft[] } | { error: string } {
  if (!staged.code) return { rows };
  let draft = staged;
  if (staged.code === CUSTOM) {
    const named = resolveCustomName(staged.name, baseUnit, units, rows);
    if ("error" in named) return named;
    draft = { ...staged, ...named };
  }
  const problem = draftProblem(draft, baseUnit, units, []);
  return problem ? { error: problem } : { rows: [...rows, draft] };
}
