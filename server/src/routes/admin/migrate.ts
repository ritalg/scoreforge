import { Router } from 'express';
import { sqlite } from '../../db';
import { authGuard, requireRole } from '../../middleware/auth';

const router = Router();

// POST /api/admin/migrate  — one-shot data migration from local dev DB
// Accepts uploads → passages → questions in order, remaps all IDs
router.post('/', authGuard, requireRole(['superadmin']), (req, res) => {
  const { uploads = [], passages = [], questions = [], satTestDates = [] } = req.body as {
    uploads: Record<string, unknown>[];
    passages: Record<string, unknown>[];
    questions: Record<string, unknown>[];
    satTestDates: Record<string, unknown>[];
  };

  const uploadIdMap: Record<number, number> = {};
  const passageIdMap: Record<number, number> = {};
  let insertedUploads = 0;
  let insertedPassages = 0;
  let insertedQuestions = 0;
  let skippedQuestions = 0;
  let insertedSatDates = 0;

  const insertUpload = sqlite.prepare(`
    INSERT OR IGNORE INTO uploads
      (uploaded_by, original_filename, stored_path, status, test_name, section,
       error_message, question_count, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPassage = sqlite.prepare(`
    INSERT OR IGNORE INTO passages (upload_id, passage_text, passage_type, topic_key, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSatDate = sqlite.prepare(`
    INSERT OR IGNORE INTO sat_test_dates (test_date, registration_deadline, is_official, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertQuestion = sqlite.prepare(`
    INSERT OR IGNORE INTO questions
      (upload_id, passage_id, question_number, question_text, question_type,
       choice_a, choice_b, choice_c, choice_d, correct_answer, explanation,
       topic_key, difficulty, module, status, reviewed_by, reviewed_at,
       attempt_count, correct_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Resolve the current superadmin user id from the DB
  const adminUser = sqlite.prepare("SELECT id FROM users WHERE role='superadmin' LIMIT 1").get() as { id: number } | undefined;
  const adminId = adminUser?.id ?? 1;

  const run = sqlite.transaction(() => {
    for (const u of uploads) {
      const info = insertUpload.run(
        adminId,
        u.original_filename ?? '',
        u.stored_path ?? '',
        u.status ?? 'completed',
        u.test_name ?? null,
        u.section ?? null,
        u.error_message ?? null,
        u.question_count ?? 0,
        u.created_at ?? new Date().toISOString(),
        u.completed_at ?? null,
      );
      if (info.changes > 0) {
        uploadIdMap[u.id as number] = Number(info.lastInsertRowid);
        insertedUploads++;
      }
    }

    for (const p of passages) {
      const newUploadId = p.upload_id ? (uploadIdMap[p.upload_id as number] ?? null) : null;
      const info = insertPassage.run(
        newUploadId,
        p.passage_text ?? '',
        p.passage_type ?? null,
        p.topic_key ?? null,
        p.created_at ?? new Date().toISOString(),
      );
      if (info.changes > 0) {
        passageIdMap[p.id as number] = Number(info.lastInsertRowid);
        insertedPassages++;
      }
    }

    for (const q of questions) {
      const newUploadId = q.upload_id ? (uploadIdMap[q.upload_id as number] ?? null) : null;
      const newPassageId = q.passage_id ? (passageIdMap[q.passage_id as number] ?? null) : null;
      const info = insertQuestion.run(
        newUploadId,
        newPassageId,
        q.question_number ?? null,
        q.question_text ?? '',
        q.question_type ?? 'multiple_choice',
        q.choice_a ?? null,
        q.choice_b ?? null,
        q.choice_c ?? null,
        q.choice_d ?? null,
        q.correct_answer ?? '',
        q.explanation ?? null,
        q.topic_key ?? null,
        q.difficulty ?? null,
        q.module ?? null,
        q.status ?? 'approved',
        q.reviewed_by ? adminId : null,
        q.reviewed_at ?? null,
        q.attempt_count ?? 0,
        q.correct_count ?? 0,
        q.created_at ?? new Date().toISOString(),
      );
      if (info.changes > 0) insertedQuestions++;
      else skippedQuestions++;
    }

    for (const d of satTestDates) {
      const info = insertSatDate.run(
        d.test_date ?? '',
        d.registration_deadline ?? null,
        d.is_official ?? 1,
        d.created_at ?? new Date().toISOString(),
      );
      if (info.changes > 0) insertedSatDates++;
    }
  });

  try {
    run();
    res.json({
      ok: true,
      insertedUploads,
      insertedPassages,
      insertedQuestions,
      skippedQuestions,
      insertedSatDates,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
