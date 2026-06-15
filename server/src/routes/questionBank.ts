import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth';
import { searchQuestions } from '../services/searchService';
import { enrichWithPassagesAndFigures } from '../services/questionEnricher';

const router = Router();
router.use(authGuard);

// GET /api/question-bank — browse approved questions
router.get('/', async (req, res) => {
  const { topic, difficulty, module: mod, search, page = '1', limit = '30' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page)));
  const pageSize = Math.min(100, parseInt(String(limit)));

  let questions = db.select({
    id: schema.questions.id,
    questionNumber: schema.questions.questionNumber,
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
    module: schema.questions.module,
    attemptCount: schema.questions.attemptCount,
    correctCount: schema.questions.correctCount,
    passageId: schema.questions.passageId,
  }).from(schema.questions)
    .where(eq(schema.questions.status, 'approved'))
    .all();

  if (topic) questions = questions.filter(q => q.topicKey === topic);
  if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);
  if (mod) questions = questions.filter(q => q.module === mod);

  if (search) {
    // Try MeiliSearch first; fall back to SQLite LIKE if unavailable
    const msHits = await searchQuestions(String(search), {
      topicKey: topic ? String(topic) : undefined,
      difficulty: difficulty ? String(difficulty) : undefined,
      module: mod ? String(mod) : undefined,
      status: 'approved',
    });
    if (msHits) {
      const hitIds = new Set(msHits.map(h => h.id));
      questions = questions.filter(q => hitIds.has(q.id));
    } else {
      const s = String(search).toLowerCase();
      questions = questions.filter(q =>
        q.questionText.toLowerCase().includes(s) ||
        (q.explanation ?? '').toLowerCase().includes(s)
      );
    }
  }

  const total = questions.length;
  const paginated = questions.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  // Batch-enrich with passages and figures
  const withMedia = enrichWithPassagesAndFigures(paginated);

  // Attach SR records per student
  const studentId = req.user!.id;
  const enriched = withMedia.map(q => {
    const srRecord = db.select({
      intervalDays: schema.spacedRepetitionRecords.intervalDays,
      easeFactor: schema.spacedRepetitionRecords.easeFactor,
      repetitionCount: schema.spacedRepetitionRecords.repetitionCount,
      nextReviewAt: schema.spacedRepetitionRecords.nextReviewAt,
    }).from(schema.spacedRepetitionRecords)
      .where(and(
        eq(schema.spacedRepetitionRecords.studentId, studentId),
        eq(schema.spacedRepetitionRecords.questionId, q.id)
      )).get();

    return {
      ...q,
      sr: srRecord ?? null,
      empiricalDifficulty: (q.attemptCount ?? 0) > 0
        ? Math.round((1 - (q.correctCount ?? 0) / q.attemptCount!) * 100)
        : null,
    };
  });

  res.json({ questions: enriched, total, page: pageNum, pageSize, pages: Math.ceil(total / pageSize) });
});

// GET /api/question-bank/topics — question counts by topic
router.get('/topics', (req, res) => {
  const questions = db.select({ topicKey: schema.questions.topicKey })
    .from(schema.questions)
    .where(eq(schema.questions.status, 'approved'))
    .all();

  const counts: Record<string, number> = {};
  for (const q of questions) {
    if (q.topicKey) counts[q.topicKey] = (counts[q.topicKey] ?? 0) + 1;
  }

  res.json(counts);
});

export default router;
