import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import {
  requireAdminAuth,
  requireStudentAuth,
  verifyAdminToken,
  type AuthenticatedRequest,
  type StudentAuthenticatedRequest,
} from '../middleware/auth';
import {
  adminNotificationSseHub,
  clearResolvedActiveNotifications,
  getAdminNotificationsSummary,
  markAllAdminNotificationsRead,
  markNotificationAsRead,
} from '../services/adminNotificationService';
import { fileUploadLimiter } from '../middleware/rateLimiter';
import {
  addAdminReplyOrNote,
  addStudentReplyToTicket,
  ALLOWED_ATTACHMENT_MIMES,
  assignAdminToTicket,
  COMPLAINT_CATEGORIES,
  createStudentSupportTicket,
  getAdminSupportStats,
  getAdminSupportTicketDetail,
  getAttachmentForDownload,
  getStudentSupportTicketDetail,
  getStudentUnreadSupportCount,
  listAdminSupportTickets,
  listAssignableAdmins,
  listStudentSupportTickets,
  MAX_ATTACHMENT_BYTES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  updateAdminTicketPriority,
  updateAdminTicketStatus,
  validateAttachmentSignature,
  type TicketPriority,
  type TicketStatus,
} from '../services/supportTicketService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ATTACHMENT_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid attachment type. Only PNG, JPG, WEBP images and PDF documents up to 5 MB are allowed.'));
    }
  },
});

function handleOptionalAttachment(req: Request, res: Response, next: NextFunction) {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('multipart/form-data')) return next();

  upload.single('attachment')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ status: 'error', message: 'Attachment exceeds the 5 MB maximum size limit.' });
    }
    return res.status(400).json({ status: 'error', message: err?.message || 'Invalid attachment upload.' });
  });
}

function extractValidatedAttachment(req: Request) {
  const file = req.file;
  if (!file) return { attachment: null, error: null };
  if (!ALLOWED_ATTACHMENT_MIMES.has(file.mimetype)) {
    return { attachment: null, error: 'Unsupported attachment MIME type.' };
  }
  if (!validateAttachmentSignature(file.buffer, file.mimetype)) {
    return { attachment: null, error: 'Uploaded file signature does not match its declared file type.' };
  }
  return {
    attachment: {
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    },
    error: null,
  };
}

function sendSafeSupportError(
  res: Response,
  err: any,
  fallbackMessage: string,
  context: string
) {
  console.error(`[Support ${context} Error]:`, err);
  const statusCode = Number(err?.statusCode);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500 && err?.message) {
    return res.status(statusCode).json({ status: 'error', message: String(err.message) });
  }
  return res.status(500).json({ status: 'error', message: fallbackMessage });
}

// ====================================================
// 1. STUDENT SUPPORT ROUTER (/api/support)
// ====================================================
export const studentSupportRouter = Router();

studentSupportRouter.get('/categories', (_req: Request, res: Response) => {
  return res.status(200).json({ status: 'success', data: COMPLAINT_CATEGORIES });
});

studentSupportRouter.get('/unread-count', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const count = await getStudentUnreadSupportCount(req.studentUser!.studentId);
    return res.status(200).json({ status: 'success', data: { unreadCount: count } });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Failed to check unread support messages.', 'StudentUnreadCount');
  }
});

studentSupportRouter.post(
  '/tickets',
  requireStudentAuth,
  fileUploadLimiter,
  handleOptionalAttachment,
  async (req: StudentAuthenticatedRequest, res: Response) => {
    try {
      if (req.studentUser?.isPreview) {
        return res.status(403).json({ status: 'error', message: 'Complaint submission is disabled in Student Preview Mode.' });
      }

      const category = String(req.body?.category || '').trim();
      const subject = String(req.body?.subject || '').trim();
      const description = String(req.body?.description || '').trim();

      if (!COMPLAINT_CATEGORIES.includes(category as any)) {
        return res.status(400).json({ status: 'error', message: 'Please select a valid complaint category.' });
      }
      if (subject.length < 4 || subject.length > 200) {
        return res.status(400).json({ status: 'error', message: 'Subject must be between 4 and 200 characters.' });
      }
      if (description.length < 10 || description.length > 5000) {
        return res.status(400).json({ status: 'error', message: 'Detailed description must be between 10 and 5000 characters.' });
      }

      const { attachment, error: attErr } = extractValidatedAttachment(req);
      if (attErr) {
        return res.status(400).json({ status: 'error', message: attErr });
      }

      const result = await createStudentSupportTicket({
        studentId: req.studentUser!.studentId,
        category,
        subject,
        description,
        attachment,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Your complaint has been submitted successfully. Our support team will review your request.',
        data: result,
      });
    } catch (err: any) {
      return sendSafeSupportError(res, err, 'Failed to submit complaint. Please try again.', 'StudentCreateTicket');
    }
  }
);

