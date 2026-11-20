import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';

let schemaPromise: Promise<void> | null = null;

export async function ensureSubscriptionHistorySchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id VARCHAR(64) PRIMARY KEY,
          plan_name VARCHAR(120) NOT NULL,
          duration_days INT NULL,
          price NUMERIC(10,2) NOT NULL DEFAULT 0,
          currency VARCHAR(10) NOT NULL DEFAULT 'INR',
          is_active BOOLEAN NOT NULL DEFAULT true,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE subscription_plans ALTER COLUMN duration_days DROP NOT NULL;
        ALTER TABLE subscription_plans ALTER COLUMN duration_days DROP DEFAULT;
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS slug VARCHAR(64);
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS entitlements JSONB NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;

        CREATE TABLE IF NOT EXISTS subscription_transactions (
          id SERIAL PRIMARY KEY,
          student_id INT REFERENCES students(id) ON DELETE SET NULL,
          student_email_snapshot VARCHAR(255) NOT NULL,
          subscription_plan_id VARCHAR(64),
          plan_name_snapshot VARCHAR(120) NOT NULL,
          plan_price_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
          amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
          tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          currency VARCHAR(10) NOT NULL DEFAULT 'INR',
          payment_provider VARCHAR(40) NOT NULL DEFAULT 'razorpay',
          payment_method VARCHAR(64),
          gateway_order_id VARCHAR(120),
          gateway_payment_id VARCHAR(120) UNIQUE,
          payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
          subscription_status VARCHAR(32) NOT NULL DEFAULT 'pending',
          purchased_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          activated_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          refunded_at TIMESTAMPTZ,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS student_module_entitlements (
          id SERIAL PRIMARY KEY,
          student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          module_key VARCHAR(40) NOT NULL,
          plan_id VARCHAR(64) NOT NULL,
          transaction_id INT REFERENCES subscription_transactions(id) ON DELETE SET NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'active',
          activated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (student_id, module_key)
        );

        CREATE INDEX IF NOT EXISTS idx_sub_tx_student_id ON subscription_transactions(student_id);
        CREATE INDEX IF NOT EXISTS idx_sub_tx_purchased_at ON subscription_transactions(purchased_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sub_tx_email ON subscription_transactions(LOWER(student_email_snapshot));
        CREATE INDEX IF NOT EXISTS idx_sub_tx_payment_status ON subscription_transactions(payment_status);
        CREATE INDEX IF NOT EXISTS idx_sub_tx_sub_status ON subscription_transactions(subscription_status);
        CREATE INDEX IF NOT EXISTS idx_stu_entitlements_student ON student_module_entitlements(student_id);
      `);

      // Seed the 4 official TNPSC Study Hub subscription plans idempotently (duration_days intentionally NULL until Admin configures)
      await pool.query(`
        INSERT INTO subscription_plans (
          id, slug, plan_name, duration_days, price, currency, is_active, is_featured, sort_order, description, features, entitlements
        )
        VALUES
          (
            'mcq_practice',
            'mcq_practice',
            'MCQ Practice',
            NULL,
            199.00,
            'INR',
            true,
            false,
            1,
            'Focused topic-wise and subject-wise objective question practice with performance tracking.',
            '["Topic-wise MCQ Practice", "Subject-wise question practice", "Available published MCQ questions", "Student performance tracking", "Practice history"]'::jsonb,
            '["mcq_practice"]'::jsonb
          ),
          (
            'mock_test',
            'mock_test',
            'Mock Test',
            NULL,
            199.00,
            'INR',
            true,
            false,
            2,
            'Exam-pattern timed mock test simulations with accuracy and score analytics.',
            '["Published Mock Tests", "Exam-pattern practice", "Test completion and results", "Marks and accuracy tracking", "Attempt history"]'::jsonb,
            '["mock_test"]'::jsonb
          ),
          (
            'previous_papers',
            'previous_papers',
            'Previous Papers',
            NULL,
            199.00,
            'INR',
            true,
            false,
            3,
            'Practice official TNPSC Previous Year Question Papers with instant evaluation.',
            '["Published TNPSC Previous Year Papers", "Actual examination paper practice", "Answer evaluation", "Marks and result history"]'::jsonb,
            '["previous_papers"]'::jsonb
          ),
          (
            'test_batch',
            'test_batch',
            'Test Batch',
            NULL,
            429.00,
            'INR',
            true,
            true,
            4,
            'All-in-one combined exam practice subscription unlocking all three practice modules.',
            '["Combined MCQ Practice access", "Combined Mock Test access", "Combined Previous Papers access", "One combined subscription for all three exam practice modules"]'::jsonb,
            '["mcq_practice", "mock_test", "previous_papers"]'::jsonb
          )
        ON CONFLICT (id) DO UPDATE SET
          slug = COALESCE(subscription_plans.slug, EXCLUDED.slug),
          description = COALESCE(subscription_plans.description, EXCLUDED.description),
          features = CASE WHEN subscription_plans.features = '[]'::jsonb THEN EXCLUDED.features ELSE subscription_plans.features END,
          entitlements = CASE WHEN subscription_plans.entitlements = '[]'::jsonb THEN EXCLUDED.entitlements ELSE subscription_plans.entitlements END,
          is_featured = EXCLUDED.is_featured,
          sort_order = EXCLUDED.sort_order
      `);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
}

const GENUINE_EMAIL_SQL = (col: string) => `(
  LOWER(TRIM(COALESCE(${col}, ''))) NOT LIKE '%@example.com'
  AND LOWER(TRIM(COALESCE(${col}, ''))) NOT LIKE 'test_%'
  AND LOWER(TRIM(COALESCE(${col}, ''))) NOT LIKE 'preview_%'
  AND LOWER(TRIM(COALESCE(${col}, ''))) NOT LIKE 'demo_%'
)`;

export function normalizeGatewayPaymentMethod(rawMethod?: string | null, cardType?: string | null): string | null {
  const m = String(rawMethod || '').trim().toLowerCase();
  if (!m || m === 'razorpay' || m === 'unknown' || m === 'none') return null;
  if (m === 'upi') return 'UPI';
  if (m === 'card') {
    const ct = String(cardType || '').trim().toLowerCase();
    if (ct === 'debit') return 'Debit Card';
    if (ct === 'credit') return 'Credit Card';
    return 'Card';
  }
  if (m === 'netbanking' || m === 'net_banking') return 'Net Banking';
  if (m === 'wallet') return 'Wallet';
  if (m === 'emi') return 'EMI';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function inferDurationDays(planId?: string | null, planName?: string | null): number {
  const s = `${planId || ''} ${planName || ''}`.toLowerCase();
  if (s.includes('year') || s.includes('annual')) return 365;
  if (s.includes('half')) return 180;
  if (s.includes('quarter')) return 90;
  return 30;
}

export interface VerifiedSubscriptionTxInput {
  studentId: number | null;
  studentEmail?: string | null;
  planId?: string | null;
  planName?: string | null;
  planPriceSnapshot?: number | null;
  amountPaid: number;
  taxAmount?: number;
  discountAmount?: number;
  refundAmount?: number;
  currency?: string;
  paymentProvider?: string;
  paymentMethod?: string | null;
  cardType?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  paymentStatus: 'success' | 'pending' | 'failed' | 'refunded';
  subscriptionStatus?: 'active' | 'expired' | 'cancelled' | 'pending' | 'inactive';
  purchasedAt?: Date | string;
  activatedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  refundedAt?: Date | string | null;
  metadata?: Record<string, any>;
}

/**
 * Idempotently records a verified subscription payment transaction.
 * Duplicate gateway_payment_id events update the existing record instead of creating duplicates.
 */
export async function recordVerifiedSubscriptionTransaction(input: VerifiedSubscriptionTxInput) {
  await ensureSubscriptionHistorySchema();

  let emailSnapshot = String(input.studentEmail || '').trim().toLowerCase();
  if (!emailSnapshot && input.studentId) {
    const sRes = await pool.query(`SELECT email FROM students WHERE id = $1`, [input.studentId]);
    emailSnapshot = String(sRes.rows[0]?.email || '').trim().toLowerCase();
  }
  if (!emailSnapshot) {
    emailSnapshot = 'unknown@student.local';
  }

  // Look up configured plan snapshot from subscription_plans (never hardcode in frontend)
  let planNameSnapshot = String(input.planName || '').trim();
  let planPriceSnapshot =
    input.planPriceSnapshot !== undefined && input.planPriceSnapshot !== null
      ? Number(input.planPriceSnapshot)
      : null;
  let durationDays: number | null = null;
  let foundInCatalog = false;

  if (input.planId) {
    const pRes = await pool.query(
      `SELECT plan_name, price::float AS price, duration_days FROM subscription_plans WHERE id = $1 LIMIT 1`,
      [input.planId]
    );
    if (pRes.rows.length > 0) {
      foundInCatalog = true;
      if (!planNameSnapshot) planNameSnapshot = pRes.rows[0].plan_name;
      if (planPriceSnapshot === null) planPriceSnapshot = Number(pRes.rows[0].price);
      const rawDur = pRes.rows[0].duration_days;
      durationDays = rawDur !== null && rawDur !== undefined && Number(rawDur) > 0 ? Number(rawDur) : null;
    }
  }
  if (!foundInCatalog) {
    const inferred = inferDurationDays(input.planId, input.planName);
    durationDays = inferred > 0 ? inferred : null;
  }
  if (!planNameSnapshot) planNameSnapshot = 'TNPSC Pro Pass';
  if (planPriceSnapshot === null) planPriceSnapshot = Number(input.amountPaid || 0);

  const normalizedMethod = normalizeGatewayPaymentMethod(input.paymentMethod, input.cardType);
  const purchasedAt = input.purchasedAt ? new Date(input.purchasedAt) : new Date();
  const isSuccess = input.paymentStatus === 'success';
  const isRefunded = input.paymentStatus === 'refunded';

  const subStatus =
    input.subscriptionStatus ||
    (isSuccess ? 'active' : isRefunded ? 'cancelled' : input.paymentStatus === 'failed' ? 'inactive' : 'pending');

  const activatedAt =
    input.activatedAt !== undefined
      ? input.activatedAt
        ? new Date(input.activatedAt)
        : null
      : isSuccess
        ? purchasedAt
        : null;

  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt
        ? new Date(input.expiresAt)
        : null
      : isSuccess && durationDays !== null
        ? new Date(purchasedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

  const refundedAt =
    input.refundedAt !== undefined
      ? input.refundedAt
        ? new Date(input.refundedAt)
        : null
      : isRefunded
        ? new Date()
        : null;

  const refundAmount = isRefunded
    ? Number(input.refundAmount ?? input.amountPaid ?? 0)
    : Number(input.refundAmount ?? 0);

  const gatewayPaymentId = input.gatewayPaymentId?.trim() || null;

  const res = await pool.query(
    `INSERT INTO subscription_transactions (
       student_id, student_email_snapshot, subscription_plan_id, plan_name_snapshot,
       plan_price_snapshot, amount_paid, tax_amount, discount_amount, refund_amount,
       currency, payment_provider, payment_method, gateway_order_id, gateway_payment_id,
       payment_status, subscription_status, purchased_at, activated_at, expires_at, refunded_at, metadata
     )
     VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21::jsonb
     )
     ON CONFLICT (gateway_payment_id) DO UPDATE SET
       payment_status = CASE
         WHEN subscription_transactions.payment_status = 'refunded' THEN 'refunded'
         WHEN EXCLUDED.payment_status = 'refunded' THEN 'refunded'
         WHEN subscription_transactions.payment_status = 'success' AND EXCLUDED.payment_status = 'pending' THEN 'success'
         ELSE EXCLUDED.payment_status
       END,
       subscription_status = CASE
         WHEN EXCLUDED.payment_status = 'refunded' THEN 'cancelled'
         WHEN EXCLUDED.subscription_status IN ('active', 'cancelled', 'expired') THEN EXCLUDED.subscription_status
         ELSE subscription_transactions.subscription_status
       END,
       payment_method = COALESCE(EXCLUDED.payment_method, subscription_transactions.payment_method),
       refund_amount = GREATEST(subscription_transactions.refund_amount, EXCLUDED.refund_amount),
       refunded_at = COALESCE(subscription_transactions.refunded_at, EXCLUDED.refunded_at),
       activated_at = COALESCE(subscription_transactions.activated_at, EXCLUDED.activated_at),
       expires_at = COALESCE(subscription_transactions.expires_at, EXCLUDED.expires_at),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      input.studentId,
      emailSnapshot,
      input.planId || null,
      planNameSnapshot,
      planPriceSnapshot,
      Number(input.amountPaid || 0),
      Number(input.taxAmount || 0),
      Number(input.discountAmount || 0),
      refundAmount,
      String(input.currency || 'INR').toUpperCase(),
      String(input.paymentProvider || 'razorpay'),
      normalizedMethod,
      input.gatewayOrderId || null,
      gatewayPaymentId,
      input.paymentStatus,
      subStatus,
      purchasedAt,
      activatedAt,
      expiresAt,
      refundedAt,
      JSON.stringify(input.metadata || {}),
    ]
  );

  broadcastAnalyticsEvent('subscription_updated', {
    transactionId: res.rows[0]?.id,
    studentId: input.studentId,
    paymentStatus: input.paymentStatus,
  });

  return res.rows[0];
}

