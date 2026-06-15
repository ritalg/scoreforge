import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// GET /api/users/profile
router.get('/profile', authGuard, (req, res) => {
  const user = db.select({
    id: schema.users.id,
    email: schema.users.email,
    firstName: schema.users.firstName,
    lastName: schema.users.lastName,
    role: schema.users.role,
    theme: schema.users.theme,
    language: schema.users.language,
    fontSize: schema.users.fontSize,
    leaderboardOptOut: schema.users.leaderboardOptOut,
    totpEnabled: schema.users.totpEnabled,
    createdAt: schema.users.createdAt,
  }).from(schema.users).where(eq(schema.users.id, req.user!.id)).get();

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PUT /api/users/profile
router.put('/profile', authGuard, (req, res) => {
  const schema_ = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    theme: z.enum(['system', 'light', 'dark']).optional(),
    language: z.string().max(10).optional(),
    fontSize: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
    leaderboardOptOut: z.boolean().optional(),
  });
  const parsed = schema_.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.update(schema.users).set({
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.users.id, req.user!.id)).run();

  res.json({ message: 'Profile updated' });
});

// ─── PARENT LINKS ─────────────────────────────────────────────────────────────

// POST /api/users/parent-link/request  (parent initiates)
router.post('/parent-link/request', authGuard, requireRole(['parent']), async (req, res) => {
  const { studentEmail } = req.body;
  if (!studentEmail) return res.status(400).json({ error: 'Student email required' });

  const student = db.select({
    id: schema.users.id,
    status: schema.users.status,
    role: schema.users.role,
  }).from(schema.users)
    .where(eq(schema.users.email, studentEmail.toLowerCase())).get();

  if (!student || student.role !== 'student') {
    return res.status(404).json({ error: 'Student not found' });
  }
  if (student.status !== 'active') {
    return res.status(400).json({ error: 'Student account not active' });
  }

  const existing = db.select().from(schema.parentStudentLinks)
    .where(and(
      eq(schema.parentStudentLinks.parentId, req.user!.id),
      eq(schema.parentStudentLinks.studentId, student.id),
    )).get();

  if (existing) return res.status(409).json({ error: 'Link already exists' });

  db.insert(schema.parentStudentLinks).values({
    parentId: req.user!.id,
    studentId: student.id,
    status: 'pending',
  }).run();

  res.status(201).json({ message: 'Link request sent to student' });
});

// POST /api/users/parent-link/respond  (student accepts/rejects)
router.post('/parent-link/respond', authGuard, requireRole(['student']), (req, res) => {
  const { linkId, accept } = req.body;
  if (typeof linkId !== 'number' || typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'linkId and accept required' });
  }

  const link = db.select().from(schema.parentStudentLinks)
    .where(and(
      eq(schema.parentStudentLinks.id, linkId),
      eq(schema.parentStudentLinks.studentId, req.user!.id),
    )).get();

  if (!link) return res.status(404).json({ error: 'Link request not found' });

  if (accept) {
    db.update(schema.parentStudentLinks)
      .set({ status: 'active', consentTimestamp: new Date().toISOString() })
      .where(eq(schema.parentStudentLinks.id, linkId))
      .run();
    res.json({ message: 'Parent link accepted' });
  } else {
    db.delete(schema.parentStudentLinks)
      .where(eq(schema.parentStudentLinks.id, linkId))
      .run();
    res.json({ message: 'Parent link rejected' });
  }
});

// GET /api/users/parent-link/pending  (student views pending requests)
router.get('/parent-link/pending', authGuard, requireRole(['student']), (req, res) => {
  const links = db.select({
    id: schema.parentStudentLinks.id,
    parentId: schema.parentStudentLinks.parentId,
    parentFirstName: schema.users.firstName,
    parentLastName: schema.users.lastName,
    parentEmail: schema.users.email,
    linkedAt: schema.parentStudentLinks.linkedAt,
  })
    .from(schema.parentStudentLinks)
    .innerJoin(schema.users, eq(schema.users.id, schema.parentStudentLinks.parentId))
    .where(and(
      eq(schema.parentStudentLinks.studentId, req.user!.id),
      eq(schema.parentStudentLinks.status, 'pending'),
    )).all();

  res.json(links);
});

// GET /api/users/parent-link/children  (parent views linked students)
router.get('/parent-link/children', authGuard, requireRole(['parent']), (req, res) => {
  const children = db.select({
    id: schema.parentStudentLinks.id,
    studentId: schema.users.id,
    firstName: schema.users.firstName,
    lastName: schema.users.lastName,
    email: schema.users.email,
    status: schema.parentStudentLinks.status,
    linkedAt: schema.parentStudentLinks.linkedAt,
  })
    .from(schema.parentStudentLinks)
    .innerJoin(schema.users, eq(schema.users.id, schema.parentStudentLinks.studentId))
    .where(eq(schema.parentStudentLinks.parentId, req.user!.id))
    .all();

  res.json(children);
});

export default router;
