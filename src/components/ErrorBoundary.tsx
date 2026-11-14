import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[React ErrorBoundary] Caught runtime error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Something went wrong while rendering this view',
        fallbackMessage,
        compact = false,
      } = this.props;

      const safeMessage =
        fallbackMessage ||
        this.state.error?.message ||
        'An unexpected runtime error occurred. Please retry or return to the home page.';

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: compact ? '260px' : '60vh',
            padding: compact ? '1.5rem' : '2.5rem 1.25rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="glass"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: compact ? '1.5rem' : '2.25rem',
              borderRadius: '18px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
              textAlign: 'center',
              color: '#f8fafc',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
              }}
            >
              <AlertTriangle size={26} />
            </div>

            <h2
              style={{
                margin: '0 0 0.5rem',
                fontSize: compact ? '1.1rem' : '1.35rem',
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              {fallbackTitle}
            </h2>

            <p
              style={{
                margin: '0 0 1.5rem',
                fontSize: '0.9rem',
                lineHeight: 1.55,
                color: '#cbd5e1',
                wordBreak: 'break-word',
              }}
            >
              {safeMessage}
            </p>

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={this.handleRetry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(250, 204, 21, 0.45)',
                  background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.22), rgba(245, 158, 11, 0.16))',
                  color: '#fde047',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={15} />
                <span>Retry</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                <Home size={15} />
                <span>Go Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
