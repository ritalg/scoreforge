import { Router } from 'express';
import { db, schema } from '../../db';
import { eq, gte, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../../middleware/auth';

const router = Router();

// ─── FEATURE FLAGS ────────────────────────────────────────────────────────────

// GET /api/admin/feature-flags
router.get('/feature-flags', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const flags = db.select().from(schema.featureFlags).all()
    .sort((a, b) => a.flagKey.localeCompare(b.flagKey));
  res.json(flags);
});

// PUT /api/admin/feature-flags/:key
router.put('/feature-flags/:key', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { key } = req.params;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });

  const flag = db.select().from(schema.featureFlags).where(eq(schema.featureFlags.flagKey, key)).get();
  if (!flag) return res.status(404).json({ error: 'Flag not found' });

  // Superadmin-only flags
  const superAdminOnly = ['ferpa_mode'];
  if (superAdminOnly.includes(key) && req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: `Only superadmin can toggle ${key}` });
  }

  db.update(schema.featureFlags)
    .set({ enabled, updatedBy: req.user!.id, updatedAt: new Date().toISOString() })
    .where(eq(schema.featureFlags.flagKey, key))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'feature_flag_update',
    entityType: 'feature_flag',
    entityId: key,
    payloadJson: JSON.stringify({ enabled }),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: `${key} set to ${enabled}` });
});

// ─── PLATFORM CONFIG ──────────────────────────────────────────────────────────

// GET /api/admin/platform-config
router.get('/platform-config', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const configs = db.select().from(schema.platformConfig).all();
  res.json(configs);
});

// PUT /api/admin/platform-config/:key
router.put('/platform-config/:key', authGuard, requireRole(['superadmin']), (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });

  db.update(schema.platformConfig)
    .set({ configValue: String(value), updatedBy: req.user!.id, updatedAt: new Date().toISOString() })
    .where(eq(schema.platformConfig.configKey, key))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'platform_config_update',
    entityType: 'platform_config',
    entityId: key,
    payloadJson: JSON.stringify({ value }),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: `Config ${key} updated` });
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs
router.get('/audit-logs', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { action, entityType, userId, from, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page)));
  const pageSize = Math.min(100, parseInt(String(limit)));

  let logs = db.select({
    id: schema.auditLogs.id,
    userId: schema.auditLogs.userId,
    action: schema.auditLogs.action,
    entityType: schema.auditLogs.entityType,
    entityId: schema.auditLogs.entityId,
    payloadJson: schema.auditLogs.payloadJson,
    ipAddress: schema.auditLogs.ipAddress,
    createdAt: schema.auditLogs.createdAt,
  }).from(schema.auditLogs).all();

  if (action) logs = logs.filter(l => l.action.includes(String(action)));
  if (entityType) logs = logs.filter(l => l.entityType === entityType);
  if (userId) logs = logs.filter(l => l.userId === parseInt(String(userId)));
  if (from) logs = logs.filter(l => l.createdAt >= String(from));

  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = logs.length;
  const paginated = logs.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  // Enrich with user email
  const enriched = paginated.map(log => {
    const user = db.select({ email: schema.users.email, firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users)
      .where(eq(schema.users.id, log.userId))
      .get();
    return { ...log, userEmail: user?.email, userName: user ? `${user.firstName} ${user.lastName}` : null };
  });

  res.json({ logs: enriched, total, page: pageNum, pageSize });
});

// ─── PLATFORM KPIs ────────────────────────────────────────────────────────────

// GET /api/admin/kpis
router.get('/kpis', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const totalUsers = db.select({ id: schema.users.id }).from(schema.users).all().length;
  const totalStudents = db.select({ id: schema.users.id }).from(schema.users).all()
    .filter(u => u.id).length;

  const todaySessions = db.select({ id: schema.quizSessions.id, startedAt: schema.quizSessions.startedAt })
    .from(schema.quizSessions)
    .all()
    .filter(s => s.startedAt.startsWith(today)).length;

  const weeklySessions = db.select({ id: schema.quizSessions.id })
    .from(schema.quizSessions)
    .all().length;

  const pendingReview = db.select({ id: schema.questions.id, status: schema.questions.status })
    .from(schema.questions)
    .all()
    .filter(q => q.status === 'pending_review').length;

  const totalQuestions = db.select({ id: schema.questions.id }).from(schema.questions).all().length;
  const approvedQuestions = db.select({ id: schema.questions.id, status: schema.questions.status })
    .from(schema.questions)
    .all()
    .filter(q => q.status === 'approved').length;

  const uploads = db.select({
    id: schema.uploads.id,
    status: schema.uploads.status,
  }).from(schema.uploads).all();

  const processingUploads = uploads.filter(u => ['queued', 'extracting', 'tagging'].includes(u.status as string)).length;

  res.json({
    totalUsers,
    todaySessions,
    pendingReview,
    totalQuestions,
    approvedQuestions,
    processingUploads,
    totalUploads: uploads.length,
  });
});

// ─── SAT TEST DATES ───────────────────────────────────────────────────────────