export interface SubscriptionHistoryFilters {
  range?: string;
  from?: string;
  to?: string;
  email?: string;
  reference?: string;
  plan?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  subscriptionStatus?: string;
  page?: number;
  limit?: number;
}

function buildDateFilterSql(
  col: string,
  range: string,
  from?: string,
  to?: string,
  params?: any[]
): string {
  const r = String(range || '30d').toLowerCase().trim();
  if (r === 'all') return '1=1';
  if (r === 'today') {
    return `${col} >= (DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
  }
  if (r === 'yesterday') {
    return `${col} >= ((DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') - INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')
            AND ${col} < (DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
  }
  if (r === '7d') return `${col} >= CURRENT_TIMESTAMP - INTERVAL '7 days'`;
  if (r === '90d') return `${col} >= CURRENT_TIMESTAMP - INTERVAL '90 days'`;
  if (r === 'custom' && params) {
    const clauses: string[] = [];
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      clauses.push(`(${col} AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      clauses.push(`(${col} AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`);
    }
    return clauses.length > 0 ? clauses.join(' AND ') : '1=1';
  }
  return `${col} >= CURRENT_TIMESTAMP - INTERVAL '30 days'`;
}

function resolveEffectiveSubStatus(row: any): 'Active' | 'Expired' | 'Cancelled' | 'Pending' | 'Inactive' {
  const raw = String(row.subscription_status || '').toLowerCase();
  if (raw === 'cancelled') return 'Cancelled';
  if (raw === 'expired') return 'Expired';
  if (raw === 'active') {
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return 'Expired';
    }
    return 'Active';
  }
  if (raw === 'pending') return 'Pending';
  return 'Inactive';
}

function formatPaymentStatusLabel(raw?: string | null): 'Success' | 'Pending' | 'Failed' | 'Refunded' {
  const s = String(raw || '').toLowerCase();
  if (s === 'success' || s === 'captured') return 'Success';
  if (s === 'failed') return 'Failed';
  if (s === 'refunded') return 'Refunded';
  return 'Pending';
}

function formatIstParts(isoOrDate: Date | string | null) {
  if (!isoOrDate) return { dateKey: '', dateFormatted: '—', displayDate: '—', timeFormatted: '—' };
  const d = new Date(isoOrDate);
  const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const dateFormatted = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const displayDate = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return { dateKey, dateFormatted, displayDate, timeFormatted };
}

export async function getSubscriptionHistory(filters: SubscriptionHistoryFilters = {}) {
  await ensureSubscriptionHistorySchema();

  const range = String(filters.range || '30d').toLowerCase().trim();
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(10, Number(filters.limit) || 50));

  const params: any[] = [];
  const whereParts: string[] = [
    GENUINE_EMAIL_SQL('COALESCE(s.email, t.student_email_snapshot)'),
    buildDateFilterSql('t.purchased_at', range, filters.from, filters.to, params),
  ];

  if (filters.email && filters.email.trim()) {
    params.push(`%${filters.email.trim().toLowerCase()}%`);
    whereParts.push(`LOWER(COALESCE(s.email, t.student_email_snapshot)) LIKE $${params.length}`);
  }
  if (filters.reference && filters.reference.trim()) {
    params.push(`%${filters.reference.trim().toLowerCase()}%`);
    whereParts.push(
      `(LOWER(COALESCE(t.gateway_payment_id, '')) LIKE $${params.length} OR LOWER(COALESCE(t.gateway_order_id, '')) LIKE $${params.length})`
    );
  }
  if (filters.plan && filters.plan !== 'all') {
    params.push(filters.plan.trim().toLowerCase());
    whereParts.push(
      `(LOWER(COALESCE(t.plan_name_snapshot, '')) = $${params.length} OR LOWER(COALESCE(t.subscription_plan_id, '')) = $${params.length})`
    );
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    if (filters.paymentMethod.toLowerCase() === 'not available') {
      whereParts.push(`(t.payment_method IS NULL OR TRIM(t.payment_method) = '')`);
    } else {
      params.push(filters.paymentMethod.trim().toLowerCase());
      whereParts.push(`LOWER(COALESCE(t.payment_method, '')) = $${params.length}`);
    }
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    params.push(filters.paymentStatus.trim().toLowerCase());
    whereParts.push(`LOWER(COALESCE(t.payment_status, 'pending')) = $${params.length}`);
  }
  if (filters.subscriptionStatus && filters.subscriptionStatus !== 'all') {
    const st = filters.subscriptionStatus.trim().toLowerCase();
    if (st === 'active') {
      whereParts.push(`LOWER(t.subscription_status) = 'active' AND (t.expires_at IS NULL OR t.expires_at > CURRENT_TIMESTAMP)`);
    } else if (st === 'expired') {
      whereParts.push(`(LOWER(t.subscription_status) = 'expired' OR (LOWER(t.subscription_status) = 'active' AND t.expires_at IS NOT NULL AND t.expires_at <= CURRENT_TIMESTAMP))`);
    } else {
      params.push(st);
      whereParts.push(`LOWER(COALESCE(t.subscription_status, '')) = $${params.length}`);
    }
  }

  const whereSql = whereParts.join(' AND ');

  const [rowsRes, facetsRes] = await Promise.all([
    pool.query(
      `SELECT
         t.id,
         t.student_id,
         COALESCE(s.email, t.student_email_snapshot) AS student_email,
         s.full_name AS student_name,
         t.subscription_plan_id,
         t.plan_name_snapshot,
         t.plan_price_snapshot::float AS plan_price_snapshot,
         t.amount_paid::float AS amount_paid,
         t.tax_amount::float AS tax_amount,
         t.discount_amount::float AS discount_amount,
         t.refund_amount::float AS refund_amount,
         t.currency,
         t.payment_provider,
         t.payment_method,
         t.gateway_order_id,
         t.gateway_payment_id,
         t.payment_status,
         t.subscription_status,
         t.purchased_at,
         t.activated_at,
         t.expires_at,
         t.refunded_at
       FROM subscription_transactions t
       LEFT JOIN students s ON s.id = t.student_id
       WHERE ${whereSql}
       ORDER BY t.purchased_at DESC, t.id DESC`,
      params
    ),
    pool.query(`
      SELECT
        ARRAY(SELECT DISTINCT plan_name_snapshot FROM subscription_transactions WHERE plan_name_snapshot IS NOT NULL ORDER BY 1) AS plans,
        ARRAY(SELECT DISTINCT payment_method FROM subscription_transactions WHERE payment_method IS NOT NULL AND TRIM(payment_method) <> '' ORDER BY 1) AS methods
    `),
  ]);

  // Compute accurate summary metrics across all matching filtered records (never counting failed/pending as revenue)
  let totalPurchases = rowsRes.rows.length;
  let successfulPayments = 0;
  let grossCollected = 0;
  let totalRefundedAmount = 0;
  let activeSubscriptions = 0;
  let pendingPayments = 0;
  let failedPayments = 0;
  let expiredSubscriptions = 0;
  let totalRefunds = 0;

  const formattedAll = rowsRes.rows.map((r: any, idx: number) => {
    const pStatus = formatPaymentStatusLabel(r.payment_status);
    const sStatus = resolveEffectiveSubStatus(r);
    const amountPaid = Math.round(Number(r.amount_paid || 0) * 100) / 100;
    const refundAmt = Math.round(Number(r.refund_amount || 0) * 100) / 100;

    if (pStatus === 'Success') {
      successfulPayments += 1;
      grossCollected += amountPaid;
    } else if (pStatus === 'Pending') {
      pendingPayments += 1;
    } else if (pStatus === 'Failed') {
      failedPayments += 1;
    } else if (pStatus === 'Refunded') {
      totalRefunds += 1;
      totalRefundedAmount += refundAmt > 0 ? refundAmt : amountPaid;
    }

    if (sStatus === 'Active') activeSubscriptions += 1;
    else if (sStatus === 'Expired') expiredSubscriptions += 1;

    const ist = formatIstParts(r.purchased_at);
    const expIst = formatIstParts(r.expires_at);
    const actIst = formatIstParts(r.activated_at);

    return {
      serialNo: idx + 1,
      id: Number(r.id),
      studentId: r.student_id != null ? Number(r.student_id) : null,
      studentEmail: String(r.student_email || ''),
      studentName: r.student_name || null,
      dateKey: ist.dateKey,
      purchaseDate: ist.dateFormatted,
      displayDate: ist.displayDate,
      purchaseTime: ist.timeFormatted,
      purchasedAt: r.purchased_at ? new Date(r.purchased_at).toISOString() : null,
      subscriptionPlanId: r.subscription_plan_id || null,
      subscriptionPlan: String(r.plan_name_snapshot || 'Subscription Plan'),
      planPrice: Math.round(Number(r.plan_price_snapshot || 0) * 100) / 100,
      amountPaid,
      taxAmount: Math.round(Number(r.tax_amount || 0) * 100) / 100,
      discountAmount: Math.round(Number(r.discount_amount || 0) * 100) / 100,
      refundAmount: refundAmt,
      currency: String(r.currency || 'INR'),
      paymentProvider: String(r.payment_provider || 'razorpay'),
      paymentMethod: r.payment_method && String(r.payment_method).trim() ? String(r.payment_method).trim() : 'Not Available',
      paymentReference: r.gateway_payment_id || r.gateway_order_id || `TXN-${r.id}`,
      gatewayOrderId: r.gateway_order_id || null,
      paymentStatus: pStatus,
      subscriptionStatus: sStatus,
      activatedDate: actIst.dateFormatted,
      expiryDate: expIst.dateFormatted,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      refundedAt: r.refunded_at ? new Date(r.refunded_at).toISOString() : null,
    };
  });

  const totalAmountCollected = Math.max(0, Math.round((grossCollected - totalRefundedAmount) * 100) / 100);

  // Pagination
  const totalCount = formattedAll.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const offset = (page - 1) * limit;
  const pagedRows = formattedAll.slice(offset, offset + limit).map((row, idx) => ({
    ...row,
    serialNo: offset + idx + 1,
  }));

  // Group paged rows by IST date
  const groupMap = new Map<
    string,
    {
      dateKey: string;
      displayDate: string;
      totalPurchases: number;
      successfulPayments: number;
      totalAmountCollected: number;
      uniqueStudentEmails: Set<string>;
      transactions: typeof pagedRows;
    }
  >();

  for (const row of pagedRows) {
    const key = row.dateKey || 'unknown';
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        dateKey: key,
        displayDate: row.displayDate,
        totalPurchases: 0,
        successfulPayments: 0,
        totalAmountCollected: 0,
        uniqueStudentEmails: new Set<string>(),
        transactions: [],
      });
    }
    const g = groupMap.get(key)!;
    g.totalPurchases += 1;
    if (row.paymentStatus === 'Success') {
      g.successfulPayments += 1;
      g.totalAmountCollected = Math.round((g.totalAmountCollected + row.amountPaid) * 100) / 100;
    }
    if (row.studentEmail) g.uniqueStudentEmails.add(row.studentEmail.toLowerCase());
    g.transactions.push(row);
  }

  const dailyGroups = Array.from(groupMap.values()).map((g) => ({
    dateKey: g.dateKey,
    displayDate: g.displayDate,
    totalPurchases: g.totalPurchases,
    successfulPayments: g.successfulPayments,
    totalAmountCollected: g.totalAmountCollected,
    uniqueStudents: g.uniqueStudentEmails.size,
    transactions: g.transactions,
  }));

  return {
    summary: {
      totalPurchases,
      successfulPayments,
      totalAmountCollected,
      activeSubscriptions,
      pendingPayments,
      failedPayments,
      expiredSubscriptions,
      totalRefunds,
      totalRefundedAmount: Math.round(totalRefundedAmount * 100) / 100,
    },
    dailyGroups,
    rows: pagedRows,
    availableFilters: {
      plans: (facetsRes.rows[0]?.plans || []) as string[],
      paymentMethods: (facetsRes.rows[0]?.methods || []) as string[],
    },
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
    },
    timezone: 'Asia/Kolkata',
    serverTimestamp: new Date().toISOString(),
  };
}

export async function getStudentSubscriptionDetail(studentId: number) {
  await ensureSubscriptionHistorySchema();

  const stuRes = await pool.query(
    `SELECT id, full_name, email, target_group, subscription_tier, subscription_status
     FROM students WHERE id = $1`,
    [studentId]
  );
  if (stuRes.rows.length === 0) return null;
  const student = stuRes.rows[0];

  const txRes = await pool.query(
    `SELECT
       id, student_id, student_email_snapshot, subscription_plan_id, plan_name_snapshot,
       plan_price_snapshot::float AS plan_price_snapshot, amount_paid::float AS amount_paid,
       refund_amount::float AS refund_amount, currency, payment_provider, payment_method,
       gateway_order_id, gateway_payment_id, payment_status, subscription_status,
       purchased_at, activated_at, expires_at, refunded_at
     FROM subscription_transactions
     WHERE student_id = $1
     ORDER BY purchased_at DESC, id DESC`,
    [studentId]
  );

  let totalVerifiedAmountPaid = 0;
  const methodsUsed = new Set<string>();
  const purchaseHistory = txRes.rows.map((r: any, idx: number) => {
    const pStatus = formatPaymentStatusLabel(r.payment_status);
    const sStatus = resolveEffectiveSubStatus(r);
    const amt = Math.round(Number(r.amount_paid || 0) * 100) / 100;
    const refAmt = Math.round(Number(r.refund_amount || 0) * 100) / 100;
    if (pStatus === 'Success') totalVerifiedAmountPaid += amt;
    if (pStatus === 'Refunded') totalVerifiedAmountPaid = Math.max(0, totalVerifiedAmountPaid - (refAmt || amt));
    const method = r.payment_method && String(r.payment_method).trim() ? String(r.payment_method).trim() : 'Not Available';
    if (method !== 'Not Available') methodsUsed.add(method);

    const pIst = formatIstParts(r.purchased_at);
    const eIst = formatIstParts(r.expires_at);
    return {
      serialNo: idx + 1,
      id: Number(r.id),
      purchaseDate: pIst.dateFormatted,
      purchaseTime: pIst.timeFormatted,
      subscriptionPlan: String(r.plan_name_snapshot || 'Subscription Plan'),
      planPrice: Math.round(Number(r.plan_price_snapshot || 0) * 100) / 100,
      amountPaid: amt,
      refundAmount: refAmt,
      paymentMethod: method,
      paymentReference: r.gateway_payment_id || r.gateway_order_id || `TXN-${r.id}`,
      paymentStatus: pStatus,
      subscriptionStatus: sStatus,
      expiryDate: eIst.dateFormatted,
      refundedAt: r.refunded_at ? formatIstParts(r.refunded_at).dateFormatted : null,
    };
  });

  const activeTx = purchaseHistory.find((t) => t.subscriptionStatus === 'Active') || purchaseHistory[0] || null;
  const refundHistory = purchaseHistory.filter((t) => t.paymentStatus === 'Refunded');

  return {
    studentId: Number(student.id),
    studentEmail: String(student.email || ''),
    studentName: student.full_name || null,
    targetGroup: student.target_group || null,
    totalPurchases: purchaseHistory.length,
    totalVerifiedAmountPaid: Math.round(totalVerifiedAmountPaid * 100) / 100,
    currentPlan: activeTx?.subscriptionPlan || 'Free Tier',
    currentStatus: activeTx?.subscriptionStatus || 'Inactive',
    paymentMethodsUsed: Array.from(methodsUsed),
    purchaseHistory,
    refundHistory,
  };
}

export async function exportSubscriptionHistoryCsv(filters: SubscriptionHistoryFilters = {}): Promise<string> {
  const result = await getSubscriptionHistory({ ...filters, page: 1, limit: 5000 });
  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = [
    'Date',
    'Time',
    'Student Email',
    'Student ID',
    'Subscription Plan',
    'Plan Price',
    'Amount Paid',
    'Payment Method',
    'Payment Reference',
    'Payment Status',
    'Subscription Status',
    'Expiry Date',
  ];

  const lines = [headers.join(',')];
  for (const r of result.rows) {
    lines.push(
      [
        r.purchaseDate,
        r.purchaseTime,
        r.studentEmail,
        r.studentId ?? '',
        r.subscriptionPlan,
        r.planPrice,
        r.amountPaid,
        r.paymentMethod,
        r.paymentReference,
        r.paymentStatus,
        r.subscriptionStatus,
        r.expiryDate,
      ]
        .map(escapeCsv)
        .join(',')
    );
  }
  return lines.join('\r\n');
}
