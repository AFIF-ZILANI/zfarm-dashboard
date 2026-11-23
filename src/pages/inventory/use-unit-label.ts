import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { UnitRow } from "@/pages/inventory/types";

/** Every unit, deactivated ones too: past records still name them. */
export function useUnits() {
  const { data } = useGetData<Paginated<UnitRow>>("/units?limit=1000", ["units"]);
  return data?.results ?? [];
}

/** A unit code as the name it has now. Codes never change, so after a rename the code reads as the old name. */
export function useUnitLabel() {
  const labels = new Map(useUnits().map((u) => [u.code, u.label]));
  return (code: string) => labels.get(code) ?? humanizeEnum(code);
}
