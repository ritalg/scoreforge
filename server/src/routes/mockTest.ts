import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { awardXP } from '../services/xpService';
import { updateSR } from '../services/srService';
import { triggerRetrain } from './scorePrediction';

const router = Router();
router.use(authGuard, requireRole(['student']));

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function pickQuestions(module: 'm1' | 'm2_hard' | 'm2_easy', section: 'math' | 'rw', count: number) {
  const sectionTopics = section === 'math'
    ? ['algebra', 'advanced_math', 'problem_solving', 'geometry']
    : ['craft_structure', 'information_ideas', 'expression_ideas', 'standard_english'];

  const pool = db.select().from(schema.questions)
    .where(and(
      eq(schema.questions.status, 'approved'),
      eq(schema.questions.module, module)
    ))
    .all()
    .filter(q => q.topicKey && sectionTopics.some(t => q.topicKey!.startsWith(t)));

  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function createQuizSessionForModule(
  studentId: number,
  questions: typeof schema.questions.$inferSelect[],
  timeLimitSeconds: number,
  mockModule: string
) {
  db.insert(schema.quizSessions).values({
    studentId,
    mode: 'adaptive',
    status: 'in_progress',
    questionCountTarget: questions.length,
    timeLimitSeconds,
  }).run();

  const session = db.select().from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'in_progress')))
    .all()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  for (let i = 0; i < questions.length; i++) {
    db.insert(schema.quizQuestionAttempts).values({
      sessionId: session.id,
      questionId: questions[i].id,
    }).run();
  }

  return session;
}

function applyScalingTable(rawScore: number, section: 'math' | 'rw', testName?: string): number {
  const rows = db.select().from(schema.scoringTables)
    .where(eq(schema.scoringTables.section, section))
    .all()
    .filter(r => !testName || r.testName === testName)
    .sort((a, b) => a.rawScore - b.rawScore);

  if (rows.length === 0) {
    // Fallback linear approximation: math 200–800, raw 0–54
    const max = section === 'math' ? 54 : 54;
    return Math.round(200 + (rawScore / max) * 600);
  }

  const exact = rows.find(r => r.rawScore === rawScore);
  if (exact) return exact.scaledScore;

  // Interpolate
  const below = rows.filter(r => r.rawScore <= rawScore).at(-1);
  const above = rows.find(r => r.rawScore > rawScore);
  if (!below) return rows[0].scaledScore;
  if (!above) return rows[rows.length - 1].scaledScore;

  const t = (rawScore - below.rawScore) / (above.rawScore - below.rawScore);
  return Math.round(below.scaledScore + t * (above.scaledScore - below.scaledScore));
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// POST /api/mock-test/start
router.post('/start', (req, res) => {
  const { sections = 'both' } = req.body; // 'math' | 'rw' | 'both'
  const studentId = req.user!.id;

  // Abandon any existing in-progress mock tests
  const existing = db.select().from(schema.mockTestSessions)
    .where(and(eq(schema.mockTestSessions.studentId, studentId), eq(schema.mockTestSessions.status, 'in_progress')))
    .all();
  for (const e of existing) {
    db.update(schema.mockTestSessions).set({ status: 'abandoned' }).where(eq(schema.mockTestSessions.id, e.id)).run();
  }

  let m1MathSessionId: number | null = null;
  let m1RwSessionId: number | null = null;

  if (sections === 'math' || sections === 'both') {
    const qs = pickQuestions('m1', 'math', 27);
    if (qs.length < 10) return res.status(400).json({ error: 'Not enough approved math questions in the bank yet' });
    const s = createQuizSessionForModule(studentId, qs, 35 * 60, 'm1_math');
    m1MathSessionId = s.id;
  }

  if (sections === 'rw' || sections === 'both') {
    const qs = pickQuestions('m1', 'rw', 27);
    if (qs.length < 10) return res.status(400).json({ error: 'Not enough approved R&W questions in the bank yet' });
    const s = createQuizSessionForModule(studentId, qs, 32 * 60, 'm1_rw');
    m1RwSessionId = s.id;
  }

  db.insert(schema.mockTestSessions).values({
    studentId,
    sections,
    m1MathSessionId,
    m1RwSessionId,
    status: 'in_progress',
  }).run();

  const mockTest = db.select().from(schema.mockTestSessions)
    .where(and(eq(schema.mockTestSessions.studentId, studentId), eq(schema.mockTestSessions.status, 'in_progress')))
    .all()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  res.status(201).json({ mockTestId: mockTest.id, m1MathSessionId, m1RwSessionId });
});

// GET /api/mock-test/:id
router.get('/:id', (req, res) => {
  const mockTest = db.select().from(schema.mockTestSessions)
    .where(and(
      eq(schema.mockTestSessions.id, parseInt(req.params.id)),
      eq(schema.mockTestSessions.studentId, req.user!.id)
    )).get();
  if (!mockTest) return res.status(404).json({ error: 'Not found' });

  function getSessionWithAttempts(sid: number | null) {
    if (!sid) return null;
    const s = db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, sid)).get();
    if (!s) return null;
    const attempts = db.select({
      id: schema.quizQuestionAttempts.id,
      questionId: schema.quizQuestionAttempts.questionId,
      studentAnswer: schema.quizQuestionAttempts.studentAnswer,
      isCorrect: schema.quizQuestionAttempts.isCorrect,
      flaggedForReview: schema.quizQuestionAttempts.flaggedForReview,
      timeSpentSeconds: schema.quizQuestionAttempts.timeSpentSeconds,
    }).from(schema.quizQuestionAttempts)
      .where(eq(schema.quizQuestionAttempts.sessionId, sid))
      .all();

    const questionIds = attempts.map(a => a.questionId);
    const questions = questionIds.length > 0
      ? db.select({
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
          passageId: schema.questions.passageId,
        }).from(schema.questions)
          .all()
          .filter(q => questionIds.includes(q.id))
      : [];

    const passageIds = [...new Set(questions.filter(q => q.passageId).map(q => q.passageId!))];
    const passages = passageIds.length > 0
      ? db.select().from(schema.passages).all().filter(p => passageIds.includes(p.id))
      : [];

    return { session: s, attempts, questions, passages };
  }

  res.json({
    mockTest,
    m1Math: getSessionWithAttempts(mockTest.m1MathSessionId),
    m1Rw: getSessionWithAttempts(mockTest.m1RwSessionId),
    m2Math: getSessionWithAttempts(mockTest.m2MathSessionId),
    m2Rw: getSessionWithAttempts(mockTest.m2RwSessionId),
  });
});

