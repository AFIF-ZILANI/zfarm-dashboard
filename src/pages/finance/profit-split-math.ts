import { formatTk } from "../../lib/utils";

/** Shares in percent: the first three make 100, tax is inside the reserve. */
export type Pct = { reinvest: number; reserve: number; owner: number; tax: number };

const paisa = (tk: number) => Math.round((Number.isFinite(tk) ? tk : 0) * 100);
const taka = (p: number) => p / 100;
/** Half up in whole paisa, with the percent as whole hundredths so no float creeps in. */
const share = (base: number, pct: number) => Math.floor((base * Math.round(pct * 100) + 5000) / 10000);

/** Mirrors the server (lib/profit-split.ts), for the figures shown while deciding. */
export function splitProfit(profit: number, carried: number, principal: number, pct: Pct) {
  const whole = paisa(profit);
  const recovered = Math.min(whole, Math.max(0, paisa(carried)));
  const base = whole - recovered;
  const reserve = share(base, pct.reserve);
  const owner = Math.min(share(base, pct.owner), base - reserve);
  const reinvest = base - reserve - owner;
  const principalTaken = Math.min(reinvest, Math.max(0, paisa(principal)));
  return {
    recovered: taka(recovered),
    base: taka(base),
    reinvest: taka(reinvest),
    reserve: taka(reserve),
    owner: taka(owner),
    tax: taka(Math.min(share(base, pct.tax), reserve)),
    principalTaken: taka(principalTaken),
    reinvestToMove: taka(reinvest - principalTaken),
  };
}

/** `loss` above zero. The reserve pays what it can; the rest comes out of the next profit. */
export function settleLoss(loss: number, available: number) {
  const covered = Math.min(paisa(loss), Math.max(0, paisa(available)));
  return { covered: taka(covered), carried: taka(paisa(loss) - covered) };
}

export function pctProblem(p: Pct): string | null {
  const all = [p.reinvest, p.reserve, p.owner, p.tax];
  if (all.some((x) => !Number.isFinite(x))) return "Enter every share.";
  if (all.some((x) => x < 0)) return "A share can't be below 0.";
  const sum = Math.round((p.reinvest + p.reserve + p.owner) * 100) / 100;
  if (sum !== 100) return `The three shares add up to ${sum}, not 100.`;
  return p.tax > p.reserve ? `Tax is part of the reserve, so it can't be more than ${p.reserve}.` : null;
}

/** Moving more than the farm can spare is allowed, but said. */
export function moveWarning(amount: number, spendable: number): string | null {
  const over = paisa(amount) - paisa(spendable);
  return paisa(amount) > 0 && over > 0 ? `That's ${formatTk(taka(over))} more than the farm has after its unpaid bills.` : null;
}
