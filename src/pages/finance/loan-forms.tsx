import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatTk } from "@/lib/utils";
import { farmToday } from "@/lib/farm-day";
import type { Batch } from "@/pages/batches/types";
import {
  LOAN_FREQUENCIES,
  LOAN_PURPOSES,
  LOAN_PURPOSE_LABEL,
  LOAN_TERMS,
  LOAN_TERMS_LABEL,
  type Loan,
  type LoanFrequency,
  type LoanPurpose,
  type LoanTerms,
} from "@/pages/finance/types";
import { interestPart, schedule } from "@/pages/finance/loan-math";

const FREQUENCY_LABEL: Record<LoanFrequency, string> = { MONTHLY: "Monthly", WEEKLY: "Weekly", ONE_OFF: "Once, in full" };

/** Who bears the interest, in the words the Record loan dialog shows. */
const PURPOSE_HINT: Record<LoanPurpose, string> = {
  BATCH: "Chicks and feed for one batch. That batch carries all of the interest, booked now.",
  FARM: "A shed, equipment, solar. Each installment's interest is shared by the batches running then.",
  LOSS: "Covering a disease or price shock. Interest is shared like a farm loan.",
  OLD_DEBT: "Owed before FMS started. No money comes in now; only the repayments are recorded.",
};

const loanSchema = z
  .object({
    lender: z.string().trim().min(1, "Say who lent the money"),
    purpose: z.enum(LOAN_PURPOSES, "Pick why you borrowed"),
    batch_id: z.string(),
    principal: z.coerce.number().positive("Enter the amount borrowed"),
    terms: z.enum(LOAN_TERMS),
    annual_rate: z.string(),
    total_payable: z.string(),
    installment_count: z.coerce.number().int().positive("At least one installment"),
    frequency: z.enum(LOAN_FREQUENCIES),
    received_on: z.string().min(1, "Date is required"),
    first_due_on: z.string().min(1, "Date is required"),
    account_id: z.string(),
    note: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.purpose === "BATCH" && !v.batch_id) issue("batch_id", "Pick the batch");
    if (v.purpose !== "OLD_DEBT" && !v.account_id) issue("account_id", "Say which account the money landed in");
    if (v.terms === "EMI" && !(Number(v.annual_rate) > 0)) issue("annual_rate", "Enter the yearly rate");
    if (v.terms === "EMI" && v.frequency === "ONE_OFF") issue("frequency", "An EMI is paid monthly or weekly");
    if (v.terms === "FLAT" && !(Number(v.total_payable) >= v.principal))
      issue("total_payable", "The total to repay can't be less than the amount borrowed");
    if (v.purpose !== "OLD_DEBT" && v.first_due_on < v.received_on) issue("first_due_on", "Can't be before the loan's own date");
    if (v.frequency === "ONE_OFF" && v.installment_count !== 1) issue("installment_count", "A one-off repayment is one installment");
  });
type LoanFormInput = z.input<typeof loanSchema>;
type LoanFormValues = z.output<typeof loanSchema>;

const blankLoan = (): LoanFormInput => ({
  lender: "",
  purpose: undefined as unknown as LoanPurpose,
  batch_id: "",
  principal: "",
  terms: "FLAT",
  annual_rate: "",
  total_payable: "",
  installment_count: "1",
  frequency: "MONTHLY",
  received_on: farmToday(),
  first_due_on: farmToday(),
  account_id: "",
  note: "",
});

