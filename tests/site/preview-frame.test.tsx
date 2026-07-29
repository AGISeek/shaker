import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PreviewFrame } from "@/components/site/preview-frame"

describe("PreviewFrame", () => {
  it("keeps the default iframe route static and applies theme and device controls to the frame", () => {
    render(<PreviewFrame name="button" title="Button" />)
    const frame = screen.getByTitle("Button preview")

    expect(frame).toHaveAttribute("src", "/preview/button/")
    expect(screen.getByTestId("preview-viewport")).toHaveStyle({ width: "1280px" })

    fireEvent.click(screen.getByRole("button", { name: "Dark" }))
    expect(screen.getByTitle("Button preview")).toHaveAttribute("src", "/preview/button/?theme=dark")

    fireEvent.click(screen.getByRole("button", { name: "Mobile" }))
    expect(screen.getByTestId("preview-viewport")).toHaveStyle({ width: "390px" })
  })

  it("renders the selected asset source in Code mode", () => {
    const { container } = render(<PreviewFrame name="button" title="Button" code="export const Button = () => null" />)

    fireEvent.click(within(container).getByRole("button", { name: "Code" }))

    expect(within(container).getByText("export const Button = () => null")).toBeInTheDocument()
  })

  it("shows a failure message when toolbar command copying is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    const { container } = render(<PreviewFrame name="button" title="Button" />)

    fireEvent.click(within(container).getByRole("button", { name: "复制命令" }))

    await waitFor(() => expect(within(container).getByRole("alert")).toHaveTextContent("复制失败，请手动复制"))
  })
})
