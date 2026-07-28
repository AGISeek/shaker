import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PreviewFrame } from "@/components/site/preview-frame"

describe("PreviewFrame", () => {
  it("keeps the default iframe route static and applies theme and device controls to the frame", () => {
    render(<PreviewFrame name="button" title="Button" />)
    const frame = screen.getByTitle("Button")

    expect(frame).toHaveAttribute("src", "/preview/button/")
    expect(frame).toHaveStyle({ width: "1280px" })

    fireEvent.click(screen.getByRole("button", { name: "Dark" }))
    expect(screen.getByTitle("Button")).toHaveAttribute("src", "/preview/button/?theme=dark")

    fireEvent.click(screen.getByRole("button", { name: "Mobile 390" }))
    expect(screen.getByTitle("Button")).toHaveStyle({ width: "390px" })
  })
})
