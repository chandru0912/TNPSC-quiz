import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import { normalizeTamilNaduDistrict } from './tamilNaduDistrictService';
import { recordVerifiedSubscriptionTransaction } from './subscriptionHistoryService';
import { grantPlanEntitlements } from './subscriptionPlansService';

export interface DistrictMetric {
  district: string;
  districtId?: string;
  visitors: number;
  uniqueVisitors: number;
  students: number;
  registeredStudents?: number;
  uniqueLoginStudents?: number;
  totalLoginEvents?: number;
  todayUniqueLogins?: number;
  last7dUniqueLogins?: number;
  last30dUniqueLogins?: number;
  usagePercentage?: number;
  onlineStudents?: number;
  mcqAttempts?: number;
  mockTestAttempts?: number;
  subscribers: number;
  freeStudents: number;
  conversionRate: number;
  revenue: number;
  activeToday: number;
  cities: {
    city: string;
    visitors: number;
    students: number;
    subscribers: number;
    revenue: number;
  }[];
}

// Complete list of all 38 Tamil Nadu districts
export const TN_DISTRICTS: { name: string; defaultCity: string; cities: string[] }[] = [
  { name: 'Ariyalur', defaultCity: 'Ariyalur Town', cities: ['Ariyalur Town', 'Jayankondam', 'Sendurai'] },
  { name: 'Chengalpattu', defaultCity: 'Chengalpattu', cities: ['Chengalpattu', 'Tambaram South', 'Maraimalai Nagar', 'Kelambakkam'] },
  { name: 'Chennai', defaultCity: 'Anna Nagar', cities: ['Anna Nagar', 'T. Nagar', 'Velachery', 'Guindy', 'Adyar', 'Mylapore', 'Tambaram'] },
  { name: 'Coimbatore', defaultCity: 'Gandhipuram', cities: ['Gandhipuram', 'RS Puram', 'Peelamedu', 'Singanallur', 'Saravanampatti'] },
  { name: 'Cuddalore', defaultCity: 'Chidambaram', cities: ['Chidambaram', 'Cuddalore Town', 'Panruti', 'Neyveli', 'Virudhachalam'] },
  { name: 'Dharmapuri', defaultCity: 'Dharmapuri Town', cities: ['Dharmapuri Town', 'Harur', 'Palacode', 'Pennagaram'] },
  { name: 'Dindigul', defaultCity: 'Palani', cities: ['Palani', 'Dindigul Town', 'Kodaikanal', 'Oddanchatram'] },
  { name: 'Erode', defaultCity: 'Erode Central', cities: ['Erode Central', 'Perundurai', 'Bhavani', 'Gobichettipalayam'] },
  { name: 'Kallakurichi', defaultCity: 'Kallakurichi', cities: ['Kallakurichi', 'Ulundurpet', 'Sankarapuram'] },
  { name: 'Kanchipuram', defaultCity: 'Kanchipuram Town', cities: ['Kanchipuram Town', 'Sriperumbudur', 'Walajabad'] },
  { name: 'Kanyakumari', defaultCity: 'Nagercoil', cities: ['Nagercoil', 'Kanyakumari', 'Marthandam', 'Thuckalay'] },
  { name: 'Karur', defaultCity: 'Karur Town', cities: ['Karur Town', 'Kulithalai', 'Aravakurichi'] },
  { name: 'Krishnagiri', defaultCity: 'Hosur', cities: ['Hosur', 'Krishnagiri Town', 'Denkanikottai', 'Pochampalli'] },
  { name: 'Madurai', defaultCity: 'Goripalayam', cities: ['Goripalayam', 'Anna Nagar', 'Simmakkal', 'Mattuthavani', 'Thirunagar'] },
  { name: 'Mayiladuthurai', defaultCity: 'Mayiladuthurai Town', cities: ['Mayiladuthurai Town', 'Sirkazhi', 'Tharangambadi'] },
  { name: 'Nagapattinam', defaultCity: 'Nagapattinam Port', cities: ['Nagapattinam Port', 'Velankanni', 'Vedaranyam'] },
  { name: 'Namakkal', defaultCity: 'Namakkal Town', cities: ['Namakkal Town', 'Rasipuram', 'Tiruchengode'] },
  { name: 'Nilgiris', defaultCity: 'Udhagamandalam', cities: ['Udhagamandalam', 'Coonoor', 'Kotagiri', 'Gudalur'] },
  { name: 'Perambalur', defaultCity: 'Perambalur Town', cities: ['Perambalur Town', 'Kunnam', 'Veppanthattai'] },
  { name: 'Pudukkottai', defaultCity: 'Pudukkottai Town', cities: ['Pudukkottai Town', 'Aranthangi', 'Viralimalai'] },
  { name: 'Ramanathapuram', defaultCity: 'Ramanathapuram Town', cities: ['Ramanathapuram Town', 'Rameswaram', 'Paramakudi'] },
  { name: 'Ranipet', defaultCity: 'Ranipet Town', cities: ['Ranipet Town', 'Arcot', 'Walajah', 'Sholinghur'] },
  { name: 'Salem', defaultCity: 'Fairlands', cities: ['Fairlands', 'Hasthampatti', 'Suramangalam', 'Ammapet'] },
  { name: 'Sivaganga', defaultCity: 'Karaikudi', cities: ['Karaikudi', 'Sivaganga Town', 'Devakottai'] },
  { name: 'Tenkasi', defaultCity: 'Tenkasi Town', cities: ['Tenkasi Town', 'Sankarankovil', 'Kadayanallur'] },
  { name: 'Thanjavur', defaultCity: 'Thanjavur Town', cities: ['Thanjavur Town', 'Kumbakonam', 'Pattukkottai', 'Thiruvaiyaru'] },
  { name: 'Theni', defaultCity: 'Theni', cities: ['Theni', 'Bodinayakanur', 'Periyakulam', 'Cumbum'] },
  { name: 'Thoothukudi', defaultCity: 'Thoothukudi Port', cities: ['Thoothukudi Port', 'Kovilpatti', 'Tiruchendur'] },
  { name: 'Tiruchirappalli', defaultCity: 'Thillai Nagar', cities: ['Thillai Nagar', 'Cantonment', 'Srirangam', 'KK Nagar'] },
  { name: 'Tirunelveli', defaultCity: 'Palayamkottai', cities: ['Palayamkottai', 'Tirunelveli Junction', 'Vannarpettai', 'Melapalayam'] },
  { name: 'Tirupathur', defaultCity: 'Tirupathur', cities: ['Tirupathur', 'Vaniyambadi', 'Ambur', 'Jolarpet'] },
  { name: 'Tiruppur', defaultCity: 'Tiruppur Central', cities: ['Tiruppur Central', 'Avinashi', 'Dharapuram', 'Palladam'] },
  { name: 'Tiruvallur', defaultCity: 'Avadi', cities: ['Avadi', 'Tiruvallur Town', 'Poonamallee', 'Tiruttani'] },
  { name: 'Tiruvannamalai', defaultCity: 'Tiruvannamalai Town', cities: ['Tiruvannamalai Town', 'Arani', 'Polur', 'Cheyyar'] },
  { name: 'Tiruvarur', defaultCity: 'Mannargudi', cities: ['Mannargudi', 'Tiruvarur Town', 'Thiruthuraipoondi'] },
  { name: 'Vellore', defaultCity: 'Katpadi', cities: ['Katpadi', 'Vellore Fort', 'Bagayam', 'Sathuvachari'] },
  { name: 'Viluppuram', defaultCity: 'Viluppuram Town', cities: ['Viluppuram Town', 'Tindivanam', 'Gingee'] },
  { name: 'Virudhunagar', defaultCity: 'Sivakasi', cities: ['Sivakasi', 'Virudhunagar Town', 'Rajapalayam', 'Aruppukkottai'] },
];

const IST_TODAY_START = "(DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')";

function getIntervalFromRange(range: string): string {
  switch (range) {
    case 'today':
      return "INTERVAL '1 day'";
    case '7d':
      return "INTERVAL '7 days'";
    case '30d':
      return "INTERVAL '30 days'";
    case '90d':
      return "INTERVAL '90 days'";
    case 'yearly':
      return "INTERVAL '365 days'";
    default:
      return "INTERVAL '30 days'";
  }
}

function getRangeCondition(column: string, range: string): string {
  if (range === 'all') return 'TRUE';
  if (range === 'today') return `${column} >= ${IST_TODAY_START}`;
  return `${column} >= CURRENT_TIMESTAMP - ${getIntervalFromRange(range)}`;
}

function getPrevRangeCondition(column: string, range: string): string {
  if (range === 'all') return 'FALSE';
  if (range === 'today') {
    return `${column} >= (${IST_TODAY_START} - INTERVAL '1 day') AND ${column} < ${IST_TODAY_START}`;
  }
  const interval = getIntervalFromRange(range);
  return `${column} >= CURRENT_TIMESTAMP - (${interval} * 2) AND ${column} < CURRENT_TIMESTAMP - ${interval}`;
}

function calculateChange(
  current: number,
  previous: number,
  range: string = '30d'
): { change: number | null; trend: 'up' | 'down' | 'neutral'; hasHistoricalData: boolean } {
  if (range === 'all' || previous <= 0) {
    return { change: null, trend: 'neutral', hasHistoricalData: false };
  }
  const diff = ((current - previous) / previous) * 100;
  const rounded = Math.round(diff * 10) / 10;
  return {
    change: Math.abs(rounded),
    trend: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral',
    hasHistoricalData: true,
  };
}

const GENUINE_STUDENT_SQL = (alias: string = 's') => `(
  COALESCE(${alias}.role, 'student') = 'student'
  AND ${alias}.deleted_at IS NULL
  AND COALESCE(${alias}.is_active, true) = true
  AND LOWER(TRIM(COALESCE(${alias}.email, ''))) NOT LIKE '%@example.com'
  AND LOWER(TRIM(COALESCE(${alias}.email, ''))) NOT LIKE 'test_%'
  AND LOWER(TRIM(COALESCE(${alias}.email, ''))) NOT LIKE 'preview_%'
  AND LOWER(TRIM(COALESCE(${alias}.email, ''))) NOT LIKE 'demo_%'
)`;

const GENUINE_SUB_SQL = (subAlias: string = 'sub', stuAlias: string = 's') => `(
  ${GENUINE_STUDENT_SQL(stuAlias)}
  AND ${subAlias}.transaction_date >= (${stuAlias}.created_at - INTERVAL '1 hour')
)`;

let cachedLiveActivationIso: string | null = null;

const FATAL_DB_ERROR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '57P01',
  '57P02',
  '57P03',
]);

function isConnectivityError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    FATAL_DB_ERROR_CODES.has(code) ||
    /getaddrinfo|connection terminated|cannot connect|ECONNREFUSED|ENOTFOUND/i.test(msg)
  );
}

function isTransientConnectTimeout(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === 'ECONNRESET' ||
    /timeout exceeded when trying to connect|connection terminated unexpectedly/i.test(msg)
  );
}

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

