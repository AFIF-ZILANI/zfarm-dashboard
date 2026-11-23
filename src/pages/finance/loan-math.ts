import type { Loan, LoanFrequency, LoanTerms } from "@/pages/finance/types";

const round = (x: number) => Math.round(x * 100) / 100;

/** Mirrors the server's schedule (LoanService.loanSchedule) so the dialog can preview it. Null until it can. */
export function schedule(principal: number, terms: LoanTerms, rate: number, total: number, count: number, frequency: LoanFrequency) {
  if (!(principal > 0) || !(count > 0)) return null;
  if (terms === "EMI") {
    if (!(rate > 0) || frequency === "ONE_OFF") return null;
    const r = rate / 100 / (frequency === "MONTHLY" ? 12 : 52);
    const installment = Math.round(((principal * r) / (1 - Math.pow(1 + r, -count))) * 100) / 100;
    // Rounded like the server: whole paisa, and never less than was borrowed.
    return { installment, total: Math.max(round(installment * count), principal) };
  }
  const t = terms === "FLAT" ? total : principal;
  if (!(t >= principal)) return null;
  const installment = round(t / count);
  return installment > 0 ? { installment, total: t } : null;
}

type Standing = Pick<Loan, "left" | "interest_total" | "interest_booked">;

/** The interest part of a payment: what the server books if left blank, and the range it accepts. */
export function interestPart(loan: Standing, amount: number) {
  const left = parseFloat(loan.left);
  const interestLeft = round(parseFloat(loan.interest_total) - parseFloat(loan.interest_booked));
  const least = Math.max(0, round(amount - (left - interestLeft)));
  const most = Math.min(interestLeft, amount);
  if (!(left > 0)) return { suggested: 0, least: 0, most: 0 };
  return { suggested: Math.min(Math.max(round((amount * interestLeft) / left), least), most), least, most };
}
