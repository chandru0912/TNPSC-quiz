import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home, RefreshCw } from 'lucide-react';
import {
  checkForNewDeployment,
  getDeploymentVersionState,
  markAssetChunkError,
  performCleanUpdateReload,
  type DeploymentVersionState,
} from '../utils/appVersion';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  compact?: boolean;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  retryCount: number;
  retryKey: number;
  failedRoute: string;
  versionState: DeploymentVersionState;
  isReloading: boolean;
}

const MAX_INLINE_RETRIES = 2;

function extractFailedModuleUrl(error: Error | null): string | null {
  if (!error?.message) return null;
  const match = error.message.match(/https?:\/\/[^\s'"]+|\/src\/[^\s'"]+|\/assets\/[^\s'"]+/i);
  return match ? match[0] : null;
}

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const name = String(error.name || '').toLowerCase();
  return (
    name.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('expected a javascript-or-wasm module script')
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      retryCount: 0,
      retryKey: 0,
      failedRoute: '',
      versionState: getDeploymentVersionState(),
      isReloading: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const failedRoute =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '';
    if (isChunkLoadError(error)) {
      markAssetChunkError();
    }
    return {
      hasError: true,
      error,
      failedRoute,
      versionState: getDeploymentVersionState(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const route =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : 'unknown';
    const isStudentAuthenticated =
      typeof window !== 'undefined' && Boolean(localStorage.getItem('tnpsc_student_token'));
    const isAdminAuthenticated =
      typeof window !== 'undefined' && Boolean(localStorage.getItem('tnpsc_admin_token'));

    this.setState({
      componentStack: errorInfo?.componentStack || '',
      failedRoute: route,
    });

    // Check live /version.json & Service Worker status for accurate diagnostics
    void checkForNewDeployment().then((latestState) => {
      if (this.state.hasError) {
        this.setState({ versionState: latestState });
      }
    });

    // Safe diagnostic log — never logs tokens, passwords, or PII
    console.error('[React ErrorBoundary] Caught runtime error:', {
      name: error?.name,
      message: error?.message,
      route,
      buildId: this.state.versionState.currentBuildId,
      isStudentAuthenticated,
      isAdminAuthenticated,
      isChunkError: isChunkLoadError(error),
      componentStack: errorInfo?.componentStack,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
        componentStack: '',
        retryCount: 0,
        isReloading: false,
      });
    }
  }

  handleRetry = (): void => {
    const chunkError = isChunkLoadError(this.state.error);
    const exceededRetries = this.state.retryCount >= MAX_INLINE_RETRIES;

    // For chunk load errors or repeated render crashes, perform a clean cache-busting update reload
    if (typeof window !== 'undefined' && (chunkError || exceededRetries || this.state.versionState.mismatchDetected)) {
      this.setState({ isReloading: true });
      void performCleanUpdateReload(true);
      return;
    }

    this.setState((prev) => ({
      hasError: false,
      error: null,
      componentStack: '',
      retryCount: prev.retryCount + 1,
      retryKey: prev.retryKey + 1,
    }));

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: '',
      retryCount: 0,
      isReloading: false,
    });
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Something went wrong while rendering this view',
        fallbackMessage,
        compact = false,
      } = this.props;

      const chunkError = isChunkLoadError(this.state.error);
      const failedModuleUrl = extractFailedModuleUrl(this.state.error);
      const exceededRetries = this.state.retryCount >= MAX_INLINE_RETRIES;
      const isDev = Boolean(import.meta.env?.DEV);
      const { versionState } = this.state;
      const isGenuineDeployMismatch = !isDev && (versionState.mismatchDetected || chunkError);
      const shouldReload = chunkError || exceededRetries || versionState.mismatchDetected;

      const safeMessage = isGenuineDeployMismatch
        ? 'A newer version of TNPSC Aspirant Orbit was deployed. Click Reload Page to load the latest update.'
        : chunkError && isDev
          ? `A page module failed to load from the local Vite dev server${failedModuleUrl ? ` (${failedModuleUrl})` : ''}. Check the Vite terminal for errors or click Reload Page to recover.`
          : fallbackMessage ||
            'An unexpected runtime error occurred. Please retry or return to the home page.';

      // Only authorized admins or local dev mode can inspect diagnostic details (zero tokens/secrets)
      const isAdminAuthenticated =
        typeof window !== 'undefined' && Boolean(localStorage.getItem('tnpsc_admin_token'));
      const canViewDiagnostics = isDev || isAdminAuthenticated;

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
              maxWidth: '560px',
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

            {canViewDiagnostics && this.state.error && (
              <details
                style={{
                  marginBottom: '1.25rem',
                  textAlign: 'left',
                  padding: '0.8rem 0.95rem',
                  borderRadius: '10px',
                  background: 'rgba(2, 6, 23, 0.72)',
                  border: '1px solid rgba(248, 113, 113, 0.25)',
                  fontSize: '0.76rem',
                  color: '#fca5a5',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Dev Diagnostics ({this.state.failedRoute || '/'})
                </summary>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '0.25rem 0.65rem',
                    marginBottom: '0.6rem',
                    color: '#cbd5e1',
                    fontFamily: 'monospace',
                    fontSize: '0.73rem',
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>Current Build ID:</span>
                  <span>{versionState.currentBuildId}</span>
                  <span style={{ color: '#94a3b8' }}>Latest Build ID:</span>
                  <span>{versionState.latestBuildId || 'unavailable'}</span>
                  <span style={{ color: '#94a3b8' }}>Environment:</span>
                  <span>{versionState.environment}</span>
                  <span style={{ color: '#94a3b8' }}>Route:</span>
                  <span>{this.state.failedRoute || '/'}</span>
                  {failedModuleUrl && (
                    <>
                      <span style={{ color: '#94a3b8' }}>Failed Module:</span>
                      <span style={{ wordBreak: 'break-all' }}>{failedModuleUrl}</span>
                    </>
                  )}
                  <span style={{ color: '#94a3b8' }}>Version Mismatch:</span>
                  <span>{versionState.mismatchDetected ? 'Yes' : 'No'}</span>
                  <span style={{ color: '#94a3b8' }}>Service Worker:</span>
                  <span>{versionState.serviceWorkerStatus}</span>
                  <span style={{ color: '#94a3b8' }}>Asset Status:</span>
                  <span>{versionState.assetStatus}</span>
                  <span style={{ color: '#94a3b8' }}>Last Version Check:</span>
                  <span>{versionState.lastCheckedAt || 'pending'}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                  {`${this.state.error.name}: ${this.state.error.message}`}
                  {this.state.componentStack ? `\n${this.state.componentStack}` : ''}
                </div>
              </details>
            )}

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
                disabled={this.state.isReloading}
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
                {shouldReload ? <RefreshCw size={16} /> : <RotateCcw size={16} />}
                <span>{this.state.isReloading ? 'Reloading...' : shouldReload ? 'Reload Page' : 'Retry'}</span>
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
                <Home size={16} />
                <span>Go Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey} style={{ display: 'contents' }}>{this.props.children}</div>;
  }
}

export default ErrorBoundary;
