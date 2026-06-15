import { Router } from 'express';
import { db, schema } from '../../db';
import { eq, and, ne, sql } from 'drizzle-orm';
import { authGuard, requireRole } from '../../middleware/auth';
import { z } from 'zod';
import { indexQuestion, removeFromIndex } from '../../services/searchService';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const figureUpload = multer({
  dest: path.join(__dirname, '../../../../../uploads/figures/'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

const router = Router();

// GET /api/admin/questions  – list with filters
router.get('/', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { status, topic, uploadId, page = '1', limit = '50' } = req.query;
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
    topicKey: schema.questions.topicKey,
    difficulty: schema.questions.difficulty,
    module: schema.questions.module,
    status: schema.questions.status,
    uploadId: schema.questions.uploadId,
    passageId: schema.questions.passageId,
    attemptCount: schema.questions.attemptCount,
    correctCount: schema.questions.correctCount,
    createdAt: schema.questions.createdAt,
    reviewedAt: schema.questions.reviewedAt,
  }).from(schema.questions).all();

  if (status) questions = questions.filter(q => q.status === status);
  if (topic) questions = questions.filter(q => q.topicKey === topic);
  if (uploadId) questions = questions.filter(q => q.uploadId === parseInt(String(uploadId)));

  questions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = questions.length;
  const paginated = questions.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  res.json({ questions: paginated, total, page: pageNum, pageSize });
});

// GET /api/admin/questions/stats  – pending/approved/rejected counts
router.get('/stats', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const all = db.select({ status: schema.questions.status }).from(schema.questions).all();
  const counts = { pending_review: 0, approved: 0, rejected: 0, flagged: 0, total: all.length };
  for (const q of all) {
    const key = q.status as keyof typeof counts;
    if (key in counts) counts[key]++;
  }
  res.json(counts);
});

// GET /api/admin/questions/:id
router.get('/:id', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const q = db.select().from(schema.questions)
    .where(eq(schema.questions.id, parseInt(req.params.id)))
    .get();
  if (!q) return res.status(404).json({ error: 'Not found' });

  const passage = q.passageId
    ? db.select().from(schema.passages).where(eq(schema.passages.id, q.passageId)).get()
    : null;

  const versions = db.select().from(schema.questionVersions)
    .where(eq(schema.questionVersions.questionId, q.id))
    .all()
    .sort((a, b) => b.versionNumber - a.versionNumber);

  const figures = db.select().from(schema.questionFigures)
    .where(eq(schema.questionFigures.questionId, q.id))
    .all();

  res.json({ question: q, passage, versions, figures });
});

const editSchema = z.object({
  questionText: z.string().min(1).optional(),
  questionType: z.enum(['multiple_choice', 'grid_in']).optional(),
  choiceA: z.string().nullable().optional(),
  choiceB: z.string().nullable().optional(),
  choiceC: z.string().nullable().optional(),
  choiceD: z.string().nullable().optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().nullable().optional(),
  topicKey: z.string().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  module: z.enum(['m1', 'm2_hard', 'm2_easy']).nullable().optional(),
});

// PUT /api/admin/questions/:id
router.put('/:id', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = db.select().from(schema.questions).where(eq(schema.questions.id, id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // Archive current version
  const latestVersion = db.select({ vn: schema.questionVersions.versionNumber })
    .from(schema.questionVersions)
    .where(eq(schema.questionVersions.questionId, id))
    .all()
    .sort((a, b) => b.vn - a.vn)[0];

  db.insert(schema.questionVersions).values({
    questionId: id,
    versionNumber: (latestVersion?.vn ?? 0) + 1,
    snapshotJson: JSON.stringify(existing),
    editedBy: req.user!.id,
  }).run();

  db.update(schema.questions)
    .set({ ...parsed.data })
    .where(eq(schema.questions.id, id))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'question_edit',
    entityType: 'question',
    entityId: String(id),
    payloadJson: JSON.stringify(parsed.data),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: 'Question updated' });
});

