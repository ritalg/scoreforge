import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['student']));

// GET /api/test-calendar/dates — list all official SAT dates
router.get('/dates', (req, res) => {
  const dates = db.select().from(schema.satTestDates).all()
    .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
  res.json(dates);
});

// GET /api/test-calendar/my — student's calendar entries
router.get('/my', (req, res) => {
  const studentId = req.user!.id;
  const entries = db.select().from(schema.studentTestCalendar)
    .where(eq(schema.studentTestCalendar.studentId, studentId))
    .all()
    .sort((a, b) => {
      const dateA = a.customDate ?? db.select({ testDate: schema.satTestDates.testDate })
        .from(schema.satTestDates).where(eq(schema.satTestDates.id, a.satTestDateId!)).get()?.testDate ?? '';
      const dateB = b.customDate ?? db.select({ testDate: schema.satTestDates.testDate })
        .from(schema.satTestDates).where(eq(schema.satTestDates.id, b.satTestDateId!)).get()?.testDate ?? '';
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

  const enriched = entries.map(e => {
    const officialDate = e.satTestDateId
      ? db.select().from(schema.satTestDates).where(eq(schema.satTestDates.id, e.satTestDateId)).get()
      : null;
    const resolvedDate = e.customDate ?? officialDate?.testDate ?? null;
    const daysUntil = resolvedDate
      ? Math.ceil((new Date(resolvedDate).getTime() - Date.now()) / 86400000)
      : null;
    return { ...e, officialDate, resolvedDate, daysUntil };
  });

  res.json(enriched);
});

// POST /api/test-calendar — add a date to calendar
router.post('/', (req, res) => {
  const studentId = req.user!.id;
  const { satTestDateId, customDate, isTarget = false } = req.body;

  if (!satTestDateId && !customDate) {
    return res.status(400).json({ error: 'satTestDateId or customDate required' });
  }

  // If marking as target, unmark existing targets
  if (isTarget) {
    const existing = db.select().from(schema.studentTestCalendar)
      .where(and(eq(schema.studentTestCalendar.studentId, studentId), eq(schema.studentTestCalendar.isTarget, 1 as any)))
      .all();
    for (const e of existing) {
      db.update(schema.studentTestCalendar).set({ isTarget: false as any }).where(eq(schema.studentTestCalendar.id, e.id)).run();
    }
  }

  db.insert(schema.studentTestCalendar).values({
    studentId,
    satTestDateId: satTestDateId ?? null,
    customDate: customDate ?? null,
    isTarget,
    status: 'planned',
  }).run();

  const entry = db.select().from(schema.studentTestCalendar)
    .where(eq(schema.studentTestCalendar.studentId, studentId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  res.status(201).json(entry);
});

// PATCH /api/test-calendar/:id — update status or actual score
router.patch('/:id', (req, res) => {
  const studentId = req.user!.id;
  const entryId = parseInt(req.params.id);
  const { status, actualScore, isTarget } = req.body;

  const entry = db.select().from(schema.studentTestCalendar)
    .where(and(eq(schema.studentTestCalendar.id, entryId), eq(schema.studentTestCalendar.studentId, studentId)))
    .get();
  if (!entry) return res.status(404).json({ error: 'Not found' });

  // If setting as target, clear other targets
  if (isTarget) {
    const others = db.select().from(schema.studentTestCalendar)
      .where(and(eq(schema.studentTestCalendar.studentId, studentId), eq(schema.studentTestCalendar.isTarget, 1 as any)))
      .all();
    for (const o of others) {
      if (o.id !== entryId) {
        db.update(schema.studentTestCalendar).set({ isTarget: false as any }).where(eq(schema.studentTestCalendar.id, o.id)).run();
      }
    }
  }

  const updates: Record<string, any> = {};
  if (status) updates.status = status;
  if (actualScore !== undefined) updates.actualScore = actualScore;
  if (isTarget !== undefined) updates.isTarget = isTarget;

  if (Object.keys(updates).length > 0) {
    db.update(schema.studentTestCalendar).set(updates).where(eq(schema.studentTestCalendar.id, entryId)).run();
  }

  res.json({ message: 'Updated' });
});

// DELETE /api/test-calendar/:id
router.delete('/:id', (req, res) => {
  const studentId = req.user!.id;
  db.delete(schema.studentTestCalendar)
    .where(and(
      eq(schema.studentTestCalendar.id, parseInt(req.params.id)),
      eq(schema.studentTestCalendar.studentId, studentId)
    )).run();
  res.json({ message: 'Removed' });
});

// Admin: POST /api/test-calendar/admin/dates — add official SAT dates
router.post('/admin/dates', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { testDate, registrationDeadline } = req.body;
  if (!testDate) return res.status(400).json({ error: 'testDate required' });
  db.insert(schema.satTestDates).values({ testDate, registrationDeadline: registrationDeadline ?? null, isOfficial: true }).run();
  res.status(201).json({ message: 'Date added' });
});

export default router;