export function RecordLoanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoanFormInput, unknown, LoanFormValues>({ resolver: zodResolver(loanSchema), defaultValues: blankLoan() });
  useEffect(() => {
    if (open) reset(blankLoan());
  }, [open, reset]);

  const purpose = useWatch({ control, name: "purpose" }) as LoanPurpose | undefined;
  const terms = useWatch({ control, name: "terms" }) as LoanTerms;
  const frequency = useWatch({ control, name: "frequency" }) as LoanFrequency;
  const [principal, rate, total, count] = useWatch({
    control,
    name: ["principal", "annual_rate", "total_payable", "installment_count"],
  }).map((x) => Number(x) || 0);
  const preview = schedule(principal, terms, rate, total, count, frequency);

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"], { enabled: purpose === "BATCH" });
  const openBatches = (batches?.results ?? []).filter((b) => b.status !== "CLOSED");

  const queryClient = useQueryClient();
  const create = usePostData<Loan, Record<string, unknown>>("/loans", ["loans"]);
  const onSubmit = (v: LoanFormValues) =>
    create.mutate(
      {
        lender: v.lender,
        purpose: v.purpose,
        principal: v.principal,
        terms: v.terms,
        installment_count: v.installment_count,
        frequency: v.frequency,
        received_on: v.received_on,
        first_due_on: v.first_due_on,
        ...(v.purpose === "BATCH" && { batch_id: v.batch_id }),
        ...(v.purpose !== "OLD_DEBT" && { to_instrument_id: v.account_id }),
        ...(v.terms === "EMI" && { annual_rate: Number(v.annual_rate) }),
        ...(v.terms === "FLAT" && { total_payable: Number(v.total_payable) }),
        ...(v.note && { note: v.note }),
      },
      {
        onSuccess: () => {
          // The money landed in an account and, for a batch loan, its interest is now a cost.
          for (const key of ["payments", "payment-instruments", "expenses", "analytics"]) {
            void queryClient.invalidateQueries({ queryKey: [key] });
          }
          toast.success(`Loan from ${v.lender} recorded`);
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error.fieldError("principal") ?? error.fieldError("installment_count") ?? error.fieldError("first_due_on") ?? error.message),
      },
    );

  const field = (name: keyof LoanFormInput) => errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record a loan</DialogTitle>
          <DialogDescription>
            Only the interest is a cost. The amount borrowed comes in as cash and goes out again as installments.
          </DialogDescription>
        </DialogHeader>
        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lender">Lender</Label>
              <Input id="lender" placeholder="Bank, NGO, person" {...register("lender")} aria-invalid={!!errors.lender} />
              {field("lender")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purpose">Why you borrowed</Label>
              <Controller
                control={control}
                name="purpose"
                render={({ field: f }) => (
                  <Select value={f.value ?? ""} onValueChange={f.onChange}>
                    <SelectTrigger id="purpose" className="w-full" aria-invalid={!!errors.purpose}>
                      <SelectValue>{(v: LoanPurpose) => (v ? LOAN_PURPOSE_LABEL[v] : "Select")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_PURPOSES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {LOAN_PURPOSE_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {field("purpose")}
            </div>
          </div>
          {purpose && <p className="-mt-2 text-xs text-muted-foreground">{PURPOSE_HINT[purpose]}</p>}

          {purpose === "BATCH" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batch_id">Batch</Label>
              <Controller
                control={control}
                name="batch_id"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id="batch_id" className="w-full" aria-invalid={!!errors.batch_id}>
                      <SelectValue>{(v: string) => openBatches.find((b) => b.id === v)?.batch_code ?? "Select batch"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {openBatches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batch_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {field("batch_id")}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="principal">{purpose === "OLD_DEBT" ? "Still owed (৳)" : "Amount borrowed (৳)"}</Label>
              <NumericInput id="principal" allowDecimal decimalPlaces={2} {...register("principal")} aria-invalid={!!errors.principal} />
              {field("principal")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="received_on">{purpose === "OLD_DEBT" ? "Recorded on" : "Received on"}</Label>
              <Input id="received_on" type="date" max={farmToday()} {...register("received_on")} />
              {field("received_on")}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="terms">Interest</Label>
              <Controller
                control={control}
                name="terms"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id="terms" className="w-full">
                      <SelectValue>{(v: LoanTerms) => LOAN_TERMS_LABEL[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_TERMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {LOAN_TERMS_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {terms === "EMI" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="annual_rate">Yearly rate (%)</Label>
                <NumericInput id="annual_rate" allowDecimal decimalPlaces={3} {...register("annual_rate")} aria-invalid={!!errors.annual_rate} />
                {field("annual_rate")}
              </div>
            )}
            {terms === "FLAT" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="total_payable">Total to repay (৳)</Label>
                <NumericInput id="total_payable" allowDecimal decimalPlaces={2} {...register("total_payable")} aria-invalid={!!errors.total_payable} />
                {field("total_payable")}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frequency">Repaid</Label>
              <Controller
                control={control}
                name="frequency"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id="frequency" className="w-full" aria-invalid={!!errors.frequency}>
                      <SelectValue>{(v: LoanFrequency) => FREQUENCY_LABEL[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_FREQUENCIES.map((x) => (
                        <SelectItem key={x} value={x}>
                          {FREQUENCY_LABEL[x]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {field("frequency")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="installment_count">Installments</Label>
              <NumericInput id="installment_count" {...register("installment_count")} aria-invalid={!!errors.installment_count} />
              {field("installment_count")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_due_on">First due</Label>
              <Input id="first_due_on" type="date" {...register("first_due_on")} />
              {field("first_due_on")}
            </div>
          </div>

          {preview && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm tabular-nums">
              {count > 1 ? `${formatTk(preview.installment)} × ${count}` : "One payment"} = {formatTk(preview.total)} to repay, of which{" "}
              <span className="font-medium">{formatTk(preview.total - principal)} is interest</span>.
            </p>
          )}

          {purpose !== "OLD_DEBT" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account_id">Money landed in</Label>
              <Controller
                control={control}
                name="account_id"
                render={({ field: f }) => <FarmAccountSelect id="account_id" value={f.value} onChange={f.onChange} invalid={!!errors.account_id} />}
              />
              {field("account_id")}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan_note">Note (optional)</Label>
            <Input id="loan_note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Record loan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const installmentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount above 0"),
  payment_date: z.string().min(1, "Date is required"),
  account_id: z.string().min(1, "Select the farm account"),
  interest: z.string(),
  transaction_ref: z.string().trim().optional(),
});
type InstallmentInput = z.input<typeof installmentSchema>;
type InstallmentValues = z.output<typeof installmentSchema>;

export function PayInstallmentDialog({ loan, onOpenChange }: { loan: Loan | null; onOpenChange: (open: boolean) => void }) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InstallmentInput, unknown, InstallmentValues>({ resolver: zodResolver(installmentSchema) });
  const left = loan ? parseFloat(loan.left) : 0;
  // Hoisted: the React Compiler crashes on `loan?.x` read inside a closure while loan is null.
  const loanId = loan?.id;
  const lender = loan?.lender;
  const receivedOn = loan?.received_on.slice(0, 10);
  useEffect(() => {
    if (loan)
      reset({
        amount: String(Math.min(parseFloat(loan.installment_amount), left)),
        payment_date: farmToday(),
        account_id: "",
        interest: "",
        transaction_ref: "",
      });
  }, [loan, left, reset]);

  const amount = Number(useWatch({ control, name: "amount" })) || 0;
  // A batch loan's interest is already on its batch; an interest-free one has none.
  const asksInterest = !!loan && loan.purpose !== "BATCH" && parseFloat(loan.interest_total) > 0;
  const { suggested, least, most } = loan ? interestPart(loan, amount) : { suggested: 0, least: 0, most: 0 };

  const queryClient = useQueryClient();
  const pay = usePostData<unknown, Record<string, unknown>>(() => `/loans/${loanId}/installments`, ["loans"]);
  const onSubmit = (v: InstallmentValues) => {
    if (v.amount > left + 0.005) {
      setError("amount", { message: `Only ${formatTk(left)} is left` });
      return;
    }
    const interest = v.interest === "" ? undefined : Number(v.interest);
    if (asksInterest && interest !== undefined && (interest < least - 0.005 || interest > most + 0.005)) {
      setError("interest", { message: `Between ${formatTk(least)} and ${formatTk(most)} for this payment` });
      return;
    }
    if (receivedOn && v.payment_date < receivedOn) {
      setError("payment_date", { message: "Before the loan's own date" });
      return;
    }
    pay.mutate(
      {
        amount: v.amount,
        payment_date: v.payment_date,
        from_instrument_id: v.account_id,
        ...(asksInterest && interest !== undefined && { interest }),
        ...(v.transaction_ref && { transaction_ref: v.transaction_ref }),
      },
      {
        onSuccess: () => {
          for (const key of ["payments", "payment-instruments", "expenses", "analytics"]) {
            void queryClient.invalidateQueries({ queryKey: [key] });
          }
          toast.success(`${formatTk(v.amount)} paid to ${lender}`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.fieldError("amount") ?? error.fieldError("interest") ?? error.fieldError("payment_date") ?? error.message),
      },
    );
  };

  return (
    <Dialog open={!!loan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay installment</DialogTitle>
          <DialogDescription>
            {loan?.lender}: {formatTk(left)} left of {formatTk(loan?.total_payable ?? 0)}.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst_amount">Amount (৳)</Label>
              <NumericInput id="inst_amount" allowDecimal decimalPlaces={2} {...register("amount")} aria-invalid={!!errors.amount} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst_date">Date</Label>
              <Input id="inst_date" type="date" min={receivedOn} max={farmToday()} {...register("payment_date")} aria-invalid={!!errors.payment_date} />
              {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date.message}</p>}
            </div>
          </div>
          {asksInterest && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="inst_interest">Interest part (৳)</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setValue("interest", String(suggested))}
                >
                  Use {formatTk(suggested)}
                </button>
              </div>
              <NumericInput
                id="inst_interest"
                allowDecimal
                decimalPlaces={2}
                placeholder={String(suggested)}
                {...register("interest")}
                aria-invalid={!!errors.interest}
              />
              <p className="text-xs text-muted-foreground">
                Left blank, {formatTk(suggested)} is used: this payment's share of the interest still left. Type the figure on the
                bank statement if it differs. Only this part is a cost.
              </p>
              {errors.interest && <p className="text-xs text-destructive">{errors.interest.message}</p>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst_account">Paid from</Label>
              <Controller
                control={control}
                name="account_id"
                render={({ field }) => (
                  <FarmAccountSelect id="inst_account" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.account_id} />
                )}
              />
              {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inst_ref">Transaction ref (optional)</Label>
              <Input id="inst_ref" {...register("transaction_ref")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || pay.isPending}>
              {pay.isPending && <Loader2 className="animate-spin" />}
              Pay {amount > 0 ? formatTk(amount) : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
