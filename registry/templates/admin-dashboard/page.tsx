import { ApprovalCard } from "../../blocks/approval-card/approval-card"

const metrics = [
  { label: "待处理审批", value: "12" },
  { label: "本月支出", value: "¥ 128,400" },
  { label: "活跃项目", value: "24" },
  { label: "平均处理时长", value: "1.8 天" },
]

const approvals = [
  { title: "市场活动预算", requester: "林晓", amount: "¥ 18,600", status: "待审批" as const },
  { title: "供应商续约", requester: "陈默", amount: "¥ 42,000", status: "待审批" as const },
]

export default function AdminDashboard() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-5">
        <div><p className="text-sm text-neutral-500">运营中心</p><h1 className="text-2xl font-semibold tracking-tight">管理概览</h1></div>
        <p className="text-sm text-neutral-500">2026 年 7 月</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="关键指标">
        {metrics.map((metric) => <article className="rounded-lg border border-neutral-200 bg-white p-4" key={metric.label}><p className="text-sm text-neutral-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold">{metric.value}</p></article>)}
      </section>
      <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">待审批事项</h2><span className="text-sm text-neutral-500">共 {approvals.length} 项</span></div><div className="grid gap-4 md:grid-cols-2">{approvals.map((approval) => <ApprovalCard key={approval.title} {...approval} />)}</div></section>
    </main>
  )
}
