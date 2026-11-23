import type { Payment } from "@/pages/payments/types";

type Move = Pick<Payment, "direction" | "ref_type" | "amount" | "from_instrument_id" | "to_instrument_id">;

/** In, out, or only moved between the farm's own accounts. */
export const flowOf = (p: Move): "IN" | "OUT" | "MOVED" =>
  p.ref_type === "TRANSFER" ? "MOVED" : p.direction === "INCOMING" ? "IN" : "OUT";

/** "+৳5" / "−৳5" signs; a transfer has none. */
export const signOf = (p: Move) => ({ IN: "+", OUT: "−", MOVED: "" })[flowOf(p)];

/** "into Cash" / "from Cash" / "Cash → Bank". */
export function accountsOf(p: Move, label: (id: string | null) => string) {
  const [from, to] = [label(p.from_instrument_id), label(p.to_instrument_id)];
  return { IN: `into ${to}`, OUT: `from ${from}`, MOVED: `${from} → ${to}` }[flowOf(p)];
}

/** Money in and out over these rows. */
export function totals(payments: Move[]) {
  const sum = (f: "IN" | "OUT") => payments.filter((p) => flowOf(p) === f).reduce((s, p) => s + parseFloat(p.amount), 0);
  return { incoming: sum("IN"), outgoing: sum("OUT") };
}

/** Rows with the parts of one supplier payment joined into one line: what was handed over, as the bank shows it. */
export function groupSupplierPayments(rows: Payment[]): (Payment & { parts: Payment[] })[] {
  const out: (Payment & { parts: Payment[] })[] = [];
  const at = new Map<string, number>();
  for (const p of rows) {
    const group = p.supplier_payment_id;
    const i = group === null ? undefined : at.get(group);
    if (i === undefined) {
      if (group !== null) at.set(group, out.length);
      out.push({ ...p, parts: [p] });
    } else {
      const parts = [...out[i]!.parts, p];
      const sum = parts.reduce((s, x) => s + Math.round(parseFloat(x.amount) * 100), 0);
      out[i] = { ...out[i]!, parts, amount: (sum / 100).toFixed(2) };
    }
  }
  return out;
}
