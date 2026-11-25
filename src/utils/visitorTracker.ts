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
  if (typeof window === 'undefined') return 'Other';
  const ua = navigator.userAgent || '';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium|Edg/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Other';
}

function detectOs(): string {
  if (typeof window === 'undefined') return 'Other';
  const ua = navigator.userAgent || '';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Other';
}

function getStoredStudentId(): number | null {
  try {
    if (localStorage.getItem('tnpsc_admin_preview_active') === 'true') {
      return null;
    }
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
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingInitialized = false;

function dispatchTrackPayload(
  eventType: 'page_view' | 'heartbeat' | 'session_end',
  pagePath?: string,
  pageTitle?: string
) {
  if (typeof window === 'undefined') return;

  const currentPath = pagePath || window.location.pathname || '/';
  if (currentPath.startsWith('/admin') || currentPath === '/owner-login') return;

  if (eventType === 'page_view') {
    lastTrackedPath = currentPath;
  }

  const visitorId = getOrGenerateId('tnpsc_visitor_id', localStorage);
  const sessionId = getOrGenerateId('tnpsc_session_id', sessionStorage);
  const studentId = eventType === 'session_end' ? null : getStoredStudentId();
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
    eventType,
  };

  const endpoint = getApiUrl('/api/analytics/track');

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

export function trackPageView(pagePath?: string, pageTitle?: string) {
  dispatchTrackPayload('page_view', pagePath, pageTitle);
}

export function sendSessionHeartbeat(pagePath?: string) {
  dispatchTrackPayload('heartbeat', pagePath || lastTrackedPath || window.location.pathname);
}

export function endVisitorSession() {
  dispatchTrackPayload('session_end', lastTrackedPath || window.location.pathname);
}

export function trackAnalyticsEvent(
  eventType: string,
  metadata: Record<string, any> = {},
  eventId?: string
) {
  if (typeof window === 'undefined') return;
  const currentPath = window.location.pathname || '/';
  if (currentPath.startsWith('/admin') || currentPath === '/owner-login') return;

  const visitorId = getOrGenerateId('tnpsc_visitor_id', localStorage);
  const sessionId = getOrGenerateId('tnpsc_session_id', sessionStorage);
  const token = localStorage.getItem('tnpsc_student_token');
  const endpoint = getApiUrl('/api/analytics/event');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && localStorage.getItem('tnpsc_admin_preview_active') !== 'true') {
    headers.Authorization = `Bearer ${token}`;
  }

  fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventId: eventId || `${eventType}_${sessionId}_${Date.now()}`,
      eventType,
      visitorId,
      sessionId,
      pagePath: currentPath,
      metadata,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function startVisitorTracking() {
  if (typeof window === 'undefined' || trackingInitialized) return;
  trackingInitialized = true;

  // Setup periodic heartbeat every 45 seconds while active (updates last_heartbeat, no duplicate page_views)
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendSessionHeartbeat();
      }
    }, 45000);
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendSessionHeartbeat();
    }
  });

  window.addEventListener('pagehide', () => {
    endVisitorSession();
  });
}

