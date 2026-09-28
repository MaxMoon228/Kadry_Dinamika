import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Необработанная ошибка интерфейса", error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-fg">
        <div className="max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-lg)]">
          <p className="text-[15px] font-semibold">Интерфейс столкнулся с ошибкой</p>
          <p className="mt-2 text-[12.5px] text-muted">{this.state.error.message}</p>
          <button
            className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
            onClick={() => window.location.reload()}
          >
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }
}
