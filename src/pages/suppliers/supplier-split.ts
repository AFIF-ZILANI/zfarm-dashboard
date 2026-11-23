import { formatTk } from "../../lib/utils";

/** Sums are in whole paisa: 0.1 + 0.2 is 0.3. */
const paisa = (tk: number) => Math.round((Number.isFinite(tk) ? tk : 0) * 100);
const taka = (p: number) => p / 100;

export type OpenBill = { id: string; due: number };
/** How one amount is shared out. Bills left out take nothing. */
export type Split = { opening: number; bills: Record<string, number> };

/** Mirrors the server (lib/supplier-split.ts): old balance, then bills in the order given, then advance. */
export function splitOldestFirst(amount: number, openingLeft: number, bills: OpenBill[]): Split & { advance: number } {
  let left = paisa(amount);
  const opening = Math.min(left, paisa(openingLeft));
  left -= opening;
  const out: Record<string, number> = {};
  for (const b of bills) {
    const part = Math.min(left, paisa(b.due));
    if (part <= 0) continue;
    out[b.id] = taka(part);
    left -= part;
  }
  return { opening: taka(opening), bills: out, advance: taka(left) };
}

/** What the split leaves as an advance; below zero means it names more than was paid. */
export function advanceOf(amount: number, split: Split): number {
  return taka(Object.values(split.bills).reduce((s, b) => s - paisa(b), paisa(amount) - paisa(split.opening)));
}

/** Why an edited split can't be saved, or null. */
export function splitProblem(amount: number, openingLeft: number, bills: OpenBill[], split: Split): string | null {
  if (split.opening < 0 || Object.values(split.bills).some((b) => b < 0)) return "A part can't be below zero.";
  if (paisa(split.opening) > paisa(openingLeft)) return `Only ${formatTk(openingLeft)} of the old balance is left.`;
  for (const b of bills) {
    if (paisa(split.bills[b.id] ?? 0) > paisa(b.due)) return `Only ${formatTk(b.due)} is due on that bill.`;
  }
  return advanceOf(amount, split) < 0 ? `The parts add up to more than ${formatTk(amount)}.` : null;
}

/** How much of the advance held settles a new bill, after what's paid on it now. */
export function advanceToUse(total: number, paid: number, advance: number, wanted: boolean): number {
  return wanted ? taka(Math.max(0, Math.min(paisa(total) - paisa(paid), paisa(advance)))) : 0;
}
