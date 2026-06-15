import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { updateSR } from '../services/srService';
import { awardXP, updateStreak } from '../services/xpService';
import { z } from 'zod';
import { triggerRetrain } from './scorePrediction';
import { enrichWithPassagesAndFigures } from '../services/questionEnricher';
import { pushBadgeEarned } from '../services/pushService';

const router = Router();

// GET /api/quiz/history  — must be before /:sessionId
router.get('/history', authGuard, requireRole(['student']), (req, res) => {
  const sessions = db.select({
    id: schema.quizSessions.id,
    mode: schema.quizSessions.mode,
    topicKey: schema.quizSessions.topicKey,
    status: schema.quizSessions.status,
    questionCountTarget: schema.quizSessions.questionCountTarget,
    questionCountActual: schema.quizSessions.questionCountActual,
    correctCount: schema.quizSessions.correctCount,
    scorePct: schema.quizSessions.scorePct,
    startedAt: schema.quizSessions.startedAt,
    completedAt: schema.quizSessions.completedAt,
  }).from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.studentId, req.user!.id),
      eq(schema.quizSessions.status, 'completed'),
    ))
    .all()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 50);

  res.json(sessions);
});

const startSchema = z.object({
  mode: z.enum(['practice', 'timed_quiz', 'sr_drill']),
  topicKey: z.string().optional(),
  questionCount: z.number().int().min(5).max(50).default(20),
});

// POST /api/quiz/start
router.post('/start', authGuard, requireRole(['student']), (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { mode, topicKey, questionCount } = parsed.data;

  // Select approved questions
  let query = db.select({
    id: schema.questions.id,
    questionText: schema.questions.questionText,
    questionType: schema.questions.questionType,
    choiceA: schema.questions.choiceA,
    choiceB: schema.questions.choiceB,
    choiceC: schema.questions.choiceC,
    choiceD: schema.questions.choiceD,
    topicKey: schema.questions.topicKey,
    difficulty: schema.questions.difficulty,
    passageId: schema.questions.passageId,
  }).from(schema.questions).where(eq(schema.questions.status, 'approved'));

  const allQuestions = query.all();

  let pool = topicKey
    ? allQuestions.filter(q => q.topicKey === topicKey)
    : allQuestions;

  if (pool.length === 0) {
    return res.status(422).json({ error: 'No approved questions available for this selection' });
  }

  // Shuffle and take questionCount
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, questionCount);

  const timeLimitSeconds = mode === 'timed_quiz'
    ? shuffled.length * 75   // 75 seconds per question for timed mode
    : undefined;

  const session = db.insert(schema.quizSessions).values({
    studentId: req.user!.id,
    mode,
    topicKey: topicKey || null,
    status: 'in_progress',
    questionCountTarget: shuffled.length,
    timeLimitSeconds: timeLimitSeconds || null,
  }).run();

  const sessionId = Number(session.lastInsertRowid);

  // Insert placeholder attempts (one per question in order)
  for (const q of shuffled) {
    db.insert(schema.quizQuestionAttempts).values({
      sessionId,
      questionId: q.id,
    }).run();
  }

  res.status(201).json({
    sessionId,
    questions: enrichWithPassagesAndFigures(shuffled),
    timeLimitSeconds,
    questionCount: shuffled.length,
  });
});

// GET /api/quiz/:sessionId
router.get('/:sessionId', authGuard, requireRole(['student']), (req, res) => {
  const sessionId = parseInt(req.params.sessionId);

  const session = db.select().from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.id, sessionId),
      eq(schema.quizSessions.studentId, req.user!.id),
    )).get();

  if (!session) return res.status(404).json({ error: 'Session not found' });

  const attempts = db.select({
    id: schema.quizQuestionAttempts.id,
    questionId: schema.quizQuestionAttempts.questionId,
    studentAnswer: schema.quizQuestionAttempts.studentAnswer,
    isCorrect: schema.quizQuestionAttempts.isCorrect,
    flaggedForReview: schema.quizQuestionAttempts.flaggedForReview,
  }).from(schema.quizQuestionAttempts)
    .where(eq(schema.quizQuestionAttempts.sessionId, sessionId))
    .all();

  res.json({ session, attempts });
});

const submitAnswerSchema = z.object({
  questionId: z.number().int(),
  answer: z.string(),
  flagged: z.boolean().optional(),
  timeSpentSeconds: z.number().int().optional(),
});

