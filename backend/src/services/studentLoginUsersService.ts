import { PoolClient } from 'pg';
import pool from '../db';
import { ensureStudentSessionSchema } from './studentSessionService';

let loginUsersSchemaPromise: Promise<void> | null = null;

/**
 * Ensures student_login_users table, indexes, device columns on student_login_events,
 * and idempotent historical backfill exist (safe for cold starts & concurrent calls).
 */
export async function ensureStudentLoginUsersSchema(): Promise<void> {
  if (!loginUsersSchemaPromise) {
    loginUsersSchemaPromise = (async () => {
      await ensureStudentSessionSchema().catch(() => {});
      await pool.query(`
        ALTER TABLE student_login_events ADD COLUMN IF NOT EXISTS device_type VARCHAR(64);
        ALTER TABLE student_login_events ADD COLUMN IF NOT EXISTS browser_name VARCHAR(64);
        ALTER TABLE student_login_events ADD COLUMN IF NOT EXISTS os_name VARCHAR(64);

        CREATE INDEX IF NOT EXISTS idx_student_login_events_method_ts
          ON student_login_events (authentication_method, login_timestamp DESC);

        CREATE TABLE IF NOT EXISTS student_login_users (
          id SERIAL PRIMARY KEY,
          student_user_id INT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
          first_login_at TIMESTAMPTZ NOT NULL,
          last_login_at TIMESTAMPTZ NOT NULL,
          total_login_count INT NOT NULL DEFAULT 1,
          last_login_method VARCHAR(40),
          last_device VARCHAR(64),
          last_browser VARCHAR(64),
          last_os VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_student_login_users_last_login
          ON student_login_users (last_login_at DESC);
        CREATE INDEX IF NOT EXISTS idx_student_login_users_first_login
          ON student_login_users (first_login_at DESC);
        CREATE INDEX IF NOT EXISTS idx_student_login_users_total_count
          ON student_login_users (total_login_count DESC, last_login_at DESC);
        CREATE INDEX IF NOT EXISTS idx_student_login_users_method
          ON student_login_users (last_login_method);
      `);

      await backfillStudentLoginUsersIdempotent();
    })().catch((err) => {
      loginUsersSchemaPromise = null;
      throw err;
    });
  }
  await loginUsersSchemaPromise;
}

/**
 * Idempotent backfill: populates student_login_users for any student who has historical
 * successful login events in student_login_events or legacy student_activity
 * without overwriting or duplicating existing student_login_users rows.
 */
export async function backfillStudentLoginUsersIdempotent(): Promise<number> {
  const res = await pool.query(`
    WITH unified_hist AS (
      SELECT
        sle.student_id,
        sle.authentication_method,
        sle.login_timestamp,
        sle.device_type,
        sle.browser_name,
        sle.os_name
      FROM student_login_events sle
      JOIN students s ON s.id = sle.student_id
      WHERE COALESCE(s.role, 'student') = 'student'
        AND COALESCE(sle.login_status, 'Successful') = 'Successful'

      UNION ALL

      SELECT
        sa.student_id,
        CASE WHEN sa.activity_type = 'google_login' THEN 'Google OAuth' ELSE 'Email & Password' END AS authentication_method,
        sa.created_at AS login_timestamp,
        NULL::VARCHAR(64) AS device_type,
        NULL::VARCHAR(64) AS browser_name,
        NULL::VARCHAR(64) AS os_name
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
    latest_sess AS (
      SELECT DISTINCT ON (student_id)
        student_id,
        device_type,
        browser_name,
        os_name
      FROM student_auth_sessions
      ORDER BY student_id, created_at DESC
    ),
    agg AS (
      SELECT
        u.student_id,
        MIN(u.login_timestamp) AS first_login_at,
        MAX(u.login_timestamp) AS last_login_at,
        COUNT(*)::int AS total_login_count,
        (ARRAY_AGG(u.authentication_method ORDER BY u.login_timestamp DESC))[1] AS last_login_method,
        COALESCE(
          (ARRAY_AGG(u.device_type ORDER BY u.login_timestamp DESC) FILTER (WHERE u.device_type IS NOT NULL))[1],
          MAX(ls.device_type)
        ) AS last_device,
        COALESCE(
          (ARRAY_AGG(u.browser_name ORDER BY u.login_timestamp DESC) FILTER (WHERE u.browser_name IS NOT NULL))[1],
          MAX(ls.browser_name)
        ) AS last_browser,
        COALESCE(
          (ARRAY_AGG(u.os_name ORDER BY u.login_timestamp DESC) FILTER (WHERE u.os_name IS NOT NULL))[1],
          MAX(ls.os_name)
        ) AS last_os
      FROM unified_hist u
      LEFT JOIN latest_sess ls ON ls.student_id = u.student_id
      GROUP BY u.student_id
    )
    INSERT INTO student_login_users (
      student_user_id,
      first_login_at,
      last_login_at,
      total_login_count,
      last_login_method,
      last_device,
      last_browser,
      last_os
    )
    SELECT
      student_id,
      first_login_at,
      last_login_at,
      total_login_count,
      last_login_method,
      last_device,
      last_browser,
      last_os
    FROM agg
    ON CONFLICT (student_user_id) DO NOTHING
  `);
  return res.rowCount || 0;
}

