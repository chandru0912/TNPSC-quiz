import { Router, Request, Response } from 'express';
import {
  requireAdminAuth,
  requireStudentAuth,
  StudentAuthenticatedRequest,
} from '../middleware/auth';
import {
  listPublicPlans,
  listAdminPlans,
  updateAdminPlan,
  getStudentSubscriptionStatus,
  createRazorpaySubscriptionOrder,
  verifyAndActivateRazorpayPayment,
  recordFailedCheckoutPayment,
} from '../services/subscriptionPlansService';

const router = Router();

// 1. Public catalog of active subscription plans (authoritative backend prices & configuration)
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await listPublicPlans();
    return res.status(200).json({ status: 'success', data: { plans } });
  } catch (err: any) {
    console.error('[Subscriptions Public Plans Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load subscription plans.' });
  }
});

// 2. Authenticated student's current subscription status & module entitlements
router.get('/me', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const data = await getStudentSubscriptionStatus(studentId);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Subscriptions Me Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load subscription status.' });
  }
});

// 3. Create secure Razorpay Order using backend-configured plan price (never trusts frontend price)
router.post('/create-order', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const planId = String(req.body?.planId || '').trim();
    if (!planId) {
      return res.status(400).json({ status: 'error', message: 'planId is required.' });
    }
    const order = await createRazorpaySubscriptionOrder(studentId, planId);
    return res.status(200).json({ status: 'success', data: order });
  } catch (err: any) {
    const statusCode = Number(err.statusCode) || 500;
    console.error('[Subscriptions Create Order Error]:', err.message);
    return res.status(statusCode).json({ status: 'error', message: err.message || 'Failed to initiate checkout.' });
  }
});

// 4. Cryptographically verify Razorpay payment signature & activate entitlements
router.post('/verify-payment', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const {
      planId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    const result = await verifyAndActivateRazorpayPayment({
      studentId,
      planId: String(planId || '').trim(),
      razorpayOrderId: String(razorpay_order_id || '').trim(),
      razorpayPaymentId: String(razorpay_payment_id || '').trim(),
      razorpaySignature: String(razorpay_signature || '').trim(),
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    const statusCode = Number(err.statusCode) || 500;
    console.error('[Subscriptions Verify Payment Error]:', err.message);
    return res.status(statusCode).json({ status: 'error', message: err.message || 'Payment verification failed.' });
  }
});

// 5. Record failed Razorpay checkout attempt (never activates entitlements)
router.post('/record-failure', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.studentUser!.studentId;
    const { planId, razorpay_order_id, razorpay_payment_id, reason } = req.body || {};
    const result = await recordFailedCheckoutPayment({
      studentId,
      planId: String(planId || '').trim(),
      razorpayOrderId: razorpay_order_id ? String(razorpay_order_id) : null,
      razorpayPaymentId: razorpay_payment_id ? String(razorpay_payment_id) : null,
      reason: reason ? String(reason) : null,
    });
    return res.status(200).json({ status: 'success', data: result });
  } catch (err: any) {
    console.error('[Subscriptions Record Failure Error]:', err.message);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to record payment failure.' });
  }
});

// 6. Admin: list all 4 official plans with pricing, duration configuration status, and live metrics
export const adminSubscriptionsRouter = Router();

adminSubscriptionsRouter.get('/plans', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const plans = await listAdminPlans();
    return res.status(200).json({ status: 'success', data: { plans } });
  } catch (err: any) {
    console.error('[Admin Subscriptions Plans Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to load admin plans.' });
  }
});

// 7. Admin: update configured price, duration_days, or active status (preserves historical snapshots)
adminSubscriptionsRouter.patch('/plans/:planId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const planId = String(req.params.planId || '').trim();
    const { price, durationDays, isActive } = req.body || {};
    const updated = await updateAdminPlan(planId, {
      price: price !== undefined ? Number(price) : undefined,
      durationDays:
        durationDays === undefined
          ? undefined
          : durationDays === null || durationDays === ''
            ? null
            : Number(durationDays),
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    });
    return res.status(200).json({ status: 'success', data: { plan: updated } });
  } catch (err: any) {
    const statusCode = Number(err.statusCode) || 500;
    console.error('[Admin Subscriptions Update Plan Error]:', err.message);
    return res.status(statusCode).json({ status: 'error', message: err.message || 'Failed to update plan.' });
  }
});

export default router;
