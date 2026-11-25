import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { AnalyticsService, TN_DISTRICTS } from '../services/analyticsService';
import { requireAdminAuth, verifyAdminToken, optionalStudentAuth, StudentAuthenticatedRequest } from '../middleware/auth';
import { analyticsEventBus } from '../services/analyticsEventBus';
import {
  getSubscriptionHistory,
  getStudentSubscriptionDetail,
  exportSubscriptionHistoryCsv,
} from '../services/subscriptionHistoryService';
import { getAdminActiveStudentSessions } from '../services/studentSessionService';
import {
  getStudentLoginUsersRegistry,
  getStudentLoginUserDetail,
  exportStudentLoginUsersCsv,
  exportIndividualStudentLoginHistoryCsv,
} from '../services/studentLoginUsersService';

const router = Router();

export type AnalyticsRange = 'today' | '7d' | '30d' | '90d' | 'all';
const VALID_RANGES = new Set<AnalyticsRange>(['today', '7d', '30d', '90d', 'all']);
function normalizeRange(raw: unknown): AnalyticsRange {
  const s = String(raw || '30d').toLowerCase().trim() as AnalyticsRange;
  return VALID_RANGES.has(s) ? s : '30d';
}

// Lightweight sliding-window rate limiter for public tracking endpoints (max 90 req/min per IP)
const trackRateMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string, maxPerMin = 90): boolean {
  const now = Date.now();
  const entry = trackRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    trackRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > maxPerMin;
}

// 0. Real-Time SSE Stream for Admin Analytics Dashboard (Admin-authenticated via Bearer or ?token=)
router.get('/stream', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const token = headerToken || queryToken;

  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized admin stream request.' });
  }

  const range = normalizeRange(req.query.range);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientId = analyticsEventBus.addClient(res, range);

  req.on('close', () => {
    analyticsEventBus.removeClient(clientId);
  });
});

// 1. Client Tracking Beacon (Public - supports page_view, heartbeat, and session_end)
const BOT_UA_REGEX = /bot|crawler|spider|slurp|curl|wget|headless|lighthouse|healthcheck|uptime/i;

router.post('/track', optionalStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const ua = String(req.headers['user-agent'] || '');
    if (BOT_UA_REGEX.test(ua)) {
      return res.status(200).json({ status: 'ignored', reason: 'bot' });
    }
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(clientIp, 120)) {
      return res.status(429).json({ status: 'error', message: 'Rate limit exceeded.' });
    }

    const {
      sessionId,
      visitorId,
      studentId,
      pagePath,
      pageTitle,
      district,
      city,
      deviceCategory,
      browser,
      os,
      referrer,
      eventType = 'page_view',
    } = req.body || {};

    if (!sessionId || !visitorId || !pagePath) {
      return res.status(400).json({ status: 'error', message: 'Missing required tracking fields.' });
    }

    // Never track admin portal paths as student/public website traffic
    const cleanPath = String(pagePath).slice(0, 255);
    if (cleanPath.startsWith('/admin')) {
      return res.status(200).json({ status: 'ignored' });
    }

    // Prefer authenticated studentId from JWT if present, otherwise accept numeric studentId if valid
    const verifiedStudentId =
      req.studentUser && !req.studentUser.isPreview
        ? req.studentUser.studentId
        : typeof studentId === 'number' && Number.isInteger(studentId) && studentId > 0
          ? studentId
          : null;

    await AnalyticsService.recordHit({
      sessionId: String(sessionId).slice(0, 64),
      visitorId: String(visitorId).slice(0, 64),
      studentId: verifiedStudentId,
      pagePath: cleanPath,
      pageTitle: pageTitle ? String(pageTitle).slice(0, 255) : undefined,
      district: district ? String(district).slice(0, 100) : undefined,
      city: city ? String(city).slice(0, 100) : undefined,
      deviceCategory: deviceCategory ? String(deviceCategory).slice(0, 50) : undefined,
      browser: browser ? String(browser).slice(0, 50) : undefined,
      os: os ? String(os).slice(0, 50) : undefined,
      referrer: referrer ? String(referrer).slice(0, 500) : undefined,
      eventType:
        eventType === 'heartbeat' || eventType === 'session_end' ? eventType : 'page_view',
    });

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    // Non-blocking for client
    return res.status(200).json({ status: 'ok', warning: err.message });
  }
});