// POST /api/mock-test/:id/answer  — proxy to submit individual answers
router.post('/:id/answer', (req, res) => {
  const { sessionId, attemptId, selectedAnswer, timeSpentSeconds } = req.body;
  if (!sessionId || !attemptId || !selectedAnswer) {
    return res.status(400).json({ error: 'sessionId, attemptId, selectedAnswer required' });
  }

  const attempt = db.select().from(schema.quizQuestionAttempts)
    .where(and(
      eq(schema.quizQuestionAttempts.id, attemptId),
      eq(schema.quizQuestionAttempts.sessionId, sessionId)
    )).get();
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

  const q = db.select().from(schema.questions).where(eq(schema.questions.id, attempt.questionId)).get()!;
  const isCorrect = selectedAnswer.toUpperCase() === q.correctAnswer.toUpperCase();

  db.update(schema.quizQuestionAttempts).set({
    studentAnswer: selectedAnswer,
    isCorrect,
    timeSpentSeconds: timeSpentSeconds ?? null,
    answeredAt: new Date().toISOString(),
  }).where(eq(schema.quizQuestionAttempts.id, attemptId)).run();

  res.json({ isCorrect });
});

// POST /api/mock-test/:id/submit-module  — complete a module, get M2 if needed
router.post('/:id/submit-module', (req, res) => {
  const { module: moduleKey } = req.body; // 'm1_math' | 'm1_rw'
  const studentId = req.user!.id;

  const mockTest = db.select().from(schema.mockTestSessions)
    .where(and(
      eq(schema.mockTestSessions.id, parseInt(req.params.id)),
      eq(schema.mockTestSessions.studentId, studentId)
    )).get();
  if (!mockTest) return res.status(404).json({ error: 'Not found' });

  const isMath = moduleKey === 'm1_math';
  const m1SessionId = isMath ? mockTest.m1MathSessionId : mockTest.m1RwSessionId;
  if (!m1SessionId) return res.status(400).json({ error: 'Module not started' });

  // Complete the M1 session
  const attempts = db.select().from(schema.quizQuestionAttempts)
    .where(eq(schema.quizQuestionAttempts.sessionId, m1SessionId)).all();
  const correct = attempts.filter(a => a.isCorrect).length;
  const total = attempts.length;
  const pct = total > 0 ? correct / total : 0;

  db.update(schema.quizSessions).set({
    status: 'completed',
    correctCount: correct,
    questionCountActual: total,
    scorePct: pct * 100,
    completedAt: new Date().toISOString(),
  }).where(eq(schema.quizSessions.id, m1SessionId)).run();

  // Adaptive routing: ≥70% → hard, else easy/medium
  const m2Level = pct >= 0.7 ? 'hard' : 'easy_medium';
  const m2Module: 'm2_hard' | 'm2_easy' = m2Level === 'hard' ? 'm2_hard' : 'm2_easy';
  const section = isMath ? 'math' : 'rw';
  const timeLimit = isMath ? 35 * 60 : 32 * 60;

  const m2Questions = pickQuestions(m2Module, section, 27);
  if (m2Questions.length < 5) {
    // Not enough M2 questions — skip M2
    const update: Record<string, string | number | null> = {};
    if (isMath) { update.mathModule2Level = m2Level; update.rawMathScore = correct; }
    else { update.rwModule2Level = m2Level; update.rawRwScore = correct; }
    db.update(schema.mockTestSessions).set(update as any).where(eq(schema.mockTestSessions.id, mockTest.id)).run();
    return res.json({ m2SessionId: null, m2Level, m1Correct: correct, m1Total: total, m1Pct: pct });
  }

  const m2Session = createQuizSessionForModule(studentId, m2Questions, timeLimit, `m2_${section}`);

  const update: Record<string, string | number | null> = {};
  if (isMath) { update.m2MathSessionId = m2Session.id; update.mathModule2Level = m2Level; }
  else { update.m2RwSessionId = m2Session.id; update.rwModule2Level = m2Level; }
  db.update(schema.mockTestSessions).set(update as any).where(eq(schema.mockTestSessions.id, mockTest.id)).run();

  res.json({ m2SessionId: m2Session.id, m2Level, m1Correct: correct, m1Total: total, m1Pct: pct });
});

