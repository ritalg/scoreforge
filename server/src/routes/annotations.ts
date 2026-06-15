import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['student']));

// ─── QUESTION ANNOTATIONS ─────────────────────────────────────────────────────

// GET /api/annotations?questionId=X
router.get('/', (req, res) => {
  const { questionId } = req.query;
  let annotations = db.select().from(schema.questionAnnotations)
    .where(eq(schema.questionAnnotations.studentId, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (questionId) {
    annotations = annotations.filter(a => a.questionId === parseInt(String(questionId)));
  }

  // Enrich with question text snippet
  const enriched = annotations.map(a => {
    const q = db.select({ questionText: schema.questions.questionText, topicKey: schema.questions.topicKey })
      .from(schema.questions).where(eq(schema.questions.id, a.questionId)).get();
    return { ...a, questionSnippet: q?.questionText?.slice(0, 80), topicKey: q?.topicKey };
  });

  res.json(enriched);
});

// POST /api/annotations
router.post('/', (req, res) => {
  const { questionId, startChar, endChar, noteText, tag } = req.body;
  if (!questionId || startChar == null || endChar == null) {
    return res.status(400).json({ error: 'questionId, startChar, endChar required' });
  }
  if (tag && !['confusion', 'key_insight', 'strategy_note'].includes(tag)) {
    return res.status(400).json({ error: 'Invalid tag' });
  }

  db.insert(schema.questionAnnotations).values({
    studentId: req.user!.id,
    questionId,
    startChar,
    endChar,
    noteText: noteText ?? null,
    tag: tag ?? null,
  }).run();

  const annotation = db.select().from(schema.questionAnnotations)
    .where(eq(schema.questionAnnotations.studentId, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  res.status(201).json(annotation);
});

// DELETE /api/annotations/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const ann = db.select().from(schema.questionAnnotations)
    .where(eq(schema.questionAnnotations.id, id)).get();
  if (!ann || ann.studentId !== req.user!.id) return res.status(404).json({ error: 'Not found' });
  db.delete(schema.questionAnnotations).where(eq(schema.questionAnnotations.id, id)).run();
  res.json({ message: 'Deleted' });
});

// ─── ERROR LOG ────────────────────────────────────────────────────────────────

// GET /api/annotations/error-log
router.get('/error-log', (req, res) => {
  const { topic, limit: lim = '50', page: pg = '1' } = req.query;
  const studentId = req.user!.id;
  const pageSize = Math.min(100, parseInt(String(lim)));
  const pageNum = Math.max(1, parseInt(String(pg)));

  // All wrong answers from this student's sessions
  const sessions = db.select({ id: schema.quizSessions.id })
    .from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'completed')))
    .all();

  const sessionIds = sessions.map(s => s.id);
  if (sessionIds.length === 0) return res.json({ errors: [], total: 0 });

  let wrongAttempts = db.select({
    id: schema.quizQuestionAttempts.id,
    sessionId: schema.quizQuestionAttempts.sessionId,
    questionId: schema.quizQuestionAttempts.questionId,
    studentAnswer: schema.quizQuestionAttempts.studentAnswer,
    isCorrect: schema.quizQuestionAttempts.isCorrect,
    answeredAt: schema.quizQuestionAttempts.answeredAt,
  }).from(schema.quizQuestionAttempts)
    .all()
    .filter(a => sessionIds.includes(a.sessionId) && a.isCorrect === false && a.studentAnswer !== null);

  wrongAttempts.sort((a, b) => new Date(b.answeredAt ?? '').getTime() - new Date(a.answeredAt ?? '').getTime());

  // Enrich with question + reflection note
  let enriched = wrongAttempts.map(a => {
    const q = db.select({
      questionText: schema.questions.questionText,
      correctAnswer: schema.questions.correctAnswer,
      explanation: schema.questions.explanation,
      topicKey: schema.questions.topicKey,
      difficulty: schema.questions.difficulty,
    }).from(schema.questions).where(eq(schema.questions.id, a.questionId)).get();

    const note = db.select({ id: schema.errorLogNotes.id, reflection: schema.errorLogNotes.reflection, createdAt: schema.errorLogNotes.createdAt })
      .from(schema.errorLogNotes)
      .where(and(
        eq(schema.errorLogNotes.studentId, studentId),
        eq(schema.errorLogNotes.attemptId, a.id)
      )).get();

    return { ...a, question: q ?? null, note: note ?? null };
  });

  if (topic) enriched = enriched.filter(e => e.question?.topicKey === topic);

  const total = enriched.length;
  const paginated = enriched.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  res.json({ errors: paginated, total, page: pageNum, pages: Math.ceil(total / pageSize) });
});

// POST /api/annotations/error-log/:attemptId/note
router.post('/error-log/:attemptId/note', (req, res) => {
  const attemptId = parseInt(req.params.attemptId);
  const { reflection } = req.body;
  const studentId = req.user!.id;

  // Upsert — delete existing note then insert
  const existing = db.select().from(schema.errorLogNotes)
    .where(and(eq(schema.errorLogNotes.studentId, studentId), eq(schema.errorLogNotes.attemptId, attemptId)))
    .get();

  if (existing) {
    db.update(schema.errorLogNotes).set({ reflection: reflection ?? null })
      .where(eq(schema.errorLogNotes.id, existing.id)).run();
  } else {
    db.insert(schema.errorLogNotes).values({ studentId, attemptId, reflection: reflection ?? null }).run();
  }

  res.json({ message: 'Note saved' });
});

export default router;
