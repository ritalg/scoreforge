import './instrumentation'; // must be first
import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { initSearchIndex } from './services/searchService';
import { initVapid, getVapidPublicKey } from './services/pushService';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { sql } from 'drizzle-orm';

import { db } from './db';
import { recordRequest, recordError } from './routes/metrics';

import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import usersRouter from './routes/users';
import quizRouter from './routes/quiz';
import analyticsRouter from './routes/analytics';
import gamificationRouter from './routes/gamification';
import srRouter from './routes/sr';
import mockTestRouter from './routes/mockTest';
import flashcardsRouter from './routes/flashcards';
import questionBankRouter from './routes/questionBank';
import essaysRouter from './routes/essays';
import scorePredictionRouter from './routes/scorePrediction';
import annotationsRouter from './routes/annotations';
import notificationsRouter from './routes/notifications';
import notificationPreferencesRouter from './routes/notificationPreferences';
import parentRouter from './routes/parent';
import studyGroupsRouter from './routes/studyGroups';
import tutorRouter from './routes/tutor';
import testCalendarRouter from './routes/testCalendar';
import tutorStudentLinkRouter from './routes/tutorStudentLink';
import metricsRouter from './routes/metrics';
import adminUploadsRouter from './routes/admin/uploads';
import adminQuestionsRouter from './routes/admin/questions';
import adminUsersRouter from './routes/admin/users';
import adminPlatformRouter from './routes/admin/platform';
import adminScoringTablesRouter from './routes/admin/scoringTables';
import adminFlashcardsRouter from './routes/admin/adminFlashcards';

// Sentry (only when DSN configured)
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' });
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Security
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://scoreforge.coach',
  'https://www.scoreforge.coach',
  ...(process.env.APP_URL ? [process.env.APP_URL] : []),
];
app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Request timing middleware (feeds Prometheus metrics)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    recordRequest(Date.now() - start);
    if (res.statusCode >= 500) recordError();
  });
  next();
});

// Rate limiting
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many registrations' } }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 5 : 100, message: { error: 'Too many login attempts' } }));
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many requests' } }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/users', usersRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/sr', srRouter);
app.use('/api/mock-test', mockTestRouter);
app.use('/api/flashcards', flashcardsRouter);
app.use('/api/question-bank', questionBankRouter);
app.use('/api/essays', essaysRouter);
app.use('/api/score-prediction', scorePredictionRouter);
app.use('/api/annotations', annotationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/notification-preferences', notificationPreferencesRouter);
app.use('/api/parent', parentRouter);
app.use('/api/groups', studyGroupsRouter);
app.use('/api/tutor', tutorRouter);
app.use('/api/test-calendar', testCalendarRouter);
app.use('/api/student', tutorStudentLinkRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/admin/scoring-tables', adminScoringTablesRouter);
app.use('/api/admin/flashcards', adminFlashcardsRouter);
app.use('/api/admin/uploads', adminUploadsRouter);
app.use('/api/admin/questions', adminQuestionsRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin', adminPlatformRouter);

// Health check
app.get('/api/health', (req, res) => {
  let dbOk = false;
  try { db.get(sql`SELECT 1`); dbOk = true; } catch {}
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'error',
    redis: 'not_configured',
    ai: 'not_checked',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Sentry error handler (must be after routes, before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  recordError();
  res.status(500).json({ error: 'Internal server error' });
});

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Serve uploaded figures as static files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// VAPID public key endpoint (unauthenticated — needed for SW subscription)
app.get('/api/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.json({ publicKey: null });
  res.json({ publicKey: key });
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initVapid();
  await initSearchIndex();
});

export default app;
