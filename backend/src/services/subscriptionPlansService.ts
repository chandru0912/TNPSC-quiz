import crypto from 'crypto';
import pool from '../db';
import {
  ensureSubscriptionHistorySchema,
  recordVerifiedSubscriptionTransaction,
} from './subscriptionHistoryService';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import { executeWithCircuitBreaker } from './circuitBreakerService';

export const OFFICIAL_PLAN_IDS = ['mcq_practice', 'mock_test', 'previous_papers', 'test_batch'] as const;
export type OfficialPlanId = (typeof OFFICIAL_PLAN_IDS)[number];
export type ModuleEntitlementKey = 'mcq_practice' | 'mock_test' | 'previous_papers';

export interface SubscriptionPlanDto {
  id: string;
  slug: string;
  planName: string;
  price: number;
  currency: string;
  durationDays: number | null;
  requiresDurationConfig: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  description: string;
  features: string[];
  entitlements: ModuleEntitlementKey[];
  updatedAt: string;
}

function mapPlanRow(row: any): SubscriptionPlanDto {
  const rawDur = row.duration_days;
  const durationDays =
    rawDur !== null && rawDur !== undefined && Number(rawDur) > 0 ? Number(rawDur) : null;
  return {
    id: String(row.id),
    slug: String(row.slug || row.id),
    planName: String(row.plan_name),
    price: Math.round(Number(row.price || 0) * 100) / 100,
    currency: String(row.currency || 'INR').toUpperCase(),
    durationDays,
    requiresDurationConfig: durationDays === null,
    isActive: Boolean(row.is_active),
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order ?? 100),
    description: String(row.description || ''),
    features: Array.isArray(row.features) ? row.features.map(String) : [],
    entitlements: Array.isArray(row.entitlements)
      ? (row.entitlements.map(String) as ModuleEntitlementKey[])
      : [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function listPublicPlans(): Promise<SubscriptionPlanDto[]> {
  await ensureSubscriptionHistorySchema();
  const res = await pool.query(
    `SELECT id, slug, plan_name, duration_days, price::float AS price, currency,
            is_active, is_featured, sort_order, description, features, entitlements, updated_at
     FROM subscription_plans
     WHERE id = ANY($1::varchar[]) AND is_active = true
     ORDER BY sort_order ASC, id ASC`,
    [OFFICIAL_PLAN_IDS]
  );
  return res.rows.map(mapPlanRow);
}

export async function listAdminPlans() {
  await ensureSubscriptionHistorySchema();
  const res = await pool.query(
    `SELECT
       p.id, p.slug, p.plan_name, p.duration_days, p.price::float AS price, p.currency,
       p.is_active, p.is_featured, p.sort_order, p.description, p.features, p.entitlements, p.updated_at,
       COUNT(t.id) FILTER (WHERE t.payment_status = 'success')::int AS total_purchases,
       COALESCE(SUM(t.amount_paid) FILTER (WHERE t.payment_status = 'success'), 0)::float AS total_revenue,
       COUNT(t.id) FILTER (
         WHERE t.subscription_status = 'active'
           AND (t.expires_at IS NULL OR t.expires_at > CURRENT_TIMESTAMP)
       )::int AS active_subscribers
     FROM subscription_plans p
     LEFT JOIN subscription_transactions t
       ON t.subscription_plan_id = p.id
      AND LOWER(TRIM(COALESCE(t.student_email_snapshot, ''))) NOT LIKE '%@example.com'
      AND LOWER(TRIM(COALESCE(t.student_email_snapshot, ''))) NOT LIKE 'test_%'
     WHERE p.id = ANY($1::varchar[])
     GROUP BY p.id
     ORDER BY p.sort_order ASC, p.id ASC`,
    [OFFICIAL_PLAN_IDS]
  );

  return res.rows.map((row: any) => ({
    ...mapPlanRow(row),
    totalPurchases: Number(row.total_purchases || 0),
    totalRevenue: Math.round(Number(row.total_revenue || 0) * 100) / 100,
    activeSubscribers: Number(row.active_subscribers || 0),
  }));
}

export async function updateAdminPlan(
  planId: string,
  updates: { price?: number; durationDays?: number | null; isActive?: boolean }
) {
  await ensureSubscriptionHistorySchema();
  if (!OFFICIAL_PLAN_IDS.includes(planId as OfficialPlanId)) {
    throw Object.assign(new Error('Invalid subscription plan identifier.'), { statusCode: 400 });
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (updates.price !== undefined) {
    const numPrice = Number(updates.price);
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      throw Object.assign(new Error('Plan price must be a positive number.'), { statusCode: 400 });
    }
    params.push(Math.round(numPrice * 100) / 100);
    sets.push(`price = $${params.length}`);
  }

  if (updates.durationDays !== undefined) {
    if (updates.durationDays === null || updates.durationDays === ('' as any)) {
      sets.push(`duration_days = NULL`);
    } else {
      const dur = Number(updates.durationDays);
      if (!Number.isInteger(dur) || dur <= 0 || dur > 3650) {
        throw Object.assign(new Error('Duration must be a whole number of days between 1 and 3650, or left blank.'), {
          statusCode: 400,
        });
      }
      params.push(dur);
      sets.push(`duration_days = $${params.length}`);
    }
  }

  if (updates.isActive !== undefined) {
    params.push(Boolean(updates.isActive));
    sets.push(`is_active = $${params.length}`);
  }

  if (sets.length === 0) {
    throw Object.assign(new Error('No valid fields provided to update.'), { statusCode: 400 });
  }

  sets.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(planId);

  const res = await pool.query(
    `UPDATE subscription_plans
     SET ${sets.join(', ')}
     WHERE id = $${params.length}
     RETURNING id, slug, plan_name, duration_days, price::float AS price, currency,
               is_active, is_featured, sort_order, description, features, entitlements, updated_at`,
    params
  );

  if (res.rows.length === 0) {
    throw Object.assign(new Error('Subscription plan not found.'), { statusCode: 404 });
  }

  broadcastAnalyticsEvent('subscription_updated', { planId, action: 'plan_config_updated' });
  return mapPlanRow(res.rows[0]);
}

export async function getPlanById(planId: string): Promise<SubscriptionPlanDto | null> {
  await ensureSubscriptionHistorySchema();
  const res = await pool.query(
    `SELECT id, slug, plan_name, duration_days, price::float AS price, currency,
            is_active, is_featured, sort_order, description, features, entitlements, updated_at
     FROM subscription_plans
     WHERE id = $1
     LIMIT 1`,
    [planId]
  );
  return res.rows.length > 0 ? mapPlanRow(res.rows[0]) : null;
}

export async function grantPlanEntitlements(input: {
  studentId: number;
  planId: string;
  transactionId?: number | null;
  expiresAt?: Date | null;
}) {
  await ensureSubscriptionHistorySchema();
  const plan = await getPlanById(input.planId);
  const modules: ModuleEntitlementKey[] =
    plan && plan.entitlements.length > 0
      ? plan.entitlements
      : input.planId === 'test_batch'
        ? ['mcq_practice', 'mock_test', 'previous_papers']
        : input.planId === 'mcq_practice' || input.planId === 'mock_test' || input.planId === 'previous_papers'
          ? [input.planId]
          : [];

  for (const mod of modules) {
    await pool.query(
      `INSERT INTO student_module_entitlements (
         student_id, module_key, plan_id, transaction_id, status, activated_at, expires_at, updated_at
       )
       VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, module_key) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         transaction_id = COALESCE(EXCLUDED.transaction_id, student_module_entitlements.transaction_id),
         status = 'active',
         activated_at = CURRENT_TIMESTAMP,
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [input.studentId, mod, input.planId, input.transactionId ?? null, input.expiresAt ?? null]
    );
  }
  return modules;
}

function formatIstDate(val: Date | string | null): string | null {
  if (!val) return null;
  const d = new Date(val);
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export async function getStudentSubscriptionStatus(studentId: number) {
  await ensureSubscriptionHistorySchema();

  const entRes = await pool.query(
    `SELECT module_key, plan_id, status, activated_at, expires_at
     FROM student_module_entitlements
     WHERE student_id = $1`,
    [studentId]
  );

  const now = Date.now();
  const entitlements: Record<ModuleEntitlementKey, boolean> = {
    mcq_practice: false,
    mock_test: false,
    previous_papers: false,
  };
  const entitlementSources: Record<string, { planId: string; activatedAt: string | null; expiresAt: string | null }> = {};

  for (const row of entRes.rows) {
    const key = String(row.module_key) as ModuleEntitlementKey;
    const isExpired = row.expires_at ? new Date(row.expires_at).getTime() <= now : false;
    const isActive = row.status === 'active' && !isExpired;
    if (key in entitlements && isActive) {
      entitlements[key] = true;
      entitlementSources[key] = {
        planId: String(row.plan_id),
        activatedAt: formatIstDate(row.activated_at),
        expiresAt: formatIstDate(row.expires_at),
      };
    }
  }

  const txRes = await pool.query(
    `SELECT
       id, subscription_plan_id, plan_name_snapshot, plan_price_snapshot::float AS plan_price_snapshot,
       amount_paid::float AS amount_paid, currency, payment_method, gateway_order_id, gateway_payment_id,
       payment_status, subscription_status, purchased_at, activated_at, expires_at
     FROM subscription_transactions
     WHERE student_id = $1
     ORDER BY purchased_at DESC, id DESC
     LIMIT 30`,
    [studentId]
  );

  const subscriptions = txRes.rows.map((r: any) => {
    const rawPay = String(r.payment_status || 'pending').toLowerCase();
    const rawSub = String(r.subscription_status || 'pending').toLowerCase();
    const isExpired =
      rawSub === 'active' && r.expires_at ? new Date(r.expires_at).getTime() <= now : rawSub === 'expired';

    let displayStatus: 'Active' | 'Pending' | 'Expired' | 'Cancelled' | 'Payment Failed' = 'Pending';
    if (rawPay === 'failed') displayStatus = 'Payment Failed';
    else if (rawSub === 'cancelled' || rawPay === 'refunded') displayStatus = 'Cancelled';
    else if (isExpired) displayStatus = 'Expired';
    else if (rawSub === 'active' && rawPay === 'success') displayStatus = 'Active';
    else displayStatus = 'Pending';

    return {
      id: Number(r.id),
      planId: r.subscription_plan_id || null,
      planName: String(r.plan_name_snapshot || 'Subscription Plan'),
      planPrice: Math.round(Number(r.plan_price_snapshot || 0) * 100) / 100,
      amountPaid: Math.round(Number(r.amount_paid || 0) * 100) / 100,
      currency: String(r.currency || 'INR'),
      paymentMethod: r.payment_method ? String(r.payment_method) : 'Not Available',
      paymentReference: r.gateway_payment_id || r.gateway_order_id || `TXN-${r.id}`,
      paymentStatus:
        rawPay === 'success'
          ? 'Success'
          : rawPay === 'failed'
            ? 'Failed'
            : rawPay === 'refunded'
              ? 'Refunded'
              : 'Pending',
      subscriptionStatus: displayStatus,
      purchaseDate: formatIstDate(r.purchased_at) || '—',
      activationDate: formatIstDate(r.activated_at) || '—',
      expiryDate: r.expires_at ? formatIstDate(r.expires_at) : null,
    };
  });

  const activePlanIds = new Set<string>();
  if (entitlements.mcq_practice && entitlements.mock_test && entitlements.previous_papers) {
    activePlanIds.add('test_batch');
    activePlanIds.add('mcq_practice');
    activePlanIds.add('mock_test');
    activePlanIds.add('previous_papers');
  } else {
    if (entitlements.mcq_practice) activePlanIds.add('mcq_practice');
    if (entitlements.mock_test) activePlanIds.add('mock_test');
    if (entitlements.previous_papers) activePlanIds.add('previous_papers');
  }

  return {
    entitlements,
    entitlementSources,
    activePlanIds: Array.from(activePlanIds),
    subscriptions,
    currentSubscription: subscriptions.find((s) => s.subscriptionStatus === 'Active') || subscriptions[0] || null,
  };
}

export async function createRazorpaySubscriptionOrder(studentId: number, planId: string) {
  await ensureSubscriptionHistorySchema();

  const plan = await getPlanById(planId);
  if (!plan || !plan.isActive) {
    throw Object.assign(new Error('Selected subscription plan is not available.'), { statusCode: 404 });
  }

  // Duplicate purchase protection: block if student already has active access to ALL modules of this plan
  const current = await getStudentSubscriptionStatus(studentId);
  const alreadyOwnsAll =
    plan.entitlements.length > 0 && plan.entitlements.every((m) => current.entitlements[m] === true);
  if (alreadyOwnsAll) {
    throw Object.assign(
      new Error(`You already have active access to ${plan.planName}. Duplicate purchase is not required.`),
      { statusCode: 409 }
    );
  }

  const stuRes = await pool.query(`SELECT id, full_name, email, mobile FROM students WHERE id = $1`, [studentId]);
  if (stuRes.rows.length === 0) {
    throw Object.assign(new Error('Student account not found.'), { statusCode: 404 });
  }
  const student = stuRes.rows[0];

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    throw Object.assign(
      new Error('Razorpay payment gateway credentials are not configured on the server. Please contact support.'),
      { statusCode: 503 }
    );
  }

  // Calculate authoritative amount strictly from PostgreSQL plan price
  const amountPaise = Math.round(plan.price * 100);
  const receipt = `tnpsc_${studentId}_${plan.id}_${Date.now()}`.slice(0, 40);

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  const rzpJson: any = await executeWithCircuitBreaker(
    {
      service: 'razorpay_orders',
      maxRetries: 0, // Never retry non-idempotent payment order creation
      fallback: () => {
        throw Object.assign(
          new Error('Payment gateway is temporarily unavailable. Please try again in a moment.'),
          { statusCode: 503, code: 'PAYMENT_GATEWAY_UNAVAILABLE' }
        );
      },
    },
    async () => {
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: plan.currency,
          receipt,
          notes: {
            student_id: String(studentId),
            student_email: String(student.email || ''),
            plan_id: plan.id,
            plan_name: plan.planName,
          },
        }),
      });
      const parsed: any = await rzpRes.json().catch(() => ({}));
      if (!rzpRes.ok || !parsed?.id) {
        const errMsg = parsed?.error?.description || 'Failed to create secure Razorpay order.';
        throw Object.assign(new Error(errMsg), { statusCode: rzpRes.status >= 500 ? 502 : rzpRes.status || 502 });
      }
      return parsed;
    }
  );

  // Record pending transaction with authoritative backend price snapshot
  await recordVerifiedSubscriptionTransaction({
    studentId,
    studentEmail: student.email,
    planId: plan.id,
    planName: plan.planName,
    planPriceSnapshot: plan.price,
    amountPaid: plan.price,
    currency: plan.currency,
    paymentProvider: 'razorpay',
    paymentMethod: null,
    gatewayOrderId: String(rzpJson.id),
    gatewayPaymentId: `order_pending_${rzpJson.id}`,
    paymentStatus: 'pending',
    subscriptionStatus: 'pending',
    metadata: { receipt, stage: 'order_created' },
  });

  return {
    keyId,
    orderId: String(rzpJson.id),
    amountPaise,
    amountInr: plan.price,
    currency: plan.currency,
    planId: plan.id,
    planName: plan.planName,
    durationDays: plan.durationDays,
    requiresDurationConfig: plan.requiresDurationConfig,
    studentName: student.full_name || '',
    studentEmail: student.email || '',
    studentContact: student.mobile || '',
  };
}

export async function verifyAndActivateRazorpayPayment(input: {
  studentId: number;
  planId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  await ensureSubscriptionHistorySchema();

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    throw Object.assign(new Error('Razorpay credentials are not configured on the server.'), { statusCode: 503 });
  }

  const orderId = String(input.razorpayOrderId || '').trim();
  const paymentId = String(input.razorpayPaymentId || '').trim();
  const signature = String(input.razorpaySignature || '').trim();
  if (!orderId || !paymentId || !signature) {
    throw Object.assign(new Error('Missing Razorpay payment verification parameters.'), { statusCode: 400 });
  }

  // 1. Cryptographic HMAC-SHA256 signature verification (never trust frontend success alone)
  const expectedSig = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw Object.assign(new Error('Invalid Razorpay payment signature. Activation rejected.'), { statusCode: 400 });
  }

  const plan = await getPlanById(input.planId);
  if (!plan) {
    throw Object.assign(new Error('Subscription plan not found.'), { statusCode: 404 });
  }

  // 2. Fetch authoritative payment metadata from Razorpay API (method, card type, captured amount)
  let rawMethod: string | null = null;
  let cardType: string | null = null;
  let verifiedAmountInr = plan.price;

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  const payJson = await executeWithCircuitBreaker<any | null>(
    {
      service: 'razorpay_payments_read',
      fallback: () => null, // Non-fatal: payment method remains null -> "Not Available" (never fabricated)
    },
    async () => {
      const payRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: authHeader },
      });
      if (!payRes.ok) {
        const err: any = new Error(`Razorpay payment lookup failed (${payRes.status})`);
        err.statusCode = payRes.status;
        throw err;
      }
      return await payRes.json();
    }
  );
  if (payJson) {
    rawMethod = payJson?.method || null;
    cardType = payJson?.card?.type || null;
    if (typeof payJson?.amount === 'number' && payJson.amount > 0) {
      verifiedAmountInr = Math.round((payJson.amount / 100) * 100) / 100;
    }
  }

  const stuRes = await pool.query(`SELECT id, email, district FROM students WHERE id = $1`, [input.studentId]);
  const student = stuRes.rows[0];

  // Remove temporary order_pending placeholder row for this order so only the verified payment row exists
  await pool.query(
    `DELETE FROM subscription_transactions WHERE gateway_payment_id = $1 AND payment_status = 'pending'`,
    [`order_pending_${orderId}`]
  );

  // 3. Idempotently record verified transaction (preserves durationDays === null -> expiresAt = null)
  const txRow = await recordVerifiedSubscriptionTransaction({
    studentId: input.studentId,
    studentEmail: student?.email || null,
    planId: plan.id,
    planName: plan.planName,
    planPriceSnapshot: plan.price,
    amountPaid: verifiedAmountInr,
    currency: plan.currency,
    paymentProvider: 'razorpay',
    paymentMethod: rawMethod,
    cardType,
    gatewayOrderId: orderId,
    gatewayPaymentId: paymentId,
    paymentStatus: 'success',
    subscriptionStatus: 'active',
    metadata: { verifiedVia: 'checkout_signature' },
  });

  // 4. Grant module entitlements (1 module for individual plans, all 3 for test_batch)
  const grantedModules = await grantPlanEntitlements({
    studentId: input.studentId,
    planId: plan.id,
    transactionId: Number(txRow.id),
    expiresAt: txRow.expires_at ? new Date(txRow.expires_at) : null,
  });

  // 5. Sync into student_subscriptions & students so Subscription Overview reflects real purchase
  const existingSubRes = await pool.query(
    `SELECT id FROM student_subscriptions WHERE student_id = $1 AND plan_id = $2 AND transaction_date >= CURRENT_TIMESTAMP - INTERVAL '10 minutes' LIMIT 1`,
    [input.studentId, plan.id]
  );
  if (existingSubRes.rows.length === 0) {
    await pool.query(
      `INSERT INTO student_subscriptions (
         student_id, plan_id, plan_name, amount, currency, status, payment_method, district, starts_at, expires_at, transaction_date
       ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP)`,
      [
        input.studentId,
        plan.id,
        plan.planName,
        verifiedAmountInr,
        plan.currency,
        txRow.payment_method || null,
        student?.district || null,
        txRow.expires_at || null,
      ]
    );
  }

  await pool.query(
    `UPDATE students SET subscription_tier = $2, subscription_status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [input.studentId, plan.id === 'test_batch' ? 'test_batch' : 'pro']
  );

  broadcastAnalyticsEvent('subscription_updated', {
    studentId: input.studentId,
    planId: plan.id,
    paymentId,
    status: 'active',
  });

  const updatedStatus = await getStudentSubscriptionStatus(input.studentId);
  return {
    transactionId: Number(txRow.id),
    planId: plan.id,
    planName: plan.planName,
    amountPaid: verifiedAmountInr,
    grantedModules,
    expiresAt: txRow.expires_at ? formatIstDate(txRow.expires_at) : null,
    status: updatedStatus,
  };
}

export async function recordFailedCheckoutPayment(input: {
  studentId: number;
  planId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  reason?: string | null;
}) {
  await ensureSubscriptionHistorySchema();
  const plan = await getPlanById(input.planId);
  const stuRes = await pool.query(`SELECT email FROM students WHERE id = $1`, [input.studentId]);
  const orderId = input.razorpayOrderId?.trim() || null;

  if (orderId) {
    await pool.query(
      `DELETE FROM subscription_transactions WHERE gateway_payment_id = $1 AND payment_status = 'pending'`,
      [`order_pending_${orderId}`]
    );
  }

  const paymentId =
    input.razorpayPaymentId?.trim() || `failed_${orderId || Date.now()}_${input.studentId}`;

  const txRow = await recordVerifiedSubscriptionTransaction({
    studentId: input.studentId,
    studentEmail: stuRes.rows[0]?.email || null,
    planId: plan?.id || input.planId,
    planName: plan?.planName || input.planId,
    planPriceSnapshot: plan?.price ?? 0,
    amountPaid: plan?.price ?? 0,
    currency: plan?.currency || 'INR',
    paymentProvider: 'razorpay',
    paymentMethod: null,
    gatewayOrderId: orderId,
    gatewayPaymentId: paymentId,
    paymentStatus: 'failed',
    subscriptionStatus: 'inactive',
    metadata: { reason: input.reason || 'payment_failed' },
  });

  return { transactionId: Number(txRow.id), paymentStatus: 'failed' };
}
