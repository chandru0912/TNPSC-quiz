import { Response } from 'express';
import pool from '../db';

export type AdminNotificationType = 'NEW_COMPLAINT' | 'STUDENT_REPLY';

export interface AdminNotificationRecord {
  id: number;
  ticketId: number;
  ticketNumber: string;
  studentName: string;
  category: string;
  subject: string;
  notificationType: AdminNotificationType;
  ticketStatus: string;
  isRead: boolean;
  readAt: string | null;
  resolvedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationSseClient {
  id: number;
  res: Response;
  adminUsername: string;
  connectedAt: number;
}

class AdminNotificationSseHub {
  private clients = new Map<number, NotificationSseClient>();
  private nextClientId = 1;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      const dead: number[] = [];
      for (const [id, c] of this.clients.entries()) {
        try {
          c.res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          dead.push(id);
        }
      }
      for (const id of dead) this.clients.delete(id);
    }, 25000);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  addClient(res: Response, adminUsername: string): number {
    const id = this.nextClientId++;
    this.clients.set(id, { id, res, adminUsername, connectedAt: Date.now() });
    this.writeEvent(res, 'connected', {
      clientId: id,
      serverTime: new Date().toISOString(),
    });
    return id;
  }

  removeClient(id: number): void {
    this.clients.delete(id);
  }

  broadcast(eventName: 'admin_notification' | 'admin_notifications_sync', payload: Record<string, any>): void {
    if (this.clients.size === 0) return;
    const dead: number[] = [];
    for (const [id, c] of this.clients.entries()) {
      try {
        this.writeEvent(c.res, eventName, payload);
      } catch {
        dead.push(id);
      }
    }
    for (const id of dead) this.clients.delete(id);
  }

  private writeEvent(res: Response, eventName: string, data: any): void {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export const adminNotificationSseHub = new AdminNotificationSseHub();

let notificationSchemaPromise: Promise<void> | null = null;

export async function ensureAdminNotificationSchema(): Promise<void> {
  if (!notificationSchemaPromise) {
    notificationSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_support_notifications (
          id SERIAL PRIMARY KEY,
          ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
          ticket_number VARCHAR(40) NOT NULL,
          student_name VARCHAR(255) NOT NULL,
          category VARCHAR(120) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          notification_type VARCHAR(40) NOT NULL DEFAULT 'NEW_COMPLAINT',
          ticket_status VARCHAR(30) NOT NULL DEFAULT 'Open',
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          read_at TIMESTAMP NULL,
          resolved_at TIMESTAMP NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_admin_notif_active
          ON admin_support_notifications(is_active, is_read, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_notif_ticket
          ON admin_support_notifications(ticket_id);
      `);

      // Seed one notification row for any pre-existing support tickets not yet tracked
      await pool.query(`
        INSERT INTO admin_support_notifications (
          ticket_id, ticket_number, student_name, category, subject,
          notification_type, ticket_status, is_read, read_at, resolved_at, is_active, created_at, updated_at
        )
        SELECT
          t.id,
          t.ticket_number,
          COALESCE(s.full_name, t.student_name_snapshot, 'Student'),
          t.category,
          t.subject,
          'NEW_COMPLAINT',
          t.status,
          CASE WHEN t.status IN ('Resolved', 'Closed') OR t.unread_by_admin = FALSE THEN TRUE ELSE FALSE END,
          CASE WHEN t.status IN ('Resolved', 'Closed') OR t.unread_by_admin = FALSE THEN t.updated_at ELSE NULL END,
          CASE WHEN t.status IN ('Resolved', 'Closed') THEN COALESCE(t.resolved_at, t.closed_at, t.updated_at) ELSE NULL END,
          CASE WHEN t.status IN ('Resolved', 'Closed') THEN FALSE ELSE TRUE END,
          t.created_at,
          t.updated_at
        FROM support_tickets t
        LEFT JOIN students s ON s.id = t.student_id
        WHERE NOT EXISTS (
          SELECT 1 FROM admin_support_notifications n WHERE n.ticket_id = t.id
        );
      `);
    })().catch((err) => {
      notificationSchemaPromise = null;
      throw err;
    });
  }
  await notificationSchemaPromise;
}

function mapNotificationRow(row: any): AdminNotificationRecord {
  return {
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    ticketNumber: String(row.ticket_number),
    studentName: String(row.student_name),
    category: String(row.category),
    subject: String(row.subject),
    notificationType: (row.notification_type === 'STUDENT_REPLY' ? 'STUDENT_REPLY' : 'NEW_COMPLAINT') as AdminNotificationType,
    ticketStatus: String(row.ticket_status || 'Open'),
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function createAdminSupportNotification(input: {
  ticketId: number;
  ticketNumber: string;
  studentName: string;
  category: string;
  subject: string;
  notificationType: AdminNotificationType;
  ticketStatus: string;
}): Promise<AdminNotificationRecord> {
  await ensureAdminNotificationSchema();
  const res = await pool.query(
    `INSERT INTO admin_support_notifications (
       ticket_id, ticket_number, student_name, category, subject,
       notification_type, ticket_status, is_read, is_active
     )
     VALUES ($1::int, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, FALSE, TRUE)
     RETURNING *`,
    [
      input.ticketId,
      input.ticketNumber,
      input.studentName,
      input.category,
      input.subject,
      input.notificationType,
      input.ticketStatus,
    ]
  );
  const record = mapNotificationRow(res.rows[0]);
  adminNotificationSseHub.broadcast('admin_notification', {
    notification: record,
    timestamp: new Date().toISOString(),
  });
  return record;
}

export async function syncNotificationsForTicketStatus(ticketId: number, status: string): Promise<void> {
  await ensureAdminNotificationSchema();
  const isTerminal = status === 'Resolved' || status === 'Closed';
  if (isTerminal) {
    await pool.query(
      `UPDATE admin_support_notifications
       SET ticket_status = $1::text,
           is_active = FALSE,
           is_read = TRUE,
           read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
           resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $2::int`,
      [status, ticketId]
    );
  } else {
    await pool.query(
      `UPDATE admin_support_notifications
       SET ticket_status = $1::text,
           updated_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $2::int AND is_active = TRUE`,
      [status, ticketId]
    );
  }
  adminNotificationSseHub.broadcast('admin_notifications_sync', {
    ticketId,
    status,
    timestamp: new Date().toISOString(),
  });
}

export async function markTicketNotificationsRead(ticketId: number): Promise<void> {
  await ensureAdminNotificationSchema();
  const res = await pool.query(
    `UPDATE admin_support_notifications
     SET is_read = TRUE,
         read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE ticket_id = $1::int AND is_read = FALSE
     RETURNING id`,
    [ticketId]
  );
  if (res.rows.length > 0) {
    adminNotificationSseHub.broadcast('admin_notifications_sync', {
      ticketId,
      action: 'MARK_TICKET_READ',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<AdminNotificationRecord | null> {
  await ensureAdminNotificationSchema();
  const res = await pool.query(
    `UPDATE admin_support_notifications
     SET is_read = TRUE,
         read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::int
     RETURNING *`,
    [notificationId]
  );
  if (res.rows.length === 0) return null;
  const record = mapNotificationRow(res.rows[0]);
  adminNotificationSseHub.broadcast('admin_notifications_sync', {
    notificationId,
    ticketId: record.ticketId,
    action: 'MARK_READ',
    timestamp: new Date().toISOString(),
  });
  return record;
}

export async function markAllAdminNotificationsRead(): Promise<number> {
  await ensureAdminNotificationSchema();
  const res = await pool.query(
    `UPDATE admin_support_notifications
     SET is_read = TRUE,
         read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE is_active = TRUE AND is_read = FALSE
     RETURNING id`
  );
  adminNotificationSseHub.broadcast('admin_notifications_sync', {
    action: 'MARK_ALL_READ',
    timestamp: new Date().toISOString(),
  });
  return res.rows.length;
}

export async function clearResolvedActiveNotifications(): Promise<number> {
  await ensureAdminNotificationSchema();
  const res = await pool.query(
    `UPDATE admin_support_notifications
     SET is_active = FALSE,
         is_read = TRUE,
         read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
         resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE is_active = TRUE AND ticket_status IN ('Resolved', 'Closed')
     RETURNING id`
  );
  adminNotificationSseHub.broadcast('admin_notifications_sync', {
    action: 'CLEAR_RESOLVED',
    timestamp: new Date().toISOString(),
  });
  return res.rows.length;
}

export async function getAdminNotificationsSummary() {
  await ensureAdminNotificationSchema();

  // Always join latest status from support_tickets so UI reflects real-time DB truth
  const [activeRes, historyRes] = await Promise.all([
    pool.query(
      `SELECT n.*, t.status AS live_status
       FROM admin_support_notifications n
       JOIN support_tickets t ON t.id = n.ticket_id
       WHERE n.is_active = TRUE AND t.status NOT IN ('Resolved', 'Closed')
       ORDER BY n.is_read ASC, n.created_at DESC
       LIMIT 60`
    ),
    pool.query(
      `SELECT n.*, t.status AS live_status
       FROM admin_support_notifications n
       JOIN support_tickets t ON t.id = n.ticket_id
       ORDER BY n.created_at DESC
       LIMIT 100`
    ),
  ]);

  const activeNotifications = activeRes.rows.map((r) =>
    mapNotificationRow({ ...r, ticket_status: r.live_status || r.ticket_status })
  );
  const history = historyRes.rows.map((r) =>
    mapNotificationRow({ ...r, ticket_status: r.live_status || r.ticket_status })
  );
  const recentlyResolved = history.filter(
    (n) => n.ticketStatus === 'Resolved' || n.ticketStatus === 'Closed'
  );
  const unreadCount = activeNotifications.filter((n) => !n.isRead).length;

  return {
    unreadCount,
    activeNotifications,
    recentlyResolved,
    history,
    counts: {
      newComplaints: activeNotifications.filter((n) => n.ticketStatus === 'Open').length,
      inProgress: activeNotifications.filter((n) => n.ticketStatus === 'In Progress').length,
      waitingForStudent: activeNotifications.filter((n) => n.ticketStatus === 'Waiting for Student').length,
      resolved: recentlyResolved.length,
    },
  };
}