// GET /api/admin/sat-test-dates
router.get('/sat-test-dates', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const dates = db.select().from(schema.satTestDates).all()
    .sort((a, b) => a.testDate.localeCompare(b.testDate));
  res.json(dates);
});

// POST /api/admin/sat-test-dates
router.post('/sat-test-dates', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { testDate, registrationDeadline, isOfficial = true } = req.body;
  if (!testDate) return res.status(400).json({ error: 'testDate required' });

  db.insert(schema.satTestDates).values({ testDate, registrationDeadline, isOfficial }).run();
  res.status(201).json({ message: 'Test date added' });
});

// ─── PLATFORM ANALYTICS ───────────────────────────────────────────────────────

// GET /api/admin/analytics
router.get('/analytics', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const now = new Date();

  // Daily quiz sessions — last 30 days
  const dailySessions: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailySessions[d.toISOString().slice(0, 10)] = 0;
  }
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const recentSessions = db.select({
    startedAt: schema.quizSessions.startedAt,
    status: schema.quizSessions.status,
  }).from(schema.quizSessions)
    .where(gte(schema.quizSessions.startedAt, thirtyDaysAgo))
    .all();
  for (const s of recentSessions) {
    const day = s.startedAt.slice(0, 10);
    if (day in dailySessions) dailySessions[day]++;
  }

  // User growth — registrations by week (last 12 weeks)
  const weeklyUsers: Record<string, number> = {};
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 86400000).toISOString();
  const recentUsers = db.select({ createdAt: schema.users.createdAt, role: schema.users.role })
    .from(schema.users)
    .where(gte(schema.users.createdAt, twelveWeeksAgo))
    .all();
  for (const u of recentUsers) {
    const weekStart = new Date(u.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const wk = weekStart.toISOString().slice(0, 10);
    weeklyUsers[wk] = (weeklyUsers[wk] ?? 0) + 1;
  }

  // Per-topic accuracy
  const allSessions = db.select({
    id: schema.quizSessions.id,
    topicKey: schema.quizSessions.topicKey,
    status: schema.quizSessions.status,
  }).from(schema.quizSessions).all().filter(s => s.status === 'completed' && s.topicKey);

  const topicStats: Record<string, { correct: number; total: number }> = {};
  for (const sess of allSessions) {
    const attempts = db.select({ isCorrect: schema.quizQuestionAttempts.isCorrect })
      .from(schema.quizQuestionAttempts)
      .where(eq(schema.quizQuestionAttempts.sessionId, sess.id))
      .all().filter(a => a.isCorrect !== null);
    const key = sess.topicKey!;
    if (!topicStats[key]) topicStats[key] = { correct: 0, total: 0 };
    topicStats[key].total += attempts.length;
    topicStats[key].correct += attempts.filter(a => a.isCorrect).length;
  }

  const topicAccuracy = Object.entries(topicStats)
    .filter(([, v]) => v.total >= 5)
    .map(([key, v]) => ({ topicKey: key, accuracy: Math.round((v.correct / v.total) * 100), total: v.total }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Score distribution from mock tests
  const mockScores = db.select({ compositeScore: schema.mockTestSessions.compositeScore })
    .from(schema.mockTestSessions)
    .where(eq(schema.mockTestSessions.status, 'completed'))
    .all()
    .filter(m => m.compositeScore !== null)
    .map(m => m.compositeScore!);

  const scoreDistribution: Record<string, number> = {
    '400–799': 0, '800–999': 0, '1000–1199': 0, '1200–1399': 0, '1400–1600': 0,
  };
  for (const s of mockScores) {
    if (s < 800) scoreDistribution['400–799']++;
    else if (s < 1000) scoreDistribution['800–999']++;
    else if (s < 1200) scoreDistribution['1000–1199']++;
    else if (s < 1400) scoreDistribution['1200–1399']++;
    else scoreDistribution['1400–1600']++;
  }

  // Upload stats
  const uploads = db.select({ status: schema.uploads.status }).from(schema.uploads).all();
  const uploadStats = { total: uploads.length, completed: 0, failed: 0, processing: 0 };
  for (const u of uploads) {
    if (u.status === 'done') uploadStats.completed++;
    else if (u.status === 'failed') uploadStats.failed++;
    else uploadStats.processing++;
  }

  // Role breakdown
  const users = db.select({ role: schema.users.role }).from(schema.users).all();
  const roleBreakdown: Record<string, number> = {};
  for (const u of users) {
    roleBreakdown[u.role] = (roleBreakdown[u.role] ?? 0) + 1;
  }

  res.json({
    dailySessions: Object.entries(dailySessions).map(([date, sessions]) => ({ date, sessions })),
    weeklyUsers: Object.entries(weeklyUsers).sort(([a], [b]) => a.localeCompare(b)).map(([week, newUsers]) => ({ week, newUsers })),
    topicAccuracy,
    scoreDistribution: Object.entries(scoreDistribution).map(([range, count]) => ({ range, count })),
    uploadStats,
    roleBreakdown,
    totals: {
      users: users.length,
      sessions: recentSessions.length,
      mockTests: mockScores.length,
    },
  });
});

export default router;
