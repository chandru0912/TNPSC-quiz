import { getApiUrl } from './api';

function getOrGenerateId(key: string, storage: Storage): string {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = 'v_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return 'anon_' + Date.now();
  }
}

function detectDevice(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  const ua = navigator.userAgent || '';
  if (/iPad|tablet|PlayBook/i.test(ua) || (width >= 768 && width <= 1024)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua) || width < 768) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof window === 'undefined') return 'Chrome';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium|Edg/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/OPR\//.test(ua)) return 'Opera';
  return 'Chrome';
}

function detectOs(): string {
  if (typeof window === 'undefined') return 'Windows';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Windows';
}

function getStoredStudentId(): number | null {
  try {
    const raw = localStorage.getItem('tnpsc_student_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'number') {
        return parsed.id;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

let lastTrackedPath = '';
let heartbeatTimer: any = null;

export function trackPageView(pagePath?: string, pageTitle?: string) {
  if (typeof window === 'undefined') return;

  const currentPath = pagePath || window.location.pathname || '/';
  lastTrackedPath = currentPath;

  const visitorId = getOrGenerateId('tnpsc_visitor_id', localStorage);
  const sessionId = getOrGenerateId('tnpsc_session_id', sessionStorage);
  const studentId = getStoredStudentId();
  const deviceCategory = detectDevice();
  const browser = detectBrowser();
  const os = detectOs();
  const referrer = document.referrer || undefined;

  const payload = {
    sessionId,
    visitorId,
    studentId,
    pagePath: currentPath,
    pageTitle: pageTitle || document.title || currentPath,
    deviceCategory,
    browser,
    os,
    referrer,
  };

  const endpoint = getApiUrl('/api/analytics/track');

  // Use sendBeacon if available, otherwise fetch
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Non-blocking fail-safe
  }
}

export function startVisitorTracking() {
  if (typeof window === 'undefined') return;

  // Track initial page view
  trackPageView();

  // Setup periodic heartbeat every 45 seconds while active
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackPageView(lastTrackedPath || window.location.pathname);
      }
    }, 45000);
  }

  // Handle visibility changes
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      trackPageView(lastTrackedPath || window.location.pathname);
    }
  });
}