function toFloat(val: unknown): number {
  const n = parseFloat(String(val ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

async function safeQuery<T = any>(
  label: string,
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; failed?: boolean }> {
  const execute = async () => {
    const res = await pool.query(sql, params);
    return { rows: (res.rows || []) as T[] };
  };

  try {
    return await execute();
  } catch (err: any) {
    if (isTransientConnectTimeout(err)) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        return await execute();
      } catch (retryErr: any) {
        if (isConnectivityError(retryErr) || isTransientConnectTimeout(retryErr)) {
          console.error(`[AnalyticsService] DB connectivity error in "${label}" after retry:`, retryErr?.code, retryErr?.message);
          throw retryErr;
        }
        console.error(`[AnalyticsService] Isolated query failure in "${label}" after retry:`, retryErr?.code, retryErr?.message);
        return { rows: [], failed: true };
      }
    }

    if (isConnectivityError(err)) {
      console.error(`[AnalyticsService] DB connectivity error in "${label}":`, err?.code, err?.message);
      throw err;
    }

    console.error(`[AnalyticsService] Isolated query failure in "${label}":`, err?.code, err?.message);
    return { rows: [], failed: true };
  }
}

export class AnalyticsService {
  // Ensure clean Live Analytics Activation Timestamp exists once in PostgreSQL
  static async ensureLiveAnalyticsBaseline(): Promise<string> {
    if (cachedLiveActivationIso) return cachedLiveActivationIso;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const nowIso = new Date().toISOString();
    await pool.query(
      `INSERT INTO analytics_settings (key, value)
       VALUES ('live_tracking_activated_at', $1)
       ON CONFLICT (key) DO NOTHING`,
      [nowIso]
    );
    const res = await pool.query(
      `SELECT value FROM analytics_settings WHERE key = 'live_tracking_activated_at' LIMIT 1`
    );
    cachedLiveActivationIso = res.rows[0]?.value || nowIso;
    return cachedLiveActivationIso!;
  }

  // Mark student online immediately on successful login (deduplicated per student)
  static async touchStudentLiveSession(studentId: number): Promise<void> {
    if (!Number.isInteger(studentId) || studentId <= 0) return;
    const sessionId = `auth_student_${studentId}`;
    const visitorId = `stu_${studentId}`;
    await pool.query(
      `INSERT INTO visitor_sessions (session_id, visitor_id, student_id, is_active, started_at, last_heartbeat, ended_at)
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
       ON CONFLICT (session_id) DO UPDATE SET
         student_id = EXCLUDED.student_id,
         is_active = true,
         ended_at = NULL,
         last_heartbeat = CURRENT_TIMESTAMP`,
      [sessionId, visitorId, studentId]
    );
  }

  // End all active sessions immediately when student logs out
  static async endStudentLiveSessions(studentId: number): Promise<void> {
    if (!Number.isInteger(studentId) || studentId <= 0) return;
    await pool.query(
      `UPDATE visitor_sessions
       SET is_active = false,
           ended_at = CURRENT_TIMESTAMP
       WHERE student_id = $1 AND (is_active = true OR ended_at IS NULL)`,
      [studentId]
    );
  }

  // Idempotent genuine login event recorder (prevents duplicates from retries/OAuth callbacks within 3s)
  static async recordGenuineLoginEvent(studentId: number, provider: 'email' | 'google'): Promise<void> {
    if (!Number.isInteger(studentId) || studentId <= 0) return;
    const dupCheck = await pool.query(
      `SELECT id FROM student_activity
       WHERE student_id = $1
         AND activity_type IN ('login', 'google_login')
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '3 seconds'
       LIMIT 1`,
      [studentId]
    );
    if (dupCheck.rows.length > 0) return;
    await pool.query(
      `INSERT INTO student_activity (student_id, activity_type, reference_id, reference_title, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        studentId,
        provider === 'google' ? 'google_login' : 'login',
        String(studentId),
        provider === 'google' ? 'Logged In with Google' : 'Logged In',
        JSON.stringify({ provider, recordedAt: new Date().toISOString() }),
      ]
    );
  }

  // 1. Record visitor tracking beacon (page_view, heartbeat, or session_end)
  static async recordHit(data: {
    sessionId: string;
    visitorId: string;
    studentId?: number | null;
    pagePath: string;
    pageTitle?: string;
    district?: string;
    city?: string;
    deviceCategory?: string;
    browser?: string;
    os?: string;
    referrer?: string;
    eventType?: 'page_view' | 'heartbeat' | 'session_end';
  }) {
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
    } = data;

    // Never count Admin pages or internal health checks as website visitor traffic
    if (String(pagePath || '').toLowerCase().startsWith('/admin')) {
      return { success: true, ignored: true };
    }

    // Session end (tab close / logout): mark session inactive immediately
    if (eventType === 'session_end') {
      await pool.query(
        `UPDATE visitor_sessions
         SET is_active = false, ended_at = CURRENT_TIMESTAMP, last_heartbeat = CURRENT_TIMESTAMP
         WHERE session_id = $1`,
        [sessionId]
      );
      broadcastAnalyticsEvent('visitor_hit', { pagePath, eventType: 'session_end' });
      return { success: true };
    }

    // Never fabricate Chennai/Anna Nagar: only use explicit district or student's confirmed DB district
    let resolvedDistrict: string | null = district ? district.trim() : null;
    let resolvedCity: string | null = city ? city.trim() : null;
    let locationSource: string | null = resolvedDistrict ? 'reported' : null;

    if (!resolvedDistrict && studentId) {
      const stuRes = await pool.query('SELECT district, city FROM students WHERE id = $1', [studentId]);
      if (stuRes.rows[0]?.district) {
        resolvedDistrict = stuRes.rows[0].district;
        resolvedCity = stuRes.rows[0].city || null;
        locationSource = 'student_profile';
      }
    }

    const resolvedDevice = deviceCategory || 'desktop';
    const resolvedBrowser = browser || 'Other';
    const resolvedOs = os || 'Other';

    // Check if returning visitor (has a different earlier session)
    const priorRes = await pool.query(
      `SELECT 1 FROM visitor_sessions WHERE visitor_id = $1 AND session_id <> $2 LIMIT 1`,
      [visitorId, sessionId]
    );
    const isReturning = priorRes.rows.length > 0;

    // Upsert session
    await pool.query(
      `INSERT INTO visitor_sessions (
        session_id, visitor_id, student_id, country, state, district, city, location_source,
        device_category, browser, os, referrer, entry_path, current_path,
        is_returning, is_active, started_at, last_heartbeat, ended_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $13,
        $14, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL
      )
      ON CONFLICT (session_id) DO UPDATE SET
        student_id = COALESCE($3, visitor_sessions.student_id),
        district = COALESCE($6, visitor_sessions.district),
        city = COALESCE($7, visitor_sessions.city),
        location_source = COALESCE($8, visitor_sessions.location_source),
        current_path = $13,
        is_active = true,
        ended_at = NULL,
        last_heartbeat = CURRENT_TIMESTAMP`,
      [
        sessionId,
        visitorId,
        studentId || null,
        resolvedDistrict ? 'India' : null,
        resolvedDistrict ? 'Tamil Nadu' : null,
        resolvedDistrict,
        resolvedCity,
        locationSource,
        resolvedDevice,
        resolvedBrowser,
        resolvedOs,
        referrer || null,
        pagePath,
        isReturning,
      ]
    );

    // Only insert a page_views row on actual page_view events (never duplicate on heartbeats)
    if (eventType === 'page_view') {
      await pool.query(
        `INSERT INTO page_views (
          session_id, visitor_id, student_id, page_path, page_title, district, city, device_category, viewed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
        [
          sessionId,
          visitorId,
          studentId || null,
          pagePath,
          pageTitle || null,
          resolvedDistrict,
          resolvedCity,
          resolvedDevice,
        ]
      );
    }

    broadcastAnalyticsEvent('visitor_hit', { pagePath, eventType });
    return { success: true };
  }

  // 1B. Record idempotent learning / platform event
  static async recordAnalyticsEvent(data: {
    eventId?: string;
    eventType: string;
    studentId?: number | null;
    visitorId?: string | null;
    sessionId?: string | null;
    pagePath?: string | null;
    metadata?: Record<string, any>;
  }) {
    let district: string | null = null;
    if (data.studentId) {
      const sRes = await pool.query('SELECT district FROM students WHERE id = $1', [data.studentId]);
      district = sRes.rows[0]?.district || null;
    }

    await pool.query(
      `INSERT INTO analytics_events (
        event_id, event_type, student_id, visitor_id, session_id, page_path, district, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id) DO NOTHING`,
      [
        data.eventId || null,
        data.eventType,
        data.studentId || null,
        data.visitorId || null,
        data.sessionId || null,
        data.pagePath || null,
        district,
        JSON.stringify(data.metadata || {}),
      ]
    );

    broadcastAnalyticsEvent('learning_activity', { eventType: data.eventType, studentId: data.studentId });
    return { success: true };
  }

  // 1C. Record signature-verified Razorpay webhook event (idempotent)
  static async recordVerifiedRazorpayWebhook(payload: any) {
    const eventName = String(payload?.event || '').trim();
    const paymentEntity = payload?.payload?.payment?.entity || {};
    const subEntity = payload?.payload?.subscription?.entity || {};
    const refundEntity = payload?.payload?.refund?.entity || {};

    const razorpayPaymentId = paymentEntity.id || refundEntity.payment_id || null;
    const razorpayOrderId = paymentEntity.order_id || null;
    const notes = paymentEntity.notes || subEntity.notes || {};
    const studentId = Number.isInteger(Number(notes.student_id)) && Number(notes.student_id) > 0
      ? Number(notes.student_id)
      : null;
    const planId = String(notes.plan_id || subEntity.plan_id || 'razorpay_plan').slice(0, 64);
    const planName = String(notes.plan_name || 'TNPSC Pro Pass').slice(0, 120);
    const amountPaise = Number(paymentEntity.amount ?? refundEntity.amount ?? 0);
    const amountInr = Math.round((amountPaise / 100) * 100) / 100;
    const currency = String(paymentEntity.currency || 'INR').toUpperCase().slice(0, 10);

    let status = 'pending';
    if (eventName === 'payment.captured' || eventName === 'subscription.activated' || eventName === 'subscription.charged') {
      status = 'success';
    } else if (eventName === 'payment.failed') {
      status = 'failed';
    } else if (eventName === 'subscription.cancelled') {
      status = 'cancelled';
    } else if (eventName === 'refund.processed' || eventName === 'payment.refunded') {
      status = 'refunded';
    }

    const paymentEventId = `rzp_${eventName}_${razorpayPaymentId || subEntity.id || Date.now()}`.slice(0, 120);
    let district: string | null = null;
    if (studentId) {
      const sRes = await pool.query('SELECT district FROM students WHERE id = $1', [studentId]);
      district = sRes.rows[0]?.district || null;
    }

      await pool.query(
        `INSERT INTO payment_events (
        payment_event_id, student_id, razorpay_order_id, razorpay_payment_id,
        plan_id, plan_name, amount, currency, status, verified_by_signature, district, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11::jsonb)
      ON CONFLICT (payment_event_id) DO NOTHING`,
        [
          paymentEventId,
          studentId,
          razorpayOrderId,
          razorpayPaymentId,
          planId,
          planName,
          amountInr,
          currency,
          status,
          district,
          JSON.stringify({ event: eventName, method: paymentEntity.method || null }),
        ]
      );

      // Persist verified subscription transaction idempotently into subscription_transactions
      const normalizedPaymentStatus: 'success' | 'pending' | 'failed' | 'refunded' =
        status === 'success'
          ? 'success'
          : status === 'failed'
            ? 'failed'
            : status === 'refunded'
              ? 'refunded'
              : 'pending';

      const txRow = await recordVerifiedSubscriptionTransaction({
        studentId,
        studentEmail: notes.student_email || paymentEntity.email || null,
        planId,
        planName,
        amountPaid: amountInr,
        refundAmount: status === 'refunded' ? amountInr : 0,
        currency,
        paymentProvider: 'razorpay',
        paymentMethod: paymentEntity.method || null,
        cardType: paymentEntity.card?.type || null,
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId || paymentEventId,
        paymentStatus: normalizedPaymentStatus,
        subscriptionStatus: status === 'cancelled' ? 'cancelled' : undefined,
        metadata: { event: eventName, paymentEventId },
      });

      if (studentId && status === 'success') {
        await grantPlanEntitlements({
          studentId,
          planId,
          transactionId: txRow?.id ? Number(txRow.id) : null,
          expiresAt: txRow?.expires_at ? new Date(txRow.expires_at) : null,
        });
        await pool.query(
          `INSERT INTO student_subscriptions (
          student_id, plan_id, plan_name, amount, currency, status, payment_method, district, starts_at, expires_at, transaction_date
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP)`,
          [studentId, planId, planName, amountInr, currency, paymentEntity.method || null, district, txRow?.expires_at || null]
        );
        await pool.query(
          `UPDATE students SET subscription_tier = $2, subscription_status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [studentId, planId === 'test_batch' ? 'test_batch' : 'pro']
        );
      } else if (studentId && status === 'cancelled') {
        await pool.query(
          `UPDATE student_subscriptions SET status = 'cancelled' WHERE student_id = $1 AND status = 'active'`,
          [studentId]
        );
        await pool.query(
          `UPDATE students SET subscription_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [studentId]
        );
      }

    broadcastAnalyticsEvent('payment_event', { eventName, status, studentId });
    broadcastAnalyticsEvent('subscription_updated', { status, studentId });
    return { success: true };
  }

  // 2. Main Analytics Overview (100% PostgreSQL-backed, Asia/Kolkata aligned, zero fabricated fallbacks)
  static async getOverview(range: string = '30d', districtFilter?: string) {
    const distParam = districtFilter && districtFilter !== 'all' ? districtFilter : null;
    const isAllTime = range === 'all';
    const liveTrackingActivatedAt = await AnalyticsService.ensureLiveAnalyticsBaseline();

    const rangeLabel =
      range === 'today'
        ? 'vs previous day'
        : range === '7d'
          ? 'vs previous 7 days'
          : range === '90d'
            ? 'vs previous 90 days'
            : isAllTime
              ? 'all time'
              : 'vs previous 30 days';

    const formatTrendMeta = (
      current: number,
      previous: number,
      label: string = rangeLabel
    ) => {
      const res = calculateChange(current, previous, range);
      return {
        change: res.change,
        trend: res.trend,
        hasHistoricalData: res.hasHistoricalData,
        comparisonText: res.hasHistoricalData ? label : 'Insufficient historical data',
      };
    };

    // Batch 1: Core student, traffic, login, revenue, and MCQ metrics (parallelized for ~10x speedup)
    const [
      qStudents,
      qOnlineStudents,
      qMockAttemptsAgg,
      qActiveToday,
      qTraffic,
      qPageViews,
      qLogins,
      qRevenue,
      qMcq,
      qAllTimeMcq,
    ] = await Promise.all([
      safeQuery(
        'overview.students',
        `SELECT
          COUNT(DISTINCT LOWER(TRIM(s.email)))::int as total,
          COUNT(DISTINCT CASE WHEN NOT (${getRangeCondition('s.created_at', range)}) THEN LOWER(TRIM(s.email)) END)::int as prev_total,
          COUNT(DISTINCT CASE WHEN s.email_verified = true THEN LOWER(TRIM(s.email)) END)::int as verified_students,
          MAX(s.last_login_at) as last_active_at,
          COUNT(DISTINCT CASE WHEN ${getRangeCondition('s.created_at', range)} THEN LOWER(TRIM(s.email)) END)::int as new_in_range,
          COUNT(DISTINCT CASE WHEN ${getPrevRangeCondition('s.created_at', range)} THEN LOWER(TRIM(s.email)) END)::int as prev_new_in_range,
          COUNT(DISTINCT CASE WHEN s.created_at >= $2::timestamptz THEN LOWER(TRIM(s.email)) END)::int as new_since_activation,
          COUNT(DISTINCT CASE WHEN s.created_at >= ${IST_TODAY_START} THEN LOWER(TRIM(s.email)) END)::int as new_today,
          COUNT(DISTINCT CASE WHEN s.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN LOWER(TRIM(s.email)) END)::int as new_7d,
          COUNT(DISTINCT CASE WHEN s.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN LOWER(TRIM(s.email)) END)::int as new_30d,
          COUNT(DISTINCT CASE WHEN s.subscription_tier != 'free' AND s.subscription_status = 'active' THEN LOWER(TRIM(s.email)) END)::int as paid_subscribers,
          COUNT(DISTINCT CASE WHEN s.subscription_tier = 'free' OR s.subscription_tier IS NULL THEN LOWER(TRIM(s.email)) END)::int as free_students
         FROM students s
         WHERE ${GENUINE_STUDENT_SQL('s')}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.online_students',
        `SELECT COUNT(DISTINCT vs.student_id)::int as online_students
         FROM visitor_sessions vs
         JOIN students s ON s.id = vs.student_id
         WHERE vs.student_id IS NOT NULL
           AND vs.is_active = true
           AND vs.ended_at IS NULL
           AND vs.last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
           AND ${GENUINE_STUDENT_SQL('s')}`
      ),
      safeQuery(
        'overview.mock_attempts_agg',
        `SELECT
          COUNT(*)::int as all_time_attempts,
          COUNT(CASE WHEN ${getRangeCondition('a.completed_at', range)} THEN 1 END)::int as attempts_in_range,
          COUNT(CASE WHEN ${getPrevRangeCondition('a.completed_at', range)} THEN 1 END)::int as prev_attempts_in_range,
          COUNT(CASE WHEN a.completed_at >= ${IST_TODAY_START} THEN 1 END)::int as attempts_today,
          COUNT(CASE WHEN a.completed_at >= CURRENT_TIMESTAMP - INTERVAL '3 days' THEN 1 END)::int as attempts_3d,
          COUNT(CASE WHEN a.completed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END)::int as attempts_7d,
          COUNT(CASE WHEN a.completed_at >= CURRENT_TIMESTAMP - INTERVAL '14 days' THEN 1 END)::int as attempts_14d,
          COUNT(CASE WHEN a.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END)::int as attempts_30d,
          COALESCE(SUM(CASE WHEN ${getRangeCondition('a.completed_at', range)} THEN a.correct_answers ELSE 0 END), 0)::int as correct_in_range,
          COALESCE(SUM(CASE WHEN ${getRangeCondition('a.completed_at', range)} THEN a.incorrect_answers ELSE 0 END), 0)::int as incorrect_in_range,
          COALESCE(SUM(a.correct_answers), 0)::int as all_time_correct,
          COALESCE(SUM(a.incorrect_answers), 0)::int as all_time_incorrect,
          COUNT(DISTINCT a.student_id)::int as participating_students,
          COALESCE(ROUND(
            100.0 * SUM(CASE WHEN a.assessment_type IN ('lesson_quiz', 'study_material_quiz', 'subject_drill') OR COALESCE(a.mock_test_format, '') = 'mcq_practice' THEN a.correct_answers ELSE 0 END)
            / NULLIF(SUM(CASE WHEN a.assessment_type IN ('lesson_quiz', 'study_material_quiz', 'subject_drill') OR COALESCE(a.mock_test_format, '') = 'mcq_practice' THEN (a.correct_answers + a.incorrect_answers) ELSE 0 END), 0)
          , 1), 0) as mcq_practice_accuracy,
          COALESCE(ROUND(
            100.0 * SUM(CASE WHEN a.assessment_type = 'mock_test' OR COALESCE(a.mock_test_format, '') IN ('lesson_wise', 'unit_wise', 'full_length') THEN a.correct_answers ELSE 0 END)
            / NULLIF(SUM(CASE WHEN a.assessment_type = 'mock_test' OR COALESCE(a.mock_test_format, '') IN ('lesson_wise', 'unit_wise', 'full_length') THEN (a.correct_answers + a.incorrect_answers) ELSE 0 END), 0)
          , 1), 0) as mock_test_accuracy,
          COALESCE(ROUND(
            100.0 * SUM(CASE WHEN a.assessment_type = 'previous_paper' THEN a.correct_answers ELSE 0 END)
            / NULLIF(SUM(CASE WHEN a.assessment_type = 'previous_paper' THEN (a.correct_answers + a.incorrect_answers) ELSE 0 END), 0)
          , 1), 0) as previous_paper_accuracy
         FROM mock_test_attempts a
         JOIN students s ON s.id = a.student_id
         WHERE COALESCE(a.status, 'completed') = 'completed'
           AND a.attempted_questions > 0
           AND ${GENUINE_STUDENT_SQL('s')}`
      ),
      safeQuery(
        'overview.active_today',
        `SELECT
          COUNT(DISTINCT CASE WHEN (s.last_login_at >= ${IST_TODAY_START} OR EXISTS (
            SELECT 1 FROM study_sessions ss WHERE ss.student_id = s.id AND ss.started_at >= ${IST_TODAY_START}
          )) THEN s.id END)::int as active_today,
          COUNT(DISTINCT CASE WHEN (
            (s.last_login_at >= (${IST_TODAY_START} - INTERVAL '1 day') AND s.last_login_at < ${IST_TODAY_START})
            OR EXISTS (SELECT 1 FROM study_sessions ss WHERE ss.student_id = s.id AND ss.started_at >= (${IST_TODAY_START} - INTERVAL '1 day') AND ss.started_at < ${IST_TODAY_START})
          ) THEN s.id END)::int as active_yesterday
         FROM students s
         WHERE ${GENUINE_STUDENT_SQL('s')}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.traffic',
        `SELECT
          COUNT(DISTINCT visitor_id)::int as total_visitors,
          COUNT(DISTINCT visitor_id)::int as unique_visitors,
          COUNT(DISTINCT CASE WHEN student_id IS NOT NULL THEN visitor_id END)::int as authenticated_visits,
          COUNT(DISTINCT CASE WHEN student_id IS NULL THEN visitor_id END)::int as anonymous_visits
         FROM visitor_sessions
         WHERE started_at >= $2::timestamptz
           AND ${getRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.page_views',
        `SELECT COUNT(*)::int as total_page_views
         FROM page_views
         WHERE viewed_at >= $2::timestamptz
           AND ${getRangeCondition('viewed_at', range)}
           AND page_path NOT LIKE '/admin%'
           AND ($1::text IS NULL OR district = $1)`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.logins',
        `SELECT
          COUNT(CASE WHEN ${getRangeCondition('sa.created_at', range)} THEN 1 END)::int as total_logins,
          COUNT(CASE WHEN ${getPrevRangeCondition('sa.created_at', range)} THEN 1 END)::int as prev_logins,
          COUNT(CASE WHEN sa.created_at >= $2::timestamptz THEN 1 END)::int as login_events_since_activation,
          COUNT(DISTINCT CASE WHEN sa.created_at >= $2::timestamptz THEN sa.student_id END)::int as unique_students_logged_in
         FROM student_activity sa
         JOIN students s ON sa.student_id = s.id
         WHERE sa.activity_type IN ('login', 'google_login')
           AND ${GENUINE_STUDENT_SQL('s')}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.revenue',
        `SELECT COALESCE(SUM(sub.amount), 0) as total_revenue
         FROM student_subscriptions sub
         JOIN students s ON s.id = sub.student_id
         WHERE sub.status = 'active'
           AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP)
           AND ${GENUINE_SUB_SQL('sub', 's')}
           AND ${getRangeCondition('sub.transaction_date', range)}
           AND ($1::text IS NULL OR sub.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.mcq',
        `SELECT
          COUNT(*)::int as total_attempts,
          COUNT(CASE WHEN qa.attempted_at >= ${IST_TODAY_START} THEN 1 END)::int as attempts_today,
          COUNT(CASE WHEN qa.attempted_at >= CURRENT_TIMESTAMP - INTERVAL '3 days' THEN 1 END)::int as attempts_3d,
          COUNT(CASE WHEN qa.attempted_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END)::int as attempts_7d,
          COUNT(CASE WHEN qa.attempted_at >= CURRENT_TIMESTAMP - INTERVAL '14 days' THEN 1 END)::int as attempts_14d,
          COUNT(CASE WHEN qa.attempted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END)::int as attempts_30d,
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END)::int as correct_count,
          COUNT(CASE WHEN qa.is_correct = false THEN 1 END)::int as incorrect_count,
          COUNT(DISTINCT qa.student_id)::int as participating_students,
          COALESCE(ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) as avg_accuracy
         FROM question_attempts qa
         JOIN students s ON qa.student_id = s.id
         WHERE ${GENUINE_STUDENT_SQL('s')}
           AND ${getRangeCondition('qa.attempted_at', range)}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.all_time_mcq',
        `SELECT
          COUNT(*)::int as all_time_attempts,
          COUNT(CASE WHEN qa.is_correct = true THEN 1 END)::int as all_time_correct,
          COUNT(CASE WHEN qa.is_correct = false THEN 1 END)::int as all_time_incorrect,
          COUNT(DISTINCT qa.student_id)::int as all_time_participating_students,
          COALESCE(ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) as all_time_accuracy
         FROM question_attempts qa
         JOIN students s ON qa.student_id = s.id
         WHERE ${GENUINE_STUDENT_SQL('s')}`
      ),
    ]);

    // Batch 2: Previous period comparisons, sparkline, active/subscription periods, and question bank
    const [
      qPrevTraffic,
      qPrevPageViews,
      qPrevRevenue,
      qPrevMcq,
      qVisitorSparkline,
      qPeriodActive,
      qPeriodSubs,
      qQuestions,
      qQuestionsBySubj,
      qQuestionsByGrp,
    ] = await Promise.all([
      safeQuery(
        'overview.prev_traffic',
        `SELECT
          COUNT(DISTINCT visitor_id)::int as total_visitors,
          COUNT(DISTINCT visitor_id)::int as unique_visitors
         FROM visitor_sessions
         WHERE started_at >= $2::timestamptz
           AND ${getPrevRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.prev_page_views',
        `SELECT COUNT(*)::int as total_page_views
         FROM page_views
         WHERE viewed_at >= $2::timestamptz
           AND ${getPrevRangeCondition('viewed_at', range)}
           AND page_path NOT LIKE '/admin%'
           AND ($1::text IS NULL OR district = $1)`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.prev_revenue',
        `SELECT COALESCE(SUM(sub.amount), 0) as total_revenue
         FROM student_subscriptions sub
         JOIN students s ON s.id = sub.student_id
         WHERE sub.status = 'active'
           AND ${GENUINE_SUB_SQL('sub', 's')}
           AND ${getPrevRangeCondition('sub.transaction_date', range)}
           AND ($1::text IS NULL OR sub.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.prev_mcq',
        `SELECT
          COUNT(*)::int as total_attempts,
          COALESCE(ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) as avg_accuracy
         FROM question_attempts qa
         JOIN students s ON qa.student_id = s.id
         WHERE ${GENUINE_STUDENT_SQL('s')}
           AND ${getPrevRangeCondition('qa.attempted_at', range)}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.visitor_sparkline',
        `SELECT
          d.day,
          COUNT(DISTINCT vs.visitor_id)::int as visitors
         FROM (
           SELECT generate_series(
             ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days')::date,
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
             '1 day'::interval
           )::date as day
         ) d
         LEFT JOIN visitor_sessions vs
           ON (vs.started_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
           AND vs.started_at >= $2::timestamptz
           AND ($1::text IS NULL OR vs.district = $1)
         GROUP BY d.day
         ORDER BY d.day ASC`,
        [distParam, liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.period_active',
        `SELECT
          COUNT(DISTINCT CASE WHEN (${getRangeCondition('s.last_login_at', range)} OR EXISTS (SELECT 1 FROM study_sessions ss WHERE ss.student_id = s.id AND ${getRangeCondition('ss.started_at', range)})) THEN s.id END)::int as active_cur,
          COUNT(DISTINCT CASE WHEN (${getPrevRangeCondition('s.last_login_at', range)} OR EXISTS (SELECT 1 FROM study_sessions ss WHERE ss.student_id = s.id AND ${getPrevRangeCondition('ss.started_at', range)})) THEN s.id END)::int as active_prev
         FROM students s
         WHERE ${GENUINE_STUDENT_SQL('s')}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.period_subs',
        `SELECT
          COUNT(CASE WHEN sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) THEN 1 END)::int as active_subs,
          COUNT(CASE WHEN sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) AND NOT (${getRangeCondition('sub.transaction_date', range)}) THEN 1 END)::int as prev_active_subs
         FROM student_subscriptions sub
         JOIN students s ON s.id = sub.student_id
         WHERE ${GENUINE_SUB_SQL('sub', 's')}
           AND ($1::text IS NULL OR sub.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'overview.questions',
        `SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN status='published' THEN 1 END)::int as published,
          COUNT(CASE WHEN status='staging' THEN 1 END)::int as staging,
          COUNT(CASE WHEN ${getRangeCondition('created_at', range)} THEN 1 END)::int as new_in_range,
          COUNT(CASE WHEN ${getPrevRangeCondition('created_at', range)} THEN 1 END)::int as prev_new_in_range
        FROM questions`
      ),
      safeQuery(
        'overview.questions_by_subject',
        `SELECT COALESCE(subject, 'General Studies') as subject, COUNT(*)::int as count
        FROM questions
        GROUP BY subject
        ORDER BY count DESC
        LIMIT 8`
      ),
      safeQuery(
        'overview.questions_by_group',
        `SELECT COALESCE(category, 'General') as group_name, COUNT(*)::int as count
        FROM questions
        GROUP BY category
        ORDER BY count DESC`
      ),
    ]);

    // Batch 3: Study materials, restored accounts, trends, traffic sources, performance cohorts, subscription tiers, recent activity
    const trendDays = range === 'today' ? 1 : range === '7d' ? 6 : range === '90d' ? 89 : 29;
    const [
      qTextbooks,
      qDrive,
      qNotes,
      qTbStandard,
      qTbSubject,
      qRestored,
      qRegTrends,
      qTrafficOverview,
      trafficSourcesRes,
      qMockPerf,
      qPerfCohorts,
      qSubTiers,
      qRecentActs,
    ] = await Promise.all([
      safeQuery(
        'overview.textbooks',
        `SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN status='completed' OR status='published' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status='processing' OR status='uploaded' THEN 1 END)::int as in_review
        FROM textbooks`
      ),
      safeQuery('overview.drive_materials', `SELECT COUNT(*)::int as total FROM google_drive_materials`),
      safeQuery(
        'overview.study_notes',
        `SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN status='published' THEN 1 END)::int as published,
          COUNT(CASE WHEN status='staging' THEN 1 END)::int as staging
        FROM study_notes`
      ),
      safeQuery(
        'overview.textbooks_by_standard',
        `SELECT standard::text, COUNT(*)::int as count
        FROM textbooks
        WHERE standard IS NOT NULL
        GROUP BY standard
        ORDER BY standard`
      ),
      safeQuery(
        'overview.textbooks_by_subject',
        `SELECT subject, COUNT(*)::int as count
        FROM textbooks
        WHERE subject IS NOT NULL
        GROUP BY subject
        ORDER BY count DESC
        LIMIT 8`
      ),
      safeQuery(
        'overview.restored_students',
        `SELECT
          (SELECT COUNT(*)::int FROM student_activity sa JOIN students s ON s.id = sa.student_id WHERE sa.activity_type = 'account_restored' AND ${GENUINE_STUDENT_SQL('s')}) as restored_total,
          (SELECT COUNT(*)::int FROM student_activity sa JOIN students s ON s.id = sa.student_id WHERE sa.activity_type = 'account_restored' AND ${GENUINE_STUDENT_SQL('s')} AND ${getRangeCondition('sa.created_at', range)}) as restored_in_range,
          (SELECT COUNT(*)::int FROM student_activity sa JOIN students s ON s.id = sa.student_id WHERE sa.activity_type = 'account_restored' AND ${GENUINE_STUDENT_SQL('s')} AND ${getPrevRangeCondition('sa.created_at', range)}) as prev_restored_in_range,
          COUNT(CASE WHEN (s.is_active = false OR s.deleted_at IS NOT NULL) AND LOWER(TRIM(COALESCE(s.email, ''))) NOT LIKE '%@example.com' THEN 1 END)::int as deactivated_count
        FROM students s`
      ),
      safeQuery(
        'overview.reg_trends',
        `SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') as date,
          TO_CHAR(d.day, 'Mon DD') as label,
          COUNT(DISTINCT LOWER(TRIM(s.email)))::int as count
        FROM (
          SELECT generate_series(
            ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '${trendDays} days')::date,
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
            '1 day'::interval
          )::date as day
        ) d
        LEFT JOIN students s
          ON (s.created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
          AND ${GENUINE_STUDENT_SQL('s')}
        GROUP BY d.day
        ORDER BY d.day ASC`
      ),
      safeQuery(
        'overview.traffic_overview',
        `SELECT
          (SELECT COUNT(DISTINCT visitor_id)::int FROM visitor_sessions WHERE started_at >= GREATEST($1::timestamptz, ${IST_TODAY_START})) as daily_visitors,
          (SELECT COUNT(DISTINCT visitor_id)::int FROM visitor_sessions WHERE started_at >= GREATEST($1::timestamptz, CURRENT_TIMESTAMP - INTERVAL '7 days')) as weekly_visitors,
          (SELECT COUNT(DISTINCT visitor_id)::int FROM visitor_sessions WHERE started_at >= GREATEST($1::timestamptz, CURRENT_TIMESTAMP - INTERVAL '30 days')) as monthly_visitors,
          (SELECT COUNT(DISTINCT visitor_id)::int FROM visitor_sessions WHERE started_at >= $1::timestamptz AND is_active = true AND ended_at IS NULL AND last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes') as current_visitors,
          (SELECT COUNT(DISTINCT visitor_id)::int FROM visitor_sessions WHERE started_at >= $1::timestamptz) as total_visitors`,
        [liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.traffic_sources',
        `SELECT
          COALESCE(CASE
            WHEN referrer ILIKE '%google%' THEN 'Google Search'
            WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%instagram%' OR referrer ILIKE '%twitter%' OR referrer ILIKE '%t.co%' THEN 'Social Media'
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct Traffic'
            ELSE 'Referral / Others'
          END, 'Direct Traffic') as source,
          COUNT(DISTINCT visitor_id)::int as count
         FROM visitor_sessions
         WHERE started_at >= $1::timestamptz
           AND ${getRangeCondition('started_at', range)}
         GROUP BY source
         ORDER BY count DESC`,
        [liveTrackingActivatedAt]
      ),
      safeQuery(
        'overview.mock_perf',
        `SELECT
          COUNT(*)::int as total_mocks,
          COALESCE(ROUND(AVG(a.percentage), 1), 0) as avg_score,
          COUNT(CASE WHEN a.percentage >= 50 THEN 1 END)::int as passed_count
        FROM mock_test_attempts a
        JOIN students s ON s.id = a.student_id
        WHERE COALESCE(a.status, 'completed') = 'completed'
          AND a.attempted_questions > 0
          AND ${GENUINE_STUDENT_SQL('s')}`
      ),
      safeQuery(
        'overview.perf_cohorts',
        `WITH student_acc AS (
          SELECT
            s.id,
            COUNT(a.id) as attempts,
            COALESCE(AVG(a.percentage), 0) as accuracy
          FROM students s
          JOIN mock_test_attempts a ON s.id = a.student_id
          WHERE COALESCE(a.status, 'completed') = 'completed'
            AND a.attempted_questions > 0
            AND ${GENUINE_STUDENT_SQL('s')}
          GROUP BY s.id
        )
        SELECT
          COUNT(CASE WHEN accuracy >= 75 THEN 1 END)::int as high_performers,
          COUNT(CASE WHEN accuracy >= 50 AND accuracy < 75 THEN 1 END)::int as avg_performers,
          COUNT(CASE WHEN accuracy < 50 THEN 1 END)::int as need_support
        FROM student_acc`
      ),
      safeQuery(
        'overview.sub_tiers',
        `SELECT
          COUNT(CASE WHEN sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) THEN 1 END)::int as total_active,
          COUNT(CASE WHEN (sub.plan_name ILIKE '%month%' OR sub.plan_id ILIKE '%month%') AND sub.plan_name NOT ILIKE '%half%' AND sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) THEN 1 END)::int as monthly,
          COUNT(CASE WHEN (sub.plan_name ILIKE '%quarter%' OR sub.plan_id ILIKE '%quarter%') AND sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) THEN 1 END)::int as quarterly,
          COUNT(CASE WHEN (sub.plan_name ILIKE '%half%' OR sub.plan_id ILIKE '%half%') AND sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) THEN 1 END)::int as half_yearly,
          COUNT(CASE WHEN (sub.plan_name ILIKE '%year%' OR sub.plan_name ILIKE '%annual%' OR sub.plan_id ILIKE '%year%') AND sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at > CURRENT_TIMESTAMP) THEN 1 END)::int as yearly,
          COUNT(CASE WHEN sub.status = 'expired' OR (sub.expires_at IS NOT NULL AND sub.expires_at <= CURRENT_TIMESTAMP) THEN 1 END)::int as expired,
          COUNT(CASE WHEN ${getRangeCondition('sub.transaction_date', range)} THEN 1 END)::int as new_subscriptions
        FROM student_subscriptions sub
        JOIN students s ON s.id = sub.student_id
        WHERE ${GENUINE_SUB_SQL('sub', 's')}`
      ),
      safeQuery(
        'overview.recent_activity',
        `SELECT
          sa.id,
          sa.student_id,
          sa.activity_type,
          sa.reference_title,
          sa.metadata,
          sa.created_at,
          s.full_name as student_name,
          s.target_group
        FROM student_activity sa
        LEFT JOIN students s ON sa.student_id = s.id
        ORDER BY sa.created_at DESC
        LIMIT 12`
      ),
    ]);

    const realVisitorSparkline = qVisitorSparkline.rows.map((r) => Number(r.visitors || 0));

    const totalStudents = toInt(qStudents.rows[0]?.total);
    const activeStudentsToday = toInt(qActiveToday.rows[0]?.active_today);
    const activeStudentsYesterday = toInt(qActiveToday.rows[0]?.active_yesterday);
    const newRegistrations = toInt(qStudents.rows[0]?.new_in_range);
    const totalVisitors = toInt(qTraffic.rows[0]?.total_visitors);
    const uniqueVisitors = toInt(qTraffic.rows[0]?.unique_visitors);
    const totalPageViews = toInt(qPageViews.rows[0]?.total_page_views);
    const totalLogins = toInt(qLogins.rows[0]?.total_logins);
    const prevLogins = toInt(qLogins.rows[0]?.prev_logins);
    const paidSubscribers = toInt(qStudents.rows[0]?.paid_subscribers);
    const freeStudents = toInt(qStudents.rows[0]?.free_students);
    const revenue = toFloat(qRevenue.rows[0]?.total_revenue);
    const totalMcq = toInt(qMcq.rows[0]?.total_attempts);
    const avgAccuracy = toFloat(qMcq.rows[0]?.avg_accuracy);

    const prevVisitors = toInt(qPrevTraffic.rows[0]?.total_visitors);
    const prevUnique = toInt(qPrevTraffic.rows[0]?.unique_visitors);
    const prevPageViews = toInt(qPrevPageViews.rows[0]?.total_page_views);
    const prevRevenue = toFloat(qPrevRevenue.rows[0]?.total_revenue);
    const prevMcq = toInt(qPrevMcq.rows[0]?.total_attempts);
    const prevAccuracy = toFloat(qPrevMcq.rows[0]?.avg_accuracy);

    const curTotalStudents = totalStudents;
    const prevTotalStudents = isAllTime ? 0 : toInt(qStudents.rows[0]?.prev_total);
    const curActiveInRange = Math.max(activeStudentsToday, toInt(qPeriodActive.rows[0]?.active_cur));
    const prevActiveInRange = toInt(qPeriodActive.rows[0]?.active_prev);
    const curActiveSubs = toInt(qPeriodSubs.rows[0]?.active_subs);
    const prevActiveSubs = isAllTime ? 0 : toInt(qPeriodSubs.rows[0]?.prev_active_subs);

    const totalQuestions = toInt(qQuestions.rows[0]?.total);
    const publishedQuestions = toInt(qQuestions.rows[0]?.published);
    const stagingQuestions = toInt(qQuestions.rows[0]?.staging);
    const newQuestionsInRange = toInt(qQuestions.rows[0]?.new_in_range);
    const prevNewQuestionsInRange = toInt(qQuestions.rows[0]?.prev_new_in_range);

    const restoredTotal = toInt(qRestored.rows[0]?.restored_total);
    const restored7d = toInt(qRestored.rows[0]?.restored_in_range);
    const prevRestored7d = toInt(qRestored.rows[0]?.prev_restored_in_range);
    const deactivatedCount = toInt(qRestored.rows[0]?.deactivated_count);

    const totalSourceCount = trafficSourcesRes.rows.reduce((acc, r) => acc + toInt(r.count), 0);
    const trafficSources = trafficSourcesRes.rows.map((r) => ({
      source: r.source,
      count: toInt(r.count),
      percentage: totalSourceCount > 0 ? Math.round((toInt(r.count) / totalSourceCount) * 100) : 0,
    }));

    const totalMocks = toInt(qMockPerf.rows[0]?.total_mocks);
    const avgMockScore = toFloat(qMockPerf.rows[0]?.avg_score);
    const passedMocks = toInt(qMockPerf.rows[0]?.passed_count);
    const mockPassRate = totalMocks > 0 ? Math.round((passedMocks / totalMocks) * 100) : 0;
    const highPerfCount = toInt(qPerfCohorts.rows[0]?.high_performers);
    const avgPerfCount = toInt(qPerfCohorts.rows[0]?.avg_performers);
    const supportCount = toInt(qPerfCohorts.rows[0]?.need_support);

    const subRow = qSubTiers.rows[0] || {};
    const subActive = toInt(subRow.total_active);
    const subMonthly = toInt(subRow.monthly);
    const subQuarterly = toInt(subRow.quarterly);
    const subHalfYearly = toInt(subRow.half_yearly);
    const subYearly = toInt(subRow.yearly);
    const subExpired = toInt(subRow.expired);
    const subNew = toInt(subRow.new_subscriptions);

    const donutDistribution = [
      { name: 'Monthly Pass', count: subMonthly, percentage: subActive > 0 ? Math.round((subMonthly / subActive) * 100) : 0, color: '#3b82f6' },
      { name: 'Quarterly Pass', count: subQuarterly, percentage: subActive > 0 ? Math.round((subQuarterly / subActive) * 100) : 0, color: '#8b5cf6' },
      { name: 'Half-Yearly Pass', count: subHalfYearly, percentage: subActive > 0 ? Math.round((subHalfYearly / subActive) * 100) : 0, color: '#ec4899' },
      { name: 'Yearly Pass', count: subYearly, percentage: subActive > 0 ? Math.round((subYearly / subActive) * 100) : 0, color: '#10b981' },
      { name: 'Expired', count: subExpired, percentage: (subActive + subExpired) > 0 ? Math.round((subExpired / (subActive + subExpired)) * 100) : 0, color: '#64748b' },
    ];

    const mockAgg = qMockAttemptsAgg.rows[0] || {};
    const mockAllTimeAttempts = parseInt(mockAgg.all_time_attempts || '0', 10);
    const mockAttemptsInRange = parseInt(mockAgg.attempts_in_range || '0', 10);
    const mockPrevAttemptsInRange = parseInt(mockAgg.prev_attempts_in_range || '0', 10);
    const mockCorrectInRange = parseInt(mockAgg.correct_in_range || '0', 10);
    const mockIncorrectInRange = parseInt(mockAgg.incorrect_in_range || '0', 10);
    const mockAllTimeCorrect = parseInt(mockAgg.all_time_correct || '0', 10);
    const mockAllTimeIncorrect = parseInt(mockAgg.all_time_incorrect || '0', 10);

    // Combine real completed assessment attempts (mock_test_attempts) with question_attempts without double-counting
    const effectiveCorrect = mockAllTimeCorrect > 0
      ? (isAllTime ? mockAllTimeCorrect : mockCorrectInRange)
      : parseInt(qMcq.rows[0]?.correct_count || '0', 10);
    const effectiveIncorrect = mockAllTimeIncorrect > 0
      ? (isAllTime ? mockAllTimeIncorrect : mockIncorrectInRange)
      : parseInt(qMcq.rows[0]?.incorrect_count || '0', 10);
    const effectiveAnswered = effectiveCorrect + effectiveIncorrect;
    const effectiveAccuracy =
      effectiveAnswered > 0
        ? Math.round((effectiveCorrect / effectiveAnswered) * 1000) / 10
        : avgAccuracy;

    const effectiveTotalAttempts =
      mockAllTimeAttempts > 0
        ? (isAllTime ? mockAllTimeAttempts : mockAttemptsInRange)
        : totalMcq;
    const effectivePrevAttempts = mockAllTimeAttempts > 0 ? mockPrevAttemptsInRange : prevMcq;
    const effectiveAttemptsToday =
      mockAllTimeAttempts > 0
        ? parseInt(mockAgg.attempts_today || '0', 10)
        : parseInt(qMcq.rows[0]?.attempts_today || '0', 10);
    const effectiveAttempts3d =
      mockAllTimeAttempts > 0
        ? parseInt(mockAgg.attempts_3d || '0', 10)
        : parseInt(qMcq.rows[0]?.attempts_3d || '0', 10);
    const effectiveAttemptsWeekly =
      mockAllTimeAttempts > 0
        ? parseInt(mockAgg.attempts_7d || '0', 10)
        : parseInt(qMcq.rows[0]?.attempts_7d || '0', 10);
    const effectiveAttempts14d =
      mockAllTimeAttempts > 0
        ? parseInt(mockAgg.attempts_14d || '0', 10)
        : parseInt(qMcq.rows[0]?.attempts_14d || '0', 10);
    const effectiveAttemptsMonthly =
      mockAllTimeAttempts > 0
        ? parseInt(mockAgg.attempts_30d || '0', 10)
        : parseInt(qMcq.rows[0]?.attempts_30d || '0', 10);
    const effectiveParticipating = Math.max(
      parseInt(mockAgg.participating_students || '0', 10),
      parseInt(qMcq.rows[0]?.participating_students || qAllTimeMcq.rows[0]?.all_time_participating_students || '0', 10)
    );
    const verifiedStudents = parseInt(qStudents.rows[0]?.verified_students || '0', 10);
    const onlineStudents = parseInt(qOnlineStudents.rows[0]?.online_students || '0', 10);
    const lastActiveAt = qStudents.rows[0]?.last_active_at || null;
    const prevNewInRange = parseInt(qStudents.rows[0]?.prev_new_in_range || '0', 10);

    // 9 CORE OVERVIEW CARDS (100% genuine DB metrics, real sparklines, honest historical comparisons)
    const overviewCards = [
      {
        id: 'total_students',
        title: 'Total Students',
        value: curTotalStudents,
        formatted: curTotalStudents.toLocaleString('en-IN'),
        ...formatTrendMeta(curTotalStudents, prevTotalStudents),
        icon: 'Users',
        category: 'students',
      },
      {
        id: 'active_students',
        title: 'Active Students',
        value: onlineStudents,
        formatted: onlineStudents.toLocaleString('en-IN'),
        ...formatTrendMeta(curActiveInRange, prevActiveInRange),
        icon: 'UserCheck',
        category: 'engagement',
        badgeText: onlineStudents > 0 ? `${onlineStudents} Online Now` : 'Offline',
      },
      {
        id: 'website_visitors',
        title: 'Website Visitors',
        value: uniqueVisitors,
        formatted: uniqueVisitors.toLocaleString('en-IN'),
        ...formatTrendMeta(uniqueVisitors, prevUnique),
        icon: 'Globe',
        category: 'traffic',
        sparkline: realVisitorSparkline,
      },
      {
        id: 'new_students',
        title: 'New Students',
        value: newRegistrations,
        formatted: newRegistrations.toLocaleString('en-IN'),
        ...formatTrendMeta(newRegistrations, prevNewInRange),
        icon: 'UserPlus',
        category: 'growth',
      },
      {
        id: 'restored_students',
        title: 'Restored Students',
        value: restoredTotal,
        formatted: restoredTotal.toLocaleString('en-IN'),
        ...formatTrendMeta(restored7d, prevRestored7d),
        icon: 'RotateCcw',
        category: 'management',
        badgeText: deactivatedCount > 0 ? `${deactivatedCount} Inactive` : 'All Active',
      },
      {
        id: 'active_subscriptions',
        title: 'Active Subscriptions',
        value: curActiveSubs,
        formatted: curActiveSubs.toLocaleString('en-IN'),
        ...formatTrendMeta(curActiveSubs, prevActiveSubs),
        icon: 'CreditCard',
        category: 'revenue',
      },
      {
        id: 'total_questions',
        title: 'Total Questions',
        value: totalQuestions,
        formatted: totalQuestions.toLocaleString('en-IN'),
        ...formatTrendMeta(newQuestionsInRange, prevNewQuestionsInRange),
        icon: 'Database',
        category: 'content',
        badgeText: `${publishedQuestions} Published`,
      },
      {
        id: 'total_mcq_attempts',
        title: 'Total MCQ Attempts',
        value: effectiveTotalAttempts,
        formatted: effectiveTotalAttempts.toLocaleString('en-IN'),
        ...formatTrendMeta(effectiveTotalAttempts, effectivePrevAttempts),
        icon: 'Award',
        category: 'practice',
      },
      {
        id: 'student_performance',
        title: 'Overall Accuracy',
        value: effectiveAccuracy,
        formatted: `${effectiveAccuracy}%`,
        ...formatTrendMeta(effectiveAccuracy, prevAccuracy, 'accuracy (unanswered excluded)'),
        icon: 'Target',
        category: 'performance',
      },
    ];

    const kpiSummary = overviewCards.slice(0, 5);

    return {
      overviewCards,
      kpiSummary,
      range,
      timezone: 'Asia/Kolkata',
      serverTimestamp: new Date().toISOString(),
      liveTrackingActivatedAt,
      studentAnalytics: {
        totalStudents: curTotalStudents,
        verifiedStudents,
        onlineStudents,
        lastActiveAt,
        activeStudents: onlineStudents,
        recentlyActiveStudents: curActiveInRange,
        activePercentage: curTotalStudents > 0 ? Math.round((onlineStudents / curTotalStudents) * 100) : 0,
        newStudents: newRegistrations,
        newSinceActivation: parseInt(qStudents.rows[0]?.new_since_activation || '0', 10),
        newToday: parseInt(qStudents.rows[0]?.new_today || '0', 10),
        newWeekly: parseInt(qStudents.rows[0]?.new_7d || '0', 10),
        newMonthly: parseInt(qStudents.rows[0]?.new_30d || '0', 10),
        totalLoginEvents: parseInt(qLogins.rows[0]?.login_events_since_activation || '0', 10),
        uniqueStudentsLoggedIn: parseInt(qLogins.rows[0]?.unique_students_logged_in || '0', 10),
        restoredStudents: restoredTotal,
        restored7d,
        prevRestored7d,
        deactivatedStudents: deactivatedCount,
        registrationTrends: qRegTrends.rows.map((r) => ({
          date: r.date,
          label: r.label,
          count: parseInt(r.count, 10),
        })),
        groupBreakdown: qQuestionsByGrp.rows.map((r) => ({
          group: r.group_name.toUpperCase(),
          count: parseInt(r.count, 10),
        })),
      },
      websiteTrafficAnalytics: {
        totalVisitors: uniqueVisitors,
        uniqueVisitors,
        pageViews: totalPageViews,
        authenticatedVisits: parseInt(qTraffic.rows[0]?.authenticated_visits || '0', 10),
        anonymousVisits: parseInt(qTraffic.rows[0]?.anonymous_visits || '0', 10),
        currentVisitors: qTrafficOverview.rows[0]?.current_visitors || 0,
        dailyVisitors: qTrafficOverview.rows[0]?.daily_visitors || 0,
        weeklyVisitors: qTrafficOverview.rows[0]?.weekly_visitors || 0,
        monthlyVisitors: qTrafficOverview.rows[0]?.monthly_visitors || 0,
        trafficSources,
      },
      studentPerformance: {
        overallAccuracy: effectiveAccuracy,
        mcqPracticeAccuracy: parseFloat(mockAgg.mcq_practice_accuracy || '0'),
        mockTestAccuracy: parseFloat(mockAgg.mock_test_accuracy || '0'),
        previousPaperAccuracy: parseFloat(mockAgg.previous_paper_accuracy || '0'),
        totalMcqAttempts: effectiveTotalAttempts,
        attemptsToday: effectiveAttemptsToday,
        attempts3d: effectiveAttempts3d,
        attemptsWeekly: effectiveAttemptsWeekly,
        attempts14d: effectiveAttempts14d,
        attemptsMonthly: effectiveAttemptsMonthly,
        correctAnswers: effectiveCorrect,
        incorrectAnswers: effectiveIncorrect,
        participatingStudents: effectiveParticipating,
        averageTestScore: avgMockScore,
        avgAttemptsPerStudent: curTotalStudents > 0 ? parseFloat((effectiveTotalAttempts / curTotalStudents).toFixed(1)) : 0,
        totalMockTests: totalMocks,
        mockTestPassRate: mockPassRate,
        highPerformersCount: highPerfCount,
        averagePerformersCount: avgPerfCount,
        needSupportCount: supportCount,
      },
      subscriptionAnalytics: {
        activeSubscriptions: subActive,
        newSubscriptions: subNew,
        expiredSubscriptions: subExpired,
        monthlyPass: subMonthly,
        quarterlyPass: subQuarterly,
        halfYearlyPass: subHalfYearly,
        yearlyPass: subYearly,
        distribution: donutDistribution,
      },
      questionBankAnalytics: {
        totalQuestions,
        publishedQuestions,
        stagingQuestions,
        publishedPercentage: totalQuestions > 0 ? Math.round((publishedQuestions / totalQuestions) * 1000) / 10 : 0,
        stagingPercentage: totalQuestions > 0 ? Math.round((stagingQuestions / totalQuestions) * 1000) / 10 : 0,
        bySubject: qQuestionsBySubj.rows.map((r) => ({
          subject: r.subject,
          count: parseInt(r.count, 10),
        })),
        byGroup: qQuestionsByGrp.rows.map((r) => ({
          group: r.group_name,
          count: parseInt(r.count, 10),
        })),
      },
      studyMaterialsAnalytics: {
        totalTextbooks: qTextbooks.rows[0]?.total || 0,
        completedTextbooks: qTextbooks.rows[0]?.completed || 0,
        totalDrivePdfs: qDrive.rows[0]?.total || 0,
        totalStudyNotes: qNotes.rows[0]?.total || 0,
        publishedStudyNotes: qNotes.rows[0]?.published || 0,
        byStandard: qTbStandard.rows.map((r) => ({
          standard: r.standard,
          count: parseInt(r.count, 10),
        })),
        bySubject: qTbSubject.rows.map((r) => ({
          subject: r.subject,
          count: parseInt(r.count, 10),
        })),
      },
      recentActivity: qRecentActs.rows.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name || 'Enrolled Student',
        targetGroup: r.target_group ? r.target_group.toUpperCase() : 'TNPSC',
        activityType: r.activity_type,
        title: r.reference_title,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
      cards: [
        {
          id: 'total_students',
          title: 'Total Registered Students',
          value: totalStudents,
          formatted: totalStudents.toLocaleString('en-IN'),
          ...formatTrendMeta(totalStudents, prevTotalStudents),
          category: 'students',
          badge: `${verifiedStudents} Verified`,
        },
        {
          id: 'active_today',
          title: 'Active Students Today',
          value: activeStudentsToday,
          formatted: activeStudentsToday.toLocaleString('en-IN'),
          ...formatTrendMeta(activeStudentsToday, activeStudentsYesterday, 'vs yesterday'),
          category: 'engagement',
          badge: 'Live Today (IST)',
        },
        {
          id: 'new_registrations',
          title: 'New Registrations',
          value: newRegistrations,
          formatted: newRegistrations.toLocaleString('en-IN'),
          ...formatTrendMeta(newRegistrations, prevNewInRange),
          category: 'growth',
          badge: range.toUpperCase(),
        },
        {
          id: 'total_visitors',
          title: 'Total Visitors',
          value: totalVisitors,
          formatted: totalVisitors.toLocaleString('en-IN'),
          ...formatTrendMeta(totalVisitors, prevVisitors),
          category: 'traffic',
          badge: 'Total Traffic',
        },
        {
          id: 'unique_visitors',
          title: 'Unique Visitors',
          value: uniqueVisitors,
          formatted: uniqueVisitors.toLocaleString('en-IN'),
          ...formatTrendMeta(uniqueVisitors, prevUnique),
          category: 'traffic',
          badge: 'Distinct Users',
        },
        {
          id: 'total_page_views',
          title: 'Total Page Views',
          value: totalPageViews,
          formatted: totalPageViews.toLocaleString('en-IN'),
          ...formatTrendMeta(totalPageViews, prevPageViews),
          category: 'traffic',
          badge: 'Page Impressions',
        },
        {
          id: 'student_logins',
          title: 'Total Student Logins',
          value: totalLogins,
          formatted: totalLogins.toLocaleString('en-IN'),
          ...formatTrendMeta(totalLogins, prevLogins),
          category: 'engagement',
          badge: 'Platform Logins',
        },
        {
          id: 'paid_subscribers',
          title: 'Paid Subscribers',
          value: paidSubscribers,
          formatted: paidSubscribers.toLocaleString('en-IN'),
          ...formatTrendMeta(curActiveSubs, prevActiveSubs),
          category: 'revenue',
          badge: 'Active Paid Tier',
        },
        {
          id: 'free_students',
          title: 'Free Students',
          value: freeStudents,
          formatted: freeStudents.toLocaleString('en-IN'),
          change: null,
          trend: 'neutral' as const,
          hasHistoricalData: false,
          comparisonText: 'Current snapshot',
          category: 'students',
          badge: 'Standard Access',
        },
        {
          id: 'monthly_revenue',
          title: 'Subscription Revenue',
          value: revenue,
          formatted: `₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          ...formatTrendMeta(revenue, prevRevenue),
          category: 'revenue',
          badge: 'Verified INR',
        },
        {
          id: 'mcq_attempts',
          title: 'Total MCQ Attempts',
          value: effectiveTotalAttempts,
          formatted: effectiveTotalAttempts.toLocaleString('en-IN'),
          ...formatTrendMeta(effectiveTotalAttempts, effectivePrevAttempts),
          category: 'learning',
          badge: 'Practiced MCQs',
        },
        {
          id: 'average_accuracy',
          title: 'Average Student Accuracy',
          value: effectiveAccuracy,
          formatted: `${effectiveAccuracy}%`,
          ...formatTrendMeta(effectiveAccuracy, prevAccuracy),
          category: 'learning',
          badge: 'Accuracy Metric',
        },
      ],
    };
  }

  // 3. Tamil Nadu Geographic Analytics (All 38 Districts — 100% Real DB Data, IST aligned)
  static async getGeographic(range: string = '30d') {
    const isAllTime = String(range || '').toLowerCase().trim() === 'all';

    // Aggregate visitor sessions by district (exclude NULL/unknown districts)
    const distTraffic = await pool.query(
      `SELECT
        district,
        COUNT(*)::int as visitors,
        COUNT(DISTINCT visitor_id)::int as unique_visitors,
        COUNT(DISTINCT CASE WHEN student_id IS NOT NULL AND is_active = true AND last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN student_id END)::int as online_students
       FROM visitor_sessions
       WHERE district IS NOT NULL
         AND ${getRangeCondition('started_at', range)}
       GROUP BY district`
    );
    const trafficMap = new Map<string, { visitors: number; uniqueVisitors: number; onlineStudents: number }>();
    distTraffic.rows.forEach((r) => {
      if (!r.district) return;
      trafficMap.set(String(r.district).toLowerCase(), {
        visitors: parseInt(r.visitors, 10),
        uniqueVisitors: parseInt(r.unique_visitors, 10),
        onlineStudents: parseInt(r.online_students || '0', 10),
      });
    });

    // Aggregate students by district
    const distStudents = await pool.query(
      `SELECT
        district,
        COUNT(*)::int as total_students,
        COUNT(CASE WHEN subscription_tier != 'free' AND subscription_status = 'active' THEN 1 END)::int as subscribers,
        COUNT(CASE WHEN subscription_tier = 'free' OR subscription_tier IS NULL THEN 1 END)::int as free_students
       FROM students
       WHERE district IS NOT NULL
       GROUP BY district`
    );
    const studentMap = new Map<string, { students: number; subscribers: number; free: number }>();
    distStudents.rows.forEach((r) => {
      if (!r.district) return;
      studentMap.set(String(r.district).toLowerCase(), {
        students: parseInt(r.total_students, 10),
        subscribers: parseInt(r.subscribers, 10),
        free: parseInt(r.free_students, 10),
      });
    });

    // Aggregate active today by district (IST)
    const distActiveToday = await pool.query(
      `SELECT
        district,
        COUNT(DISTINCT id)::int as active_today
       FROM students
       WHERE (last_login_at >= ${IST_TODAY_START} OR EXISTS (
         SELECT 1 FROM study_sessions ss WHERE ss.student_id = students.id AND ss.started_at >= ${IST_TODAY_START}
       )) AND district IS NOT NULL
       GROUP BY district`
    );
    const activeMap = new Map<string, number>();
    distActiveToday.rows.forEach((r) => {
      if (!r.district) return;
      activeMap.set(String(r.district).toLowerCase(), parseInt(r.active_today, 10));
    });

    // Aggregate revenue by district
    const distRevenue = await pool.query(
      `SELECT
        district,
        COALESCE(SUM(amount), 0) as revenue
       FROM student_subscriptions
       WHERE status = 'active'
         AND district IS NOT NULL
         AND ${getRangeCondition('transaction_date', range)}
       GROUP BY district`
    );
    const revenueMap = new Map<string, number>();
    distRevenue.rows.forEach((r) => {
      if (!r.district) return;
      revenueMap.set(String(r.district).toLowerCase(), parseFloat(r.revenue));
    });

    // Aggregate MCQ & Mock Test activity by student's confirmed district
    const [distMcqRes, distMockRes] = await Promise.all([
      pool.query(
        `SELECT s.district, COUNT(qa.id)::int as mcq_attempts
         FROM question_attempts qa
         JOIN students s ON qa.student_id = s.id
         WHERE s.district IS NOT NULL
           AND ${getRangeCondition('qa.attempted_at', range)}
         GROUP BY s.district`
      ),
      pool.query(
        `SELECT s.district, COUNT(mta.id)::int as mock_attempts
         FROM mock_test_attempts mta
         JOIN students s ON mta.student_id = s.id
         WHERE s.district IS NOT NULL
           AND COALESCE(mta.status, 'completed') = 'completed'
           AND ${getRangeCondition('mta.completed_at', range)}
         GROUP BY s.district`
      ),
    ]);
    const mcqMap = new Map<string, number>();
    distMcqRes.rows.forEach((r) => {
      if (r.district) mcqMap.set(String(r.district).toLowerCase(), Number(r.mcq_attempts || 0));
    });
    const mockMap = new Map<string, number>();
    distMockRes.rows.forEach((r) => {
      if (r.district) mockMap.set(String(r.district).toLowerCase(), Number(r.mock_attempts || 0));
    });

    // City level breakdowns (only non-null districts/cities)
    const cityTraffic = await pool.query(
      `SELECT
        district,
        city,
        COUNT(*)::int as visitors
       FROM visitor_sessions
       WHERE district IS NOT NULL
         AND city IS NOT NULL
         AND ${getRangeCondition('started_at', range)}
       GROUP BY district, city`
    );
    const cityMap = new Map<string, { city: string; visitors: number }[]>();
    cityTraffic.rows.forEach((r) => {
      if (!r.district || !r.city) return;
      const key = String(r.district).toLowerCase();
      const list = cityMap.get(key) || [];
      list.push({ city: String(r.city), visitors: parseInt(r.visitors, 10) });
      cityMap.set(key, list);
    });

    // Real-time Login Location Analytics from student_login_locations (never fabricated)
    const rangeWhereSql = getRangeCondition('login_timestamp', range);

    const [loginByDistRes, loginSummaryRes] = await Promise.all([
      pool.query(
        `SELECT
           district_id,
           district_name,
           COUNT(DISTINCT CASE WHEN ${rangeWhereSql} THEN student_id END)::int AS unique_login_students,
           COUNT(CASE WHEN ${rangeWhereSql} THEN 1 END)::int AS total_login_events,
           COUNT(DISTINCT CASE WHEN (login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN student_id END)::int AS today_unique_logins,
           COUNT(DISTINCT CASE WHEN login_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN student_id END)::int AS last_7d_unique_logins,
           COUNT(DISTINCT CASE WHEN login_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN student_id END)::int AS last_30d_unique_logins
         FROM student_login_locations
         WHERE district_id IS NOT NULL
           AND location_status IN ('detected', 'manual')
         GROUP BY district_id, district_name`
      ),
      pool.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN ${rangeWhereSql} AND district_id IS NOT NULL AND location_status IN ('detected', 'manual') THEN student_id END)::int AS total_unique_login_students,
           COUNT(CASE WHEN ${rangeWhereSql} AND district_id IS NOT NULL AND location_status IN ('detected', 'manual') THEN 1 END)::int AS total_login_events,
           COUNT(DISTINCT CASE WHEN (login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND district_id IS NOT NULL AND location_status IN ('detected', 'manual') THEN student_id END)::int AS today_total_unique_logins,
           COUNT(CASE WHEN ${rangeWhereSql} AND location_status = 'outside_tamil_nadu' THEN 1 END)::int AS outside_tn_count,
           COUNT(CASE WHEN ${rangeWhereSql} AND location_status IN ('denied', 'unavailable', 'inaccurate') THEN 1 END)::int AS unavailable_count
         FROM student_login_locations`
      ),
    ]);

    const loginMap = new Map<
      string,
      {
        uniqueLoginStudents: number;
        totalLoginEvents: number;
        todayUniqueLogins: number;
        last7dUniqueLogins: number;
        last30dUniqueLogins: number;
      }
    >();

    for (const r of loginByDistRes.rows) {
      const norm = normalizeTamilNaduDistrict(r.district_name || r.district_id);
      const key = norm ? norm.id : String(r.district_id || r.district_name || '').toLowerCase();
      const prev = loginMap.get(key) || {
        uniqueLoginStudents: 0,
        totalLoginEvents: 0,
        todayUniqueLogins: 0,
        last7dUniqueLogins: 0,
        last30dUniqueLogins: 0,
      };
      loginMap.set(key, {
        uniqueLoginStudents: prev.uniqueLoginStudents + Number(r.unique_login_students || 0),
        totalLoginEvents: prev.totalLoginEvents + Number(r.total_login_events || 0),
        todayUniqueLogins: prev.todayUniqueLogins + Number(r.today_unique_logins || 0),
        last7dUniqueLogins: prev.last7dUniqueLogins + Number(r.last_7d_unique_logins || 0),
        last30dUniqueLogins: prev.last30dUniqueLogins + Number(r.last_30d_unique_logins || 0),
      });
    }

    const totalUniqueLoginStudentsAcrossTN = Number(
      loginSummaryRes.rows[0]?.total_unique_login_students || 0
    );

    // Construct response for all 38 districts
    const districts: DistrictMetric[] = TN_DISTRICTS.map((td) => {
      const key = td.name.toLowerCase();
      const normDef = normalizeTamilNaduDistrict(td.name);
      const canonicalId = normDef ? normDef.id : key;
      const tr = trafficMap.get(key) || { visitors: 0, uniqueVisitors: 0, onlineStudents: 0 };
      const st =
        studentMap.get(key) ||
        (normDef ? studentMap.get(normDef.name.toLowerCase()) : undefined) ||
        { students: 0, subscribers: 0, free: 0 };
      const rev = revenueMap.get(key) || 0;
      const act = activeMap.get(key) || 0;
      const mcqCount = mcqMap.get(key) || (normDef ? mcqMap.get(normDef.name.toLowerCase()) : 0) || 0;
      const mockCount = mockMap.get(key) || (normDef ? mockMap.get(normDef.name.toLowerCase()) : 0) || 0;
      const loginStats = loginMap.get(canonicalId) || {
        uniqueLoginStudents: 0,
        totalLoginEvents: 0,
        todayUniqueLogins: 0,
        last7dUniqueLogins: 0,
        last30dUniqueLogins: 0,
      };

      const rate = st.students > 0 ? Math.round((st.subscribers / st.students) * 1000) / 10 : 0;
      const usagePercentage =
        totalUniqueLoginStudentsAcrossTN > 0
          ? Math.round((loginStats.uniqueLoginStudents / totalUniqueLoginStudentsAcrossTN) * 1000) / 10
          : 0;

      // Merge city details (actual database counts only)
      const cList = cityMap.get(key) || [];
      const cities = td.cities.map((cityName) => {
        const found = cList.find((c) => c.city.toLowerCase() === cityName.toLowerCase());
        return {
          city: cityName,
          visitors: found ? found.visitors : 0,
          students: 0,
          subscribers: 0,
          revenue: 0,
        };
      });

      return {
        district: td.name,
        districtId: canonicalId,
        visitors: tr.visitors,
        uniqueVisitors: tr.uniqueVisitors,
        onlineStudents: tr.onlineStudents,
        mcqAttempts: mcqCount,
        mockTestAttempts: mockCount,
        students: st.students,
        registeredStudents: st.students,
        uniqueLoginStudents: loginStats.uniqueLoginStudents,
        totalLoginEvents: loginStats.totalLoginEvents,
        todayUniqueLogins: loginStats.todayUniqueLogins,
        last7dUniqueLogins: loginStats.last7dUniqueLogins,
        last30dUniqueLogins: loginStats.last30dUniqueLogins,
        usagePercentage,
        subscribers: st.subscribers,
        freeStudents: st.free,
        conversionRate: rate,
        revenue: rev,
        activeToday: Math.max(act, loginStats.todayUniqueLogins),
        cities,
      };
    });

    const sortedByActivity = [...districts].sort(
      (a, b) =>
        (b.uniqueLoginStudents || 0) - (a.uniqueLoginStudents || 0) ||
        (b.registeredStudents || 0) - (a.registeredStudents || 0) ||
        a.district.localeCompare(b.district)
    );
    const activeDistrictsList = sortedByActivity.filter((d) => (d.uniqueLoginStudents || 0) > 0);
    const registeredDistrictsCount = districts.filter((d) => (d.registeredStudents || 0) > 0).length;

    const toRankEntry = (d?: DistrictMetric) =>
      d
        ? {
            district: d.district,
            uniqueLoginStudents: d.uniqueLoginStudents || 0,
            totalLoginEvents: d.totalLoginEvents || 0,
            registeredStudents: d.registeredStudents || 0,
            usagePercentage: d.usagePercentage || 0,
          }
        : null;

    return {
      totalDistricts: 38,
      range: isAllTime ? 'all' : range,
      districts,
      ranking: {
        mostActiveDistrict: toRankEntry(activeDistrictsList[0]),
        secondMostActiveDistrict: toRankEntry(activeDistrictsList[1]),
        thirdMostActiveDistrict: toRankEntry(activeDistrictsList[2]),
        leastActiveDistrict:
          activeDistrictsList.length > 0
            ? toRankEntry(activeDistrictsList[activeDistrictsList.length - 1])
            : null,
        totalDistrictsWithRegisteredStudents: registeredDistrictsCount,
        totalDistrictsWithActivity: activeDistrictsList.length,
        totalUniqueLoginStudents: totalUniqueLoginStudentsAcrossTN,
        totalLoginEvents: Number(loginSummaryRes.rows[0]?.total_login_events || 0),
        todayTotalUniqueLogins: Number(loginSummaryRes.rows[0]?.today_total_unique_logins || 0),
        outsideTamilNaduCount: Number(loginSummaryRes.rows[0]?.outside_tn_count || 0),
        unavailableLocationCount: Number(loginSummaryRes.rows[0]?.unavailable_count || 0),
      },
    };
  }

  // 4. Live Website Visitor Monitor (100% Real-Time Sessions + Genuine Backend Activity Feed)
  static async getLiveMonitor() {
    const liveThreshold = "CURRENT_TIMESTAMP - INTERVAL '5 minutes'";

    const [qLiveVisitors, streamRes, recentEventsRes, qToday, topPagesRes, sourcesRes, trendsRes] = await Promise.all([
      safeQuery(
        'live.visitors',
        `SELECT
          COUNT(DISTINCT session_id)::int as active_sessions,
          COUNT(DISTINCT visitor_id)::int as active_visitors,
          COUNT(DISTINCT CASE WHEN student_id IS NOT NULL THEN student_id END)::int as active_students,
          COUNT(DISTINCT CASE WHEN student_id IS NULL THEN visitor_id END)::int as anonymous_visitors,
          COUNT(DISTINCT CASE WHEN device_category = 'desktop' THEN session_id END)::int as desktop_count,
          COUNT(DISTINCT CASE WHEN device_category = 'mobile' THEN session_id END)::int as mobile_count,
          COUNT(DISTINCT CASE WHEN device_category = 'tablet' THEN session_id END)::int as tablet_count
         FROM visitor_sessions
         WHERE is_active = true
           AND last_heartbeat >= ${liveThreshold}`
      ),
      safeQuery(
        'live.stream',
        `SELECT
          pv.id,
          pv.session_id,
          pv.page_path,
          pv.page_title,
          pv.district,
          pv.city,
          pv.device_category,
          pv.viewed_at,
          vs.is_returning,
          vs.browser,
          s.full_name as student_name
         FROM page_views pv
         LEFT JOIN visitor_sessions vs ON pv.session_id = vs.session_id
         LEFT JOIN students s ON pv.student_id = s.id
         ORDER BY pv.viewed_at DESC
         LIMIT 25`
      ),
      safeQuery(
        'live.recent_events',
        `SELECT
          sa.id,
          sa.activity_type as event_type,
          sa.reference_title as title,
          sa.created_at as timestamp,
          s.full_name as student_name,
          s.district as district
         FROM student_activity sa
         LEFT JOIN students s ON sa.student_id = s.id
         ORDER BY sa.created_at DESC
         LIMIT 20`
      ),
      safeQuery(
        'live.today',
        `SELECT
          (SELECT COUNT(*)::int FROM page_views WHERE viewed_at >= ${IST_TODAY_START}) as page_views_today,
          (SELECT COUNT(*)::int FROM visitor_sessions WHERE started_at >= ${IST_TODAY_START}) as sessions_today`
      ),
      safeQuery(
        'live.top_pages',
        `SELECT
          page_path,
          COUNT(*)::int as views,
          COUNT(DISTINCT visitor_id)::int as visitors
         FROM page_views
         WHERE viewed_at >= ${IST_TODAY_START}
         GROUP BY page_path
         ORDER BY views DESC
         LIMIT 5`
      ),
      safeQuery(
        'live.sources',
        `SELECT
          COALESCE(CASE
            WHEN referrer ILIKE '%google%' THEN 'Google Search'
            WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%instagram%' OR referrer ILIKE '%twitter%' OR referrer ILIKE '%t.co%' THEN 'Social Media'
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct Traffic'
            ELSE 'Referral / Others'
          END, 'Direct Traffic') as source,
          COUNT(*)::int as count
         FROM visitor_sessions
         WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
         GROUP BY source
         ORDER BY count DESC`
      ),
      safeQuery(
        'live.trends',
        `SELECT
          TO_CHAR(DATE_TRUNC('hour', viewed_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') as time,
          COUNT(*)::int as page_views,
          COUNT(DISTINCT visitor_id)::int as visitors
         FROM page_views
         WHERE viewed_at >= ${IST_TODAY_START}
         GROUP BY DATE_TRUNC('hour', viewed_at AT TIME ZONE 'Asia/Kolkata')
         ORDER BY time ASC`
      ),
    ]);

    const activeVisitors = toInt(qLiveVisitors.rows[0]?.active_visitors);
    const activeSessions = toInt(qLiveVisitors.rows[0]?.active_sessions);
    const activeStudents = toInt(qLiveVisitors.rows[0]?.active_students);
    const anonymousVisitors = toInt(qLiveVisitors.rows[0]?.anonymous_visitors);
    const desktopCount = toInt(qLiveVisitors.rows[0]?.desktop_count);
    const mobileCount = toInt(qLiveVisitors.rows[0]?.mobile_count);
    const tabletCount = toInt(qLiveVisitors.rows[0]?.tablet_count);
    const pageViewsToday = toInt(qToday.rows[0]?.page_views_today);
    const sessionsToday = toInt(qToday.rows[0]?.sessions_today);

    return {
      activeVisitors,
      activeSessions,
      activeStudents,
      anonymousVisitors,
      pageViewsToday,
      sessionsToday,
      deviceBreakdown: {
        desktop: desktopCount,
        mobile: mobileCount,
        tablet: tabletCount,
      },
      mostVisitedPages: topPagesRes.rows.map((r) => ({
        path: r.page_path,
        views: r.views,
        visitors: r.visitors,
      })),
      trafficSources: sourcesRes.rows.map((r) => ({
        source: r.source,
        count: r.count,
      })),
      visitorTrends: trendsRes.rows.map((r) => ({
        time: r.time,
        pageViews: r.page_views,
        visitors: r.visitors,
      })),
      recentEvents: recentEventsRes.rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        title: r.title || r.event_type,
        studentName: r.student_name || 'Student',
        district: r.district || null,
        timestamp: r.timestamp,
      })),
      activityStream: streamRes.rows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        pagePath: r.page_path,
        pageTitle: r.page_title || r.page_path,
        district: r.district || null,
        city: r.city || null,
        deviceCategory: r.device_category || 'desktop',
        browser: r.browser || 'Other',
        isReturning: Boolean(r.is_returning),
        studentName: r.student_name || null,
        timestamp: r.viewed_at,
      })),
    };
  }

  // 5. Traffic Analytics (Supports All Time, IST, OS, Sources, New vs Returning, Avg Session Duration)
  static async getTraffic(range: string = '30d', districtFilter?: string) {
    const distParam = districtFilter && districtFilter !== 'all' ? districtFilter : null;

    const [timeRes, pagesRes, devicesRes, browsersRes, osRes, sourcesRes, summaryRes] = await Promise.all([
      pool.query(
        `SELECT
          TO_CHAR(DATE_TRUNC('day', viewed_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') as day,
          COUNT(*)::int as page_views,
          COUNT(DISTINCT visitor_id)::int as unique_visitors
         FROM page_views
         WHERE ${getRangeCondition('viewed_at', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY DATE_TRUNC('day', viewed_at AT TIME ZONE 'Asia/Kolkata')
         ORDER BY day ASC`,
        [distParam]
      ),
      pool.query(
        `SELECT
          page_path,
          COUNT(*)::int as views,
          COUNT(DISTINCT visitor_id)::int as unique_views
         FROM page_views
         WHERE ${getRangeCondition('viewed_at', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY page_path
         ORDER BY views DESC
         LIMIT 10`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COALESCE(device_category, 'desktop') as device_category,
          COUNT(*)::int as count
         FROM visitor_sessions
         WHERE ${getRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY device_category`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COALESCE(browser, 'Other') as browser,
          COUNT(*)::int as count
         FROM visitor_sessions
         WHERE ${getRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY browser
         ORDER BY count DESC
         LIMIT 6`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COALESCE(os, 'Other') as os,
          COUNT(*)::int as count
         FROM visitor_sessions
         WHERE ${getRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY os
         ORDER BY count DESC
         LIMIT 6`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COALESCE(CASE
            WHEN referrer ILIKE '%google%' THEN 'Google Search'
            WHEN referrer ILIKE '%facebook%' OR referrer ILIKE '%instagram%' OR referrer ILIKE '%twitter%' OR referrer ILIKE '%t.co%' THEN 'Social Media'
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct Traffic'
            ELSE 'Referral / Others'
          END, 'Direct Traffic') as source,
          COUNT(*)::int as count
         FROM visitor_sessions
         WHERE ${getRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY source
         ORDER BY count DESC`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COUNT(*)::int as total_sessions,
          COUNT(DISTINCT visitor_id)::int as unique_visitors,
          COUNT(DISTINCT CASE WHEN is_returning = false THEN visitor_id END)::int as new_visitors,
          COUNT(DISTINCT CASE WHEN is_returning = true THEN visitor_id END)::int as returning_visitors,
          COUNT(CASE WHEN student_id IS NOT NULL THEN 1 END)::int as authenticated_sessions,
          COUNT(CASE WHEN student_id IS NULL THEN 1 END)::int as anonymous_sessions,
          COALESCE(ROUND(AVG(GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ended_at, last_heartbeat) - started_at))))), 0)::int as avg_session_seconds
         FROM visitor_sessions
         WHERE ${getRangeCondition('started_at', range)}
           AND ($1::text IS NULL OR district = $1)`,
        [distParam]
      ),
    ]);

    const sRow = summaryRes.rows[0] || {};
    return {
      summary: {
        totalSessions: Number(sRow.total_sessions || 0),
        uniqueVisitors: Number(sRow.unique_visitors || 0),
        newVisitors: Number(sRow.new_visitors || 0),
        returningVisitors: Number(sRow.returning_visitors || 0),
        authenticatedSessions: Number(sRow.authenticated_sessions || 0),
        anonymousSessions: Number(sRow.anonymous_sessions || 0),
        avgSessionDurationSeconds: Number(sRow.avg_session_seconds || 0),
      },
      timeseries: timeRes.rows.map((r) => ({
        date: r.day,
        pageViews: parseInt(r.page_views, 10),
        uniqueVisitors: parseInt(r.unique_visitors, 10),
      })),
      topPages: pagesRes.rows.map((r) => ({
        path: r.page_path,
        views: parseInt(r.views, 10),
        uniqueViews: parseInt(r.unique_views, 10),
      })),
      devices: devicesRes.rows.map((r) => ({
        name: r.device_category,
        count: parseInt(r.count, 10),
      })),
      browsers: browsersRes.rows.map((r) => ({
        name: r.browser,
        count: parseInt(r.count, 10),
      })),
      operatingSystems: osRes.rows.map((r) => ({
        name: r.os,
        count: parseInt(r.count, 10),
      })),
      trafficSources: sourcesRes.rows.map((r) => ({
        source: r.source,
        count: parseInt(r.count, 10),
      })),
    };
  }

  // 6. Subscription & Payment Analytics (Real student_subscriptions + verified payment_events)
  static async getSubscriptions(range: string = '30d', districtFilter?: string) {
    const distParam = districtFilter && districtFilter !== 'all' ? districtFilter : null;

    const [planRes, trendRes, txRes, tierRes, payRes] = await Promise.all([
      pool.query(
        `SELECT
          plan_name,
          COUNT(*)::int as subscriptions,
          COALESCE(SUM(amount), 0) as total_revenue
         FROM student_subscriptions
         WHERE status = 'active'
           AND ${getRangeCondition('transaction_date', range)}
           AND ($1::text IS NULL OR district = $1)
         GROUP BY plan_name`,
        [distParam]
      ),
      pool.query(
        `SELECT
          TO_CHAR(DATE_TRUNC('month', transaction_date AT TIME ZONE 'Asia/Kolkata'), 'Mon YYYY') as month,
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*)::int as new_subs
         FROM student_subscriptions
         WHERE status = 'active'
           AND transaction_date >= CURRENT_TIMESTAMP - INTERVAL '12 months'
           AND ($1::text IS NULL OR district = $1)
         GROUP BY DATE_TRUNC('month', transaction_date AT TIME ZONE 'Asia/Kolkata')
         ORDER BY DATE_TRUNC('month', transaction_date AT TIME ZONE 'Asia/Kolkata') ASC`,
        [distParam]
      ),
      pool.query(
        `SELECT
          ss.id,
          s.full_name as student_name,
          s.email as student_email,
          ss.plan_name,
          ss.amount,
          ss.status,
          ss.payment_method,
          ss.district,
          ss.city,
          ss.transaction_date
         FROM student_subscriptions ss
         JOIN students s ON ss.student_id = s.id
         WHERE ($1::text IS NULL OR ss.district = $1)
         ORDER BY ss.transaction_date DESC
         LIMIT 15`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COUNT(*)::int as total_subscriptions,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int as total_active,
          COUNT(CASE WHEN (plan_name ILIKE '%month%' OR plan_id ILIKE '%month%') AND plan_name NOT ILIKE '%half%' AND status = 'active' THEN 1 END)::int as monthly,
          COUNT(CASE WHEN (plan_name ILIKE '%quarter%' OR plan_id ILIKE '%quarter%') AND status = 'active' THEN 1 END)::int as quarterly,
          COUNT(CASE WHEN (plan_name ILIKE '%half%' OR plan_id ILIKE '%half%') AND status = 'active' THEN 1 END)::int as half_yearly,
          COUNT(CASE WHEN (plan_name ILIKE '%year%' OR plan_name ILIKE '%annual%' OR plan_id ILIKE '%year%') AND status = 'active' THEN 1 END)::int as yearly,
          COUNT(CASE WHEN status = 'expired' THEN 1 END)::int as expired,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled,
          COUNT(CASE WHEN ${getRangeCondition('transaction_date', range)} THEN 1 END)::int as new_subscriptions
         FROM student_subscriptions
         WHERE ($1::text IS NULL OR district = $1)`,
        [distParam]
      ),
      pool.query(
        `SELECT
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending_payments,
          COUNT(CASE WHEN status = 'success' THEN 1 END)::int as successful_payments,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int as failed_payments,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END)::int as refunded_payments,
          COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as verified_webhook_revenue
         FROM payment_events
         WHERE ${getRangeCondition('created_at', range)}
           AND ($1::text IS NULL OR district = $1)`,
        [distParam]
      ),
    ]);

    const tRow = tierRes.rows[0] || {};
    const pRow = payRes.rows[0] || {};
    const totalSubscriptions = tRow.total_subscriptions || 0;
    const totalActive = tRow.total_active || 0;
    const monthlyCount = tRow.monthly || 0;
    const quarterlyCount = tRow.quarterly || 0;
    const halfYearlyCount = tRow.half_yearly || 0;
    const yearlyCount = tRow.yearly || 0;
    const expiredCount = tRow.expired || 0;
    const cancelledCount = tRow.cancelled || 0;
    const newSubsCount = tRow.new_subscriptions || 0;

    const donutDistribution = [
      {
        name: 'Monthly Pass',
        count: monthlyCount,
        percentage: totalActive > 0 ? Math.round((monthlyCount / totalActive) * 100) : 0,
        color: '#3b82f6',
      },
      {
        name: 'Quarterly Pass',
        count: quarterlyCount,
        percentage: totalActive > 0 ? Math.round((quarterlyCount / totalActive) * 100) : 0,
        color: '#8b5cf6',
      },
      {
        name: 'Half-Yearly Pass',
        count: halfYearlyCount,
        percentage: totalActive > 0 ? Math.round((halfYearlyCount / totalActive) * 100) : 0,
        color: '#ec4899',
      },
      {
        name: 'Yearly Pass',
        count: yearlyCount,
        percentage: totalActive > 0 ? Math.round((yearlyCount / totalActive) * 100) : 0,
        color: '#10b981',
      },
      {
        name: 'Expired',
        count: expiredCount,
        percentage: (totalActive + expiredCount) > 0 ? Math.round((expiredCount / (totalActive + expiredCount)) * 100) : 0,
        color: '#64748b',
      },
    ];

    return {
      summary: {
        totalSubscriptions,
        totalActive,
        monthlyCount,
        quarterlyCount,
        halfYearlyCount,
        yearlyCount,
        expiredCount,
        cancelledCount,
        newSubscriptionsCount: newSubsCount,
        pendingPayments: Number(pRow.pending_payments || 0),
        successfulPayments: Number(pRow.successful_payments || 0),
        failedPayments: Number(pRow.failed_payments || 0),
        refundedPayments: Number(pRow.refunded_payments || 0),
        verifiedWebhookRevenue: parseFloat(pRow.verified_webhook_revenue || '0'),
      },
      distribution: donutDistribution,
      plans: planRes.rows.map((r) => ({
        planName: r.plan_name,
        count: parseInt(r.subscriptions, 10),
        revenue: parseFloat(r.total_revenue),
      })),
      revenueTrend: trendRes.rows.map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        subscribers: parseInt(r.new_subs, 10),
      })),
      recentTransactions: txRes.rows.map((r) => ({
        id: r.id,
        studentName: r.student_name,
        studentEmail: r.student_email,
        planName: r.plan_name,
        amount: parseFloat(r.amount),
        status: r.status,
        paymentMethod: r.payment_method,
        district: r.district || 'Location unavailable',
        city: r.city || null,
        date: r.transaction_date,
      })),
    };
  }

  // 7. Student Analytics (Zero fabricated districts/cities)
  static async getStudents(range: string = '30d', districtFilter?: string) {
    const distParam = districtFilter && districtFilter !== 'all' ? districtFilter : null;

    const groupRes = await pool.query(
      `SELECT
        target_group,
        COUNT(*)::int as count
       FROM students
       WHERE ($1::text IS NULL OR district = $1)
       GROUP BY target_group`,
      [distParam]
    );

    const listRes = await pool.query(
      `SELECT
        s.id,
        s.full_name,
        s.email,
        s.target_group,
        s.district,
        s.city,
        s.subscription_tier,
        s.created_at,
        s.last_login_at,
        EXISTS (
          SELECT 1 FROM visitor_sessions vs
          WHERE vs.student_id = s.id AND vs.is_active = true
            AND vs.last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        ) as is_online,
        COUNT(DISTINCT qa.id)::int as total_mcqs,
        COALESCE(ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) as accuracy,
        COALESCE(SUM(ss.duration_seconds), 0) / 3600.0 as study_hours
       FROM students s
       LEFT JOIN question_attempts qa ON s.id = qa.student_id AND ${getRangeCondition('qa.attempted_at', range)}
       LEFT JOIN study_sessions ss ON s.id = ss.student_id AND ${getRangeCondition('ss.started_at', range)}
       WHERE ($1::text IS NULL OR s.district = $1)
       GROUP BY s.id
       ORDER BY total_mcqs DESC, s.created_at DESC
       LIMIT 50`,
      [distParam]
    );

    return {
      groupBreakdown: groupRes.rows.map((r) => ({
        group: r.target_group ? r.target_group.toUpperCase() : 'GROUP4',
        count: parseInt(r.count, 10),
      })),
      students: listRes.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        targetGroup: r.target_group || 'group4',
        district: r.district || 'Location unavailable',
        city: r.city || null,
        tier: r.subscription_tier || 'free',
        isOnline: Boolean(r.is_online),
        mcqCount: parseInt(r.total_mcqs, 10),
        accuracy: parseFloat(r.accuracy),
        studyHours: Math.round(parseFloat(r.study_hours) * 10) / 10,
        createdAt: r.created_at,
        lastLoginAt: r.last_login_at,
      })),
    };
  }

  // 8. Performance Analytics (Subject & Group Accuracy, supports All Time)
  static async getPerformance(range: string = '30d', districtFilter?: string) {
    const distParam = districtFilter && districtFilter !== 'all' ? districtFilter : null;

    const [subjRes, mockRes, perfRes] = await Promise.all([
      safeQuery(
        'performance.subjects',
        `SELECT
          qa.subject,
          COUNT(*)::int as total_attempts,
          COUNT(CASE WHEN qa.is_correct THEN 1 END)::int as correct_count,
          COALESCE(ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) as accuracy
         FROM question_attempts qa
         JOIN students s ON qa.student_id = s.id
         WHERE ${getRangeCondition('qa.attempted_at', range)}
           AND qa.subject IS NOT NULL
           AND ($1::text IS NULL OR s.district = $1)
         GROUP BY qa.subject
         ORDER BY total_attempts DESC`,
        [distParam]
      ),
      safeQuery(
        'performance.mock_tests',
        `SELECT
          COUNT(*)::int as total_mock_tests,
          COALESCE(ROUND(AVG(percentage), 1), 0) as avg_percentage,
          COUNT(CASE WHEN percentage >= 50 THEN 1 END)::int as passed_count
         FROM mock_test_attempts mta
         JOIN students s ON mta.student_id = s.id
         WHERE COALESCE(mta.status, 'completed') = 'completed'
           AND mta.attempted_questions > 0
           AND ${getRangeCondition('mta.completed_at', range)}
           AND ($1::text IS NULL OR s.district = $1)`,
        [distParam]
      ),
      safeQuery(
        'performance.cohorts',
        `WITH student_acc AS (
          SELECT
            s.id,
            COUNT(qa.id) as attempts,
            COALESCE(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 0) as accuracy
          FROM students s
          JOIN question_attempts qa ON s.id = qa.student_id
          WHERE ${getRangeCondition('qa.attempted_at', range)}
            AND ($1::text IS NULL OR s.district = $1)
          GROUP BY s.id
        )
        SELECT
          COUNT(CASE WHEN accuracy >= 75 THEN 1 END)::int as high_performers,
          COUNT(CASE WHEN accuracy >= 50 AND accuracy < 75 THEN 1 END)::int as avg_performers,
          COUNT(CASE WHEN accuracy < 50 THEN 1 END)::int as need_support,
          COALESCE(ROUND(AVG(accuracy), 1), 0) as overall_accuracy,
          COALESCE(SUM(attempts), 0)::int as total_attempts
        FROM student_acc`,
        [distParam]
      ),
    ]);

    const perfRow = perfRes.rows[0] || {};
    const highPerformers = toInt(perfRow.high_performers);
    const avgPerformers = toInt(perfRow.avg_performers);
    const needSupport = toInt(perfRow.need_support);
    const overallAccuracy = toFloat(perfRow.overall_accuracy);
    const totalMcqAttempts = toInt(perfRow.total_attempts);
    const totalMockTests = toInt(mockRes.rows[0]?.total_mock_tests);
    const avgMockScore = toFloat(mockRes.rows[0]?.avg_percentage);
    const passedMockTests = toInt(mockRes.rows[0]?.passed_count);

    return {
      subjects: subjRes.rows.map((r) => ({
        subject: r.subject,
        attempts: parseInt(r.total_attempts, 10),
        correct: parseInt(r.correct_count, 10),
        accuracy: parseFloat(r.accuracy),
      })),
      mockTests: {
        totalAttempts: totalMockTests,
        averageScore: avgMockScore,
        passedCount: passedMockTests,
        passRate: totalMockTests > 0 ? Math.round((passedMockTests / totalMockTests) * 100) : 0,
      },
      performanceSummary: {
        averageTestScore: avgMockScore,
        highPerformersCount: highPerformers,
        averagePerformersCount: avgPerformers,
        needSupportCount: needSupport,
        overallAccuracy,
        totalMcqAttempts,
        mockTestPerformance: {
          totalAttempts: totalMockTests,
          averageScore: avgMockScore,
          passedCount: passedMockTests,
          passRate: totalMockTests > 0 ? Math.round((passedMockTests / totalMockTests) * 100) : 0,
        },
      },
    };
  }

  // 9. Real-Time Student Login History (Day-by-Day Register, IST aligned, Admin-Only)
  private static buildLoginHistoryFilters(opts: {
    range?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    method?: string;
    sessionStatus?: string;
  }) {
    const range = String(opts.range || '30d').toLowerCase().trim();
    const params: any[] = [];
    const conditions: string[] = [];

    if (range === 'today') {
      conditions.push(`(e.login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`);
    } else if (range === 'yesterday') {
      conditions.push(`(e.login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day')::date`);
    } else if (range === '7d') {
      conditions.push(`e.login_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
    } else if (range === '30d') {
      conditions.push(`e.login_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
    } else if (range === '90d') {
      conditions.push(`e.login_timestamp >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
    } else if (range === 'custom') {
      const start = String(opts.startDate || '').trim();
      const end = String(opts.endDate || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        params.push(start);
        conditions.push(`(e.login_timestamp AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`);
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        params.push(end);
        conditions.push(`(e.login_timestamp AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`);
      }
    }

    const search = String(opts.search || '').trim();
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      const idx = params.length;
      conditions.push(`(
        LOWER(e.student_email_snapshot) LIKE $${idx}
        OR TO_CHAR(e.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') LIKE $${idx}
        OR TO_CHAR(e.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') LIKE $${idx}
      )`);
    }

    const method = String(opts.method || 'all').toLowerCase().trim();
    if (method === 'google') {
      conditions.push(`e.authentication_method = 'Google OAuth'`);
    } else if (method === 'email') {
      conditions.push(`e.authentication_method = 'Email & Password'`);
    }

    const sessionStatus = String(opts.sessionStatus || 'all').toLowerCase().trim();
    if (sessionStatus === 'online' || sessionStatus === 'offline' || sessionStatus === 'expired') {
      params.push(sessionStatus);
      conditions.push(`LOWER(e.session_status) = $${params.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereSql, params };
  }

  private static getUnifiedLoginHistoryCte(): string {
    return `
      WITH raw_events AS (
        SELECT
          sle.id::text AS record_key,
          sle.event_id,
          sle.student_id,
          LOWER(TRIM(COALESCE(NULLIF(sle.student_email_snapshot, ''), s.email))) AS student_email_snapshot,
          s.full_name AS student_name,
          sle.authentication_method,
          sle.login_status,
          sle.login_timestamp
        FROM student_login_events sle
        JOIN students s ON s.id = sle.student_id
        WHERE COALESCE(s.role, 'student') = 'student'

        UNION ALL

        SELECT
          ('sa_' || sa.id::text) AS record_key,
          ('legacy_sa_' || sa.id::text) AS event_id,
          sa.student_id,
          LOWER(TRIM(s.email)) AS student_email_snapshot,
          s.full_name AS student_name,
          CASE WHEN sa.activity_type = 'google_login' THEN 'Google OAuth' ELSE 'Email & Password' END AS authentication_method,
          'Successful' AS login_status,
          sa.created_at AS login_timestamp
        FROM student_activity sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.activity_type IN ('login', 'google_login')
          AND COALESCE(s.role, 'student') = 'student'
          AND NOT EXISTS (
            SELECT 1 FROM student_login_events sle2
            WHERE sle2.student_id = sa.student_id
              AND ABS(EXTRACT(EPOCH FROM (sle2.login_timestamp - sa.created_at))) <= 10
          )
      ),
      session_state AS (
        SELECT
          student_id,
          BOOL_OR(is_active = true AND last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes') AS is_online,
          BOOL_OR(ended_at IS NOT NULL) AS has_explicit_end,
          MAX(last_heartbeat) AS last_heartbeat
        FROM visitor_sessions
        WHERE student_id IS NOT NULL
        GROUP BY student_id
      ),
      last_activity_cte AS (
        SELECT
          student_id,
          MAX(created_at) AS last_activity_at
        FROM student_activity
        GROUP BY student_id
      ),
      enriched AS (
        SELECT
          re.record_key,
          re.event_id,
          re.student_id,
          re.student_email_snapshot,
          re.student_name,
          re.authentication_method,
          re.login_status,
          re.login_timestamp,
          TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS ist_date_key,
          TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') AS date_formatted,
          TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY') AS display_date,
          TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS time_formatted,
          CASE
            WHEN COALESCE(ss.is_online, false) = true THEN 'Online'
            WHEN ss.last_heartbeat IS NOT NULL AND ss.has_explicit_end = false AND ss.last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN 'Expired'
            ELSE 'Offline'
          END AS session_status,
          GREATEST(ss.last_heartbeat, la.last_activity_at, re.login_timestamp) AS last_activity_at,
          (ROW_NUMBER() OVER (PARTITION BY re.student_id ORDER BY re.login_timestamp ASC) > 1) AS is_returning_login
        FROM raw_events re
        LEFT JOIN session_state ss ON ss.student_id = re.student_id
        LEFT JOIN last_activity_cte la ON la.student_id = re.student_id
      )
    `;
  }

  static async getStudentLoginHistory(opts: {
    range?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    method?: string;
    sessionStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(10, Number(opts.limit) || 50));
    const offset = (page - 1) * limit;

    const cte = this.getUnifiedLoginHistoryCte();
    const { whereSql, params } = this.buildLoginHistoryFilters(opts);

    const [summaryRes, todayOnlineRes, dailySummaryRes, pageRowsRes, activationRes] = await Promise.all([
      pool.query(
        `${cte}
         SELECT
           COUNT(*)::int AS total_login_events,
           COUNT(DISTINCT e.student_id)::int AS unique_students_logged_in,
           COUNT(CASE WHEN e.is_returning_login THEN 1 END)::int AS returning_student_logins
         FROM enriched e
         ${whereSql}`,
        params
      ),
      pool.query(
        `${cte}
         SELECT
           COUNT(CASE WHEN (e.login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 1 END)::int AS today_login_events,
           COUNT(DISTINCT CASE WHEN (e.login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN e.student_id END)::int AS today_unique_students,
           (SELECT COUNT(DISTINCT student_id)::int FROM visitor_sessions WHERE student_id IS NOT NULL AND is_active = true AND last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes') AS currently_online_students
         FROM enriched e`
      ),
      pool.query(
        `${cte}
         SELECT
           e.ist_date_key,
           MIN(e.display_date) AS display_date,
           COUNT(*)::int AS total_login_events,
           COUNT(DISTINCT e.student_id)::int AS unique_students_logged_in
         FROM enriched e
         ${whereSql}
         GROUP BY e.ist_date_key
         ORDER BY e.ist_date_key DESC`,
        params
      ),
      pool.query(
        `${cte}
         SELECT
           e.record_key,
           e.event_id,
           e.student_id,
           e.student_email_snapshot,
           e.student_name,
           e.authentication_method,
           e.login_status,
           e.login_timestamp,
           e.ist_date_key,
           e.date_formatted,
           e.display_date,
           e.time_formatted,
           e.session_status,
           e.last_activity_at,
           e.is_returning_login
         FROM enriched e
         ${whereSql}
         ORDER BY e.login_timestamp DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT MIN(created_at) AS activated_at FROM student_login_events`),
    ]);

    const totalCount = Number(summaryRes.rows[0]?.total_login_events || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const dailyStatsMap = new Map<string, { displayDate: string; totalLoginEvents: number; uniqueStudentsLoggedIn: number }>();
    for (const d of dailySummaryRes.rows) {
      dailyStatsMap.set(d.ist_date_key, {
        displayDate: d.display_date,
        totalLoginEvents: Number(d.total_login_events || 0),
        uniqueStudentsLoggedIn: Number(d.unique_students_logged_in || 0),
      });
    }

    const rows = pageRowsRes.rows.map((r, idx) => ({
      serialNo: offset + idx + 1,
      eventId: r.event_id,
      studentId: Number(r.student_id),
      studentEmail: r.student_email_snapshot,
      studentName: r.student_name || null,
      dateKey: r.ist_date_key,
      dateFormatted: r.date_formatted,
      displayDate: r.display_date,
      loginTime: r.time_formatted,
      loginTimestamp: r.login_timestamp,
      authenticationMethod: r.authentication_method,
      loginStatus: r.login_status,
      sessionStatus: r.session_status,
      lastActivityAt: r.last_activity_at,
      isReturningLogin: Boolean(r.is_returning_login),
    }));

    // Group paginated rows by IST date (latest date first, latest login first within date)
    const groupMap = new Map<
      string,
      {
        dateKey: string;
        displayDate: string;
        totalLoginEvents: number;
        uniqueStudentsLoggedIn: number;
        events: typeof rows;
      }
    >();

    for (const row of rows) {
      let grp = groupMap.get(row.dateKey);
      if (!grp) {
        const stats = dailyStatsMap.get(row.dateKey);
        grp = {
          dateKey: row.dateKey,
          displayDate: stats?.displayDate || row.displayDate,
          totalLoginEvents: stats?.totalLoginEvents || 0,
          uniqueStudentsLoggedIn: stats?.uniqueStudentsLoggedIn || 0,
          events: [],
        };
        groupMap.set(row.dateKey, grp);
      }
      grp.events.push(row);
    }

    return {
      summary: {
        totalLoginEvents: totalCount,
        uniqueStudentsLoggedIn: Number(summaryRes.rows[0]?.unique_students_logged_in || 0),
        todayLoginEvents: Number(todayOnlineRes.rows[0]?.today_login_events || 0),
        todayUniqueStudents: Number(todayOnlineRes.rows[0]?.today_unique_students || 0),
        currentlyOnlineStudents: Number(todayOnlineRes.rows[0]?.currently_online_students || 0),
        returningStudentLogins: Number(summaryRes.rows[0]?.returning_student_logins || 0),
      },
      dailyGroups: Array.from(groupMap.values()),
      rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
      trackingActivatedAt: activationRes.rows[0]?.activated_at || null,
      timezone: 'Asia/Kolkata',
      serverTimestamp: new Date().toISOString(),
    };
  }

  static async getStudentLoginHistoryDetail(studentId: number) {
    const cte = this.getUnifiedLoginHistoryCte();
    const [studentRes, historyRes] = await Promise.all([
      pool.query(
        `SELECT id, full_name, email, target_group, district, created_at, last_login_at
         FROM students
         WHERE id = $1 AND COALESCE(role, 'student') = 'student'`,
        [studentId]
      ),
      pool.query(
        `${cte}
         SELECT
           e.event_id,
           e.student_email_snapshot,
           e.authentication_method,
           e.login_status,
           e.login_timestamp,
           e.ist_date_key,
           e.date_formatted,
           e.display_date,
           e.time_formatted,
           e.session_status,
           e.last_activity_at
         FROM enriched e
         WHERE e.student_id = $1
         ORDER BY e.login_timestamp DESC
         LIMIT 200`,
        [studentId]
      ),
    ]);

    if (studentRes.rows.length === 0) {
      return null;
    }

    const s = studentRes.rows[0];
    const events = historyRes.rows;
    const uniqueDates = new Set(events.map((e) => e.ist_date_key)).size;
    const mostRecent = events[0] || null;
    const firstRecorded = events.length > 0 ? events[events.length - 1] : null;

    return {
      studentId: Number(s.id),
      studentEmail: String(s.email || '').trim().toLowerCase(),
      studentName: s.full_name || null,
      targetGroup: s.target_group || null,
      district: s.district || 'Location unavailable',
      firstRecordedLogin: firstRecorded?.login_timestamp || null,
      mostRecentLogin: mostRecent?.login_timestamp || s.last_login_at || null,
      totalLoginEvents: events.length,
      uniqueLoginDates: uniqueDates,
      currentSessionStatus: mostRecent?.session_status || 'Offline',
      lastActivityAt: mostRecent?.last_activity_at || s.last_login_at || null,
      history: events.map((r, idx) => ({
        serialNo: idx + 1,
        eventId: r.event_id,
        dateFormatted: r.date_formatted,
        displayDate: r.display_date,
        loginTime: r.time_formatted,
        loginTimestamp: r.login_timestamp,
        authenticationMethod: r.authentication_method,
        loginStatus: r.login_status,
        sessionStatus: r.session_status,
      })),
    };
  }

  static async exportStudentLoginHistoryCsv(opts: {
    range?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    method?: string;
    sessionStatus?: string;
  }): Promise<string> {
    const cte = this.getUnifiedLoginHistoryCte();
    const { whereSql, params } = this.buildLoginHistoryFilters(opts);

    const res = await pool.query(
      `${cte}
       SELECT
         e.date_formatted,
         e.student_email_snapshot,
         e.time_formatted,
         e.authentication_method,
         e.session_status
       FROM enriched e
       ${whereSql}
       ORDER BY e.login_timestamp DESC
       LIMIT 10000`,
      params
    );

    const csvEscape = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = ['S.No,Date,Email,Login Time,Authentication Method,Session Status'];
    res.rows.forEach((r, idx) => {
      lines.push(
        [
          idx + 1,
          csvEscape(r.date_formatted),
          csvEscape(r.student_email_snapshot),
          csvEscape(r.time_formatted),
          csvEscape(r.authentication_method),
          csvEscape(r.session_status),
        ].join(',')
      );
    });
    return lines.join('\r\n');
  }
}

