/**
 * Centralized Deployment Build Version Management & Safe Update Recovery.
 * Single source of truth for CURRENT_BUILD_ID, /version.json polling,
 * Service Worker activation, and loop-safe cache-busting reload.
 */

export interface DeploymentVersionState {
  currentBuildId: string;
  currentBuildTime: string;
  latestBuildId: string | null;
  environment: string;
  mismatchDetected: boolean;
  lastCheckedAt: string | null;
  serviceWorkerStatus: string;
  assetStatus: 'ok' | 'chunk-error';
}

const RELOAD_GUARD_KEY = 'tnpsc_version_reload_guard';
const RELOAD_COOLDOWN_MS = 20_000;

export const CURRENT_BUILD_ID: string =
  typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__.trim()
    ? __APP_BUILD_ID__.trim()
    : 'dev-local';

export const CURRENT_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ === 'string' && __APP_BUILD_TIME__.trim()
    ? __APP_BUILD_TIME__.trim()
    : '';

export const DEPLOYMENT_ENV: string = import.meta.env?.MODE || 'production';

const versionState: DeploymentVersionState = {
  currentBuildId: CURRENT_BUILD_ID,
  currentBuildTime: CURRENT_BUILD_TIME,
  latestBuildId: CURRENT_BUILD_ID,
  environment: DEPLOYMENT_ENV,
  mismatchDetected: false,
  lastCheckedAt: null,
  serviceWorkerStatus: 'unknown',
  assetStatus: 'ok',
};

export function getDeploymentVersionState(): DeploymentVersionState {
  return { ...versionState };
}

export function markAssetChunkError(): void {
  versionState.assetStatus = 'chunk-error';
}

export async function inspectServiceWorkerStatus(): Promise<string> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    versionState.serviceWorkerStatus = 'unsupported';
    return versionState.serviceWorkerStatus;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      versionState.serviceWorkerStatus = 'not-registered';
    } else if (reg.waiting) {
      versionState.serviceWorkerStatus = 'update-waiting';
    } else if (reg.installing) {
      versionState.serviceWorkerStatus = 'installing';
    } else if (reg.active) {
      versionState.serviceWorkerStatus = 'active';
    } else {
      versionState.serviceWorkerStatus = 'registered';
    }
  } catch {
    versionState.serviceWorkerStatus = 'error';
  }
  return versionState.serviceWorkerStatus;
}

/**
 * Checks /version.json for a genuinely newer production deployment.
 * Strictly guards against undefined/null/empty comparisons and never fires
 * false version mismatch warnings in local development.
 */
export async function checkForNewDeployment(): Promise<DeploymentVersionState> {
  await inspectServiceWorkerStatus();

  if (typeof window === 'undefined' || import.meta.env?.DEV) {
    versionState.latestBuildId = CURRENT_BUILD_ID;
    versionState.mismatchDetected = false;
    versionState.lastCheckedAt = new Date().toISOString();
    return getDeploymentVersionState();
  }

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !ct.includes('application/json')) {
      return getDeploymentVersionState();
    }

    const data = await res.json().catch(() => null);
    const remoteBuildId =
      data && typeof data.buildId === 'string' ? data.buildId.trim() : '';

    if (remoteBuildId && CURRENT_BUILD_ID && CURRENT_BUILD_ID !== 'dev-local') {
      versionState.latestBuildId = remoteBuildId;
      versionState.mismatchDetected = remoteBuildId !== CURRENT_BUILD_ID;
      versionState.lastCheckedAt = new Date().toISOString();
    }
  } catch {
    // Transient network error — never trigger a false version mismatch
  }

  return getDeploymentVersionState();
}

export function canAutoReloadForUpdate(targetBuildId?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { ts?: number; buildId?: string };
    const elapsed = Date.now() - Number(parsed.ts || 0);
    if (elapsed < RELOAD_COOLDOWN_MS) {
      return false;
    }
    if (targetBuildId && parsed.buildId === targetBuildId && elapsed < 120_000) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Performs a genuine cache-busting recovery reload:
 * 1. Activates any waiting Service Worker via SKIP_WAITING
 * 2. Purges stale tnpsc-hub-* CacheStorage buckets
 * 3. Records a session guard to prevent infinite reload loops
 * 4. Reloads cleanly to fetch the newest index.html & hashed chunks
 */
export async function performCleanUpdateReload(force = true): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!force && !canAutoReloadForUpdate(versionState.latestBuildId)) {
    return;
  }

  try {
    sessionStorage.setItem(
      RELOAD_GUARD_KEY,
      JSON.stringify({ ts: Date.now(), buildId: versionState.latestBuildId || CURRENT_BUILD_ID })
    );
  } catch {
    // ignore storage errors
  }

  try {
    if ('serviceWorker' in navigator) {
      if (import.meta.env?.DEV) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      } else {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg?.update().catch(() => {});
      }
    }
  } catch {
    // continue reload
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('tnpsc-hub-'))
          .map((k) => caches.delete(k).catch(() => false))
      );
    }
  } catch {
    // continue reload
  }

  window.location.reload();
}
