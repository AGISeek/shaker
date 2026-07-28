import { expect, test } from "@playwright/test"

test("static preview hydrates component content without site chrome", async ({ page }) => {
  await page.goto("/preview/button/")

  await expect(page.getByRole("button", { name: "Default" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Secondary" })).toBeVisible()
  await expect(page.locator(".site-header")).toHaveCount(0)
  await expect(page.locator(".site-footer")).toHaveCount(0)
  await expect(page.locator(".site-main")).toHaveCount(0)
})
