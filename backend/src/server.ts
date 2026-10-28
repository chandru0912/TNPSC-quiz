import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';
import questionsRouter from './routes/questions';
import authRouter from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*',
  credentials: true,
};
app.use(cors(corsOptions));
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
    },
  });
});

app.use('/api/admin', authRouter);
app.use('/api/questions', questionsRouter);

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
