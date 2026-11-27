import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import pool from '../db';
import { broadcastAnalyticsEvent } from './analyticsEventBus';
import {
  createAdminSupportNotification,
  markTicketNotificationsRead,
  syncNotificationsForTicketStatus,
} from './adminNotificationService';

export const COMPLAINT_CATEGORIES = [
  'Account & Login Issues',
  'Google Login Problems',
  'Study Materials Issues',
  'Textbook PDF Download Issues',
  'MCQ Practice Issues',
  'Mock Test Issues',
  'Previous Year Papers Issues',
  'Subscription & Payment Issues',
  'Student Dashboard Issues',
  'Performance Analytics Issues',
  'Technical Problems',
  'Privacy & Data Requests',
  'Other Issues',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Waiting for Student',
  'Resolved',
  'Closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

let supportSchemaPromise: Promise<void> | null = null;

export function resolveSupportAttachmentsDir(): string {
  const preferred = process.env.VERCEL
    ? path.join(os.tmpdir(), 'tnpsc-support-attachments')
    : path.resolve(__dirname, '../../uploads/support-attachments');
  try {
    if (!fs.existsSync(preferred)) fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'tnpsc-support-attachments');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

/**
 * Validates file buffer against magic-byte signatures to prevent spoofed MIME types or dangerous uploads.
 */
export function validateAttachmentSignature(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  return false;
}

export function sanitizeFilename(raw: string): string {
  const base = path.basename(String(raw || 'attachment')).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 140) || 'attachment';
}

export async function ensureSupportSchema(): Promise<void> {
  if (!supportSchemaPromise) {
    supportSchemaPromise = (async () => {
      await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START 1;

        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          ticket_number VARCHAR(40) UNIQUE NOT NULL,
          student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          student_name_snapshot VARCHAR(150) NOT NULL,
          student_email_snapshot VARCHAR(255) NOT NULL,
          tnpsc_group_snapshot VARCHAR(50) NOT NULL DEFAULT 'group4',
          category VARCHAR(100) NOT NULL,
          subject VARCHAR(200) NOT NULL,
          description TEXT NOT NULL,
          priority VARCHAR(20) NOT NULL DEFAULT 'Medium'
            CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
          status VARCHAR(30) NOT NULL DEFAULT 'Open'
            CHECK (status IN ('Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed')),
          assigned_admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
          assigned_admin_name VARCHAR(150),
          unread_by_admin BOOLEAN NOT NULL DEFAULT TRUE,
          unread_by_student BOOLEAN NOT NULL DEFAULT FALSE,
          last_message_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMPTZ,
          closed_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_support_tickets_student ON support_tickets(student_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
        CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
        CREATE INDEX IF NOT EXISTS idx_support_tickets_unread_admin ON support_tickets(unread_by_admin) WHERE unread_by_admin = TRUE;

        CREATE TABLE IF NOT EXISTS support_messages (
          id SERIAL PRIMARY KEY,
          ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
          sender_id INT,
          sender_name VARCHAR(150) NOT NULL,
          sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('student', 'admin')),
          message TEXT NOT NULL,
          is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at ASC);

        CREATE TABLE IF NOT EXISTS support_attachments (
          id SERIAL PRIMARY KEY,
          ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
          message_id INT REFERENCES support_messages(id) ON DELETE CASCADE,
          uploaded_by INT,
          uploaded_role VARCHAR(20) NOT NULL DEFAULT 'student',
          original_filename VARCHAR(255) NOT NULL,
          storage_key VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_size INT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket ON support_attachments(ticket_id);

        CREATE TABLE IF NOT EXISTS support_audit_logs (
          id SERIAL PRIMARY KEY,
          ticket_id INT REFERENCES support_tickets(id) ON DELETE CASCADE,
          admin_id INT,
          admin_username VARCHAR(100) NOT NULL,
          action VARCHAR(60) NOT NULL,
          details JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_support_audit_ticket ON support_audit_logs(ticket_id, created_at DESC);
      `);
    })().catch((err) => {
      supportSchemaPromise = null;
      throw err;
    });
  }
  await supportSchemaPromise;
}

function mapTicketRow(r: any) {
  return {
    id: Number(r.id),
    ticketNumber: String(r.ticket_number),
    studentId: Number(r.student_id),
    studentName: String(r.student_name || r.student_name_snapshot || 'Student'),
    studentEmail: String(r.student_email || r.student_email_snapshot || ''),
    tnpscGroup: String(r.tnpsc_group || r.tnpsc_group_snapshot || 'group4'),
    category: String(r.category),
    subject: String(r.subject),
    description: String(r.description),
    priority: String(r.priority || 'Medium') as TicketPriority,
    status: String(r.status || 'Open') as TicketStatus,
    assignedAdminId: r.assigned_admin_id ? Number(r.assigned_admin_id) : null,
    assignedAdminName: r.assigned_admin_name || null,
    unreadByAdmin: Boolean(r.unread_by_admin),
    unreadByStudent: Boolean(r.unread_by_student),
    lastAdminReply: r.last_admin_reply || null,
    messageCount: r.message_count !== undefined ? Number(r.message_count) : undefined,
    lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
  };
}

function mapMessageRow(r: any) {
  return {
    id: Number(r.id),
    ticketId: Number(r.ticket_id),
    senderId: r.sender_id ? Number(r.sender_id) : null,
    senderName: String(r.sender_name || (r.sender_role === 'admin' ? 'Support Team' : 'Student')),
    senderRole: String(r.sender_role) as 'student' | 'admin',
    message: String(r.message),
    isInternalNote: Boolean(r.is_internal_note),
    readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapAttachmentRow(r: any, scope: 'student' | 'admin') {
  return {
    id: Number(r.id),
    ticketId: Number(r.ticket_id),
    messageId: r.message_id ? Number(r.message_id) : null,
    originalFilename: String(r.original_filename),
    mimeType: String(r.mime_type),
    fileSize: Number(r.file_size || 0),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    downloadUrl:
      scope === 'admin'
        ? `/api/admin/support/attachments/${r.id}`
        : `/api/support/attachments/${r.id}`,
  };
}

function saveAttachmentFileToDisk(buffer: Buffer, originalName: string): string {
  const dir = resolveSupportAttachmentsDir();
  const safeName = sanitizeFilename(originalName);
  const storageKey = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${safeName}`;
  fs.writeFileSync(path.join(dir, storageKey), buffer);
  return storageKey;
}

export async function createStudentSupportTicket(input: {
  studentId: number;
  category: string;
  subject: string;
  description: string;
  attachment?: { buffer: Buffer; originalFilename: string; mimeType: string; fileSize: number } | null;
}) {
  await ensureSupportSchema();

  const stuRes = await pool.query(
    `SELECT id, full_name, email, target_group FROM students WHERE id = $1`,
    [input.studentId]
  );
  if (stuRes.rows.length === 0) {
    const err: any = new Error('Student account not found.');
    err.statusCode = 404;
    throw err;
  }
  const stu = stuRes.rows[0];
  const studentName = String(stu.full_name || '').trim() || String(stu.email || '').split('@')[0] || 'Student';
  const studentEmail = String(stu.email || '').trim();
  const tnpscGroup = String(stu.target_group || 'group4').trim();

  let savedStorageKey: string | null = null;
  if (input.attachment) {
    savedStorageKey = saveAttachmentFileToDisk(input.attachment.buffer, input.attachment.originalFilename);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seqRes = await client.query(`SELECT nextval('support_ticket_number_seq')::bigint AS seq`);
    const seqNum = Number(seqRes.rows[0].seq);
    const year = new Date().getFullYear();
    const ticketNumber = `TNPSC-HELP-${year}-${String(seqNum).padStart(5, '0')}`;

    const ticketRes = await client.query(
      `INSERT INTO support_tickets (
         ticket_number, student_id, student_name_snapshot, student_email_snapshot, tnpsc_group_snapshot,
         category, subject, description, priority, status, unread_by_admin, unread_by_student
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Medium', 'Open', TRUE, FALSE)
       RETURNING *`,
      [
        ticketNumber,
        input.studentId,
        studentName,
        studentEmail,
        tnpscGroup,
        input.category,
        input.subject,
        input.description,
      ]
    );
    const ticketRow = ticketRes.rows[0];

    const msgRes = await client.query(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message, is_internal_note)
       VALUES ($1, $2, $3, 'student', $4, FALSE)
       RETURNING *`,
      [ticketRow.id, input.studentId, studentName, input.description]
    );
    const firstMsg = msgRes.rows[0];

    let attachmentRow: any = null;
    if (input.attachment && savedStorageKey) {
      const attRes = await client.query(
        `INSERT INTO support_attachments (
           ticket_id, message_id, uploaded_by, uploaded_role, original_filename, storage_key, mime_type, file_size
         )
         VALUES ($1, $2, $3, 'student', $4, $5, $6, $7)
         RETURNING *`,
        [
          ticketRow.id,
          firstMsg.id,
          input.studentId,
          sanitizeFilename(input.attachment.originalFilename),
          savedStorageKey,
          input.attachment.mimeType,
          input.attachment.fileSize,
        ]
      );
      attachmentRow = attRes.rows[0];
    }

    await client.query(
      `INSERT INTO support_audit_logs (ticket_id, admin_id, admin_username, action, details)
       VALUES ($1::int, NULL, $2::text, 'TICKET_CREATED', $3::jsonb)`,
      [
        ticketRow.id,
        studentName,
        JSON.stringify({ ticketNumber, category: input.category, priority: 'Medium', status: 'Open' }),
      ]
    );

    await client.query('COMMIT');

    broadcastAnalyticsEvent('support_ticket_created', {
      ticketId: Number(ticketRow.id),
      ticketNumber,
      category: input.category,
      studentName,
    });

    await createAdminSupportNotification({
      ticketId: Number(ticketRow.id),
      ticketNumber,
      studentName,
      category: input.category,
      subject: input.subject,
      notificationType: 'NEW_COMPLAINT',
      ticketStatus: 'Open',
    }).catch((err) => console.error('[AdminNotification create on ticket error]:', err));

    return {
      ticket: mapTicketRow(ticketRow),
      messages: [mapMessageRow(firstMsg)],
      attachments: attachmentRow ? [mapAttachmentRow(attachmentRow, 'student')] : [],
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (savedStorageKey) {
      try {
        fs.unlinkSync(path.join(resolveSupportAttachmentsDir(), savedStorageKey));
      } catch {}
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function listStudentSupportTickets(studentId: number) {
  await ensureSupportSchema();
  const res = await pool.query(
    `SELECT t.*,
            (
              SELECT m.message FROM support_messages m
              WHERE m.ticket_id = t.id AND m.sender_role = 'admin' AND m.is_internal_note = FALSE
              ORDER BY m.created_at DESC LIMIT 1
            ) AS last_admin_reply,
            (
              SELECT COUNT(*)::int FROM support_messages m
              WHERE m.ticket_id = t.id AND m.is_internal_note = FALSE
            ) AS message_count
     FROM support_tickets t
     WHERE t.student_id = $1
     ORDER BY t.updated_at DESC, t.id DESC`,
    [studentId]
  );
  return res.rows.map(mapTicketRow);
}

export async function getStudentSupportTicketDetail(studentId: number, ticketId: number) {
  await ensureSupportSchema();
  const tRes = await pool.query(
    `SELECT t.*, s.full_name AS student_name, s.email AS student_email, s.target_group AS tnpsc_group
     FROM support_tickets t
     LEFT JOIN students s ON s.id = t.student_id
     WHERE t.id = $1 AND t.student_id = $2`,
    [ticketId, studentId]
  );
  if (tRes.rows.length === 0) return null;

  // Mark admin messages as read by student
  await Promise.all([
    pool.query(
      `UPDATE support_tickets SET unread_by_student = FALSE WHERE id = $1 AND student_id = $2 AND unread_by_student = TRUE`,
      [ticketId, studentId]
    ),
    pool.query(
      `UPDATE support_messages SET read_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND sender_role = 'admin' AND is_internal_note = FALSE AND read_at IS NULL`,
      [ticketId]
    ),
  ]);

  const [mRes, aRes] = await Promise.all([
    pool.query(
      `SELECT * FROM support_messages
       WHERE ticket_id = $1 AND is_internal_note = FALSE
       ORDER BY created_at ASC, id ASC`,
      [ticketId]
    ),
    pool.query(
      `SELECT * FROM support_attachments WHERE ticket_id = $1 ORDER BY created_at ASC, id ASC`,
      [ticketId]
    ),
  ]);

  const ticket = mapTicketRow({ ...tRes.rows[0], unread_by_student: false });
  return {
    ticket,
    messages: mRes.rows.map(mapMessageRow),
    attachments: aRes.rows.map((r) => mapAttachmentRow(r, 'student')),
  };
}

export async function addStudentReplyToTicket(input: {
  studentId: number;
  ticketId: number;
  message: string;
  attachment?: { buffer: Buffer; originalFilename: string; mimeType: string; fileSize: number } | null;
}) {
  await ensureSupportSchema();

  const ownRes = await pool.query(
    `SELECT t.id, t.ticket_number, t.category, t.status, s.full_name, s.email
     FROM support_tickets t
     JOIN students s ON s.id = t.student_id
     WHERE t.id = $1 AND t.student_id = $2`,
    [input.ticketId, input.studentId]
  );
  if (ownRes.rows.length === 0) return null;

  const row = ownRes.rows[0];
  if (row.status === 'Closed') {
    const err: any = new Error('This support ticket is closed. Please raise a new complaint if you need further help.');
    err.statusCode = 400;
    throw err;
  }

  const senderName = String(row.full_name || '').trim() || String(row.email || '').split('@')[0] || 'Student';
  let savedStorageKey: string | null = null;
  if (input.attachment) {
    savedStorageKey = saveAttachmentFileToDisk(input.attachment.buffer, input.attachment.originalFilename);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const msgRes = await client.query(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message, is_internal_note)
       VALUES ($1, $2, $3, 'student', $4, FALSE)
       RETURNING *`,
      [input.ticketId, input.studentId, senderName, input.message]
    );
    const createdMsg = msgRes.rows[0];

    let attachmentRow: any = null;
    if (input.attachment && savedStorageKey) {
      const attRes = await client.query(
        `INSERT INTO support_attachments (
           ticket_id, message_id, uploaded_by, uploaded_role, original_filename, storage_key, mime_type, file_size
         )
         VALUES ($1, $2, $3, 'student', $4, $5, $6, $7)
         RETURNING *`,
        [
          input.ticketId,
          createdMsg.id,
          input.studentId,
          sanitizeFilename(input.attachment.originalFilename),
          savedStorageKey,
          input.attachment.mimeType,
          input.attachment.fileSize,
        ]
      );
      attachmentRow = attRes.rows[0];
    }

    const nextStatus = row.status === 'Waiting for Student' ? 'Open' : row.status;
    await client.query(
      `UPDATE support_tickets
       SET status = $1::text,
           unread_by_admin = TRUE,
           unread_by_student = FALSE,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2::int`,
      [nextStatus, input.ticketId]
    );

    await client.query('COMMIT');

    broadcastAnalyticsEvent('support_ticket_student_reply', {
      ticketId: input.ticketId,
      ticketNumber: row.ticket_number,
      category: row.category,
      studentName: senderName,
    });

    await createAdminSupportNotification({
      ticketId: input.ticketId,
      ticketNumber: String(row.ticket_number),
      studentName: senderName,
      category: String(row.category),
      subject: String(row.subject),
      notificationType: 'STUDENT_REPLY',
      ticketStatus: nextStatus,
    }).catch((err) => console.error('[AdminNotification create on student reply error]:', err));

    return {
      message: mapMessageRow(createdMsg),
      attachment: attachmentRow ? mapAttachmentRow(attachmentRow, 'student') : null,
      status: nextStatus,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (savedStorageKey) {
      try {
        fs.unlinkSync(path.join(resolveSupportAttachmentsDir(), savedStorageKey));
      } catch {}
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getStudentUnreadSupportCount(studentId: number): Promise<number> {
  await ensureSupportSchema();
  const res = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM support_tickets WHERE student_id = $1 AND unread_by_student = TRUE`,
    [studentId]
  );
  return Number(res.rows[0]?.cnt || 0);
}

// ====================================================
// ADMIN SUPPORT MANAGEMENT QUERIES
// ====================================================

export async function getAdminSupportStats() {
  await ensureSupportSchema();
  const [countsRes, unreadRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Open')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'Waiting for Student')::int AS waiting_count,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed_count,
        COUNT(*) FILTER (WHERE unread_by_admin = TRUE)::int AS unread_count
      FROM support_tickets
    `),
    pool.query(`
      SELECT id, ticket_number, student_name_snapshot, category, subject, status, priority, updated_at
      FROM support_tickets
      WHERE unread_by_admin = TRUE
      ORDER BY updated_at DESC
      LIMIT 8
    `),
  ]);

  const c = countsRes.rows[0] || {};
  return {
    total: Number(c.total || 0),
    open: Number(c.open_count || 0),
    inProgress: Number(c.in_progress_count || 0),
    waitingForStudent: Number(c.waiting_count || 0),
    resolved: Number(c.resolved_count || 0),
    closed: Number(c.closed_count || 0),
    unreadCount: Number(c.unread_count || 0),
    unreadTickets: unreadRes.rows.map((r) => ({
      id: Number(r.id),
      ticketNumber: String(r.ticket_number),
      studentName: String(r.student_name_snapshot || 'Student'),
      category: String(r.category),
      subject: String(r.subject),
      status: String(r.status),
      priority: String(r.priority),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    })),
  };
}

export async function listAdminSupportTickets(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  category?: string;
  priority?: string;
  tnpscGroup?: string;
  date?: string;
  search?: string;
}) {
  await ensureSupportSchema();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 15));
  const offset = (page - 1) * pageSize;

  const clauses: string[] = ['1 = 1'];
  const values: any[] = [];

  if (params.status && params.status !== 'all') {
    values.push(params.status.trim());
    clauses.push(`t.status = $${values.length}`);
  }
  if (params.category && params.category !== 'all') {
    values.push(params.category.trim());
    clauses.push(`t.category = $${values.length}`);
  }
  if (params.priority && params.priority !== 'all') {
    values.push(params.priority.trim());
    clauses.push(`t.priority = $${values.length}`);
  }
  if (params.tnpscGroup && params.tnpscGroup !== 'all') {
    values.push(params.tnpscGroup.trim().toLowerCase());
    clauses.push(`LOWER(COALESCE(s.target_group, t.tnpsc_group_snapshot)) = $${values.length}`);
  }
  if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date.trim())) {
    values.push(params.date.trim());
    clauses.push(`DATE(t.created_at) = $${values.length}::date`);
  }
  if (params.search && params.search.trim()) {
    values.push(`%${params.search.trim()}%`);
    const p = `$${values.length}::text`;
    clauses.push(
      `(t.ticket_number ILIKE ${p} OR COALESCE(s.full_name, t.student_name_snapshot) ILIKE ${p} OR COALESCE(s.email, t.student_email_snapshot) ILIKE ${p} OR t.subject ILIKE ${p})`
    );
  }

  const whereSql = clauses.join(' AND ');

  const [countRes, rowsRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM support_tickets t
       LEFT JOIN students s ON s.id = t.student_id
       WHERE ${whereSql}`,
      values
    ),
    pool.query(
      `SELECT t.*,
              COALESCE(s.full_name, t.student_name_snapshot) AS student_name,
              COALESCE(s.email, t.student_email_snapshot) AS student_email,
              COALESCE(s.target_group, t.tnpsc_group_snapshot) AS tnpsc_group,
              (SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id AND m.is_internal_note = FALSE) AS message_count
       FROM support_tickets t
       LEFT JOIN students s ON s.id = t.student_id
       WHERE ${whereSql}
       ORDER BY t.unread_by_admin DESC, t.updated_at DESC, t.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, offset]
    ),
  ]);

  const total = Number(countRes.rows[0]?.total || 0);
  return {
    items: rowsRes.rows.map(mapTicketRow),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getAdminSupportTicketDetail(ticketId: number) {
  await ensureSupportSchema();
  const tRes = await pool.query(
    `SELECT t.*,
            COALESCE(s.full_name, t.student_name_snapshot) AS student_name,
            COALESCE(s.email, t.student_email_snapshot) AS student_email,
            COALESCE(s.target_group, t.tnpsc_group_snapshot) AS tnpsc_group
     FROM support_tickets t
     LEFT JOIN students s ON s.id = t.student_id
     WHERE t.id = $1`,
    [ticketId]
  );
  if (tRes.rows.length === 0) return null;

  await Promise.all([
    pool.query(`UPDATE support_tickets SET unread_by_admin = FALSE WHERE id = $1 AND unread_by_admin = TRUE`, [ticketId]),
    pool.query(
      `UPDATE support_messages SET read_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND sender_role = 'student' AND read_at IS NULL`,
      [ticketId]
    ),
    markTicketNotificationsRead(ticketId).catch((err) =>
      console.error('[AdminNotification mark read error]:', err)
    ),
  ]);

  const [mRes, aRes, auditRes] = await Promise.all([
    pool.query(`SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC, id ASC`, [ticketId]),
    pool.query(`SELECT * FROM support_attachments WHERE ticket_id = $1 ORDER BY created_at ASC, id ASC`, [ticketId]),
    pool.query(`SELECT * FROM support_audit_logs WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 25`, [ticketId]),
  ]);

  return {
    ticket: mapTicketRow({ ...tRes.rows[0], unread_by_admin: false }),
    messages: mRes.rows.map(mapMessageRow),
    attachments: aRes.rows.map((r) => mapAttachmentRow(r, 'admin')),
    auditLogs: auditRes.rows.map((r) => ({
      id: Number(r.id),
      adminUsername: String(r.admin_username),
      action: String(r.action),
      details: r.details || null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    })),
  };
}

async function logAdminSupportAction(
  ticketId: number,
  adminId: number | null,
  adminUsername: string,
  action: string,
  details?: Record<string, any>
) {
  await pool.query(
    `INSERT INTO support_audit_logs (ticket_id, admin_id, admin_username, action, details)
     VALUES ($1::int, $2::int, $3::text, $4::text, $5::jsonb)`,
    [ticketId, adminId, adminUsername, action, details ? JSON.stringify(details) : null]
  );
}

export async function addAdminReplyOrNote(input: {
  ticketId: number;
  adminId: number | null;
  adminUsername: string;
  adminName: string;
  message: string;
  isInternalNote: boolean;
  nextStatus?: TicketStatus;
}) {
  await ensureSupportSchema();
  const exists = await pool.query(`SELECT id, status FROM support_tickets WHERE id = $1::int`, [input.ticketId]);
  if (exists.rows.length === 0) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Guard against rapid duplicate double-submit within 5 seconds
    const dupRes = await client.query(
      `SELECT *
       FROM support_messages
       WHERE ticket_id = $1::int
         AND sender_role = 'admin'
         AND is_internal_note = $2::boolean
         AND message = $3::text
         AND created_at >= CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       ORDER BY id DESC
       LIMIT 1`,
      [input.ticketId, input.isInternalNote, input.message]
    );
    if (dupRes.rows.length > 0) {
      await client.query('COMMIT');
      return mapMessageRow(dupRes.rows[0]);
    }

    const msgRes = await client.query(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message, is_internal_note)
       VALUES ($1::int, $2::int, $3::text, 'admin', $4::text, $5::boolean)
       RETURNING *`,
      [input.ticketId, input.adminId, input.adminName || input.adminUsername, input.message, input.isInternalNote]
    );

    let appliedStatus: TicketStatus | null = null;
    if (!input.isInternalNote) {
      const targetStatus: TicketStatus =
        input.nextStatus && TICKET_STATUSES.includes(input.nextStatus)
          ? input.nextStatus
          : exists.rows[0].status === 'Open'
            ? 'In Progress'
            : exists.rows[0].status;
      appliedStatus = targetStatus;
      await client.query(
        `UPDATE support_tickets
         SET status = $1::text,
             unread_by_student = TRUE,
             unread_by_admin = FALSE,
             last_message_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             resolved_at = CASE WHEN $1::text = 'Resolved' THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END,
             closed_at = CASE WHEN $1::text = 'Closed' THEN COALESCE(closed_at, CURRENT_TIMESTAMP) ELSE closed_at END
         WHERE id = $2::int`,
        [targetStatus, input.ticketId]
      );
    } else {
      await client.query(`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1::int`, [input.ticketId]);
    }

    await client.query('COMMIT');

    if (appliedStatus) {
      await syncNotificationsForTicketStatus(input.ticketId, appliedStatus).catch((err) =>
        console.error('[AdminNotification sync after reply error]:', err)
      );
    }

    await logAdminSupportAction(
      input.ticketId,
      input.adminId,
      input.adminUsername,
      input.isInternalNote ? 'ADD_INTERNAL_NOTE' : 'ADMIN_REPLY',
      input.nextStatus ? { nextStatus: input.nextStatus } : undefined
    );

    return mapMessageRow(msgRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAdminTicketStatus(input: {
  ticketId: number;
  status: TicketStatus;
  adminId: number | null;
  adminUsername: string;
}) {
  await ensureSupportSchema();
  const res = await pool.query(
    `UPDATE support_tickets
     SET status = $1::text,
         unread_by_student = TRUE,
         updated_at = CURRENT_TIMESTAMP,
         resolved_at = CASE WHEN $1::text = 'Resolved' THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END,
         closed_at = CASE WHEN $1::text = 'Closed' THEN COALESCE(closed_at, CURRENT_TIMESTAMP) ELSE closed_at END
     WHERE id = $2::int
     RETURNING *`,
    [input.status, input.ticketId]
  );
  if (res.rows.length === 0) return null;
  await logAdminSupportAction(input.ticketId, input.adminId, input.adminUsername, 'UPDATE_STATUS', { status: input.status });
  await syncNotificationsForTicketStatus(input.ticketId, input.status).catch((err) =>
    console.error('[AdminNotification sync on status error]:', err)
  );
  return mapTicketRow(res.rows[0]);
}

export async function updateAdminTicketPriority(input: {
  ticketId: number;
  priority: TicketPriority;
  adminId: number | null;
  adminUsername: string;
}) {
  await ensureSupportSchema();
  const res = await pool.query(
    `UPDATE support_tickets
     SET priority = $1::text,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2::int
     RETURNING *`,
    [input.priority, input.ticketId]
  );
  if (res.rows.length === 0) return null;
  await logAdminSupportAction(input.ticketId, input.adminId, input.adminUsername, 'UPDATE_PRIORITY', { priority: input.priority });
  return mapTicketRow(res.rows[0]);
}

export async function assignAdminToTicket(input: {
  ticketId: number;
  assignedAdminId: number | null;
  adminId: number | null;
  adminUsername: string;
}) {
  await ensureSupportSchema();
  let assignedName: string | null = null;
  if (input.assignedAdminId) {
    const aRes = await pool.query(`SELECT id, name, username FROM admin_users WHERE id = $1::int`, [input.assignedAdminId]);
    if (aRes.rows.length === 0) {
      const err: any = new Error('Selected admin account not found.');
      err.statusCode = 404;
      throw err;
    }
    assignedName = String(aRes.rows[0].name || aRes.rows[0].username);
  }
  const res = await pool.query(
    `UPDATE support_tickets
     SET assigned_admin_id = $1::int,
         assigned_admin_name = $2::text,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3::int
     RETURNING *`,
    [input.assignedAdminId, assignedName, input.ticketId]
  );
  if (res.rows.length === 0) return null;
  await logAdminSupportAction(input.ticketId, input.adminId, input.adminUsername, 'ASSIGN_ADMIN', {
    assignedAdminId: input.assignedAdminId,
    assignedAdminName: assignedName,
  });
  return mapTicketRow(res.rows[0]);
}

export async function listAssignableAdmins() {
  const res = await pool.query(`SELECT id, username, name, role FROM admin_users ORDER BY id ASC`);
  return res.rows.map((r) => ({
    id: Number(r.id),
    username: String(r.username),
    name: String(r.name || r.username),
    role: String(r.role || 'admin'),
  }));
}

export async function getAttachmentForDownload(attachmentId: number, requester: { role: 'student' | 'admin'; studentId?: number }) {
  await ensureSupportSchema();
  const res = await pool.query(
    `SELECT a.*, t.student_id
     FROM support_attachments a
     JOIN support_tickets t ON t.id = a.ticket_id
     WHERE a.id = $1`,
    [attachmentId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (requester.role === 'student' && Number(row.student_id) !== Number(requester.studentId)) {
    return null;
  }
  const filePath = path.join(resolveSupportAttachmentsDir(), String(row.storage_key));
  if (!fs.existsSync(filePath)) return null;
  return {
    filePath,
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    fileSize: Number(row.file_size || 0),
  };
}