// POST /api/quiz/:sessionId/answer
router.post('/:sessionId/answer', authGuard, requireRole(['student']), (req, res) => {
  const sessionId = parseInt(req.params.sessionId);
  const parsed = submitAnswerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const session = db.select().from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.id, sessionId),
      eq(schema.quizSessions.studentId, req.user!.id),
    )).get();

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session already completed' });

  const question = db.select().from(schema.questions)
    .where(eq(schema.questions.id, parsed.data.questionId)).get();

  if (!question) return res.status(404).json({ error: 'Question not found' });

  const isCorrect = question.correctAnswer.toLowerCase() === parsed.data.answer.toLowerCase();

  db.update(schema.quizQuestionAttempts)
    .set({
      studentAnswer: parsed.data.answer,
      isCorrect,
      flaggedForReview: parsed.data.flagged ?? false,
      timeSpentSeconds: parsed.data.timeSpentSeconds,
      answeredAt: new Date().toISOString(),
    })
    .where(and(
      eq(schema.quizQuestionAttempts.sessionId, sessionId),
      eq(schema.quizQuestionAttempts.questionId, parsed.data.questionId),
    ))
    .run();

  // Update question aggregate stats
  db.update(schema.questions)
    .set({
      attemptCount: (question.attemptCount ?? 0) + 1,
      correctCount: (question.correctCount ?? 0) + (isCorrect ? 1 : 0),
    })
    .where(eq(schema.questions.id, question.id))
    .run();

  res.json({ isCorrect, correctAnswer: question.correctAnswer, explanation: question.explanation });
});

// POST /api/quiz/:sessionId/complete
router.post('/:sessionId/complete', authGuard, requireRole(['student']), (req, res) => {
  const sessionId = parseInt(req.params.sessionId);
  const { timeSpentSeconds } = req.body;

  const session = db.select().from(schema.quizSessions)
    .where(and(
      eq(schema.quizSessions.id, sessionId),
      eq(schema.quizSessions.studentId, req.user!.id),
    )).get();

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session already completed' });

  const attempts = db.select().from(schema.quizQuestionAttempts)
    .where(eq(schema.quizQuestionAttempts.sessionId, sessionId))
    .all();

  const answered = attempts.filter(a => a.studentAnswer !== null);
  const correct = attempts.filter(a => a.isCorrect === true);
  const scorePct = answered.length > 0 ? (correct.length / attempts.length) * 100 : 0;

  db.update(schema.quizSessions)
    .set({
      status: 'completed',
      questionCountActual: answered.length,
      correctCount: correct.length,
      scorePct,
      timeSpentSeconds: timeSpentSeconds || null,
      completedAt: new Date().toISOString(),
    })
    .where(eq(schema.quizSessions.id, sessionId))
    .run();

  // Update SR records for all answered questions
  for (const attempt of answered) {
    const quality = attempt.isCorrect
      ? (attempt.flaggedForReview ? 3 : 5)
      : 0;
    updateSR(session.studentId, attempt.questionId!, quality as 0 | 3 | 5);
  }

  // Award XP
  const studentId = req.user!.id;
  for (const attempt of answered) {
    awardXP(studentId, 'quiz_question_answered');
    if (attempt.isCorrect) awardXP(studentId, 'quiz_question_correct');
  }
  if (session.mode === 'timed_quiz') {
    for (let i = 0; i < correct.length; i++) {
      awardXP(studentId, 'timed_quiz_bonus');
    }
  }
  updateStreak(studentId);

  // Check for perfect score badge
  if (attempts.length >= 20 && correct.length === attempts.length) {
    try {
      db.insert(schema.studentBadges)
        .values({ studentId, badgeKey: 'perfect_score' })
        .run();
      pushBadgeEarned(studentId, 'Perfect Score').catch(() => {});
    } catch { /* already earned */ }
  }

  // Return results with per-question breakdown
  const questionsById = new Map(
    db.select().from(schema.questions)
      .where(inArray(schema.questions.id, attempts.map(a => a.questionId!)))
      .all()
      .map(q => [q.id, q])
  );

  const breakdown = attempts.map(a => ({
    questionId: a.questionId,
    questionText: questionsById.get(a.questionId!)?.questionText,
    topicKey: questionsById.get(a.questionId!)?.topicKey,
    correctAnswer: questionsById.get(a.questionId!)?.correctAnswer,
    explanation: questionsById.get(a.questionId!)?.explanation,
    studentAnswer: a.studentAnswer,
    isCorrect: a.isCorrect,
    flaggedForReview: a.flaggedForReview,
    timeSpentSeconds: a.timeSpentSeconds,
  }));

  // Topic performance summary
  const topicStats: Record<string, { correct: number; total: number }> = {};
  for (const item of breakdown) {
    const key = item.topicKey || 'unknown';
    if (!topicStats[key]) topicStats[key] = { correct: 0, total: 0 };
    topicStats[key].total++;
    if (item.isCorrect) topicStats[key].correct++;
  }

  // Async ML retrain — fire and forget, does not block response
  triggerRetrain(studentId).catch(() => {});

  res.json({
    sessionId,
    totalQuestions: attempts.length,
    answered: answered.length,
    correct: correct.length,
    scorePct: Math.round(scorePct * 10) / 10,
    breakdown,
    topicStats,
  });
});

export default router;
