import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches render-time errors so a single throw cannot unmount the whole tree
 * and leave the user staring at an empty page. Deliberately dependency-free
 * and untranslated: it has to render even when i18n, routing or a context
 * provider is the thing that broke.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-16 bg-slate-900 p-24 text-center text-white">
        <div className="text-24 font-medium">Something went wrong</div>
        <div className="max-w-[480px] text-slate-100">
          The page failed to render. Your funds and open positions are unaffected — reload to continue.
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-4 bg-blue-300 px-24 py-10 font-medium text-white"
        >
          Reload
        </button>
        <pre className="max-h-[200px] max-w-full overflow-auto whitespace-pre-wrap text-left text-12 text-slate-100 opacity-70">
          {error.message}
        </pre>
      </div>
    );
  }
}
