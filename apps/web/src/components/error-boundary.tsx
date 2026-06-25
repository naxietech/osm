/**
 * Top-level error boundary — catches render errors anywhere below it and shows a
 * recoverable fallback instead of a blank white screen.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // TODO: report to an error-tracking service (e.g. Sentry) in production.
    // eslint-disable-next-line no-console
    console.error('Uncaught error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
          <h1 className="text-3xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Try reloading the page.
          </p>
          <pre className="max-w-md overflow-auto rounded-md bg-muted px-4 py-2 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-brand-foreground transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
