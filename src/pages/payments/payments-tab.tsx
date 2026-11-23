import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatTk, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Purchase } from "@/pages/purchases/types";
import type { Sale, BirdSale } from "@/pages/sales/types";
import type { PaymentInstrument } from "@/pages/payments/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { KIND_LABEL, type Payment } from "@/pages/payments/types";
import { groupSupplierPayments, kindOf, totals } from "@/pages/payments/movements";
import type { Supplier } from "@/pages/suppliers/types";

export function PaymentsTab() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<Payment>>("/payments?limit=100", ["payments"]);
  const { data: purchases } = useGetData<Paginated<Purchase>>("/purchases?limit=100", ["purchases"]);
  const { data: sales } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"]);
  const { data: birdSales } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", ["bird-sales"]);
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: instruments } = useGetData<Paginated<PaymentInstrument>>("/payment-instruments?limit=100", [
    "payment-instruments",
  ]);

  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);

  const instrumentLabel = (id: string | null) => instruments?.results.find((i) => i.id === id)?.label ?? "—";

  // Payment.ref_id is a polymorphic reference (see types.ts) — resolve a
  // human label per ref_type from whichever list actually has that record.
  type Row = ReturnType<typeof groupSupplierPayments>[number];
  const supplierName = (id: string | null | undefined) => suppliers?.results.find((s) => s.id === id)?.profile.name;
  const refLabel = (p: Row) => {
    if (p.supplier_payment_id) {
      // A part on the old balance or an advance carries the supplier's id; one on a bill, the bill's.
      const own = p.parts.find((x) => x.ref_type !== "PURCHASE");
      const bill = purchases?.results.find((x) => x.id === p.ref_id);
      return supplierName(own?.ref_id ?? bill?.supplier_id) ?? "Supplier";
    }
    if (p.ref_type === "PURCHASE") {
      const purchase = purchases?.results.find((x) => x.id === p.ref_id);
      return purchase ? (purchase.invoice_no ?? "Purchase") : "Purchase";
    }
    if (p.ref_type === "SALE") {
      const sale = sales?.results.find((x) => x.id === p.ref_id);
      return sale ? `Sale · ${new Date(sale.sale_date).toLocaleDateString()}` : "Sale";
    }
    if (p.ref_type === "BIRD_SALE") {
      const birdSale = birdSales?.results.find((x) => x.id === p.ref_id);
      const batch = birdSale ? batches?.results.find((b) => b.id === birdSale.batch_id) : undefined;
      return batch?.batch_code ?? "Bird sale";
    }
    // Owner money, other, transfers: no bill to name, so the note says what it was.
    return p.note ?? KIND_LABEL[p.ref_type] ?? humanizeEnum(p.ref_type);
  };

  const payments = data?.results ?? [];
  // A transfer only moves money between the farm's own accounts: neither in nor out.
  const { incoming: totalIncoming, outgoing: totalOutgoing } = totals(payments);

  // One supplier payment is one line, however many bills it settled.
  const rows = groupSupplierPayments(payments);

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", render: (p) => new Date(p.payment_date).toLocaleDateString() },
    {
      key: "direction",
      header: "Direction",
      render: (p) => (
        p.ref_type === "TRANSFER" ? (
          <StatusBadge tone="neutral" label="Transfer" />
        ) : (
          <StatusBadge
            tone={p.direction === "INCOMING" ? "success" : "warning"}
            label={humanizeEnum(p.direction)}
          />
        )
      ),
    },
    { key: "ref_type", header: "Kind", render: kindOf },
    { key: "ref", header: "Record", render: (p) => refLabel(p) },
    { key: "amount", header: "Amount", render: (p) => formatTk(p.amount), numeric: true },
    { key: "from", header: "From", render: (p) => instrumentLabel(p.from_instrument_id) },
    { key: "to", header: "To", render: (p) => instrumentLabel(p.to_instrument_id) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total payments" value={data?.total ?? payments.length} icon={Receipt} isLoading={isLoading} />
        <KPICard label="Total incoming" money={totalIncoming} icon={ArrowDownLeft} isLoading={isLoading} />
        <KPICard label="Total outgoing" money={totalOutgoing} icon={ArrowUpRight} isLoading={isLoading} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Record payment
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        totalCount={data && data.total - (payments.length - rows.length)}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        empty={{
          icon: Wallet,
          title: "No payments recorded yet",
          description: "Record money in or out: a bill, your own capital or draw, or a transfer between accounts.",
          action: { label: "Record payment", onClick: () => setCreateOpen(true) },
        }}
      />

      <PaymentCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