studentSupportRouter.get('/tickets', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const tickets = await listStudentSupportTickets(req.studentUser!.studentId);
    return res.status(200).json({ status: 'success', data: tickets });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Failed to fetch your support tickets.', 'StudentListTickets');
  }
});

studentSupportRouter.get('/tickets/:id(\\d+)', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const detail = await getStudentSupportTicketDetail(req.studentUser!.studentId, Number(req.params.id));
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(200).json({ status: 'success', data: detail });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Failed to load ticket details.', 'StudentTicketDetail');
  }
});

studentSupportRouter.get('/tickets/:id(\\d+)/messages', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const detail = await getStudentSupportTicketDetail(req.studentUser!.studentId, Number(req.params.id));
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(200).json({ status: 'success', data: detail.messages });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Failed to load ticket messages.', 'StudentTicketMessages');
  }
});

studentSupportRouter.post(
  '/tickets/:id(\\d+)/messages',
  requireStudentAuth,
  fileUploadLimiter,
  handleOptionalAttachment,
  async (req: StudentAuthenticatedRequest, res: Response) => {
    try {
      if (req.studentUser?.isPreview) {
        return res.status(403).json({ status: 'error', message: 'Replying is disabled in Student Preview Mode.' });
      }
      const message = String(req.body?.message || '').trim();
      if (message.length < 1 || message.length > 4000) {
        return res.status(400).json({ status: 'error', message: 'Reply message must be between 1 and 4000 characters.' });
      }

      const { attachment, error: attErr } = extractValidatedAttachment(req);
      if (attErr) {
        return res.status(400).json({ status: 'error', message: attErr });
      }

      const result = await addStudentReplyToTicket({
        studentId: req.studentUser!.studentId,
        ticketId: Number(req.params.id),
        message,
        attachment,
      });
      if (!result) {
        return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
      }
      return res.status(201).json({ status: 'success', data: result });
    } catch (err: any) {
      return sendSafeSupportError(res, err, 'Failed to send reply. Please try again.', 'StudentReply');
    }
  }
);

studentSupportRouter.get('/attachments/:id(\\d+)', requireStudentAuth, async (req: StudentAuthenticatedRequest, res: Response) => {
  try {
    const att = await getAttachmentForDownload(Number(req.params.id), {
      role: 'student',
      studentId: req.studentUser!.studentId,
    });
    if (!att) {
      return res.status(404).json({ status: 'error', message: 'Attachment not found.' });
    }
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return fs.createReadStream(att.filePath).pipe(res);
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Failed to download attachment.', 'StudentAttachmentDownload');
  }
});

// ====================================================
// 2. ADMIN SUPPORT ROUTER (/api/admin/support)
// ====================================================
export const adminSupportRouter = Router();

adminSupportRouter.get('/stats', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getAdminSupportStats();
    return res.status(200).json({ status: 'success', data: stats });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to load support statistics. Please try again.', 'AdminStats');
  }
});

adminSupportRouter.get('/admins', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const admins = await listAssignableAdmins();
    return res.status(200).json({ status: 'success', data: admins });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to load administrator list. Please try again.', 'AdminList');
  }
});

adminSupportRouter.get('/tickets', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await listAdminSupportTickets({
      page: typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1,
      pageSize: typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : 15,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
      tnpscGroup: typeof req.query.tnpscGroup === 'string' ? req.query.tnpscGroup : undefined,
      date: typeof req.query.date === 'string' ? req.query.date : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to load complaints list. Please try again.', 'AdminTicketsList');
  }
});

adminSupportRouter.get('/tickets/:id(\\d+)', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const detail = await getAdminSupportTicketDetail(Number(req.params.id));
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(200).json({ status: 'success', data: detail });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to load complaint details. Please try again.', 'AdminTicketDetail');
  }
});

adminSupportRouter.post('/tickets/:id(\\d+)/reply', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (message.length < 1 || message.length > 5000) {
      return res.status(400).json({ status: 'error', message: 'Reply message is required (1–5000 characters).' });
    }
    const nextStatus = typeof req.body?.status === 'string' && TICKET_STATUSES.includes(req.body.status as any)
      ? (req.body.status as TicketStatus)
      : undefined;

    const created = await addAdminReplyOrNote({
      ticketId: Number(req.params.id),
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
      adminName: (req.adminUser as any)?.name || req.adminUser?.username || 'Support Team',
      message,
      isInternalNote: false,
      nextStatus,
    });
    if (!created) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(201).json({ status: 'success', data: created });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to send reply. Please try again.', 'AdminReply');
  }
});

