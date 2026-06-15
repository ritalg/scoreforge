import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { MATH_TOPICS, RW_TOPICS } from '@scoreforge/shared';
import { mlPredict, mlRetrain, mlFeatureImportance } from '../services/mlClient';

const router = Router();
router.use(authGuard, requireRole(['student']));

// ── Feature extraction ────────────────────────────────────────────────────────

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const ssxy = xs.reduce((acc, x, i) => acc + (x - meanX) * (ys[i] - meanY), 0);
  const ssxx = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
  if (ssxx === 0) return { slope: 0, intercept: meanY, r2: 0 };
  const slope = ssxy / ssxx;
  const intercept = meanY - slope * meanX;
  const ssres = ys.reduce((acc, y, i) => acc + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const sstot = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const r2 = sstot === 0 ? 1 : 1 - ssres / sstot;
  return { slope, intercept, r2 };
}

interface FeatureVector {
  [key: string]: number | { sessionCount: number; mockCount: number };
  _meta: { sessionCount: number; mockCount: number };
}

export function buildFeatureVector(studentId: number): FeatureVector {
  const sessions = db.select({
    id: schema.quizSessions.id,
    topicKey: schema.quizSessions.topicKey,
    scorePct: schema.quizSessions.scorePct,
    completedAt: schema.quizSessions.completedAt,
  }).from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'completed')))
    .all()
    .filter(s => s.scorePct !== null && s.completedAt !== null)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

  const mockTests = db.select().from(schema.mockTestSessions)
    .where(and(eq(schema.mockTestSessions.studentId, studentId), eq(schema.mockTestSessions.status, 'completed')))
    .all()
    .filter(m => m.compositeScore !== null)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

  const srRecords = db.select().from(schema.spacedRepetitionRecords)
    .where(eq(schema.spacedRepetitionRecords.studentId, studentId)).all();
  const srMasteryRate = srRecords.length > 0
    ? srRecords.filter(r => (r.easeFactor ?? 0) >= 2.5 && r.repetitionCount >= 3).length / srRecords.length
    : 0;

  // Per-topic accuracy
  const topicAccuracy: Record<string, { correct: number; total: number }> = {};
  for (const sess of sessions) {
    if (!sess.topicKey) continue;
    const attempts = db.select({ isCorrect: schema.quizQuestionAttempts.isCorrect })
      .from(schema.quizQuestionAttempts)
      .where(eq(schema.quizQuestionAttempts.sessionId, sess.id))
      .all().filter(a => a.isCorrect !== null);
    for (const a of attempts) {
      if (!topicAccuracy[sess.topicKey]) topicAccuracy[sess.topicKey] = { correct: 0, total: 0 };
      topicAccuracy[sess.topicKey].total++;
      if (a.isCorrect) topicAccuracy[sess.topicKey].correct++;
    }
  }

  const topicAcc = (key: string) =>
    topicAccuracy[key] && topicAccuracy[key].total > 0
      ? topicAccuracy[key].correct / topicAccuracy[key].total
      : 0.5;

  // Score trend slope from last 10 sessions
  const scoreSessions = sessions.filter(s => s.scorePct !== null).slice(-10);
  const trendSlope = scoreSessions.length >= 2
    ? linearRegression(scoreSessions.map((_, i) => i), scoreSessions.map(s => s.scorePct!)).slope
    : 0;

  // Mock test composite scores for avg
  const avgComposite = mockTests.length > 0
    ? mockTests.reduce((sum, m) => sum + (m.compositeScore ?? 0), 0) / mockTests.length
    : 1000;

  // Study hours (last 4 weeks, approximated as sessions * 0.25 hours)
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentSessions = sessions.filter(s => s.completedAt! >= fourWeeksAgo);
  const weeklyHours = (recentSessions.length * 15) / 60; // 15 min/session estimate

  // Days until test (from target calendar entry; prefer SAT official date, fall back to custom)
  const targetEntry = db.select({
    satTestDateId: schema.studentTestCalendar.satTestDateId,
    customDate: schema.studentTestCalendar.customDate,
  }).from(schema.studentTestCalendar)
    .where(and(eq(schema.studentTestCalendar.studentId, studentId), eq(schema.studentTestCalendar.isTarget, true)))
    .get();
  let resolvedDate: string | null = null;
  if (targetEntry?.satTestDateId) {
    const satDate = db.select({ testDate: schema.satTestDates.testDate })
      .from(schema.satTestDates).where(eq(schema.satTestDates.id, targetEntry.satTestDateId)).get();
    resolvedDate = satDate?.testDate ?? null;
  } else if (targetEntry?.customDate) {
    resolvedDate = targetEntry.customDate;
  }
  const daysUntilTest = resolvedDate
    ? Math.max(0, Math.ceil((new Date(resolvedDate).getTime() - Date.now()) / 86400000))
    : 60;

  return {
    algebra_acc: topicAcc('algebra'),
    adv_math_acc: topicAcc('advanced_math'),
    psda_acc: topicAcc('problem_solving'),
    geometry_acc: topicAcc('geometry'),
    info_ideas_acc: topicAcc('info_ideas'),
    craft_structure_acc: topicAcc('craft_structure'),
    expression_acc: topicAcc('expression_ideas'),
    conventions_acc: topicAcc('standard_english'),
    weekly_hours: weeklyHours,
    sr_mastery_rate: srMasteryRate,
    days_until_test: daysUntilTest,
    quiz_count: sessions.length,
    mock_test_count: mockTests.length,
    score_trend_slope: trendSlope,
    avg_composite: avgComposite,
    _meta: { sessionCount: sessions.length, mockCount: mockTests.length },
  };
}