// 1B. Idempotent Real-Time Activity Event Ingestion (Learning / Study / Exam events)
router.post('/event', optionalStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(clientIp, 90)) {
      return res.status(429).json({ status: 'error', message: 'Rate limit exceeded.' });
    }

    const { eventId, eventType, visitorId, sessionId, pagePath, metadata } = req.body || {};
    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({ status: 'error', message: 'eventType is required.' });
    }

    const verifiedStudentId =
      req.studentUser && !req.studentUser.isPreview ? req.studentUser.studentId : null;

    await AnalyticsService.recordAnalyticsEvent({
      eventId: eventId ? String(eventId).slice(0, 120) : undefined,
      eventType: String(eventType).slice(0, 64),
      studentId: verifiedStudentId,
      visitorId: visitorId ? String(visitorId).slice(0, 64) : null,
      sessionId: sessionId ? String(sessionId).slice(0, 64) : null,
      pagePath: pagePath ? String(pagePath).slice(0, 255) : null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    return res.status(200).json({ status: 'ok', warning: err.message });
  }
});

// 1C. Razorpay Payment Webhook (Signature-verified, idempotent)
router.post('/webhooks/razorpay', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = String(req.headers['x-razorpay-signature'] || '');
    if (!webhookSecret || !signature) {
      return res.status(401).json({ status: 'error', message: 'Missing Razorpay webhook verification.' });
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ status: 'error', message: 'Invalid Razorpay signature.' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await AnalyticsService.recordVerifiedRazorpayWebhook(payload);
    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error('[Razorpay Webhook Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. Districts List (Public/Admin helper)
router.get('/districts', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'success',
    districts: TN_DISTRICTS.map((d) => d.name),
  });
});