// POST /api/mock-test/:id/complete
router.post('/:id/complete', async (req, res) => {
  const studentId = req.user!.id;
  const mockTest = db.select().from(schema.mockTestSessions)
    .where(and(
      eq(schema.mockTestSessions.id, parseInt(req.params.id)),
      eq(schema.mockTestSessions.studentId, studentId)
    )).get();
  if (!mockTest) return res.status(404).json({ error: 'Not found' });

  // Complete any outstanding M2 sessions
  for (const sid of [mockTest.m2MathSessionId, mockTest.m2RwSessionId]) {
    if (!sid) continue;
    const s = db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, sid)).get();
    if (s && s.status === 'in_progress') {
      const attempts = db.select().from(schema.quizQuestionAttempts)
        .where(eq(schema.quizQuestionAttempts.sessionId, sid)).all();
      const correct = attempts.filter(a => a.isCorrect).length;
      db.update(schema.quizSessions).set({
        status: 'completed',
        correctCount: correct,
        questionCountActual: attempts.length,
        scorePct: attempts.length > 0 ? (correct / attempts.length) * 100 : 0,
        completedAt: new Date().toISOString(),
      }).where(eq(schema.quizSessions.id, sid)).run();
    }
  }

  // Compute raw scores: M1 correct + M2 correct
  function rawScore(m1sid: number | null, m2sid: number | null) {
    let total = 0;
    for (const sid of [m1sid, m2sid]) {
      if (!sid) continue;
      const att = db.select().from(schema.quizQuestionAttempts)
        .where(eq(schema.quizQuestionAttempts.sessionId, sid)).all();
      total += att.filter(a => a.isCorrect).length;
    }
    return total;
  }

  const rawMath = (mockTest.sections === 'math' || mockTest.sections === 'both')
    ? rawScore(mockTest.m1MathSessionId, mockTest.m2MathSessionId) : null;
  const rawRw = (mockTest.sections === 'rw' || mockTest.sections === 'both')
    ? rawScore(mockTest.m1RwSessionId, mockTest.m2RwSessionId) : null;

  const scaledMath = rawMath != null ? applyScalingTable(rawMath, 'math') : null;
  const scaledRw = rawRw != null ? applyScalingTable(rawRw, 'rw') : null;
  const composite = scaledMath != null && scaledRw != null
    ? scaledMath + scaledRw
    : scaledMath ?? scaledRw ?? null;

  db.update(schema.mockTestSessions).set({
    status: 'completed',
    rawMathScore: rawMath,
    rawRwScore: rawRw,
    scaledMathScore: scaledMath,
    scaledRwScore: scaledRw,
    compositeScore: composite,
    completedAt: new Date().toISOString(),
  }).where(eq(schema.mockTestSessions.id, mockTest.id)).run();

  // Award XP for completing a full mock test
  awardXP(studentId, 'mock_test_complete');

  // Run SR for all answered questions
  const allSids = [mockTest.m1MathSessionId, mockTest.m2MathSessionId, mockTest.m1RwSessionId, mockTest.m2RwSessionId].filter(Boolean) as number[];
  for (const sid of allSids) {
    const att = db.select().from(schema.quizQuestionAttempts)
      .where(eq(schema.quizQuestionAttempts.sessionId, sid)).all();
    for (const a of att) {
      if (a.isCorrect !== null) {
        updateSR(studentId, a.questionId, a.isCorrect ? 5 : 0);
      }
    }
  }

  // Async ML retrain — fire and forget
  triggerRetrain(studentId).catch(() => {});

  res.json({ rawMath, rawRw, scaledMath, scaledRw, composite });
});

// GET /api/mock-test/history — all completed mock tests
router.get('/history/list', (req, res) => {
  const tests = db.select().from(schema.mockTestSessions)
    .where(eq(schema.mockTestSessions.studentId, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  res.json(tests);
});

export default router;
