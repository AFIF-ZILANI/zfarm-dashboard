// Run with `bun test src/pages/batches`
import { expect, test } from "bun:test";
import { blankChickPurchase, chickProblem, chickTotals, type ChickPurchase } from "./chick-purchase-math";

const chicks = (over: Partial<ChickPurchase> = {}): ChickPurchase => ({
  ...blankChickPurchase("2026-01-01"), supplier_id: "s", billed: "100", unit_price: "50", ...over,
});

test("a delivery needs its supplier", () => {
  expect(chickProblem(chicks({ supplier_id: "" }), 0, true)).toBe("Select the supplier.");
  expect(chickProblem(chicks(), 0, true)).toBeNull();
});
test("the advance comes off what's paid now", () => {
  expect(chickTotals(chicks(), 0, 2000)).toMatchObject({ total: 5000, advanceUsed: 2000 });
  expect(chickTotals(chicks({ status: "PAID" }), 0, 2000)).toMatchObject({ advanceUsed: 2000, paymentAmount: 3000 });
  expect(chickTotals(chicks({ use_advance: false, status: "PAID" }), 0, 2000)).toMatchObject({ advanceUsed: 0, paymentAmount: 5000 });
  expect(chickTotals(chicks({ status: "PARTIAL", amount: "4000" }), 0, 2000)).toMatchObject({ advanceUsed: 1000, paymentAmount: 4000 });
  expect(chickTotals(chicks(), 0, 0)).toMatchObject({ advanceUsed: 0 });
});
test("an advance that covers the whole bill leaves nothing to pay now", () => {
  const all = chicks({ status: "PAID", from_instrument_id: "a" });
  expect(chickTotals(all, 0, 9000)).toMatchObject({ advanceUsed: 5000, paymentAmount: 0 });
  expect(chickProblem(all, 0, true, 9000)).toBe("The advance covers this bill. Pick “Unpaid” for the rest.");
  expect(chickProblem(chicks(), 0, true, 9000)).toBeNull();
});
test("partial payments are still checked against the total", () => {
  const part = (amount: string) => chickProblem(chicks({ status: "PARTIAL", amount, from_instrument_id: "a" }), 0, true, 0);
  expect(part("4999.99")).toBeNull();
  expect(part("5000")).toContain("less than the total");
  expect(part("0")).toBe("Enter a valid payment amount.");
  expect(chickProblem(chicks({ status: "PAID" }), 0, true)).toBe("Select which account the payment came from.");
});
