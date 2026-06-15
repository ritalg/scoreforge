import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { db, schema } from '../../db';
import { eq, desc } from 'drizzle-orm';
import { authGuard, requireRole } from '../../middleware/auth';
import { extractQuestionsFromText } from '../../services/aiExtractionService';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50')) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

// GET /api/admin/uploads
router.get('/', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const uploads = db.select().from(schema.uploads)
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(uploads);
});

// GET /api/admin/uploads/:id
router.get('/:id', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const upload_ = db.select().from(schema.uploads)
    .where(eq(schema.uploads.id, parseInt(req.params.id)))
    .get();
  if (!upload_) return res.status(404).json({ error: 'Upload not found' });

  const questions = db.select({
    id: schema.questions.id,
    questionNumber: schema.questions.questionNumber,
    questionText: schema.questions.questionText,
    topicKey: schema.questions.topicKey,
    difficulty: schema.questions.difficulty,
    status: schema.questions.status,
    correctAnswer: schema.questions.correctAnswer,
  }).from(schema.questions)
    .where(eq(schema.questions.uploadId, parseInt(req.params.id)))
    .all();

  res.json({ upload: upload_, questions });
});

// POST /api/admin/uploads  – upload PDF + kick off extraction
router.post('/', authGuard, requireRole(['admin', 'superadmin']),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { testName, section } = req.body;

    const row = db.insert(schema.uploads).values({
      uploadedBy: req.user!.id,
      originalFilename: req.file.originalname,
      storedPath: req.file.path,
      status: 'queued',
      testName: testName || null,
      section: section || null,
    }).run();

    const uploadId = Number(row.lastInsertRowid);

    // Log audit
    db.insert(schema.auditLogs).values({
      userId: req.user!.id,
      action: 'upload_create',
      entityType: 'upload',
      entityId: String(uploadId),
      payloadJson: JSON.stringify({ filename: req.file.originalname, testName }),
      ipAddress: req.ip || null,
    }).run();

    res.status(202).json({ uploadId, message: 'Upload received. Extraction started.' });

    // Fire-and-forget extraction
    setImmediate(async () => {
      try {
        const fileBuffer = fs.readFileSync(req.file!.path);
        const parsed = await pdfParse(fileBuffer);
        const text = parsed.text;
        const count = await extractQuestionsFromText(text, uploadId);
        console.log(`Extraction complete for upload ${uploadId}: ${count} questions`);
      } catch (err) {
        console.error(`Extraction failed for upload ${uploadId}:`, err);
      }
    });
  }
);

// DELETE /api/admin/uploads/:id
router.delete('/:id', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const uploadId = parseInt(req.params.id);
  const upload_ = db.select().from(schema.uploads).where(eq(schema.uploads.id, uploadId)).get();
  if (!upload_) return res.status(404).json({ error: 'Not found' });

  // Remove file from disk
  if (upload_.storedPath && fs.existsSync(upload_.storedPath)) {
    fs.unlinkSync(upload_.storedPath);
  }

  db.delete(schema.uploads).where(eq(schema.uploads.id, uploadId)).run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'upload_delete',
    entityType: 'upload',
    entityId: String(uploadId),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: 'Upload deleted' });
});

export default router;
