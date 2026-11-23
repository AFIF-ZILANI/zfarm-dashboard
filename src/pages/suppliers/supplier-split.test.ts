// Run with `bun test src/pages/suppliers`. Same vectors as server/src/lib/supplier-split.test.ts.
import { expect, test } from "bun:test";
import { advanceToUse, splitOldestFirst, splitProblem } from "./supplier-split";

const run = (amount: number, opening: number, dues: number[]) => {
  const r = splitOldestFirst(amount, opening, dues.map((due, i) => ({ id: String(i), due })));
  return [r.opening, Object.values(r.bills), r.advance];
};
test("old balance, then oldest bills, then advance", () => {
  expect(run(50000, 30000, [])).toEqual([30000, [], 20000]);
  expect(run(50000, 10000, [25000, 40000])).toEqual([10000, [25000, 15000], 0]);
  expect(run(500, 0, [0, 500])).toEqual([0, [500], 0]);
  expect(run(0, 100, [100])).toEqual([0, [], 0]);
});
test("paisa add up exactly", () => {
  expect(run(0.3, 0, [0.1, 0.2])).toEqual([0, [0.1, 0.2], 0]);
  expect(run(100, 0, [33.33, 33.33, 33.33])).toEqual([0, [33.33, 33.33, 33.33], 0.01]);
  expect(run(1.1, 0.7, [0.4])).toEqual([0.7, [0.4], 0]);
});
test("what's wrong with an edited split", () => {
  const bills = [{ id: "a", due: 100 }];
  const check = (amount: number, opening: number, a: number) => splitProblem(amount, 50, bills, { opening, bills: { a } });
  expect(check(150, 50, 100)).toBeNull();
  expect(check(200, 0, 0)).toBeNull();
  expect(check(0.3, 0.1, 0.2)).toBeNull();
  expect(check(140, 50, 100)).toBe("The parts add up to more than the amount paid.");
  expect(check(500, 51, 0)).toBe("Only ৳50 of the old balance is left.");
  expect(check(500, 0, 100.01)).toBe("Only ৳100 is due on that bill.");
  expect(check(500, -1, 0)).toBe("A part can't be below zero.");
});
test("how much of the advance a new bill can use", () => {
  expect(advanceToUse(75000, 0, 20000, true)).toBe(20000);
  expect(advanceToUse(75000, 60000, 20000, true)).toBe(15000);
  expect(advanceToUse(75000, 75000, 20000, true)).toBe(0);
  expect(advanceToUse(75000, 80000, 20000, true)).toBe(0);
  expect(advanceToUse(0.3, 0.1, 5, true)).toBe(0.2);
  expect(advanceToUse(75000, 0, 20000, false)).toBe(0);
  expect(advanceToUse(NaN, 0, 20000, true)).toBe(0);
});