export interface RecordStudentLoginUpsertInput {
  studentUserId: number;
  authMethod: 'Google OAuth' | 'Email & Password';
  deviceType?: string | null;
  browserName?: string | null;
  osName?: string | null;
  loginTimestamp?: Date;
}

/**
 * Atomic, concurrency-safe UPSERT into student_login_users on every genuine successful login.
 * Never creates duplicate student records; increments total_login_count atomically.
 */
export async function upsertStudentLoginUser(
  input: RecordStudentLoginUpsertInput,
  client?: PoolClient
): Promise<void> {
  if (!Number.isInteger(input.studentUserId) || input.studentUserId <= 0) return;

  if (!client) {
    await ensureStudentLoginUsersSchema();
  }

  const executor = client || pool;
  const ts = input.loginTimestamp || new Date();

  await executor.query(
    `INSERT INTO student_login_users (
       student_user_id,
       first_login_at,
       last_login_at,
       total_login_count,
       last_login_method,
       last_device,
       last_browser,
       last_os,
       created_at,
       updated_at
     ) VALUES ($1, $2, $2, 1, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (student_user_id) DO UPDATE SET
       first_login_at = LEAST(student_login_users.first_login_at, EXCLUDED.first_login_at),
       last_login_at = GREATEST(student_login_users.last_login_at, EXCLUDED.last_login_at),
       total_login_count = student_login_users.total_login_count + 1,
       last_login_method = EXCLUDED.last_login_method,
       last_device = COALESCE(EXCLUDED.last_device, student_login_users.last_device),
       last_browser = COALESCE(EXCLUDED.last_browser, student_login_users.last_browser),
       last_os = COALESCE(EXCLUDED.last_os, student_login_users.last_os),
       updated_at = CURRENT_TIMESTAMP`,
    [
      input.studentUserId,
      ts,
      input.authMethod,
      input.deviceType || null,
      input.browserName || null,
      input.osName || null,
    ]
  );
}

