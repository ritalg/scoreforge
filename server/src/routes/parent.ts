import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['parent']));

// GET /api/parent/children — list linked children
router.get('/children', (req, res) => {
  const parentId = req.user!.id;
  const links = db.select().from(schema.parentStudentLinks)
    .where(and(eq(schema.parentStudentLinks.parentId, parentId), eq(schema.parentStudentLinks.status, 'active')))
    .all();

  const children = links.map(l => {
    const u = db.select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email })
      .from(schema.users).where(eq(schema.users.id, l.studentId)).get();
    const level = db.select({ currentLevel: schema.studentLevels.currentLevel, totalXp: schema.studentLevels.totalXp })
      .from(schema.studentLevels).where(eq(schema.studentLevels.studentId, l.studentId)).get();
    const streak = db.select({ currentStreak: schema.streakRecords.currentStreak })
      .from(schema.streakRecords).where(eq(schema.streakRecords.studentId, l.studentId)).get();
    const prediction = db.select({
      predictedComposite: schema.scorePredictions.predictedComposite,
      confidenceInterval: schema.scorePredictions.confidenceInterval,
    }).from(schema.scorePredictions)
      .where(eq(schema.scorePredictions.studentId, l.studentId))
      .all()
      .sort((a, b) => 0)[0] ?? null;
    return {
      ...u, linkedAt: l.linkedAt,
      level: level?.currentLevel ?? 1, totalXp: level?.totalXp ?? 0,
      streak: streak?.currentStreak ?? 0,
      prediction,
    };
  }).filter(c => c.id);

  res.json(children);
});

// GET /api/parent/children/:studentId/dashboard — full read-only dashboard
router.get('/children/:studentId/dashboard', (req, res) => {
  const parentId = req.user!.id;
  const studentId = parseInt(req.params.studentId);

  const link = db.select().from(schema.parentStudentLinks)
    .where(and(
      eq(schema.parentStudentLinks.parentId, parentId),
      eq(schema.parentStudentLinks.studentId, studentId),
      eq(schema.parentStudentLinks.status, 'active')
    )).get();
  if (!link) return res.status(403).json({ error: 'Not your child' });

  const student = db.select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
    .from(schema.users).where(eq(schema.users.id, studentId)).get();

  const level = db.select().from(schema.studentLevels).where(eq(schema.studentLevels.studentId, studentId)).get();
  const streak = db.select().from(schema.streakRecords).where(eq(schema.streakRecords.studentId, studentId)).get();

  const sessions = db.select({
    id: schema.quizSessions.id, scorePct: schema.quizSessions.scorePct,
    topicKey: schema.quizSessions.topicKey, completedAt: schema.quizSessions.completedAt,
  }).from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'completed')))
    .all()
    .sort((a, b) => new Date(b.completedAt ?? '').getTime() - new Date(a.completedAt ?? '').getTime());

  const recentSessions = sessions.slice(0, 10);

  // Weekly activity (last 7 days)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekSessions = sessions.filter(s => (s.completedAt ?? '') >= cutoff);

  const avgScore = weekSessions.length
    ? Math.round(weekSessions.reduce((sum, s) => sum + (s.scorePct ?? 0), 0) / weekSessions.length)
    : null;

  const xpThisWeek = db.select({ xpEarned: schema.studentXpEvents.xpEarned, createdAt: schema.studentXpEvents.createdAt })
    .from(schema.studentXpEvents)
    .where(eq(schema.studentXpEvents.studentId, studentId))
    .all()
    .filter(e => (e.createdAt ?? '') >= cutoff)
    .reduce((sum, e) => sum + (e.xpEarned ?? 0), 0);

  const badges = db.select().from(schema.studentBadges)
    .where(eq(schema.studentBadges.studentId, studentId)).all();

  const prediction = db.select().from(schema.scorePredictions)
    .where(eq(schema.scorePredictions.studentId, studentId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

  const calendar = db.select().from(schema.studentTestCalendar)
    .where(eq(schema.studentTestCalendar.studentId, studentId)).all();

  const targetDate = calendar.find(c => c.isTarget);
  const daysUntilTest = targetDate?.customDate
    ? Math.ceil((new Date(targetDate.customDate).getTime() - Date.now()) / 86400000)
    : null;

  res.json({
    student, level, streak, prediction,
    recentSessions, weekSessions: weekSessions.length, avgScore, xpThisWeek,
    badges: badges.length, targetDate, daysUntilTest,
  });
});

// POST /api/parent/link — parent links to child by student email
router.post('/link', (req, res) => {
  const { studentEmail } = req.body;
  if (!studentEmail) return res.status(400).json({ error: 'studentEmail required' });

  const student = db.select({ id: schema.users.id, role: schema.users.role, firstName: schema.users.firstName })
    .from(schema.users).where(eq(schema.users.email, studentEmail.toLowerCase())).get();

  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });

  try {
    db.insert(schema.parentStudentLinks).values({
      parentId: req.user!.id, studentId: student.id, status: 'active',
      consentTimestamp: new Date().toISOString(),
    }).run();
  } catch {
    return res.status(400).json({ error: 'Already linked to this student' });
  }

  res.status(201).json({ message: `Linked to ${student.firstName}`, studentId: student.id });
});

export default router;
