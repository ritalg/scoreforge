import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { TOPIC_LABELS, MATH_TOPICS, RW_TOPICS } from '@scoreforge/shared';

const router = Router();
router.use(authGuard, requireRole(['tutor']));

function getStudentSummary(studentId: number) {
  const u = db.select({
    id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName,
    email: schema.users.email, status: schema.users.status,
  }).from(schema.users).where(eq(schema.users.id, studentId)).get();

  const level = db.select({ currentLevel: schema.studentLevels.currentLevel, totalXp: schema.studentLevels.totalXp })
    .from(schema.studentLevels).where(eq(schema.studentLevels.studentId, studentId)).get();

  const sessions = db.select({
    id: schema.quizSessions.id, scorePct: schema.quizSessions.scorePct,
    topicKey: schema.quizSessions.topicKey, completedAt: schema.quizSessions.completedAt,
  }).from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'completed')))
    .all()
    .sort((a, b) => new Date(b.completedAt ?? '').getTime() - new Date(a.completedAt ?? '').getTime());

  const recentScore = sessions[0]?.scorePct ?? null;
  const prevScore = sessions[1]?.scorePct ?? null;
  const trend: 'up' | 'down' | 'flat' | null = recentScore != null && prevScore != null
    ? recentScore > prevScore + 2 ? 'up' : recentScore < prevScore - 2 ? 'down' : 'flat'
    : null;

  const lastStudyDate = sessions[0]?.completedAt ?? null;
  const daysSinceStudy = lastStudyDate
    ? Math.floor((Date.now() - new Date(lastStudyDate).getTime()) / 86400000) : null;
  const needsAttention = daysSinceStudy !== null && daysSinceStudy >= 3;

  const streak = db.select({ currentStreak: schema.streakRecords.currentStreak })
    .from(schema.streakRecords).where(eq(schema.streakRecords.studentId, studentId)).get();

  return {
    ...u,
    level: level?.currentLevel ?? 1, totalXp: level?.totalXp ?? 0,
    sessionCount: sessions.length, recentScore, trend, lastStudyDate, daysSinceStudy,
    needsAttention, streak: streak?.currentStreak ?? 0,
  };
}

// GET /api/tutor/students — roster
router.get('/students', (req, res) => {
  const tutorId = req.user!.id;
  const links = db.select().from(schema.tutorStudentLinks)
    .where(and(eq(schema.tutorStudentLinks.tutorId, tutorId), eq(schema.tutorStudentLinks.status, 'active')))
    .all();

  const students = links.map(l => ({
    ...getStudentSummary(l.studentId),
    linkId: l.id, tutorNotes: l.tutorNotes, linkedAt: l.linkedAt,
  })).filter(s => s.id);

  res.json(students);
});

// POST /api/tutor/students/invite — generate link code (student pastes it on their end)
router.post('/students/invite', (req, res) => {
  // Returns tutor's ID so student can link themselves
  res.json({ tutorId: req.user!.id, inviteHint: `Student enters tutor ID: ${req.user!.id}` });
});

// POST /api/tutor/students/:studentId/notes — update notes
router.put('/students/:studentId/notes', (req, res) => {
  const { notes } = req.body;
  const tutorId = req.user!.id;
  db.update(schema.tutorStudentLinks)
    .set({ tutorNotes: notes ?? null })
    .where(and(
      eq(schema.tutorStudentLinks.tutorId, tutorId),
      eq(schema.tutorStudentLinks.studentId, parseInt(req.params.studentId))
    )).run();
  res.json({ message: 'Notes saved' });
});

// GET /api/tutor/students/:studentId — full student detail
router.get('/students/:studentId', (req, res) => {
  const tutorId = req.user!.id;
  const studentId = parseInt(req.params.studentId);
  const link = db.select().from(schema.tutorStudentLinks)
    .where(and(eq(schema.tutorStudentLinks.tutorId, tutorId), eq(schema.tutorStudentLinks.studentId, studentId))).get();
  if (!link) return res.status(403).json({ error: 'Not your student' });

  const summary = getStudentSummary(studentId);
  const sessions = db.select().from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'completed')))
    .all()
    .sort((a, b) => new Date(b.completedAt ?? '').getTime() - new Date(a.completedAt ?? '').getTime())
    .slice(0, 20);

  const prediction = db.select().from(schema.scorePredictions)
    .where(eq(schema.scorePredictions.studentId, studentId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

  res.json({ student: summary, recentSessions: sessions, prediction, tutorNotes: link.tutorNotes });
});

// ─── COHORT ANALYTICS ─────────────────────────────────────────────────────────

