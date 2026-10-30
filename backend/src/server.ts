import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import pool from './db';
import { ensureDatabaseSchema } from './migrate';
import questionsRouter from './routes/questions';
import authRouter, { getConfiguredAdminCount } from './routes/auth';
import { generateAdminToken, verifyAdminToken } from './middleware/auth';
import notesRouter from './routes/notes';
import textbooksRouter from './routes/textbooks';

const app = express();
const PORT = process.env.PORT || 5000;

// Disable ETag generation globally so dynamic API endpoints never return HTTP 304 (Not Modified)
app.set('etag', false);

const allowedOrigins = [
  'https://tnpsc-quiz-lrkivhxrn-moonzoro.vercel.app',
  'https://tnpsc-quiz-1rra490pf-moonzoro.vercel.app',
  'https://tnpsc-quiz-lval.vercel.app',
  'https://tnpsc-quiz-jwkl.vercel.app',
  'https://tnpsc-quiz-jwk1.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:5000',
];

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((o) => {
    const trimmed = o.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

const isOriginAllowed = (origin: string): boolean => {
  const clean = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes('*') || process.env.CORS_ORIGIN === '*') {
    return true;
  }
  if (allowedOrigins.includes(clean) || allowedOrigins.includes(origin)) {
    return true;
  }
  // Allow local development origins on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) {
    return true;
  }
  // Allow all Vercel deployment and preview subdomains for this project
  if (/^https:\/\/tnpsc-quiz.*\.vercel\.app$/.test(clean) || /^https:\/\/.*-moonzoro\.vercel\.app$/.test(clean)) {
    return true;
  }
  return false;
};

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser requests or same-origin requests with no Origin header
    if (!origin) {
      return callback(null, true);
    }
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // Disallow without throwing a 500 error to ensure clean CORS handling
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires',
    'If-None-Match',
    'If-Modified-Since',
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Prevent HTTP 304 (Not Modified) and stale edge/browser caching on all API endpoints
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  delete req.headers['if-match'];
  delete req.headers['if-unmodified-since'];

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Routes
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'TNPSC Quiz Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      dbHealth: '/api/db-health',
      adminAuth: '/api/admin/login',
      questions: '/api/questions',
      notes: '/api/notes',
      textbooks: '/api/textbooks',
    },
  });
});

// Informational endpoints for GET requests to prevent 404s when testing in browser
app.get('/api/admin', (_req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Admin API',
    endpoints: {
      login: 'POST /api/admin/login',
      verify: 'GET /api/admin/verify',
      users: 'GET /api/admin/users',
    },
  });
});

app.get('/api/admin/login', (_req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Admin Auth API',
    message: 'Admin authentication endpoint is online. Submit admin credentials using POST /api/admin/login.',
    endpoint: 'POST /api/admin/login',
  });
});

// Ensure PostgreSQL schema tables exist before handling data routes
const requireSchemaMiddleware = async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await ensureDatabaseSchema();
    next();
  } catch (err) {
    next(err);
  }
};

app.use('/api/admin', authRouter);
app.use('/api/questions', requireSchemaMiddleware, questionsRouter);
app.use('/api/notes', requireSchemaMiddleware, notesRouter);
app.use('/api/textbooks', requireSchemaMiddleware, textbooksRouter);

// Health check endpoint with separate service status for Backend Server, Database Connection, and Authentication Service
app.get('/api/health', async (_req: Request, res: Response) => {
  const startDb = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbLatencyMs: number | null = null;

  try {
    await Promise.race([
      pool.query('SELECT 1 AS result'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database health check timeout')), 3000)),
    ]);
    dbStatus = 'connected';
    dbLatencyMs = Date.now() - startDb;
  } catch {
    dbStatus = 'disconnected';
  }

  let jwtOk = false;
  try {
    const probeToken = generateAdminToken('__health_probe__', 'Health Probe', 'admin');
    const verified = verifyAdminToken(probeToken);
    jwtOk = Boolean(verified && verified.username === '__health_probe__');
  } catch {
    jwtOk = false;
  }

  const configuredAdmins = getConfiguredAdminCount();
  const authReady = jwtOk && configuredAdmins > 0;

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      backendServer: {
        status: 'ok',
        uptime: process.uptime(),
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      authentication: {
        status: authReady ? 'ready' : 'degraded',
        jwtVerification: jwtOk ? 'ok' : 'error',
        configuredAdminAccounts: configuredAdmins,
      },
    },
  });
});

// Database health check endpoint running SELECT 1
app.get('/api/db-health', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT 1 AS result');
    res.status(200).json({
      status: 'connected',
      message: 'PostgreSQL database connection is healthy',
      database: process.env.PGDATABASE || 'tnpsc_study_hub',
      result: result.rows[0].result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      dbStatus: 'disconnected',
      message: 'Failed to connect to PostgreSQL database',
      error: error.message || 'Database connection error',
      timestamp: new Date().toISOString(),
    });
  }
});

// JSON 404 handler for unmatched routes (prevents Express default HTML 404 responses)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Not Found (404): Route ${req.method} ${req.originalUrl} does not exist on this server.`,
  });
});

// Global JSON error handler to ensure runtime or middleware errors never drop CORS headers or return raw HTML
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]:', err?.message || err);
  const statusCode = typeof err?.status === 'number' ? err.status : typeof err?.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json({
    status: 'error',
    message: err?.message || 'Internal server error',
  });
});

if (!process.env.VERCEL) {
  ensureDatabaseSchema().catch((err) => {
    console.warn('[Server Startup] Schema check warning:', err?.message || err);
  });
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
