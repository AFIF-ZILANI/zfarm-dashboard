import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { cn, formatDate, formatTk } from "@/lib/utils";
import { MoveMoneyDialog, type MoveAsk } from "@/pages/finance/move-money-dialog";
import { SplitDecisionDialog } from "@/pages/finance/split-decision-dialog";
import { SplitReasonDialog, type ReasonAsk } from "@/pages/finance/split-reason-dialog";
import type { ProfitSplitOverview, SplitDone, SplitWaiting } from "@/pages/finance/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";

const n = (v: string) => parseFloat(v);
const signed = (v: string) => (n(v) < 0 ? `−${formatTk(-n(v))}` : formatTk(n(v)));

/** One decision per closed batch, and where the money set aside for each fund stands. */
export function ProfitSplitTab() {
  const { data, error } = useGetData<ProfitSplitOverview>("/profit-splits", ["profit-splits"]);
  const [deciding, setDeciding] = useState<SplitWaiting | null>(null);
  const [moving, setMoving] = useState<MoveAsk | null>(null);
  const [asking, setAsking] = useState<ReasonAsk | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);

  if (error) return <EmptyState icon={PieChart} title="Couldn't load the profit split" description={error.message} />;
  if (!data) return <Skeleton className="h-96 w-full" />;

  const label = (fund: "REINVEST" | "RESERVE") => data.accounts.find((a) => a.fund === fund)?.label;
  const [reinvestAccount, reserveAccount] = [label("REINVEST"), label("RESERVE")];
  const toReinvest = n(data.reinvest.to_move);
  const toReserve = n(data.reserve.to_move);
  const toDraw = n(data.owner.to_draw);
  const spendable = n(data.spendable_cash);
  const addAccount = (name: string) => (
    <Link to="/finance?tab=accounts" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
      Add a {name} account
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <FundCard
          title="Reinvestment"
          headline={toReinvest < 0 ? "Moved ahead" : "To move"}
          amount={Math.abs(toReinvest)}
          facts={[
            ["Set aside", formatTk(n(data.reinvest.set_aside))],
            ["Moved", formatTk(n(data.reinvest.moved))],
            ["In the account", signed(data.reinvest.balance)],
          ]}
          action={
            !reinvestAccount ? (
              addAccount("Reinvestment")
            ) : toReinvest > 0 ? (
              <Button onClick={() => setMoving({ move: "TO_REINVEST", left: toReinvest, account: reinvestAccount })}>Move money</Button>
            ) : null
          }
        />
        <FundCard
          title="Reserve"
          headline={toReserve >= 0 ? "To move" : n(data.reserve.covered) > 0 ? "To bring back for a loss" : "Moved ahead"}
          amount={Math.abs(toReserve)}
          facts={[
            ["Set aside", formatTk(n(data.reserve.set_aside))],
            ...(n(data.reserve.covered) > 0 ? ([["Paid for losses", formatTk(n(data.reserve.covered))]] as [string, string][]) : []),
            ["Moved", signed(data.reserve.moved)],
            ["In the account", signed(data.reserve.balance)],
            ["Tax held", formatTk(n(data.reserve.tax_held))],
            ["Can pay for a loss", formatTk(n(data.reserve.available))],
          ]}
          action={
            !reserveAccount ? (
              addAccount("Reserve")
            ) : toReserve > 0 ? (
              <Button onClick={() => setMoving({ move: "TO_RESERVE", left: toReserve, account: reserveAccount })}>Move money</Button>
            ) : toReserve < 0 ? (
              <Button onClick={() => setMoving({ move: "FROM_RESERVE", left: -toReserve, account: reserveAccount })}>Bring back</Button>
            ) : null
          }
        />
        <FundCard
          title="Owner"
          headline={toDraw < 0 ? "Drawn ahead" : "To draw"}
          amount={Math.abs(toDraw)}
          facts={[
            ["Share so far", formatTk(n(data.owner.set_aside))],
            ["Drawn", formatTk(n(data.owner.drawn))],
          ]}
          action={
            <Button variant={toDraw > 0 ? "default" : "outline"} onClick={() => setDrawOpen(true)}>
              Record draw
            </Button>
          }
        />
      </div>

      <dl className="grid gap-x-8 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
        <Fact label="Loss carried" value={formatTk(n(data.carried_loss))} note="Comes out of the next profit first" critical={n(data.carried_loss) > 0} />
        <Fact label="Loan principal waiting" value={formatTk(n(data.principal_waiting))} note="Loans and old debts paid from Operating, to come off the next reinvestment share" />
        <Fact label="Spendable cash" value={signed(data.spendable_cash)} note="Operating accounts less unpaid bills" critical={spendable < 0} />
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waiting for a decision</CardTitle>
          <CardDescription>Closed batches, oldest first</CardDescription>
        </CardHeader>
        <CardContent>
          {data.waiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">No closed batch is waiting.</p>
          ) : (
            <ul className="divide-y">
              {data.waiting.map((w) => {
                const loss = n(w.net_profit) < 0;
                return (
                  <li key={w.batch_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link to={`/batches/${w.batch_id}`} className="font-medium underline-offset-4 hover:underline">
                        {w.batch_code}
                      </Link>
                      {w.ended_on && <span className="block text-xs text-muted-foreground">Ended {formatDate(w.ended_on)}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={cn("font-semibold tabular-nums", loss && "text-critical")}>
                        {loss ? "Loss " : "Profit "}
                        {formatTk(Math.abs(n(w.net_profit)))}
                      </span>
                      {w.can_skip && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAsking({
                              title: `Skip batch ${w.batch_code}?`,
                              description: "For a batch from before you used the split. It's left out for good, and you can't skip any more once one is split.",
                              action: "Skip batch",
                              done: `Batch ${w.batch_code} skipped`,
                              endpoint: "/profit-splits/skip",
                              body: { batch_id: w.batch_id },
                            })
                          }
                        >
                          Skip
                        </Button>
                      )}
                      {w.can_decide ? (
                        <Button size="sm" onClick={() => setDeciding(w)}>
                          {loss ? "Settle loss" : "Split"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{w.waits_for ? `After batch ${w.waits_for}, once it's final` : "After the one above"}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <DoneTable rows={data.done} onUndo={setAsking} />

      {data.moves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Money moved</CardTitle>
            <CardDescription>The latest {data.moves.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.moves.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="block">{MOVE_LABEL[m.split_move]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(m.payment_date)}
                      {m.transaction_ref ? `, ref ${m.transaction_ref}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatTk(m.amount)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setAsking({
                          title: "Remove this move?",
                          description: "For a move recorded by mistake. The account balances go back and it shows as still to move.",
                          action: "Remove move",
                          done: "Move removed",
                          endpoint: `/profit-splits/moves/${m.id}/remove`,
                        })
                      }
                    >
                      Remove
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SplitDecisionDialog batch={deciding && (data.waiting.find((w) => w.batch_id === deciding.batch_id) ?? null)} overview={data} onClose={() => setDeciding(null)} />
      <MoveMoneyDialog ask={moving} spendable={spendable} onClose={() => setMoving(null)} />
      <SplitReasonDialog ask={asking} onClose={() => setAsking(null)} />
      <PaymentCreateDialog open={drawOpen} onOpenChange={setDrawOpen} defaultKind="OWNER_DRAW" />
    </div>
  );
}

const MOVE_LABEL = { TO_REINVEST: "To reinvestment", TO_RESERVE: "To the reserve", FROM_RESERVE: "Back from the reserve" } as const;

function DoneTable({ rows, onUndo }: { rows: SplitDone[]; onUndo: (ask: ReasonAsk) => void }) {
  const money = (v: string) => (n(v) === 0 ? "" : formatTk(n(v)));
  const columns: Column<SplitDone>[] = [
    {
      key: "batch",
      header: "Batch",
      render: (d) => (
        <span className="block">
          <span className="font-medium">{d.batch_code}</span>
          <span className="block text-xs text-muted-foreground">
            {formatDate(farmToday(new Date(d.approved_at)))} by {d.approved_by}
          </span>
        </span>
      ),
      exportValue: (d) => d.batch_code,
    },
    {
      key: "kind",
      header: "Decision",
      render: (d) => <StatusBadge tone={d.kind === "PROFIT" ? "success" : d.kind === "LOSS" ? "critical" : "neutral"} label={d.kind === "PROFIT" ? "Split" : d.kind === "LOSS" ? "Loss" : "Skipped"} />,
      exportValue: (d) => d.kind,
    },
    {
      key: "profit",
      header: "Profit",
      numeric: true,
      render: (d) => (
        <span className="block">
          {signed(d.net_profit)}
          {d.kind !== "SKIPPED" && n(d.profit_now) !== n(d.net_profit) && <span className="block text-xs text-warning">Now {signed(d.profit_now)}</span>}
        </span>
      ),
      exportValue: (d) => d.net_profit,
    },
    {
      key: "off",
      header: "Taken off first",
      render: (d) =>
        [
          n(d.recovered) > 0 && `${formatTk(n(d.recovered))} earlier loss`,
          n(d.principal_taken) > 0 && `${formatTk(n(d.principal_taken))} loan principal, from reinvestment`,
          n(d.loss_covered) > 0 && `${formatTk(n(d.loss_covered))} paid by the reserve`,
          d.reason,
        ]
          .filter(Boolean)
          .join(", "),
    },
    { key: "reinvest", header: "Reinvestment", numeric: true, render: (d) => money(d.reinvest), exportValue: (d) => d.reinvest },
    { key: "reserve", header: "Reserve", numeric: true, render: (d) => money(d.reserve), exportValue: (d) => d.reserve },
    { key: "owner", header: "Owner", numeric: true, render: (d) => money(d.owner), exportValue: (d) => d.owner },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (d) =>
        d.can_undo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onUndo({
                title: `Undo the decision on batch ${d.batch_code}?`,
                description: "The batch waits for a decision again. Money already moved stays where it is and shows as moved ahead.",
                action: "Undo decision",
                done: `Decision on batch ${d.batch_code} undone`,
                endpoint: `/profit-splits/${d.id}/undo`,
              })
            }
          >
            Undo
          </Button>
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      exportName="Profit splits"
      empty={{ icon: PieChart, title: "No batch decided yet", description: "When a batch closes, split its profit or settle its loss here." }}
    />
  );
}

function FundCard({ title, headline, amount, facts, action }: { title: string; headline: string; amount: number; facts: [string, string][]; action: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{headline}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatTk(amount)}</p>
        </div>
        <dl className="flex flex-col gap-1 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {action && <div className="mt-auto">{action}</div>}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value, note, critical }: { label: string; value: string; note: string; critical?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", critical && "text-critical")}>{value}</dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}
