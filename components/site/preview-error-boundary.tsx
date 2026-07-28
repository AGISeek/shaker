"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

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
        <div className="preview-error" role="alert">
          <p>预览加载失败</p>
          <button className="button" onClick={() => window.location.reload()}>重新加载预览</button>
        </div>
      )
    }

    return this.props.children
  }
}
