import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { awardXP } from '../services/xpService';

const router = Router();
router.use(authGuard, requireRole(['student']));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RUBRIC_PROMPT = (essayType: string, promptText: string, essayText: string) => `You are an expert SAT essay scorer. Score the following essay on three dimensions (each 1–4):

Essay type: ${essayType}
${promptText ? `Prompt/source text:\n${promptText}\n` : ''}

Student essay:
${essayText}

Score each dimension from 1 to 4 and provide specific, actionable feedback.

Respond ONLY with valid JSON in this exact shape:
{
  "readingScore": <1-4>,
  "analysisScore": <1-4>,
  "writingScore": <1-4>,
  "reading": {
    "score": <1-4>,
    "rationale": "<2-3 sentences>",
    "strength": "<one specific strength>",
    "improvement": "<one specific suggestion>"
  },
  "analysis": {
    "score": <1-4>,
    "rationale": "<2-3 sentences>",
    "strength": "<one specific strength>",
    "improvement": "<one specific suggestion>"
  },
  "writing": {
    "score": <1-4>,
    "rationale": "<2-3 sentences>",
    "strength": "<one specific strength>",
    "improvement": "<one specific suggestion>"
  },
  "overallFeedback": "<3-4 sentence holistic summary>",
  "keyImprovements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]
}`;

// POST /api/essays/submit
router.post('/submit', async (req, res) => {
  const { essayType = 'general', promptText = '', essayText } = req.body;
  if (!essayText?.trim() || essayText.trim().length < 100) {
    return res.status(400).json({ error: 'Essay must be at least 100 characters' });
  }
  if (!['sat_essay', 'act_essay', 'general'].includes(essayType)) {
    return res.status(400).json({ error: 'Invalid essay type' });
  }

  const studentId = req.user!.id;

  // Insert placeholder
  db.insert(schema.essaySubmissions).values({
    studentId,
    essayType: essayType as any,
    promptText: promptText || null,
    essayText: essayText.trim(),
  }).run();

  const submission = db.select().from(schema.essaySubmissions)
    .where(eq(schema.essaySubmissions.studentId, studentId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: RUBRIC_PROMPT(essayType, promptText, essayText.trim()) }],
    });

    const raw = (msg.content[0] as any).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const scored = JSON.parse(jsonMatch[0]);
    const total = (scored.readingScore ?? scored.reading?.score ?? 0) +
                  (scored.analysisScore ?? scored.analysis?.score ?? 0) +
                  (scored.writingScore ?? scored.writing?.score ?? 0);

    db.update(schema.essaySubmissions).set({
      readingScore: scored.readingScore ?? scored.reading?.score,
      analysisScore: scored.analysisScore ?? scored.analysis?.score,
      writingScore: scored.writingScore ?? scored.writing?.score,
      totalScore: total,
      aiFeedbackJson: JSON.stringify(scored),
    }).where(eq(schema.essaySubmissions.id, submission.id)).run();

    awardXP(studentId, 'essay_submitted');

    const updated = db.select().from(schema.essaySubmissions)
      .where(eq(schema.essaySubmissions.id, submission.id)).get()!;

    res.json({ ...updated, feedback: scored });
  } catch (err: any) {
    db.update(schema.essaySubmissions).set({
      aiFeedbackJson: JSON.stringify({ error: err.message }),
    }).where(eq(schema.essaySubmissions.id, submission.id)).run();

    res.status(502).json({ error: 'AI scoring failed. Essay saved — try again.', submissionId: submission.id });
  }
});

// GET /api/essays/history
router.get('/history', (req, res) => {
  const essays = db.select().from(schema.essaySubmissions)
    .where(eq(schema.essaySubmissions.studentId, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(essays);
});

// GET /api/essays/:id
router.get('/:id', (req, res) => {
  const essay = db.select().from(schema.essaySubmissions)
    .where(eq(schema.essaySubmissions.id, parseInt(req.params.id))).get();
  if (!essay || essay.studentId !== req.user!.id) return res.status(404).json({ error: 'Not found' });
  const feedback = essay.aiFeedbackJson ? JSON.parse(essay.aiFeedbackJson) : null;
  res.json({ ...essay, feedback });
});

export default router;