// ── In-process fallback (no ML service) ─────────────────────────────────────

function inProcessPrediction(studentId: number, features: { _meta: { sessionCount: number; mockCount: number }; [k: string]: any }) {
  const { sessionCount, mockCount } = features._meta;

  const sessions = db.select({
    id: schema.quizSessions.id,
    mode: schema.quizSessions.mode,
    completedAt: schema.quizSessions.completedAt,
  }).from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, 'completed')))
    .all().filter(s => s.completedAt !== null)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

  const mockTests = db.select().from(schema.mockTestSessions)
    .where(and(eq(schema.mockTestSessions.studentId, studentId), eq(schema.mockTestSessions.status, 'completed')))
    .all().filter(m => m.compositeScore !== null)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

  const srRecords = db.select().from(schema.spacedRepetitionRecords)
    .where(eq(schema.spacedRepetitionRecords.studentId, studentId)).all();
  const srMasteryRate = srRecords.length > 0
    ? srRecords.filter(r => (r.easeFactor ?? 0) >= 2.5 && r.repetitionCount >= 3).length / srRecords.length
    : 0;

  const mathAccuracies = (MATH_TOPICS as string[]).map(t => {
    const key = t === 'advanced_math' ? 'adv_math_acc' : t === 'problem_solving' ? 'psda_acc' : `${t}_acc`;
    const v = (features as any)[key];
    return v !== undefined ? v : null;
  }).filter((v): v is number => v !== null && v !== 0.5);

  const rwAccuracies = (RW_TOPICS as string[]).map(t => {
    const key = t === 'expression_ideas' ? 'expression_acc' : t === 'standard_english' ? 'conventions_acc'
      : t === 'info_ideas' ? 'info_ideas_acc' : t === 'craft_structure' ? 'craft_structure_acc' : null;
    if (!key) return null;
    const v = (features as any)[key];
    return v !== undefined ? v : null;
  }).filter((v): v is number => v !== null && v !== 0.5);

  const avgMathAcc = mathAccuracies.length > 0 ? mathAccuracies.reduce((a, b) => a + b) / mathAccuracies.length : null;
  const avgRwAcc = rwAccuracies.length > 0 ? rwAccuracies.reduce((a, b) => a + b) / rwAccuracies.length : null;
  const accToScore = (acc: number) => Math.round(200 + acc * 600);

  let predictedMath: number | null = null;
  let predictedRw: number | null = null;
  let modelVersion = 'average';
  let confidenceInterval = 80;

  if (mockCount >= 2) {
    const mathScores = mockTests.map(m => m.scaledMathScore).filter((s): s is number => s !== null);
    const rwScores = mockTests.map(m => m.scaledRwScore).filter((s): s is number => s !== null);
    if (mathScores.length >= 2) {
      const reg = linearRegression(mathScores.map((_, i) => i), mathScores);
      predictedMath = Math.min(800, Math.max(200, Math.round(reg.slope * mathScores.length + reg.intercept)));
      confidenceInterval = Math.max(20, Math.round(60 * (1 - reg.r2)));
      modelVersion = 'linear_regression';
    } else predictedMath = mathScores[0] ?? null;
    if (rwScores.length >= 2) {
      const reg = linearRegression(rwScores.map((_, i) => i), rwScores);
      predictedRw = Math.min(800, Math.max(200, Math.round(reg.slope * rwScores.length + reg.intercept)));
      modelVersion = 'linear_regression';
    } else predictedRw = rwScores[0] ?? null;
  } else if (mockCount === 1) {
    predictedMath = mockTests[0].scaledMathScore; predictedRw = mockTests[0].scaledRwScore;
    confidenceInterval = 70; modelVersion = 'single_mock';
  } else if (sessionCount >= 3) {
    predictedMath = avgMathAcc !== null ? accToScore(avgMathAcc) : null;
    predictedRw = avgRwAcc !== null ? accToScore(avgRwAcc) : null;
    confidenceInterval = 100; modelVersion = 'accuracy_estimate';
  } else if (sessionCount > 0) {
    predictedMath = avgMathAcc !== null ? accToScore(avgMathAcc) : null;
    predictedRw = avgRwAcc !== null ? accToScore(avgRwAcc) : null;
    confidenceInterval = 150; modelVersion = 'early_estimate';
  }

  if (srMasteryRate > 0 && predictedMath) predictedMath = Math.min(800, predictedMath + Math.round(srMasteryRate * 30));
  if (srMasteryRate > 0 && predictedRw) predictedRw = Math.min(800, predictedRw + Math.round(srMasteryRate * 30));

  const predictedComposite = predictedMath != null && predictedRw != null
    ? predictedMath + predictedRw
    : predictedMath != null ? predictedMath * 2 : predictedRw != null ? predictedRw * 2 : null;

  return { predictedComposite, predictedMath, predictedRw, confidenceInterval, modelVersion, featureImportances: {} };
}