// POST /api/admin/questions/:id/approve
router.post('/:id/approve', authGuard, requireRole(['admin', 'superadmin']), async (req, res) => {
  const id = parseInt(req.params.id);
  const q = db.select().from(schema.questions).where(eq(schema.questions.id, id)).get();
  if (!q) return res.status(404).json({ error: 'Not found' });

  db.update(schema.questions)
    .set({ status: 'approved', reviewedBy: req.user!.id, reviewedAt: new Date().toISOString() })
    .where(eq(schema.questions.id, id))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'question_approve',
    entityType: 'question',
    entityId: String(id),
    ipAddress: req.ip || null,
  }).run();

  await indexQuestion(id);

  res.json({ message: 'Question approved' });
});

// POST /api/admin/questions/:id/reject
router.post('/:id/reject', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;

  db.update(schema.questions)
    .set({ status: 'rejected', reviewedBy: req.user!.id, reviewedAt: new Date().toISOString() })
    .where(eq(schema.questions.id, id))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'question_reject',
    entityType: 'question',
    entityId: String(id),
    payloadJson: reason ? JSON.stringify({ reason }) : null,
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: 'Question rejected' });
});

// POST /api/admin/questions/:id/flag
router.post('/:id/flag', authGuard, (req, res) => {
  const id = parseInt(req.params.id);
  db.update(schema.questions)
    .set({ status: 'flagged' })
    .where(eq(schema.questions.id, id))
    .run();
  res.json({ message: 'Question flagged for review' });
});

// POST /api/admin/questions/bulk-approve  – approve multiple
router.post('/bulk-approve', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  let approved = 0;
  for (const id of ids) {
    db.update(schema.questions)
      .set({ status: 'approved', reviewedBy: req.user!.id, reviewedAt: new Date().toISOString() })
      .where(and(eq(schema.questions.id, id), eq(schema.questions.status, 'pending_review')))
      .run();
    approved++;
  }

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'question_bulk_approve',
    entityType: 'question',
    entityId: ids.join(','),
    payloadJson: JSON.stringify({ count: approved }),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: `Approved ${approved} questions` });
});

// POST /api/admin/questions/csv-import  – bulk CSV import
router.post('/csv-import', authGuard, requireRole(['admin', 'superadmin']), async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array required' });
  }

  let imported = 0;
  for (const row of rows) {
    if (!row.questionText || !row.correctAnswer) continue;
    db.insert(schema.questions).values({
      questionText: row.questionText,
      questionType: row.questionType || 'multiple_choice',
      choiceA: row.choiceA || null,
      choiceB: row.choiceB || null,
      choiceC: row.choiceC || null,
      choiceD: row.choiceD || null,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation || null,
      topicKey: row.topicKey || null,
      difficulty: row.difficulty || null,
      status: 'pending_review',
    }).run();
    imported++;
  }

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'question_csv_import',
    entityType: 'question',
    entityId: 'bulk',
    payloadJson: JSON.stringify({ count: imported }),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: `Imported ${imported} questions as pending_review` });
});

// POST /api/admin/questions/:id/figures  — upload an image figure for a question
router.post('/:id/figures', authGuard, requireRole(['admin', 'superadmin']),
  figureUpload.single('image'),
  (req, res) => {
    const id = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const q = db.select({ id: schema.questions.id }).from(schema.questions).where(eq(schema.questions.id, id)).get();
    if (!q) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Question not found' });
    }

    const ext = req.file.mimetype.split('/')[1] ?? 'png';
    const newName = `${req.file.filename}.${ext}`;
    const newPath = path.join(path.dirname(req.file.path), newName);
    fs.renameSync(req.file.path, newPath);

    const imagePath = `/uploads/figures/${newName}`;
    const altText = req.body.altText || null;
    const figureType = req.body.figureType || 'image';

    db.insert(schema.questionFigures).values({
      questionId: id,
      imagePath,
      figureType,
      altText,
    }).run();

    res.status(201).json({ imagePath, figureType, altText });
  }
);

// DELETE /api/admin/questions/:id/figures/:figureId
router.delete('/:id/figures/:figureId', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const figureId = parseInt(req.params.figureId);
  const figure = db.select().from(schema.questionFigures).where(eq(schema.questionFigures.id, figureId)).get();
  if (!figure) return res.status(404).json({ error: 'Not found' });

  const fullPath = path.join(__dirname, '../../../../../', figure.imagePath);
  try { fs.unlinkSync(fullPath); } catch {}

  db.delete(schema.questionFigures).where(eq(schema.questionFigures.id, figureId)).run();
  res.json({ message: 'Deleted' });
});

export default router;