export interface StudentLoginUsersQuery {
  search?: string;
  range?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
  status?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

const UNIFIED_LOGIN_USERS_BASE_CTE = `
  WITH unified_events AS (
    SELECT
      sle.student_id,
      sle.authentication_method,
      sle.login_timestamp,
      sle.device_type,
      sle.browser_name,
      sle.os_name
    FROM student_login_events sle
    JOIN students s ON s.id = sle.student_id
    WHERE COALESCE(s.role, 'student') = 'student'
      AND COALESCE(sle.login_status, 'Successful') = 'Successful'

    UNION ALL

    SELECT
      sa.student_id,
      CASE WHEN sa.activity_type = 'google_login' THEN 'Google OAuth' ELSE 'Email & Password' END AS authentication_method,
      sa.created_at AS login_timestamp,
      NULL::VARCHAR(64) AS device_type,
      NULL::VARCHAR(64) AS browser_name,
      NULL::VARCHAR(64) AS os_name
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
  today_counts AS (
    SELECT
      student_id,
      COUNT(*)::int AS today_login_count
    FROM unified_events
    WHERE (login_timestamp AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    GROUP BY student_id
  ),
  latest_auth_session AS (
    SELECT DISTINCT ON (student_id)
      student_id,
      device_type,
      browser_name,
      os_name,
      session_status,
      last_active_at
    FROM student_auth_sessions
    ORDER BY student_id, created_at DESC
  ),
  online_state AS (
    SELECT
      student_id,
      BOOL_OR(is_active = true AND last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '5 minutes') AS is_online
    FROM visitor_sessions
    WHERE student_id IS NOT NULL
    GROUP BY student_id
  ),
  user_rows AS (
    SELECT
      slu.student_user_id AS user_id,
      COALESCE(NULLIF(TRIM(s.full_name), ''), 'N/A') AS student_name,
      LOWER(TRIM(s.email)) AS student_email,
      slu.first_login_at,
      slu.last_login_at,
      slu.total_login_count,
      COALESCE(tc.today_login_count, 0)::int AS today_login_count,
      COALESCE(NULLIF(TRIM(slu.last_login_method), ''), 'N/A') AS last_login_method,
      COALESCE(NULLIF(TRIM(slu.last_device), ''), NULLIF(TRIM(las.device_type), ''), 'N/A') AS last_device,
      COALESCE(NULLIF(TRIM(slu.last_browser), ''), NULLIF(TRIM(las.browser_name), ''), 'N/A') AS last_browser,
      COALESCE(NULLIF(TRIM(slu.last_os), ''), NULLIF(TRIM(las.os_name), ''), 'N/A') AS last_os,
      COALESCE(os.is_online, false) AS is_online,
      CASE
        WHEN COALESCE(os.is_online, false) = true
          OR slu.last_login_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
          OR (las.session_status = 'active' AND las.last_active_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')
        THEN 'Active'
        ELSE 'Inactive'
      END AS account_status
    FROM student_login_users slu
    JOIN students s ON s.id = slu.student_user_id
    LEFT JOIN today_counts tc ON tc.student_id = slu.student_user_id
    LEFT JOIN latest_auth_session las ON las.student_id = slu.student_user_id
    LEFT JOIN online_state os ON os.student_id = slu.student_user_id
    WHERE COALESCE(s.role, 'student') = 'student'
  )
`;

function buildUsersFilterSql(opts: StudentLoginUsersQuery) {
  const params: any[] = [];
  const conditions: string[] = [];

  const search = String(opts.search || '').trim();
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(
      LOWER(u.student_email) LIKE $${idx}
      OR LOWER(u.student_name) LIKE $${idx}
      OR u.user_id::text LIKE $${idx}
    )`);
  }

  const range = String(opts.range || 'all').toLowerCase().trim();
  if (range === 'today') {
    conditions.push(`u.today_login_count > 0`);
  } else if (range === '7d') {
    conditions.push(`u.last_login_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
  } else if (range === '30d') {
    conditions.push(`u.last_login_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
  } else if (range === '90d') {
    conditions.push(`u.last_login_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
  } else if (range === 'custom') {
    const start = String(opts.startDate || '').trim();
    const end = String(opts.endDate || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      params.push(start);
      conditions.push(`(u.last_login_at AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      params.push(end);
      conditions.push(`(u.last_login_at AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`);
    }
  }

  const method = String(opts.method || 'all').toLowerCase().trim();
  if (method === 'google') {
    conditions.push(`u.last_login_method = 'Google OAuth'`);
  } else if (method === 'email') {
    conditions.push(`u.last_login_method = 'Email & Password'`);
  }

  const status = String(opts.status || 'all').toLowerCase().trim();
  if (status === 'active') {
    conditions.push(`u.account_status = 'Active'`);
  } else if (status === 'inactive') {
    conditions.push(`u.account_status = 'Inactive'`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortBy = String(opts.sortBy || 'latest_login').toLowerCase().trim();
  let orderBySql = 'ORDER BY u.last_login_at DESC, u.user_id DESC';
  if (sortBy === 'highest_count') {
    orderBySql = 'ORDER BY u.total_login_count DESC, u.last_login_at DESC';
  } else if (sortBy === 'first_login') {
    orderBySql = 'ORDER BY u.first_login_at DESC, u.user_id DESC';
  }

  return { whereSql, orderBySql, params };
}

export async function getStudentLoginUsersRegistry(opts: StudentLoginUsersQuery) {
  await ensureStudentLoginUsersSchema();

  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(200, Math.max(10, Number(opts.limit) || 25));
  const offset = (page - 1) * limit;

  const { whereSql, orderBySql, params } = buildUsersFilterSql(opts);

  const [summaryRes, countRes, rowsRes] = await Promise.all([
    pool.query(`
      ${UNIFIED_LOGIN_USERS_BASE_CTE}
      SELECT
        COUNT(*)::int AS total_unique_login_users,
        COALESCE(SUM(u.total_login_count), 0)::int AS total_login_events,
        COUNT(CASE WHEN u.today_login_count > 0 THEN 1 END)::int AS today_unique_login_users,
        COALESCE(SUM(u.today_login_count), 0)::int AS today_total_login_events,
        COUNT(CASE WHEN u.is_online = true THEN 1 END)::int AS currently_active_students,
        COUNT(CASE WHEN u.total_login_count > 1 THEN 1 END)::int AS returning_students,
        COUNT(CASE WHEN u.total_login_count = 1 THEN 1 END)::int AS new_students
      FROM user_rows u
    `),
    pool.query(
      `${UNIFIED_LOGIN_USERS_BASE_CTE}
       SELECT COUNT(*)::int AS filtered_count
       FROM user_rows u
       ${whereSql}`,
      params
    ),
    pool.query(
      `${UNIFIED_LOGIN_USERS_BASE_CTE}
       SELECT
         u.user_id,
         u.student_name,
         u.student_email,
         u.first_login_at,
         u.last_login_at,
         u.total_login_count,
         u.today_login_count,
         u.last_login_method,
         u.last_device,
         u.last_browser,
         u.last_os,
         u.is_online,
         u.account_status
       FROM user_rows u
       ${whereSql}
       ${orderBySql}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
  ]);

  const totalCount = Number(countRes.rows[0]?.filtered_count || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const s = summaryRes.rows[0] || {};

  return {
    summary: {
      totalUniqueLoginUsers: Number(s.total_unique_login_users || 0),
      totalLoginEvents: Number(s.total_login_events || 0),
      todayUniqueLoginUsers: Number(s.today_unique_login_users || 0),
      todayTotalLoginEvents: Number(s.today_total_login_events || 0),
      currentlyActiveStudents: Number(s.currently_active_students || 0),
      returningStudents: Number(s.returning_students || 0),
      newStudents: Number(s.new_students || 0),
    },
    users: rowsRes.rows.map((r, idx) => ({
      serialNo: offset + idx + 1,
      userId: Number(r.user_id),
      studentName: r.student_name || 'N/A',
      studentEmail: r.student_email,
      firstLoginAt: r.first_login_at,
      lastLoginAt: r.last_login_at,
      totalLoginCount: Number(r.total_login_count || 0),
      todayLoginCount: Number(r.today_login_count || 0),
      lastLoginMethod: r.last_login_method || 'N/A',
      lastDevice: r.last_device || 'N/A',
      lastBrowser: r.last_browser || 'N/A',
      lastOs: r.last_os || 'N/A',
      isOnline: Boolean(r.is_online),
      accountStatus: (r.account_status === 'Active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
    })),
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

export async function getStudentLoginUserDetail(studentId: number) {
  await ensureStudentLoginUsersSchema();

  const [profileRes, eventsRes, sessionsRes] = await Promise.all([
    pool.query(
      `${UNIFIED_LOGIN_USERS_BASE_CTE}
       SELECT
         s.id AS user_id,
         COALESCE(NULLIF(TRIM(s.full_name), ''), 'N/A') AS student_name,
         LOWER(TRIM(s.email)) AS student_email,
         s.target_group,
         s.district,
         s.created_at AS registered_at,
         u.first_login_at,
         u.last_login_at,
         COALESCE(u.total_login_count, 0)::int AS total_login_count,
         COALESCE(u.today_login_count, 0)::int AS today_login_count,
         COALESCE(u.last_login_method, 'N/A') AS last_login_method,
         COALESCE(u.last_device, 'N/A') AS last_device,
         COALESCE(u.last_browser, 'N/A') AS last_browser,
         COALESCE(u.last_os, 'N/A') AS last_os,
         COALESCE(u.is_online, false) AS is_online,
         COALESCE(u.account_status, 'Inactive') AS account_status
       FROM students s
       LEFT JOIN user_rows u ON u.user_id = s.id
       WHERE s.id = $1 AND COALESCE(s.role, 'student') = 'student'`,
      [studentId]
    ),
    pool.query(
      `WITH raw_events AS (
         SELECT
           sle.event_id,
           sle.student_id,
           sle.authentication_method,
           sle.login_status,
           sle.login_timestamp,
           sle.device_type,
           sle.browser_name,
           sle.os_name,
           sle.session_id
         FROM student_login_events sle
         WHERE sle.student_id = $1
           AND COALESCE(sle.login_status, 'Successful') = 'Successful'

         UNION ALL

         SELECT
           ('legacy_sa_' || sa.id::text) AS event_id,
           sa.student_id,
           CASE WHEN sa.activity_type = 'google_login' THEN 'Google OAuth' ELSE 'Email & Password' END AS authentication_method,
           'Successful' AS login_status,
           sa.created_at AS login_timestamp,
           NULL::VARCHAR(64) AS device_type,
           NULL::VARCHAR(64) AS browser_name,
           NULL::VARCHAR(64) AS os_name,
           NULL::VARCHAR(120) AS session_id
         FROM student_activity sa
         WHERE sa.student_id = $1
           AND sa.activity_type IN ('login', 'google_login')
           AND NOT EXISTS (
             SELECT 1 FROM student_login_events sle2
             WHERE sle2.student_id = sa.student_id
               AND ABS(EXTRACT(EPOCH FROM (sle2.login_timestamp - sa.created_at))) <= 10
           )
       )
       SELECT
         re.event_id,
         TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') AS login_date,
         TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY') AS display_date,
         TO_CHAR(re.login_timestamp AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS login_time,
         re.login_timestamp,
         re.authentication_method,
         COALESCE(NULLIF(TRIM(re.device_type), ''), NULLIF(TRIM(sas.device_type), ''), 'N/A') AS device_type,
         COALESCE(NULLIF(TRIM(re.browser_name), ''), NULLIF(TRIM(sas.browser_name), ''), 'N/A') AS browser_name,
         COALESCE(NULLIF(TRIM(re.os_name), ''), NULLIF(TRIM(sas.os_name), ''), 'N/A') AS os_name,
         CASE
           WHEN sas.session_status = 'active' THEN 'Active'
           WHEN sas.session_status = 'revoked' THEN 'Revoked'
           WHEN sas.session_status = 'logged_out' THEN 'Logged Out'
           WHEN sas.session_status = 'expired' THEN 'Expired'
           ELSE 'Completed'
         END AS session_status
       FROM raw_events re
       LEFT JOIN LATERAL (
         SELECT device_type, browser_name, os_name, session_status
         FROM student_auth_sessions sas2
         WHERE sas2.student_id = re.student_id
           AND (
             (re.session_id IS NOT NULL AND sas2.session_id = re.session_id)
             OR ABS(EXTRACT(EPOCH FROM (sas2.created_at - re.login_timestamp))) <= 15
           )
         ORDER BY ABS(EXTRACT(EPOCH FROM (sas2.created_at - re.login_timestamp))) ASC
         LIMIT 1
       ) sas ON true
       ORDER BY re.login_timestamp DESC
       LIMIT 500`,
      [studentId]
    ),
    pool.query(
      `SELECT
         session_id,
         device_type,
         browser_name,
         os_name,
         auth_method,
         session_status,
         created_at,
         last_active_at,
         revoked_at,
         revoked_reason
       FROM student_auth_sessions
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [studentId]
    ),
  ]);

  if (profileRes.rows.length === 0) return null;

  const p = profileRes.rows[0];
  const events = eventsRes.rows;
  const sessions = sessionsRes.rows;

  const deviceSet = new Set<string>();
  const browserSet = new Set<string>();
  const osSet = new Set<string>();

  for (const s of sessions) {
    if (s.device_type && s.device_type !== 'N/A') deviceSet.add(s.device_type);
    if (s.browser_name && s.browser_name !== 'N/A') browserSet.add(s.browser_name);
    if (s.os_name && s.os_name !== 'N/A') osSet.add(s.os_name);
  }
  for (const e of events) {
    if (e.device_type && e.device_type !== 'N/A') deviceSet.add(e.device_type);
    if (e.browser_name && e.browser_name !== 'N/A') browserSet.add(e.browser_name);
    if (e.os_name && e.os_name !== 'N/A') osSet.add(e.os_name);
  }

  return {
    userId: Number(p.user_id),
    studentName: p.student_name || 'N/A',
    studentEmail: p.student_email,
    targetGroup: p.target_group || 'N/A',
    district: p.district || 'N/A',
    registeredAt: p.registered_at || null,
    firstLoginAt: p.first_login_at || (events.length > 0 ? events[events.length - 1].login_timestamp : null),
    lastLoginAt: p.last_login_at || (events.length > 0 ? events[0].login_timestamp : null),
    totalLoginCount: Number(p.total_login_count || events.length),
    todayLoginCount: Number(p.today_login_count || 0),
    lastLoginMethod: p.last_login_method || 'N/A',
    accountStatus: (p.account_status === 'Active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
    isOnline: Boolean(p.is_online),
    deviceHistory: Array.from(deviceSet),
    browserHistory: Array.from(browserSet),
    osHistory: Array.from(osSet),
    sessionHistory: sessions.map((s) => ({
      sessionId: s.session_id,
      device: s.device_type || 'N/A',
      browser: s.browser_name || 'N/A',
      os: s.os_name || 'N/A',
      authMethod: s.auth_method === 'google' ? 'Google OAuth' : s.auth_method === 'email' ? 'Email & Password' : s.auth_method || 'N/A',
      sessionStatus:
        s.session_status === 'active'
          ? 'Active'
          : s.session_status === 'revoked'
            ? 'Revoked'
            : s.session_status === 'logged_out'
              ? 'Logged Out'
              : 'Expired',
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      revokedAt: s.revoked_at || null,
    })),
    loginEvents: events.map((e, idx) => ({
      serialNo: idx + 1,
      eventId: e.event_id,
      loginDate: e.login_date,
      displayDate: e.display_date,
      loginTime: e.login_time,
      loginTimestamp: e.login_timestamp,
      loginMethod: e.authentication_method || 'N/A',
      device: e.device_type || 'N/A',
      browser: e.browser_name || 'N/A',
      os: e.os_name || 'N/A',
      sessionStatus: e.session_status || 'Completed',
    })),
  };
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatIstForCsv(iso: string | Date | null): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}

export async function exportStudentLoginUsersCsv(
  opts: StudentLoginUsersQuery & { scope?: 'all' | 'filtered' }
): Promise<string> {
  await ensureStudentLoginUsersSchema();

  const filterOpts: StudentLoginUsersQuery =
    opts.scope === 'all' ? { sortBy: opts.sortBy || 'latest_login' } : opts;
  const { whereSql, orderBySql, params } = buildUsersFilterSql(filterOpts);

  const res = await pool.query(
    `${UNIFIED_LOGIN_USERS_BASE_CTE}
     SELECT
       u.user_id,
       u.student_name,
       u.student_email,
       u.first_login_at,
       u.last_login_at,
       u.total_login_count,
       u.today_login_count,
       u.last_login_method,
       u.last_device,
       u.last_browser,
       u.last_os,
       u.account_status
     FROM user_rows u
     ${whereSql}
     ${orderBySql}
     LIMIT 50000`,
    params
  );

  const lines = [
    'S.No,User ID,Student Name,Student Email,First Login (IST),Last Login (IST),Total Login Count,Today Login Count,Last Login Method,Last Device,Last Browser,Last OS,Account Status',
  ];

  res.rows.forEach((r, idx) => {
    lines.push(
      [
        idx + 1,
        r.user_id,
        csvEscape(r.student_name || 'N/A'),
        csvEscape(r.student_email),
        csvEscape(formatIstForCsv(r.first_login_at)),
        csvEscape(formatIstForCsv(r.last_login_at)),
        r.total_login_count,
        r.today_login_count,
        csvEscape(r.last_login_method || 'N/A'),
        csvEscape(r.last_device || 'N/A'),
        csvEscape(r.last_browser || 'N/A'),
        csvEscape(r.last_os || 'N/A'),
        csvEscape(r.account_status),
      ].join(',')
    );
  });

  return lines.join('\r\n');
}

export async function exportIndividualStudentLoginHistoryCsv(studentId: number): Promise<{
  filename: string;
  csv: string;
} | null> {
  const detail = await getStudentLoginUserDetail(studentId);
  if (!detail) return null;

  const lines = [
    'S.No,User ID,Student Name,Student Email,Login Date,Login Time,Login Method,Device,Browser,Operating System,Session Status',
  ];

  detail.loginEvents.forEach((ev) => {
    lines.push(
      [
        ev.serialNo,
        detail.userId,
        csvEscape(detail.studentName),
        csvEscape(detail.studentEmail),
        csvEscape(ev.loginDate),
        csvEscape(ev.loginTime),
        csvEscape(ev.loginMethod),
        csvEscape(ev.device),
        csvEscape(ev.browser),
        csvEscape(ev.os),
        csvEscape(ev.sessionStatus),
      ].join(',')
    );
  });

  const safeEmail = detail.studentEmail.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  return {
    filename: `student-login-history-uid-${detail.userId}-${safeEmail}.csv`,
    csv: lines.join('\r\n'),
  };
}
