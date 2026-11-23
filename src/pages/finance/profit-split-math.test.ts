// Run with `bun test src/pages/finance`. Same vectors as server/src/lib/profit-split.test.ts.
import { expect, test } from "bun:test";
import { moveWarning, pctProblem, settleLoss, splitProfit } from "./profit-split-math";
import { KIND_LABEL, NO_BILL_KINDS } from "../payments/types";

const P = (reinvest = 50, reserve = 30, owner = 20, tax = 10) => ({ reinvest, reserve, owner, tax });
const run = (profit: number, carried = 0, principal = 0, p = P()) => splitProfit(profit, carried, principal, p);

test("50/30/20 with tax inside the reserve", () => {
  expect(run(173068)).toEqual({
    recovered: 0, base: 173068, reinvest: 86534, reserve: 51920.4, owner: 34613.6, tax: 17306.8, principalTaken: 0, reinvestToMove: 86534,
  });
});
test("a carried loss first, then loan principal off reinvestment", () => {
  expect(run(200000, 60000)).toMatchObject({ recovered: 60000, reinvest: 70000, reserve: 42000, owner: 28000 });
  expect(run(200000, 60000, 30000)).toMatchObject({ principalTaken: 30000, reinvestToMove: 40000 });
  expect(run(200000, 60000, 90000)).toMatchObject({ principalTaken: 70000, reinvestToMove: 0 });
  expect(run(1000, 5000, 50)).toMatchObject({ recovered: 1000, base: 0, reinvest: 0, owner: 0, principalTaken: 0 });
});
test("odd paisa always make the whole", () => {
  for (const p of [P(33.33, 33.33, 33.34, 0), P(), P(0, 50, 50, 50), P(0.01, 49.99, 50, 49.99)])
    for (const profit of [0.01, 0.02, 0.05, 1.01, 100.01, 99999.99]) {
      const r = run(profit, 0, 0, p);
      expect(Math.round((r.reinvest + r.reserve + r.owner) * 100)).toBe(Math.round(profit * 100));
      expect(Math.min(r.reinvest, r.reserve, r.owner, r.tax, r.reserve - r.tax)).toBeGreaterThanOrEqual(0);
    }
});
test("half a paisa rounds up, and reinvestment takes what's left", () => {
  expect(run(0.05)).toMatchObject({ reserve: 0.02, owner: 0.01, reinvest: 0.02, tax: 0.01 });
});
test("a loss: the reserve pays what it can", () => {
  expect(settleLoss(100000, 40000)).toEqual({ covered: 40000, carried: 60000 });
  expect(settleLoss(100000, 200000)).toEqual({ covered: 100000, carried: 0 });
  expect(settleLoss(100000, 0)).toEqual({ covered: 0, carried: 100000 });
});
test("what's wrong with percentages", () => {
  expect(pctProblem(P())).toBeNull();
  expect(pctProblem(P(33.33, 33.33, 33.34, 0))).toBeNull();
  expect(pctProblem(P(50, 30, 19))).toBe("The three shares add up to 99, not 100.");
  expect(pctProblem(P(50, 30, 21))).toBe("The three shares add up to 101, not 100.");
  expect(pctProblem(P(50, 30, 20, 31))).toBe("Tax is part of the reserve, so it can't be more than 30.");
  expect(pctProblem(P(-1, 81, 20))).toBe("A share can't be below 0.");
  expect(pctProblem(P(NaN))).toBe("Enter every share.");
});
test("warns when a move is more than the farm can spend, never blocks", () => {
  expect(moveWarning(100, 100)).toBeNull();
  expect(moveWarning(100.01, 100)).toBe("That's ৳0.01 more than the farm has after its unpaid bills.");
  expect(moveWarning(100, -50)).toBe("That's ৳150 more than the farm has after its unpaid bills.");
  expect(moveWarning(0, -50)).toBeNull();
});
test("tax paid can be recorded in the cash book", () => {
  expect(NO_BILL_KINDS).toContain("TAX_PAID");
  expect(KIND_LABEL.TAX_PAID).toBe("Tax paid");
});
