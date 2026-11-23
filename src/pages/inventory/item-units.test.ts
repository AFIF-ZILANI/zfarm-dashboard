// Run with `bun test src/pages/inventory`
import { expect, test } from "bun:test";
import { CUSTOM, EMPTY_STAGED, draftProblem, resolveCustomName, unitKey, withStaged, type UnitDraft } from "./item-units";
import type { UnitRow } from "./types";

const unit = (code: string, label: string, over: Partial<UnitRow> = {}): UnitRow => ({
  id: code, code, label, is_active: true, is_base: false, base_unit: "KG", fixed_factor: null, ...over,
});
const units = [
  unit("KG", "Kg", { is_base: true, base_unit: null }),
  unit("LITER", "Liter", { is_base: true, base_unit: null }),
  unit("BAG", "Bag"),
  unit("BOTTLE", "Bottle", { base_unit: "LITER" }),
  unit("METRIC_TON", "Metric Ton", { fixed_factor: "1000" }),
  unit("CONTAINER", "Container", { base_unit: null }),
  unit("OLD", "Old Sack", { is_active: false }),
];
const draft = (over: Partial<UnitDraft>): UnitDraft => ({
  code: "BAG", name: "", factor_to_base: "50", is_purchasable: true, is_usable: false, ...over,
});

test("same key rules as the server", () => {
  expect(unitKey(" small-bag ")).toBe("SMALL_BAG");
  expect(unitKey("Bag 12.5kg")).toBe("BAG_12.5KG");
  expect(unitKey("Bag 125kg")).toBe("BAG_125KG");
  expect(unitKey("ছোট বস্তা")).toBe("ছোট_বস্তা");
  expect(unitKey("🐔.")).toBe("");
});

test("a typed name: new unit, existing unit, or the reason it can't be used", () => {
  const at = (name: string, rows: UnitDraft[] = []) => resolveCustomName(name, "KG", units, rows);
  expect(at("Small  Bag")).toEqual({ code: "custom:SMALL_BAG", name: "Small Bag" });
  expect(at("bag")).toEqual({ code: "BAG", name: "Bag" });
  expect(at("container")).toEqual({ code: "CONTAINER", name: "Container" });
  expect(at("!!")).toEqual({ error: expect.stringMatching(/letter or number/) });
  expect(at("metric ton")).toEqual({ error: expect.stringMatching(/fixed size/) });
  expect(at("Bottle")).toEqual({ error: expect.stringMatching(/already exists/) });
  expect(at("kg")).toEqual({ error: expect.stringMatching(/already exists/) });
  expect(at("old sack")).toEqual({ error: expect.stringMatching(/deactivated/) });
  expect(at("bag", [draft({})])).toEqual({ error: expect.stringMatching(/already added/) });
  expect(at("small-bag", [draft({ code: "custom:SMALL_BAG", name: "Small Bag" })])).toEqual({
    error: expect.stringMatching(/already added/),
  });
});

test("why a row can't be saved", () => {
  const at = (over: Partial<UnitDraft>, base = "KG", original: string[] = []) =>
    draftProblem(draft(over), base, units, original);
  expect(at({})).toBeNull();
  for (const factor_to_base of ["", "0", "0.00001", "abc"]) expect(at({ factor_to_base })).toMatch(/size/);
  expect(at({ factor_to_base: "1000001" })).toMatch(/1,000,000/);
  expect(at({ is_purchasable: false })).toMatch(/Purchasable or Usable/);
  expect(at({}, "LITER")).toMatch(/Liter/);
  expect(at({ code: "CONTAINER" }, "LITER")).toBeNull();
  expect(at({ code: "custom:X", name: "X" }, "LITER")).toBeNull();
  expect(at({}, "LITER", ["BAG"])).toBeNull(); // already on the item: the server leaves it alone too
});

test("the add row: untouched adds nothing, finished adds a row, half-done says what's missing", () => {
  const rows = [draft({})];
  expect(withStaged(rows, EMPTY_STAGED, "KG", units)).toEqual({ rows });
  const custom = { ...EMPTY_STAGED, code: CUSTOM, name: "Small Bag", factor_to_base: "25" };
  expect(withStaged(rows, custom, "KG", units)).toEqual({
    rows: [...rows, { ...custom, code: "custom:SMALL_BAG", name: "Small Bag" }],
  });
  expect(withStaged(rows, { ...custom, factor_to_base: "" }, "KG", units)).toEqual({ error: "Enter the size." });
  expect(withStaged(rows, { ...custom, name: "" }, "KG", units)).toEqual({ error: expect.stringMatching(/name/) });
});
