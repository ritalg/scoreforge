import { Router } from 'express';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { authGuard, requireRole } from '../../middleware/auth';
import { z } from 'zod';

const router = Router();

// GET /api/admin/users
router.get('/', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const { role, status, search } = req.query;

  let users = db.select({
    id: schema.users.id,
    email: schema.users.email,
    firstName: schema.users.firstName,
    lastName: schema.users.lastName,
    role: schema.users.role,
    status: schema.users.status,
    totpEnabled: schema.users.totpEnabled,
    createdAt: schema.users.createdAt,
    birthYear: schema.users.birthYear,
  }).from(schema.users).all();

  if (role) users = users.filter(u => u.role === role);
  if (status) users = users.filter(u => u.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    users = users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)
    );
  }

  users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Attach stats
  const withStats = users.map(u => {
    const sessions = db.select({ id: schema.quizSessions.id })
      .from(schema.quizSessions)
      .where(eq(schema.quizSessions.studentId, u.id))
      .all().length;
    const level = db.select({ totalXp: schema.studentLevels.totalXp, currentLevel: schema.studentLevels.currentLevel })
      .from(schema.studentLevels)
      .where(eq(schema.studentLevels.studentId, u.id))
      .get();
    return { ...u, sessionCount: sessions, xp: level?.totalXp ?? 0, level: level?.currentLevel ?? 1 };
  });

  res.json(withStats);
});

// GET /api/admin/users/stats
router.get('/stats', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const all = db.select({ role: schema.users.role, status: schema.users.status }).from(schema.users).all();
  const stats = {
    total: all.length,
    students: all.filter(u => u.role === 'student').length,
    parents: all.filter(u => u.role === 'parent').length,
    tutors: all.filter(u => u.role === 'tutor').length,
    admins: all.filter(u => u.role === 'admin' || u.role === 'superadmin').length,
    active: all.filter(u => u.status === 'active').length,
    pending: all.filter(u => u.status === 'pending_verification').length,
    suspended: all.filter(u => u.status === 'suspended').length,
  };
  res.json(stats);
});

// GET /api/admin/users/:id
router.get('/:id', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, parseInt(req.params.id))).get();
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { passwordHash, verificationToken, resetToken, totpSecret, ...safe } = user;
  const profile = db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.studentId, user.id)).get();
  const sessions = db.select({
    id: schema.quizSessions.id,
    mode: schema.quizSessions.mode,
    scorePct: schema.quizSessions.scorePct,
    startedAt: schema.quizSessions.startedAt,
  }).from(schema.quizSessions)
    .where(eq(schema.quizSessions.studentId, user.id))
    .all()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 10);

  res.json({ user: safe, profile, recentSessions: sessions });
});

const updateSchema = z.object({
  role: z.enum(['student', 'parent', 'tutor', 'admin', 'superadmin']).optional(),
  status: z.enum(['active', 'pending_verification', 'suspended', 'deleted']).optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

// PUT /api/admin/users/:id
router.put('/:id', authGuard, requireRole(['admin', 'superadmin']), (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!user) return res.status(404).json({ error: 'Not found' });

  // Superadmin protections
  if (user.role === 'superadmin' && req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Cannot modify superadmin' });
  }
  if (parsed.data.role === 'superadmin' && req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can promote to superadmin' });
  }

  db.update(schema.users)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, id))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'user_update',
    entityType: 'user',
    entityId: String(id),
    payloadJson: JSON.stringify(parsed.data),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: 'User updated' });
});

// POST /api/admin/users/:id/reset-2fa
router.post('/:id/reset-2fa', authGuard, requireRole(['superadmin']), (req, res) => {
  const id = parseInt(req.params.id);
  db.update(schema.users)
    .set({ totpEnabled: false, totpSecret: null })
    .where(eq(schema.users.id, id))
    .run();

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'user_reset_2fa',
    entityType: 'user',
    entityId: String(id),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: '2FA reset for user' });
});

export default router;
