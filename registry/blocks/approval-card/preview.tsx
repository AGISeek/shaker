import { useState } from "react"
import { ApprovalCard } from "./approval-card"

export default function ApprovalCardPreview() {
  const [status, setStatus] = useState<"待审批" | "已批准" | "已拒绝">("待审批")

  return (
    <div className="max-w-sm">
      <ApprovalCard
        title="市场活动预算"
        requester="林晓"
        amount="¥ 18,600"
        status={status}
        onApprove={() => setStatus("已批准")}
        onReject={() => setStatus("已拒绝")}
      />
    </div>
  )
}
