import { Button } from "@/components/ui/button"

export type ApprovalCardProps = {
  title: string
  requester: string
  amount: string
  status: "待审批" | "已批准" | "已拒绝"
  onApprove?: () => void
  onReject?: () => void
}

export function ApprovalCard({ title, requester, amount, status, onApprove, onReject }: ApprovalCardProps) {
  const isPending = status === "待审批"

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-950">{title}</p>
          <p className="mt-1 text-sm text-neutral-500">申请人：{requester}</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">{status}</span>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950">{amount}</p>
      {isPending ? (
        <div className="mt-5 flex gap-2">
          <Button className="rounded-md bg-neutral-950 px-3 py-2 text-sm text-white" onClick={onApprove}>批准</Button>
          <Button className="rounded-md border border-neutral-200 px-3 py-2 text-sm" onClick={onReject}>拒绝</Button>
        </div>
      ) : null}
    </article>
  )
}
