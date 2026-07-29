import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
})
