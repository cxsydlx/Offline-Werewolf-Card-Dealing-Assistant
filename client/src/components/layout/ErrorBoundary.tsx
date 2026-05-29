import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: any) {
    console.error("UI崩溃:", error.message, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-sm text-secondary mb-2">页面出现错误</p>
          <p className="text-xs text-muted mb-4">{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="btn btn-primary">刷新页面</button>
        </div>
      );
    }
    return this.props.children;
  }
}
