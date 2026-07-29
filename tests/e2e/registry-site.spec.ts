import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

test("searches, previews and copies an internal component", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "搜索资产…" }).click()
  await page.getByRole("combobox", { name: "搜索资产" }).fill("button")
  await page.getByRole("option", { name: "Button" }).click()
  await expect(page).toHaveURL(/\/items\/button\/$/)
  await expect(page.getByTitle("Button preview")).toBeVisible()
  await page.getByRole("button", { name: "Mobile" }).click()
  await expect(page.getByTestId("preview-viewport")).toHaveCSS("width", "390px")
})

test("previews blocks and templates in a new tab", async ({ page, context }) => {
  await page.goto("/items/approval-card/")
  const blockTab = context.waitForEvent("page")
  await page.getByRole("link", { name: "新标签页" }).click()
  const blockPreview = await blockTab
  await expect(blockPreview).toHaveURL(/\/preview\/approval-card\/$/)
  await expect(blockPreview.getByText("市场活动预算")).toBeVisible()
  await expect(blockPreview.getByRole("button", { name: "批准" })).toBeVisible()

  await page.goto("/items/admin-dashboard/")
  const templateTab = context.waitForEvent("page")
  await page.getByRole("link", { name: "新标签页" }).click()
  const templatePreview = await templateTab
  await expect(templatePreview).toHaveURL(/\/preview\/admin-dashboard\/$/)
  await expect(templatePreview.getByRole("heading", { name: "管理概览" })).toBeVisible()
  await expect(templatePreview.getByRole("region", { name: "关键指标" })).toBeVisible()
})

test("switches preview modes and has no critical axe violations", async ({ page }) => {
  await page.goto("/items/button/")
  await page.getByRole("button", { name: "切换主题" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "Code" }).click()
  await expect(page.getByLabel("Button 预览").getByText("export function Button", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Preview" }).click()
  await page.getByRole("button", { name: "Dark" }).click()
  await expect(page.getByTitle("Button preview")).toHaveAttribute("src", /theme=dark/)

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")).map((violation) => violation.id)).toEqual([])
})
