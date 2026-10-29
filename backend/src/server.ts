import express from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import pool from './db';
import questionsRouter from './routes/questions';
import authRouter from './routes/auth';
import notesRouter from './routes/notes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'https://tnpsc-quiz-lrkivhxrn-moonzoro.vercel.app',
  'https://tnpsc-quiz-1rra490pf-moonzoro.vercel.app',
  'https://tnpsc-quiz-lval.vercel.app',
  'https://tnpsc-quiz-jwkl.vercel.app',
  'https://tnpsc-quiz-jwk1.vercel.app',
  'http://localhost:5173',
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

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

app.use('/api/admin', authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/notes', notesRouter);

// Preserved existing health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Database health check endpoint running SELECT 1
app.get('/api/db-health', async (_req, res) => {
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
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to PostgreSQL database',
      error: error.message || 'Database connection error',
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
