// Run with `bun test src/pages/finance`. Same vectors as server/src/services/loan.*.test.ts.
import { expect, test } from "bun:test";
import { interestPart, schedule } from "./loan-math";

test("EMI preview matches the server's schedule", () => {
  expect(schedule(100000, "EMI", 12, 0, 12, "MONTHLY")).toEqual({ installment: 8884.88, total: 106618.56 });
  expect(schedule(10000, "EMI", 10.4, 0, 52, "WEEKLY")?.installment).toBeCloseTo(202.7, 1);
});
test("an EMI preview never totals less than was borrowed", () => {
  expect(schedule(100, "EMI", 0.001, 0, 3, "MONTHLY")!.total).toBeGreaterThanOrEqual(100);
});
test("flat and interest-free previews", () => {
  expect(schedule(10000, "FLAT", 0, 12000, 4, "MONTHLY")).toEqual({ installment: 3000, total: 12000 });
  expect(schedule(100, "NONE", 0, 0, 3, "WEEKLY")).toEqual({ installment: 33.33, total: 100 });
});
test("no preview until it can be worked out", () => {
  expect(schedule(0, "NONE", 0, 0, 3, "MONTHLY")).toBeNull();
  expect(schedule(100, "NONE", 0, 0, 0, "MONTHLY")).toBeNull();
  expect(schedule(100, "EMI", 0, 0, 3, "MONTHLY")).toBeNull();
  expect(schedule(100, "EMI", 9, 0, 1, "ONE_OFF")).toBeNull();
  expect(schedule(100, "FLAT", 0, 99, 3, "MONTHLY")).toBeNull();
  expect(schedule(1, "NONE", 0, 0, 600, "MONTHLY")).toBeNull();
});

const loan = (over = {}) => ({
  left: "12000.00", interest_total: "2000.00", interest_booked: "0.00", ...over,
});
test("a first payment suggests its share of the interest", () => {
  expect(interestPart(loan(), 3000)).toEqual({ suggested: 500, least: 0, most: 2000 });
});
test("after a bigger bank figure, later suggestions make up for it", () => {
  // 3000 paid with 1200 interest: 800 interest left of 9000.
  expect(interestPart(loan({ left: "9000.00", interest_booked: "1200.00" }), 3000).suggested).toBe(266.67);
});
test("the settling payment takes exactly the interest left", () => {
  expect(interestPart(loan({ left: "3000.00", interest_booked: "1700.00" }), 3000)).toEqual({ suggested: 300, least: 300, most: 300 });
});
test("nothing to suggest on a repaid loan or a blank amount", () => {
  expect(interestPart(loan({ left: "0.00", interest_booked: "2000.00" }), 100).suggested).toBe(0);
  expect(interestPart(loan(), 0).suggested).toBe(0);
});
