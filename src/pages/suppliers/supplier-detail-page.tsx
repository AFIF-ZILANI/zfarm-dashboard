import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Banknote, HandCoins, Mail, MapPin, Package, Pencil, Phone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Supplier } from "@/pages/suppliers/types";
import { SupplierFormDialog } from "@/pages/suppliers/supplier-form-dialog";
import { OpeningDialog } from "@/pages/suppliers/opening-dialog";
import { PaySupplierDialog } from "@/pages/suppliers/pay-supplier-dialog";
import { StatementCard } from "@/pages/suppliers/statement-card";
import type { SupplierBalance, SupplierStatement } from "@/pages/suppliers/supplier-money-types";
import { SupplierRefundDialog } from "@/pages/suppliers/supplier-refund-dialog";

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: supplier, isLoading } = useGetData<Supplier>(`/suppliers/${id}`, ["suppliers", id]);
  usePageTitle(supplier?.profile.name ?? "Supplier");

  const { data: balances } = useGetData<SupplierBalance[]>("/suppliers/balances", ["suppliers", "balances"]);
  // All dates: the card below has its own range.
  const { data: statement } = useGetData<SupplierStatement>(`/suppliers/${id}/statement?`, ["suppliers", id, "statement", "", ""]);
  const balance = balances?.find((b) => b.supplier_id === id);
  const owed = parseFloat(balance?.owed ?? "0");
  const advance = parseFloat(balance?.advance ?? "0");
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  const deactivate = usePostData<Supplier, void>(`/suppliers/${id}/deactivate`, ["suppliers"]);
  const reactivate = usePostData<Supplier, void>(`/suppliers/${id}/reactivate`, ["suppliers"]);

  const toggleActive = () => {
    const mutation = supplier?.is_active ? deactivate : reactivate;
    mutation.mutate(undefined, {
      onSuccess: () => toast.success(supplier?.is_active ? "Supplier deactivated" : "Supplier reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  if (isLoading || !supplier) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { tone, label } = activeStatus(supplier.is_active);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/suppliers")}>
        <ArrowLeft />
        Back to suppliers
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{supplier.profile.name}</CardTitle>
              <StatusBadge tone={tone} label={label} />
            </div>
            <p className="text-sm text-muted-foreground">
              {humanizeEnum(supplier.role)}
              {supplier.company && ` · ${supplier.company}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
            <Button
              variant={supplier.is_active ? "destructive" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={deactivate.isPending || reactivate.isPending}
            >
              {supplier.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="size-3.5" />
            {supplier.profile.mobile}
          </div>
          {supplier.profile.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-3.5" />
              {supplier.profile.email}
            </div>
          )}
          {supplier.profile.address && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5" />
              {supplier.profile.address}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {supplier.supplies.map((cat) => (
              <span key={cat} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {humanizeEnum(cat)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="You owe" money={owed} icon={Banknote} isLoading={!balances} />
        <KPICard label="Advance they hold" money={advance} icon={HandCoins} isLoading={!balances} />
        <KPICard label="Bought" money={statement?.bought ?? 0} icon={Package} isLoading={!statement} />
        <KPICard label="Paid" money={statement?.paid ?? 0} icon={Wallet} isLoading={!statement} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPayOpen(true)}>
          <Banknote />
          Pay supplier
        </Button>
        {advance > 0 && (
          <Button variant="outline" onClick={() => setRefundOpen(true)}>
            Refund
          </Button>
        )}
        <Button variant="outline" onClick={() => setOpeningOpen(true)}>
          Old balance
        </Button>
      </div>

      <StatementCard supplierId={supplier.id} supplierName={supplier.profile.name} />

      <PaySupplierDialog supplierId={supplier.id} supplierName={supplier.profile.name} open={payOpen} onOpenChange={setPayOpen} />
      <SupplierRefundDialog
        supplierId={supplier.id}
        supplierName={supplier.profile.name}
        advance={advance}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
      <OpeningDialog supplier={supplier} open={openingOpen} onOpenChange={setOpeningOpen} />
      <SupplierFormDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
    </div>
  );
}
