"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/ui/button"

type PreviewErrorBoundaryProps = { children: ReactNode }
type PreviewErrorBoundaryState = { hasError: boolean }

export class PreviewErrorBoundary extends Component<PreviewErrorBoundaryProps, PreviewErrorBoundaryState> {
  state: PreviewErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): PreviewErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8" role="alert">
          <p>预览加载失败</p>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => window.location.reload()}>重新加载预览</Button>
        </div>
      )
    }

    return this.props.children
  }
}
