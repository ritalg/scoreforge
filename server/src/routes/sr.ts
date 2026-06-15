import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { updateSR } from '../services/srService';
import { awardXP } from '../services/xpService';
import { z } from 'zod';
import { enrichWithPassagesAndFigures } from '../services/questionEnricher';
import { pushStudyReminder, pushStreakAtRisk } from '../services/pushService';

const router = Router();

// GET /api/sr/due  – questions due for review today
router.get('/due', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;
  const now = new Date().toISOString();

  const due = db.select({
    srId: schema.spacedRepetitionRecords.id,
    questionId: schema.spacedRepetitionRecords.questionId,
    nextReviewAt: schema.spacedRepetitionRecords.nextReviewAt,
    intervalDays: schema.spacedRepetitionRecords.intervalDays,
    easeFactor: schema.spacedRepetitionRecords.easeFactor,
    repetitionCount: schema.spacedRepetitionRecords.repetitionCount,
    lastQuality: schema.spacedRepetitionRecords.lastQuality,
  })
    .from(schema.spacedRepetitionRecords)
    .where(and(
      eq(schema.spacedRepetitionRecords.studentId, studentId),
      lte(schema.spacedRepetitionRecords.nextReviewAt, now),
    ))
    .all();

  // Get question details
  const questionDetails = db.select({
    id: schema.questions.id,
    questionText: schema.questions.questionText,
    questionType: schema.questions.questionType,
    choiceA: schema.questions.choiceA,
    choiceB: schema.questions.choiceB,
    choiceC: schema.questions.choiceC,
    choiceD: schema.questions.choiceD,
    correctAnswer: schema.questions.correctAnswer,
    explanation: schema.questions.explanation,
    topicKey: schema.questions.topicKey,
    difficulty: schema.questions.difficulty,
    passageId: schema.questions.passageId,
  }).from(schema.questions)
    .where(inArray(schema.questions.id, due.map(r => r.questionId!)))
    .all();

  const enrichedQuestions = enrichWithPassagesAndFigures(questionDetails);
  const qMap = new Map(enrichedQuestions.map(q => [q.id, q]));

  const enriched = due.map(r => ({
    ...r,
    question: qMap.get(r.questionId!) ?? undefined,
  })).filter(r => r.question !== undefined);

  res.json(enriched);
});

// GET /api/sr/stats
router.get('/stats', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;
  const now = new Date().toISOString();

  const all = db.select({
    nextReviewAt: schema.spacedRepetitionRecords.nextReviewAt,
    easeFactor: schema.spacedRepetitionRecords.easeFactor,
    repetitionCount: schema.spacedRepetitionRecords.repetitionCount,
  })
    .from(schema.spacedRepetitionRecords)
    .where(eq(schema.spacedRepetitionRecords.studentId, studentId))
    .all();

  const due = all.filter(r => r.nextReviewAt <= now).length;
  const mastered = all.filter(r => (r.easeFactor ?? 0) >= 2.5 && (r.repetitionCount ?? 0) >= 3).length;

  res.json({
    total: all.length,
    due,
    mastered,
    new: 0,
  });
});

const reviewSchema = z.object({
  questionId: z.number().int(),
  quality: z.union([z.literal(0), z.literal(3), z.literal(5)]),
});

// POST /api/sr/review
router.post('/review', authGuard, requireRole(['student']), (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const studentId = req.user!.id;
  const { questionId, quality } = parsed.data;

  const result = updateSR(studentId, questionId, quality);

  if (quality >= 3) {
    awardXP(studentId, 'sr_drill_correct');
  }

  // Fire-and-forget: check streak risk after review session ends
  setImmediate(() => {
    try {
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const still_due = db.select({ id: schema.spacedRepetitionRecords.id })
        .from(schema.spacedRepetitionRecords)
        .where(and(
          eq(schema.spacedRepetitionRecords.studentId, studentId),
          lte(schema.spacedRepetitionRecords.nextReviewAt, now),
        ))
        .all().length;
      if (still_due > 0) {
        pushStudyReminder(studentId, still_due).catch(() => {});
      }
      // Check streak — if no quiz session today, streak is at risk
      const todaySessions = db.select({ id: schema.quizSessions.id, startedAt: schema.quizSessions.startedAt })
        .from(schema.quizSessions)
        .where(eq(schema.quizSessions.studentId, studentId))
        .all()
        .filter(s => s.startedAt.startsWith(today));
      if (todaySessions.length === 0) {
        const streak = db.select({ currentStreak: schema.streakRecords.currentStreak })
          .from(schema.streakRecords)
          .where(eq(schema.streakRecords.studentId, studentId))
          .get();
        if ((streak?.currentStreak ?? 0) > 0) {
          pushStreakAtRisk(studentId, streak!.currentStreak).catch(() => {});
        }
      }
    } catch {}
  });

  res.json({ ...result, xpEarned: quality >= 3 ? 3 : 0 });
});

export default router;