// 3. Analytics Overview
router.get(['/overview', '/', ''], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const data = await AnalyticsService.getOverview(range, district);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Overview Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. Geographic Analytics (Tamil Nadu 38 Districts)
router.get('/geographic', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    const data = await AnalyticsService.getGeographic(range);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Geographic Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. Live Website Visitor Monitor
router.get('/live', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getLiveMonitor();
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Live Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 6. Traffic Analytics
router.get('/traffic', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const data = await AnalyticsService.getTraffic(range, district);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Traffic Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 7. Subscription Analytics
router.get('/subscriptions', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const data = await AnalyticsService.getSubscriptions(range, district);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Subscriptions Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 8. Student Analytics
router.get('/students', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const data = await AnalyticsService.getStudents(range, district);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Students Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 9. Performance Analytics
router.get('/performance', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = normalizeRange(req.query.range);
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const data = await AnalyticsService.getPerformance(range, district);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Performance Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10. Student Login History (Admin-Only, Paginated, Day-by-Day IST Register)
router.get('/login-history', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const data = await AnalyticsService.getStudentLoginHistory({
      range: typeof req.query.range === 'string' ? req.query.range : '30d',
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      method: typeof req.query.method === 'string' ? req.query.method : 'all',
      sessionStatus: typeof req.query.sessionStatus === 'string' ? req.query.sessionStatus : 'all',
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Login History Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10B. Student Login History CSV Export (Admin-Only, Respects All Active Filters)
router.get('/login-history/export', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const csv = await AnalyticsService.exportStudentLoginHistoryCsv({
      range: typeof req.query.range === 'string' ? req.query.range : '30d',
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      method: typeof req.query.method === 'string' ? req.query.method : 'all',
      sessionStatus: typeof req.query.sessionStatus === 'string' ? req.query.sessionStatus : 'all',
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="student-login-history-${stamp}.csv"`);
    return res.status(200).send(csv);
  } catch (err: any) {
    console.error('[Analytics Login History Export Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10C. Student-Wise Login History Detail (Admin-Only)
router.get('/login-history/student/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid student ID.' });
    }
    const data = await AnalyticsService.getStudentLoginHistoryDetail(studentId);
    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Student not found.' });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Student Login Detail Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10D. Unique Student Login Users Registry (Admin-Only, Paginated, Filtered, Sorted)
router.get('/login-users', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const data = await getStudentLoginUsersRegistry({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      range: typeof req.query.range === 'string' ? req.query.range : 'all',
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      method: typeof req.query.method === 'string' ? req.query.method : 'all',
      status: typeof req.query.status === 'string' ? req.query.status : 'all',
      sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : 'latest_login',
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 25,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Login Users Registry Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10E. Export Unique Student Login Users CSV (All or Filtered, Admin-Only)
router.get('/login-users/export', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const scope = String(req.query.scope || 'filtered').toLowerCase() === 'all' ? 'all' : 'filtered';
    const csv = await exportStudentLoginUsersCsv({
      scope,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      range: typeof req.query.range === 'string' ? req.query.range : 'all',
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      method: typeof req.query.method === 'string' ? req.query.method : 'all',
      status: typeof req.query.status === 'string' ? req.query.status : 'all',
      sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : 'latest_login',
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student-login-users-${scope}-${stamp}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err: any) {
    console.error('[Analytics Login Users Export Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10F. Individual Student Login User Profile & Complete History (Admin-Only)
router.get('/login-users/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid student ID.' });
    }
    const data = await getStudentLoginUserDetail(studentId);
    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Student not found.' });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Login User Detail Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10G. Export Individual Student Login History CSV (Admin-Only)
router.get('/login-users/:studentId/export', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid student ID.' });
    }
    const result = await exportIndividualStudentLoginHistoryCsv(studentId);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Student not found.' });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csv);
  } catch (err: any) {
    console.error('[Analytics Individual Student Export Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 11. Student Subscription History (Admin-Only, Real Verified Transactions Only, IST Date-Grouped)
router.get('/subscription-history', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const data = await getSubscriptionHistory({
      range: typeof req.query.range === 'string' ? req.query.range : '30d',
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      email: typeof req.query.email === 'string' ? req.query.email : undefined,
      reference: typeof req.query.reference === 'string' ? req.query.reference : undefined,
      plan: typeof req.query.plan === 'string' ? req.query.plan : 'all',
      paymentMethod: typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : 'all',
      paymentStatus: typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : 'all',
      subscriptionStatus: typeof req.query.subscriptionStatus === 'string' ? req.query.subscriptionStatus : 'all',
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Subscription History Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 11B. Student Subscription History CSV Export (Admin-Only, Respects Active Filters)
router.get('/subscription-history/export', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const csv = await exportSubscriptionHistoryCsv({
      range: typeof req.query.range === 'string' ? req.query.range : '30d',
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      email: typeof req.query.email === 'string' ? req.query.email : undefined,
      reference: typeof req.query.reference === 'string' ? req.query.reference : undefined,
      plan: typeof req.query.plan === 'string' ? req.query.plan : 'all',
      paymentMethod: typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : 'all',
      paymentStatus: typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : 'all',
      subscriptionStatus: typeof req.query.subscriptionStatus === 'string' ? req.query.subscriptionStatus : 'all',
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="student-subscription-history-${stamp}.csv"`);
    return res.status(200).send(csv);
  } catch (err: any) {
    console.error('[Analytics Subscription History Export Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 11C. Student-Wise Subscription History Detail Modal (Admin-Only)
router.get('/subscription-history/student/:studentId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid student ID.' });
    }
    const data = await getStudentSubscriptionDetail(studentId);
    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Student not found.' });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Student Subscription Detail Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 12. Admin Single Active Device Sessions Monitor
router.get('/active-sessions', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const data = await getAdminActiveStudentSessions();
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Active Sessions Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;

