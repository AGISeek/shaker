import { expect, test } from "@playwright/test"

test("static preview hydrates component content without site chrome", async ({ page }) => {
  await page.goto("/preview/button/")

  await expect(page.getByRole("button", { name: "Default" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Secondary" })).toBeVisible()
  await expect(page.locator(".site-header")).toHaveCount(0)
  await expect(page.locator(".site-footer")).toHaveCount(0)
  await expect(page.locator(".site-main")).toHaveCount(0)
})

test("asset detail keeps a desktop-sized preview and exposes source in Code mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/items/button/")

  await expect(page.locator("iframe")).toHaveJSProperty("title", "Button preview")
  await expect.poll(async () => (await page.locator("iframe").boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(1270)

  await page.getByRole("button", { name: "Code", exact: true }).click()
  await expect(page.getByLabel("Button 预览").getByText("export function Button", { exact: false })).toBeVisible()

  await page.getByRole("button", { name: "复制命令", exact: true }).first().click()
  await expect(page.getByText("复制失败，请手动复制", { exact: true })).toBeVisible()
})
