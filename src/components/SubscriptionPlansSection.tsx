import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  GraduationCap,
  Archive,
  Crown,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  LogIn,
  UserPlus,
  ArrowLeft,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useStudentAuth } from '../context/StudentAuthContext';
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect';
import './SubscriptionPlansSection.css';

interface SubscriptionPlan {
  id: string;
  slug: string;
  planName: string;
  price: number;
  currency: string;
  durationDays: number | null;
  requiresDurationConfig: boolean;
  isActive: boolean;
  isFeatured: boolean;
  description: string;
  features: string[];
  entitlements: ('mcq_practice' | 'mock_test' | 'previous_papers')[];
}

interface StudentSubscriptionRecord {
  id: number;
  planId: string | null;
  planName: string;
  planPrice: number;
  amountPaid: number;
  currency: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: 'Success' | 'Pending' | 'Failed' | 'Refunded';
  subscriptionStatus: 'Active' | 'Pending' | 'Expired' | 'Cancelled' | 'Payment Failed';
  purchaseDate: string;
  activationDate: string;
  expiryDate: string | null;
}

interface StudentSubscriptionMe {
  entitlements: {
    mcq_practice: boolean;
    mock_test: boolean;
    previous_papers: boolean;
  };
  activePlanIds: string[];
  subscriptions: StudentSubscriptionRecord[];
  currentSubscription: StudentSubscriptionRecord | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => {
      open: () => void;
      on: (event: string, handler: (resp: any) => void) => void;
    };
  }
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatInr(amount: number): string {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPlanIcon(planId: string) {
  switch (planId) {
    case 'mcq_practice':
      return FileText;
    case 'mock_test':
      return GraduationCap;
    case 'previous_papers':
      return Archive;
    case 'test_batch':
      return Crown;
    default:
      return Sparkles;
  }
}

interface SubscriptionPlansSectionProps {
  isDedicatedPage?: boolean;
}

export const SubscriptionPlansSection: React.FC<SubscriptionPlansSectionProps> = ({
  isDedicatedPage = false,
}) => {
  const { isAuthenticated, token } = useStudentAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mySubSectionRef = useRef<HTMLElement | null>(null);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [mySub, setMySub] = useState<StudentSubscriptionMe | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoCheckoutRanRef = useRef<string | null>(null);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await apiFetch('/api/subscriptions/plans');
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.status === 'success' && Array.isArray(json.data?.plans)) {
        setPlans(json.data.plans);
      }
    } catch {
      // Non-blocking
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const loadMySubscription = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setMySub(null);
      return;
    }
    try {
      const res = await apiFetch('/api/subscriptions/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.status === 'success') {
        setMySub(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    void loadMySubscription();
  }, [loadMySubscription]);

  const handleSubscribe = useCallback(
    async (plan: SubscriptionPlan) => {
      setErrorMsg(null);
      setSuccessMsg(null);

      // 1. If not authenticated, preserve selected plan and route to Sign In / Register
      if (!isAuthenticated || !token) {
        const returnPath = `/dashboard/subscription?subscribePlan=${encodeURIComponent(plan.id)}`;
        savePostLoginRedirect(returnPath);
        navigate(buildAuthRedirectUrl('login', returnPath), { state: { from: returnPath } });
        return;
      }

      setProcessingPlanId(plan.id);
      try {
        // 2. Create secure Razorpay Order on backend (authoritative DB price)
        const orderRes = await apiFetch('/api/subscriptions/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ planId: plan.id }),
        });
        const orderJson = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok || orderJson.status !== 'success') {
          throw new Error(orderJson.message || 'Unable to create secure checkout order.');
        }

        const order = orderJson.data;

        // 3. Load Razorpay Checkout script
        const loaded = await loadRazorpayCheckoutScript();
        if (!loaded || !window.Razorpay) {
          throw new Error('Unable to load Razorpay Checkout. Please check your internet connection and retry.');
        }

        // 4. Open Razorpay Checkout modal
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency || 'INR',
          name: 'TNPSC Aspirant Orbit',
          description: `${order.planName} Subscription`,
          order_id: order.orderId,
          prefill: {
            name: order.studentName || undefined,
            email: order.studentEmail || undefined,
            contact: order.studentContact || undefined,
          },
          theme: {
            color: plan.isFeatured ? '#f59e0b' : '#6366f1',
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // 5. Verify payment cryptographically on backend before activating
              const verifyRes = await apiFetch('/api/subscriptions/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  planId: plan.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyJson = await verifyRes.json().catch(() => ({}));
              if (!verifyRes.ok || verifyJson.status !== 'success') {
                throw new Error(verifyJson.message || 'Payment verification failed on server.');
              }
              setSuccessMsg(
                `${order.planName} activated! Paid ${formatInr(verifyJson.data?.amountPaid ?? order.amountInr)}. Your module access is now unlocked.`
              );
              await loadMySubscription();
            } catch (err: any) {
              setErrorMsg(err.message || 'Payment verification failed. Contact support if amount was debited.');
            } finally {
              setProcessingPlanId(null);
            }
          },
          modal: {
            ondismiss: () => {
              setProcessingPlanId(null);
            },
          },
        });

        rzp.on('payment.failed', async (failResp: any) => {
          try {
            await apiFetch('/api/subscriptions/record-failure', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                planId: plan.id,
                razorpay_order_id: order.orderId,
                razorpay_payment_id: failResp?.error?.metadata?.payment_id || null,
                reason: failResp?.error?.description || 'Payment failed',
              }),
            });
            await loadMySubscription();
          } catch {
            // ignore
          }
          setErrorMsg(failResp?.error?.description || 'Payment failed. No subscription was activated.');
          setProcessingPlanId(null);
        });

        rzp.open();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to start subscription checkout.');
        setProcessingPlanId(null);
      }
    },
    [isAuthenticated, token, navigate, loadMySubscription]
  );

  // Resume selected plan checkout automatically after Sign In / Register redirect
  useEffect(() => {
    if (!isAuthenticated || !token || plans.length === 0) return;
    const params = new URLSearchParams(location.search);
    const pendingPlanId = params.get('subscribePlan');
    if (!pendingPlanId || autoCheckoutRanRef.current === pendingPlanId) return;

    const targetPlan = plans.find((p) => p.id === pendingPlanId);
    if (!targetPlan) return;

    autoCheckoutRanRef.current = pendingPlanId;
    // Clean URL query parameter without reloading
    navigate('/dashboard/subscription', { replace: true });
    void handleSubscribe(targetPlan);
  }, [isAuthenticated, token, plans, location.search, navigate, handleSubscribe]);

  const isPlanOwned = (plan: SubscriptionPlan): boolean => {
    if (!mySub) return false;
    return plan.entitlements.length > 0 && plan.entitlements.every((m) => mySub.entitlements[m] === true);
  };

  const isPlanExpired = (plan: SubscriptionPlan): boolean => {
    if (!mySub || !Array.isArray(mySub.subscriptions)) return false;
    return (
      !isPlanOwned(plan) &&
      mySub.subscriptions.some((s) => s.planId === plan.id && s.subscriptionStatus === 'Expired')
    );
  };

  const getPlanAccentClass = (plan: SubscriptionPlan): string => {
    if (plan.isFeatured || plan.id === 'test_batch') return 'featured';
    if (plan.id === 'mcq_practice') return 'accent-blue';
    if (plan.id === 'mock_test') return 'accent-purple';
    if (plan.id === 'previous_papers') return 'accent-green';
    return '';
  };

  const scrollToMySubscription = () => {
    mySubSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentSub = mySub?.currentSubscription || null;

  return (
    <div
      id="subscription-plans"
      className={`sub-plans-wrapper ${isDedicatedPage ? 'dedicated-page' : ''}`}
    >
      {/* My Subscription Status (Displayed when student has any real subscription/payment record) */}
      {isAuthenticated && currentSub && (
        <section
          ref={mySubSectionRef}
          className="my-sub-status-card glass"
          aria-label="My Subscription Status"
        >
          <div className="my-sub-header">
            <div className="my-sub-title-group">
              <ShieldCheck size={20} style={{ color: '#38bdf8' }} />
              <h3>My Subscription</h3>
            </div>
            <span
              className={`sub-plan-badge ${
                currentSub.subscriptionStatus === 'Active' ? 'gold' : 'blue'
              }`}
            >
              {currentSub.subscriptionStatus}
            </span>
          </div>

          <div className="my-sub-status-grid">
            <div className="my-sub-metric">
              <span className="my-sub-metric-label">Purchased Plan</span>
              <span className="my-sub-metric-val">{currentSub.planName}</span>
            </div>
            <div className="my-sub-metric">
              <span className="my-sub-metric-label">Amount Paid</span>
              <span className="my-sub-metric-val" style={{ color: '#facc15' }}>
                {formatInr(currentSub.amountPaid)}
              </span>
            </div>
            <div className="my-sub-metric">
              <span className="my-sub-metric-label">Purchase Date</span>
              <span className="my-sub-metric-val">{currentSub.purchaseDate}</span>
            </div>
            <div className="my-sub-metric">
              <span className="my-sub-metric-label">Activation Date</span>
              <span className="my-sub-metric-val">{currentSub.activationDate}</span>
            </div>
            <div className="my-sub-metric">
              <span className="my-sub-metric-label">Expiry Date</span>
              <span className="my-sub-metric-val">
                {currentSub.expiryDate || 'Not Configured'}
              </span>
            </div>
            <div className="my-sub-metric">
              <span className="my-sub-metric-label">Payment Status</span>
              <span className="my-sub-metric-val">{currentSub.paymentStatus}</span>
            </div>
          </div>

          {mySub && (
            <div className="my-sub-entitlements-row">
              <span
                className={`my-sub-ent-chip ${mySub.entitlements.mcq_practice ? 'unlocked' : 'locked'}`}
              >
                {mySub.entitlements.mcq_practice ? <Unlock size={13} /> : <Lock size={13} />}
                MCQ Practice
              </span>
              <span
                className={`my-sub-ent-chip ${mySub.entitlements.mock_test ? 'unlocked' : 'locked'}`}
              >
                {mySub.entitlements.mock_test ? <Unlock size={13} /> : <Lock size={13} />}
                Mock Tests
              </span>
              <span
                className={`my-sub-ent-chip ${mySub.entitlements.previous_papers ? 'unlocked' : 'locked'}`}
              >
                {mySub.entitlements.previous_papers ? <Unlock size={13} /> : <Lock size={13} />}
                Previous Papers
              </span>
            </div>
          )}
        </section>
      )}

      {/* Subscription Plans Section */}
      <section className="sub-plans-section glass" aria-label="TNPSC Aspirant Orbit Subscription Plans">
        <div className="sub-plans-head">
          <div>
            <span className="sub-plans-kicker">
              <Sparkles size={13} />
              Subscription Plans
            </span>
            <h2 className="sub-plans-title">Choose Your Subscription Plan</h2>
            <p className="sub-plans-subtitle">
              Unlock the TNPSC Aspirant Orbit features that help you prepare smarter.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="sub-alert success" role="status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              className="sub-alert-close"
              onClick={() => setSuccessMsg(null)}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="sub-alert error" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              className="sub-alert-close"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {plansLoading ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
            }}
          >
            <Loader2 size={18} className="spin" />
            <span>Loading subscription plans...</span>
          </div>
        ) : (
          <div className="sub-plans-grid">
            {plans.map((plan) => {
              const Icon = getPlanIcon(plan.id);
              const owned = isPlanOwned(plan);
              const expired = isPlanExpired(plan);
              const isBusy = processingPlanId === plan.id;
              const accentClass = getPlanAccentClass(plan);

              return (
                <article
                  key={plan.id}
                  className={`sub-plan-card ${accentClass}`}
                >
                  <div className="sub-plan-top-row">
                    <div className="sub-plan-icon">
                      <Icon size={21} />
                    </div>
                    {plan.isFeatured ? (
                      <span className="sub-plan-badge gold">Featured • All 3 Modules</span>
                    ) : (
                      <span className="sub-plan-badge blue">Single Module</span>
                    )}
                  </div>

                  <h3 className="sub-plan-name">{plan.planName}</h3>

                  <div className="sub-plan-price-row">
                    <span className="sub-plan-price">{formatInr(plan.price)}</span>
                  </div>
                  <div className="sub-plan-duration">
                    {plan.durationDays
                      ? `Validity: ${plan.durationDays} days`
                      : 'Duration configured by Admin'}
                  </div>

                  <ul className="sub-plan-features">
                    {plan.features.map((feat, idx) => (
                      <li key={idx}>
                        <CheckCircle2 size={14} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {owned ? (
                    <button
                      type="button"
                      className="sub-plan-owned-pill sub-plan-view-btn"
                      onClick={scrollToMySubscription}
                    >
                      <ShieldCheck size={16} />
                      <span>View Subscription</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`sub-plan-cta-btn ${plan.isFeatured ? 'featured' : ''}`}
                      onClick={() => void handleSubscribe(plan)}
                      disabled={Boolean(processingPlanId)}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 size={16} className="spin" />
                          <span>Opening Checkout...</span>
                        </>
                      ) : (
                        <span>{expired ? 'Renew Plan' : 'Subscribe Now'}</span>
                      )}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Preserved Bottom Actions directly below Subscription Plans: Sign In | Register | Back to Home */}
      <div className="sub-bottom-actions-bar glass">
        {!isAuthenticated && (
          <>
            <Link to="/login" className="sub-bottom-action-link signin">
              <LogIn size={16} />
              <span>Sign In</span>
            </Link>
            <Link to="/register" className="sub-bottom-action-link register">
              <UserPlus size={16} />
              <span>Register</span>
            </Link>
          </>
        )}
        <Link to="/" className="sub-bottom-action-link home">
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
};

export default SubscriptionPlansSection;
