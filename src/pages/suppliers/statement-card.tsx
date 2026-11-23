import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData } from "@/lib/api";
import { printSheet } from "@/lib/print";
import { cn, formatDate, formatTk } from "@/lib/utils";
import type { StatementLine, SupplierStatement } from "@/pages/suppliers/supplier-money-types";
import { PaymentDetailDialog } from "@/pages/suppliers/remove-payment-dialog";

const FORWARD = "brought-forward";
const balanceText = (v: string) => (parseFloat(v) < 0 ? `${formatTk(-parseFloat(v))} advance` : formatTk(v));

/** The supplier's khata: every bill and payment in date order, with the balance after each. */
export function StatementCard({ supplierId, supplierName }: { supplierId: string; supplierName: string }) {
  const navigate = useNavigate();
  const sheet = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openLine, setOpenLine] = useState<StatementLine | null>(null);

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const { data, isLoading, error } = useGetData<SupplierStatement>(`/suppliers/${supplierId}/statement?${query}`, [
    "suppliers",
    supplierId,
    "statement",
    from,
    to,
  ]);

  const lines = data?.lines ?? [];
  const forward = data?.brought_forward ?? "0";
  // Only a range that starts after something happened has a balance to bring in.
  const rows: StatementLine[] =
    from && parseFloat(forward) !== 0
      ? [
          {
            id: FORWARD,
            kind: "OPENING",
            date: from,
            label: "Brought forward",
            adds: null,
            paid: null,
            balance: forward,
            purchase_id: null,
            supplier_payment_id: null,
            account: null,
            transaction_ref: null,
            note: null,
            settled: [],
          },
          ...lines,
        ]
      : lines;

  const detail = (l: StatementLine) =>
    [l.account, l.transaction_ref && `ref ${l.transaction_ref}`, l.note].filter(Boolean).join(", ");

  // No sortValue on any column: a running balance only reads in date order.
  const columns: Column<StatementLine>[] = [
    { key: "date", header: "Date", render: (l) => <span className="tabular-nums">{formatDate(l.date)}</span>, exportValue: (l) => l.date.slice(0, 10) },
    {
      key: "what",
      header: "What",
      render: (l) => (
        <span className="block">
          <span className={cn((l.kind === "BILL" || l.id === FORWARD) && "font-medium")}>{l.label}</span>
          {detail(l) && <span className="block text-xs text-muted-foreground">{detail(l)}</span>}
        </span>
      ),
      exportValue: (l) => [l.label, detail(l)].filter(Boolean).join(", "),
    },
    { key: "adds", header: "Bill", numeric: true, render: (l) => (l.adds ? formatTk(l.adds) : ""), exportValue: (l) => l.adds },
    { key: "paid", header: "Paid", numeric: true, render: (l) => (l.paid ? formatTk(l.paid) : ""), exportValue: (l) => l.paid },
    {
      key: "balance",
      header: "Balance",
      numeric: true,
      render: (l) => <span className={cn("font-semibold", parseFloat(l.balance) < 0 && "text-success")}>{balanceText(l.balance)}</span>,
      exportValue: (l) => l.balance,
    },
  ];

  const print = () => sheet.current && printSheet(sheet.current);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
        <CardTitle className="text-base">Statement</CardTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="st_from" className="text-xs">
              From
            </Label>
            <Input id="st_from" type="date" className="w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="st_to" className="text-xs">
              To
            </Label>
            <Input id="st_to" type="date" className="w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={print} disabled={rows.length === 0}>
            <Printer />
            Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div>
          <div ref={sheet} id="printable-statement">
            <div className="mb-4 hidden print:block">
              <p className="text-lg font-semibold">Statement with {supplierName}</p>
              <p className="text-sm">
                {from || to ? `${from ? formatDate(from) : "Start"} to ${to ? formatDate(to) : "today"}` : "All dates"}
              </p>
              <p className="text-sm font-medium">Closing balance {balanceText(data?.closing ?? "0")}</p>
            </div>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(l) => l.id}
              isLoading={isLoading}
              paginate={false}
              exportName={`Statement ${supplierName}`}
              onRowClick={(l) => {
                if (l.kind === "PAYMENT" || l.kind === "REFUND") setOpenLine(l);
                else if (l.purchase_id) void navigate(`/purchases/${l.purchase_id}`);
              }}
              empty={{
                icon: Receipt,
                title: error ? "Couldn't load the statement" : from || to ? "Nothing in these dates" : "No bills or payments yet",
                description: error ? error.message : undefined,
              }}
            />
          </div>
        </div>
      </CardContent>
      <PaymentDetailDialog supplierId={supplierId} line={openLine} onClose={() => setOpenLine(null)} />
    </Card>
  );
}
