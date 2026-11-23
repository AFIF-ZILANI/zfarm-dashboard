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