adminSupportRouter.post('/tickets/:id(\\d+)/notes', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const message = String(req.body?.note || req.body?.message || '').trim();
    if (message.length < 1 || message.length > 4000) {
      return res.status(400).json({ status: 'error', message: 'Internal note text is required.' });
    }
    const created = await addAdminReplyOrNote({
      ticketId: Number(req.params.id),
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
      adminName: (req.adminUser as any)?.name || req.adminUser?.username || 'Admin',
      message,
      isInternalNote: true,
    });
    if (!created) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(201).json({ status: 'success', data: created });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to save internal note. Please try again.', 'AdminNote');
  }
});

adminSupportRouter.patch('/tickets/:id(\\d+)/status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = String(req.body?.status || '').trim() as TicketStatus;
    if (!TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid ticket status.' });
    }
    const updated = await updateAdminTicketStatus({
      ticketId: Number(req.params.id),
      status,
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
    });
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to update complaint status. Please try again.', 'AdminStatus');
  }
});

adminSupportRouter.patch('/tickets/:id(\\d+)/priority', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const priority = String(req.body?.priority || '').trim() as TicketPriority;
    if (!TICKET_PRIORITIES.includes(priority)) {
      return res.status(400).json({ status: 'error', message: 'Invalid ticket priority.' });
    }
    const updated = await updateAdminTicketPriority({
      ticketId: Number(req.params.id),
      priority,
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
    });
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to update complaint priority. Please try again.', 'AdminPriority');
  }
});

adminSupportRouter.patch('/tickets/:id(\\d+)/assign', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawId = req.body?.assignedAdminId;
    const assignedAdminId = rawId === null || rawId === '' || rawId === undefined ? null : Number(rawId);
    if (assignedAdminId !== null && (!Number.isInteger(assignedAdminId) || assignedAdminId <= 0)) {
      return res.status(400).json({ status: 'error', message: 'Invalid admin ID.' });
    }
    const updated = await assignAdminToTicket({
      ticketId: Number(req.params.id),
      assignedAdminId,
      adminId: Number((req.adminUser as any)?.id ?? (req.adminUser as any)?.adminId) || null,
      adminUsername: req.adminUser?.username || 'admin',
    });
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Support ticket not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to update ticket assignment. Please try again.', 'AdminAssign');
  }
});

adminSupportRouter.get('/attachments/:id(\\d+)', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const att = await getAttachmentForDownload(Number(req.params.id), { role: 'admin' });
    if (!att) {
      return res.status(404).json({ status: 'error', message: 'Attachment not found.' });
    }
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return fs.createReadStream(att.filePath).pipe(res);
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Failed to download attachment.', 'AdminAttachmentDownload');
  }
});

// ====================================================
// 3. GLOBAL ADMIN AI ROBOT NOTIFICATIONS (SSE + REST)
// ====================================================
adminSupportRouter.get('/notifications/stream', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  const rawToken = headerToken || queryToken;

  if (!rawToken) {
    return res.status(401).json({ status: 'error', message: 'Admin authentication required.' });
  }
  const verified = verifyAdminToken(rawToken);
  if (!verified) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired admin session.' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const clientId = adminNotificationSseHub.addClient(res, verified.username || 'admin');
  req.on('close', () => {
    adminNotificationSseHub.removeClient(clientId);
  });
});

adminSupportRouter.get('/notifications', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getAdminNotificationsSummary();
    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to load admin notifications.', 'AdminNotificationsList');
  }
});

adminSupportRouter.patch('/notifications/:id(\\d+)/read', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await markNotificationAsRead(Number(req.params.id));
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Notification not found.' });
    }
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to mark notification as read.', 'AdminNotificationRead');
  }
});

adminSupportRouter.patch('/notifications/read-all', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const updatedCount = await markAllAdminNotificationsRead();
    return res.status(200).json({ status: 'success', data: { updatedCount } });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to mark all notifications as read.', 'AdminNotificationReadAll');
  }
});

adminSupportRouter.patch('/notifications/clear-resolved', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const clearedCount = await clearResolvedActiveNotifications();
    return res.status(200).json({ status: 'success', data: { clearedCount } });
  } catch (err: any) {
    return sendSafeSupportError(res, err, 'Unable to clear resolved notifications.', 'AdminNotificationClearResolved');
  }
});
