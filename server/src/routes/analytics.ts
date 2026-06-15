import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/analytics/overview  – dashboard summary stats
router.get('/overview', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;
  const now = new Date();
  const nowIso = now.toISOString();

  // Score history (last 20 completed sessions)
  const sessions = db.select({
    id: schema.quizSessions.id,
    mode: schema.quizSessions.mode,
    scorePct: schema.quizSessions.scorePct,
    questionCountActual: schema.quizSessions.questionCountActual,
    correctCount: schema.quizSessions.correctCount,
    topicKey: schema.quizSessions.topicKey,
    startedAt: schema.quizSessions.startedAt,
  })
    .from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.studentId, studentId),
      eq(schema.quizSessions.status, 'completed'),
    ))
    .all()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 30);

  // Topic breakdown
  const topicMap: Record<string, { correct: number; total: number }> = {};
  for (const s of sessions) {
    if (!s.topicKey) continue;
    if (!topicMap[s.topicKey]) topicMap[s.topicKey] = { correct: 0, total: 0 };
    topicMap[s.topicKey].total += s.questionCountActual ?? 0;
    topicMap[s.topicKey].correct += s.correctCount ?? 0;
  }

  // Streak
  const streak = db.select()
    .from(schema.streakRecords)
    .where(eq(schema.streakRecords.studentId, studentId))
    .get();

  // SR due count
  const srDue = db.select({ id: schema.spacedRepetitionRecords.id, nextReviewAt: schema.spacedRepetitionRecords.nextReviewAt })
    .from(schema.spacedRepetitionRecords)
    .where(and(
      eq(schema.spacedRepetitionRecords.studentId, studentId),
      lte(schema.spacedRepetitionRecords.nextReviewAt, nowIso),
    ))
    .all().length;

  // Level / XP
  const level = db.select()
    .from(schema.studentLevels)
    .where(eq(schema.studentLevels.studentId, studentId))
    .get();

  // Next test date
  const nextTest = db.select()
    .from(schema.studentTestCalendar)
    .where(and(
      eq(schema.studentTestCalendar.studentId, studentId),
    ))
    .all()
    .filter(t => t.customDate && new Date(t.customDate) >= now || false)
    .sort((a, b) => {
      const da = new Date(a.customDate || a.createdAt).getTime();
      const db_ = new Date(b.customDate || b.createdAt).getTime();
      return da - db_;
    })[0] ?? null;

  // Latest score prediction
  const prediction = db.select()
    .from(schema.scorePredictions)
    .where(eq(schema.scorePredictions.studentId, studentId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

  // Recent sessions for sparkline (last 10)
  const recentTrend = sessions.slice(0, 10).reverse().map(s => ({
    date: s.startedAt,
    scorePct: s.scorePct,
    mode: s.mode,
  }));

  res.json({
    streak: {
      current: streak?.currentStreak ?? 0,
      longest: streak?.longestStreak ?? 0,
      lastStudyDate: streak?.lastStudyDate,
    },
    srDueCount: srDue,
    level: {
      current: level?.currentLevel ?? 1,
      totalXp: level?.totalXp ?? 0,
    },
    prediction,
    recentTrend,
    topicBreakdown: Object.entries(topicMap).map(([key, v]) => ({
      topicKey: key,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      questionsAttempted: v.total,
    })),
  });
});

// GET /api/analytics/score-history
router.get('/score-history', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;

  const sessions = db.select({
    id: schema.quizSessions.id,
    mode: schema.quizSessions.mode,
    topicKey: schema.quizSessions.topicKey,
    scorePct: schema.quizSessions.scorePct,
    questionCountActual: schema.quizSessions.questionCountActual,
    correctCount: schema.quizSessions.correctCount,
    completedAt: schema.quizSessions.completedAt,
    startedAt: schema.quizSessions.startedAt,
  })
    .from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.studentId, studentId),
      eq(schema.quizSessions.status, 'completed'),
    ))
    .all()
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  res.json(sessions);
});

// GET /api/analytics/topic-breakdown
router.get('/topic-breakdown', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;

  // Get all attempts with question topic info
  const sessions = db.select({ id: schema.quizSessions.id })
    .from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.studentId, studentId),
      eq(schema.quizSessions.status, 'completed'),
    ))
    .all();

  if (sessions.length === 0) return res.json([]);

  const topicMap: Record<string, { correct: number; total: number; wrong: number }> = {};

  for (const sess of sessions) {
    const attempts = db.select({
      questionId: schema.quizQuestionAttempts.questionId,
      isCorrect: schema.quizQuestionAttempts.isCorrect,
    })
      .from(schema.quizQuestionAttempts)
      .where(eq(schema.quizQuestionAttempts.sessionId, sess.id))
      .all()
      .filter(a => a.isCorrect !== null);

    for (const a of attempts) {
      const q = db.select({ topicKey: schema.questions.topicKey })
        .from(schema.questions)
        .where(eq(schema.questions.id, a.questionId!))
        .get();

      const key = q?.topicKey || 'unknown';
      if (!topicMap[key]) topicMap[key] = { correct: 0, total: 0, wrong: 0 };
      topicMap[key].total++;
      if (a.isCorrect) topicMap[key].correct++;
      else topicMap[key].wrong++;
    }
  }

  const result = Object.entries(topicMap).map(([topicKey, stats]) => ({
    topicKey,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    correct: stats.correct,
    wrong: stats.wrong,
    total: stats.total,
  })).sort((a, b) => b.total - a.total);

  res.json(result);
});

// GET /api/analytics/weekly-activity
router.get('/weekly-activity', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sessions = db.select({
    startedAt: schema.quizSessions.startedAt,
    questionCountActual: schema.quizSessions.questionCountActual,
    correctCount: schema.quizSessions.correctCount,
  })
    .from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.studentId, studentId),
      eq(schema.quizSessions.status, 'completed'),
      gte(schema.quizSessions.startedAt, sevenDaysAgo),
    ))
    .all();

  // Group by day
  const dayMap: Record<string, { sessions: number; questionsAnswered: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dayMap[d] = { sessions: 0, questionsAnswered: 0 };
  }

  for (const s of sessions) {
    const day = s.startedAt.slice(0, 10);
    if (dayMap[day]) {
      dayMap[day].sessions++;
      dayMap[day].questionsAnswered += s.questionCountActual ?? 0;
    }
  }

  res.json(Object.entries(dayMap).map(([date, stats]) => ({ date, ...stats })));
});

export default router;