// GET /api/tutor/cohort — aggregate stats across all students
router.get('/cohort', (req, res) => {
  const tutorId = req.user!.id;
  const links = db.select({ studentId: schema.tutorStudentLinks.studentId })
    .from(schema.tutorStudentLinks)
    .where(and(eq(schema.tutorStudentLinks.tutorId, tutorId), eq(schema.tutorStudentLinks.status, 'active')))
    .all();

  if (links.length === 0) return res.json({ studentCount: 0, topicAccuracy: {}, mostMissed: [] });

  const studentIds = links.map(l => l.studentId);

  // Per-topic accuracy across cohort
  const topicAccuracy: Record<string, { correct: number; total: number }> = {};
  const questionMissed: Record<number, { count: number; questionText: string; topicKey: string | null }> = {};

  for (const sid of studentIds) {
    const sessions = db.select({ id: schema.quizSessions.id, topicKey: schema.quizSessions.topicKey })
      .from(schema.quizSessions)
      .where(and(eq(schema.quizSessions.studentId, sid), eq(schema.quizSessions.status, 'completed')))
      .all();

    for (const sess of sessions) {
      const attempts = db.select({
        questionId: schema.quizQuestionAttempts.questionId,
        isCorrect: schema.quizQuestionAttempts.isCorrect,
        studentAnswer: schema.quizQuestionAttempts.studentAnswer,
      }).from(schema.quizQuestionAttempts)
        .where(eq(schema.quizQuestionAttempts.sessionId, sess.id))
        .all()
        .filter(a => a.studentAnswer !== null);

      for (const a of attempts) {
        const q = db.select({ topicKey: schema.questions.topicKey, questionText: schema.questions.questionText })
          .from(schema.questions).where(eq(schema.questions.id, a.questionId)).get();
        const topic = q?.topicKey ?? sess.topicKey ?? 'unknown';

        if (!topicAccuracy[topic]) topicAccuracy[topic] = { correct: 0, total: 0 };
        topicAccuracy[topic].total++;
        if (a.isCorrect) topicAccuracy[topic].correct++;

        if (!a.isCorrect) {
          if (!questionMissed[a.questionId]) {
            questionMissed[a.questionId] = { count: 0, questionText: q?.questionText ?? '', topicKey: q?.topicKey ?? null };
          }
          questionMissed[a.questionId].count++;
        }
      }
    }
  }

  const topicStats = Object.entries(topicAccuracy).map(([key, d]) => ({
    key, label: (TOPIC_LABELS as Record<string, string>)[key] ?? key,
    accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    attempts: d.total,
  })).sort((a, b) => a.accuracy - b.accuracy);

  const mostMissed = Object.entries(questionMissed)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    .map(([qId, d]) => ({ questionId: parseInt(qId), ...d }));

  res.json({ studentCount: studentIds.length, topicAccuracy: topicStats, mostMissed });
});

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

// GET /api/tutor/assignments
router.get('/assignments', (req, res) => {
  const tutorId = req.user!.id;
  const assignments = db.select().from(schema.assignments)
    .where(eq(schema.assignments.tutorId, tutorId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const enriched = assignments.map(a => {
    const students = db.select().from(schema.assignmentStudents)
      .where(eq(schema.assignmentStudents.assignmentId, a.id)).all();
    return {
      ...a,
      studentCount: students.length,
      completedCount: students.filter(s => s.status === 'completed').length,
    };
  });

  res.json(enriched);
});

// POST /api/tutor/assignments — create assignment
router.post('/assignments', (req, res) => {
  const { title, description, topicKey, questionCount = 20, dueDate, timeLimitSeconds, studentIds } = req.body;
  if (!title?.trim() || !dueDate) return res.status(400).json({ error: 'title, dueDate required' });

  const tutorId = req.user!.id;

  // Select questions for the assignment
  let pool = db.select({ id: schema.questions.id })
    .from(schema.questions).where(eq(schema.questions.status, 'approved')).all();
  if (topicKey) pool = pool.filter(q => {
    const full = db.select({ topicKey: schema.questions.topicKey })
      .from(schema.questions).where(eq(schema.questions.id, q.id)).get();
    return full?.topicKey === topicKey;
  });

  // Shuffle and pick
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selected = pool.slice(0, questionCount).map(q => q.id);

  db.insert(schema.assignments).values({
    tutorId, title: title.trim(), description: description ?? null,
    questionSelectionJson: JSON.stringify({ topicKey, questionIds: selected }),
    dueDate, timeLimitSeconds: timeLimitSeconds ?? null,
  }).run();

  const assignment = db.select().from(schema.assignments)
    .where(eq(schema.assignments.tutorId, tutorId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Assign to students
  const targets = studentIds ?? db.select({ studentId: schema.tutorStudentLinks.studentId })
    .from(schema.tutorStudentLinks)
    .where(and(eq(schema.tutorStudentLinks.tutorId, tutorId), eq(schema.tutorStudentLinks.status, 'active')))
    .all().map(l => l.studentId);

  for (const sid of targets) {
    try {
      db.insert(schema.assignmentStudents).values({ assignmentId: assignment.id, studentId: sid }).run();
    } catch {}
  }

  res.status(201).json({ ...assignment, studentCount: targets.length });
});

// GET /api/tutor/assignments/:id — details with per-student completion
router.get('/assignments/:id', (req, res) => {
  const assignment = db.select().from(schema.assignments)
    .where(eq(schema.assignments.id, parseInt(req.params.id))).get();
  if (!assignment || assignment.tutorId !== req.user!.id) return res.status(404).json({ error: 'Not found' });

  const students = db.select().from(schema.assignmentStudents)
    .where(eq(schema.assignmentStudents.assignmentId, assignment.id)).all();

  const enriched = students.map(s => {
    const u = db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users).where(eq(schema.users.id, s.studentId)).get();
    const score = s.quizSessionId
      ? db.select({ scorePct: schema.quizSessions.scorePct }).from(schema.quizSessions)
          .where(eq(schema.quizSessions.id, s.quizSessionId)).get()
      : null;
    return { ...s, firstName: u?.firstName, lastName: u?.lastName, scorePct: score?.scorePct };
  });

  res.json({ assignment, students: enriched });
});

export default router;
