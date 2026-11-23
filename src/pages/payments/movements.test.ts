// Run with `bun test src/pages/payments`
import { expect, test } from "bun:test";
import { settledElsewhere } from "../finance/types";
import { accountsOf, flowOf, signOf, totals } from "./movements";
import { KIND_LABEL, NO_BILL_KINDS, PAYMENT_REF_TYPES } from "./types";

const row = (over = {}) => ({
  direction: "OUTGOING" as const, ref_type: "PURCHASE" as const, amount: "100", from_instrument_id: "a", to_instrument_id: null, ...over,
});
const transfer = row({ ref_type: "TRANSFER", to_instrument_id: "b" });
const capital = row({ direction: "INCOMING", ref_type: "OWNER_CAPITAL", from_instrument_id: null, to_instrument_id: "b" });
const label = (id: string | null) => ({ a: "Cash", b: "Bank" })[id ?? ""] ?? "—";

test("a transfer is neither money in nor out and carries no sign", () => {
  expect([flowOf(row()), flowOf(capital), flowOf(transfer)]).toEqual(["OUT", "IN", "MOVED"]);
  expect([signOf(row()), signOf(capital), signOf(transfer)]).toEqual(["−", "+", ""]);
});
test("a transfer names both its accounts, the right way round", () => {
  expect(accountsOf(row(), label)).toBe("from Cash");
  expect(accountsOf(capital, label)).toBe("into Bank");
  expect(accountsOf(transfer, label)).toBe("Cash → Bank");
});
test("totals leave transfers out", () => {
  expect(totals([row(), capital, transfer])).toEqual({ incoming: 100, outgoing: 100 });
});
test("every kind has a label", () => {
  for (const k of [...PAYMENT_REF_TYPES, ...NO_BILL_KINDS, "LOAN", "PAYROLL"] as const) expect(KIND_LABEL[k]).toBeTruthy();
});
test("payroll and loan interest expenses are never offered for payment", () => {
  for (const c of ["SALARY", "FESTIVAL_BONUS", "SALARY_TRANSFER_FEE", "LOAN_INTEREST"]) expect(settledElsewhere(c)).toBe(true);
  expect(settledElsewhere("ELECTRICITY")).toBe(false);
});