// ── Async retrain helper ──────────────────────────────────────────────────────

export async function triggerRetrain(studentId: number) {
  const featuresFull = buildFeatureVector(studentId);
  const { _meta, ...numericFeatures } = featuresFull;
  const features = numericFeatures as Record<string, number>;

  const mockTests = db.select().from(schema.mockTestSessions)
    .where(and(eq(schema.mockTestSessions.studentId, studentId), eq(schema.mockTestSessions.status, 'completed')))
    .all().filter(m => m.compositeScore !== null);

  const trainingData = mockTests.map(m => ({
    features: { ...features },
    composite_score: m.compositeScore!,
  }));

  await mlRetrain(studentId, trainingData);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/score-prediction/latest
router.get('/latest', async (req, res) => {
  const studentId = req.user!.id;
  const featuresFull = buildFeatureVector(studentId);
  const { _meta, ...numericFeatures } = featuresFull;
  const features = numericFeatures as Record<string, number>;

  if (_meta.sessionCount === 0 && _meta.mockCount === 0) {
    return res.json({ prediction: null, history: [], message: 'Complete more quizzes to generate a score prediction.' });
  }

  // Try ML service first
  const mlResult = await mlPredict(studentId, features);

  let predictionData: {
    predictedComposite: number | null;
    predictedMath: number | null;
    predictedRw: number | null;
    confidenceInterval: number;
    modelVersion: string;
    featureImportances: Record<string, number>;
  };

  if (mlResult?.predicted_composite) {
    predictionData = {
      predictedComposite: mlResult.predicted_composite,
      predictedMath: mlResult.predicted_math ?? null,
      predictedRw: mlResult.predicted_rw ?? null,
      confidenceInterval: mlResult.confidence_interval ?? 80,
      modelVersion: mlResult.model_type ?? 'ml_service',
      featureImportances: mlResult.feature_importances ?? {},
    };
  } else {
    const fallback = inProcessPrediction(studentId, { ...features, _meta } as any);
    predictionData = {
      predictedComposite: fallback.predictedComposite,
      predictedMath: fallback.predictedMath,
      predictedRw: fallback.predictedRw,
      confidenceInterval: fallback.confidenceInterval,
      modelVersion: fallback.modelVersion,
      featureImportances: {},
    };
  }

  if (predictionData.predictedComposite !== null) {
    db.insert(schema.scorePredictions).values({
      studentId,
      predictedComposite: predictionData.predictedComposite,
      predictedMath: predictionData.predictedMath,
      predictedRw: predictionData.predictedRw,
      confidenceInterval: predictionData.confidenceInterval,
      modelVersion: predictionData.modelVersion,
      featureSnapshotJson: JSON.stringify(features),
    }).run();
  }

  const history = db.select({
    predictedComposite: schema.scorePredictions.predictedComposite,
    predictedMath: schema.scorePredictions.predictedMath,
    predictedRw: schema.scorePredictions.predictedRw,
    confidenceInterval: schema.scorePredictions.confidenceInterval,
    modelVersion: schema.scorePredictions.modelVersion,
    createdAt: schema.scorePredictions.createdAt,
  }).from(schema.scorePredictions)
    .where(eq(schema.scorePredictions.studentId, studentId))
    .all()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-20);

  res.json({ prediction: predictionData, history });
});

// POST /api/score-prediction/retrain  — manually trigger ML retrain
router.post('/retrain', async (req, res) => {
  const studentId = req.user!.id;
  await triggerRetrain(studentId);
  res.json({ message: 'Retrain requested' });
});

// GET /api/score-prediction/feature-importance
router.get('/feature-importance', async (req, res) => {
  const studentId = req.user!.id;
  const result = await mlFeatureImportance(studentId);
  if (!result) return res.json({ feature_importances: {}, model_type: 'none' });
  res.json(result);
});

export default router;
