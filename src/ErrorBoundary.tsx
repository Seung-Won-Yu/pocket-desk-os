import { Component, ErrorInfo, ReactNode } from "react";

type ShellErrorBoundaryProps = {
  children: ReactNode;
};

type ShellErrorBoundaryState = {
  failed: boolean;
};

export class ShellErrorBoundary extends Component<
  ShellErrorBoundaryProps,
  ShellErrorBoundaryState
> {
  state: ShellErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ShellErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PocketDesk shell crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="shell-crash-screen" role="alert">
        <section className="shell-crash-panel">
          <span aria-hidden="true" className="shell-crash-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          <h1>바탕 화면을 다시 시작해야 합니다</h1>
          <p>저장된 파일과 설정은 유지됩니다.</p>
          <button onClick={() => window.location.reload()} type="button">
            다시 시작
          </button>
        </section>
      </main>
    );
  }
}
