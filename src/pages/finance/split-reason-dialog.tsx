import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostData } from "@/lib/api";
import { useRefreshSplit } from "@/pages/finance/use-refresh-split";

/** Undo a decision, skip a batch or take out a wrong move: all need a reason, and stay in the Audit Log. */
export type ReasonAsk = { title: string; description: string; action: string; done: string; endpoint: string; body?: Record<string, unknown> };

export function SplitReasonDialog({ ask, onClose }: { ask: ReasonAsk | null; onClose: () => void }) {
  return (
    <Dialog open={!!ask} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{ask && <Form ask={ask} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Form({ ask, onClose }: { ask: ReasonAsk; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const refresh = useRefreshSplit();
  const post = usePostData<unknown, Record<string, unknown>>(ask.endpoint, ["profit-splits"]);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void post.mutate(
          { ...ask.body, reason: reason.trim() },
          {
            onSuccess: () => {
              refresh();
              toast.success(ask.done);
              onClose();
            },
            onError: (error) => toast.error(Object.values(error.fields ?? {})[0] ?? error.message),
          }
        );
      }}
    >
      <DialogHeader>
        <DialogTitle>{ask.title}</DialogTitle>
        <DialogDescription>{ask.description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="split_reason">Reason</Label>
        <Input id="split_reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="text-xs text-muted-foreground">A copy is kept in the Audit Log.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={post.isPending || reason.trim().length < 3}>
          {post.isPending && <Loader2 className="animate-spin" />}
          {ask.action}
        </Button>
      </DialogFooter>
    </form>
  );
}
