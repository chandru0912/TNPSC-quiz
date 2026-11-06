import { Router, Request, Response } from 'express';
import { AnalyticsService, TN_DISTRICTS } from '../services/analyticsService';
import { requireAdminAuth } from '../middleware/auth';

const router = Router();

// 1. Client Tracking Beacon (Public - does not require admin token)
router.post('/track', async (req: Request, res: Response) => {
  try {
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
    } = req.body;

    if (!sessionId || !visitorId || !pagePath) {
      return res.status(400).json({ status: 'error', message: 'Missing required tracking fields.' });
    }

    await AnalyticsService.recordHit({
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
    });

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    // Non-blocking for client
    return res.status(200).json({ status: 'ok', warning: err.message });
  }
});

// 2. Districts List (Public/Admin helper)
router.get('/districts', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'success',
    districts: TN_DISTRICTS.map((d) => d.name),
  });
});

// 3. Analytics Overview (12 Cards with % Change)
router.get('/overview', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const district = req.query.district as string;
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
    const range = (req.query.range as string) || '30d';
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
    const range = (req.query.range as string) || '30d';
    const district = req.query.district as string;
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
    const range = (req.query.range as string) || '30d';
    const district = req.query.district as string;
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
    const range = (req.query.range as string) || '30d';
    const district = req.query.district as string;
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
    const range = (req.query.range as string) || '30d';
    const district = req.query.district as string;
    const data = await AnalyticsService.getPerformance(range, district);
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[Analytics Performance Error]:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;

