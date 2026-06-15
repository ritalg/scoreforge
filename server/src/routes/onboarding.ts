import { Router } from 'express';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const onboardingSchema = z.object({
  gradeLevel: z.number().int().min(9).max(12).optional(),
  targetScore: z.number().int().min(400).max(1600).optional(),
  targetTestDate: z.string().optional(),
  studyHoursPerWeek: z.number().int().min(1).max(40).default(5),
});

// GET /api/onboarding/status
router.get('/status', authGuard, requireRole(['student']), (req, res) => {
  const profile = db.select().from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.studentId, req.user!.id)).get();
  res.json({ completed: profile?.onboardingCompleted ?? false, profile });
});

// POST /api/onboarding/complete
router.post('/complete', authGuard, requireRole(['student']), (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { gradeLevel, targetScore, targetTestDate, studyHoursPerWeek } = parsed.data;

  db.update(schema.studentProfiles).set({
    gradeLevel,
    targetScore,
    targetTestDate,
    studyHoursPerWeek,
    onboardingCompleted: true,
  }).where(eq(schema.studentProfiles.studentId, req.user!.id)).run();

  res.json({ message: 'Onboarding complete' });
});

// PUT /api/onboarding/profile
router.put('/profile', authGuard, requireRole(['student']), (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.update(schema.studentProfiles).set(parsed.data)
    .where(eq(schema.studentProfiles.studentId, req.user!.id)).run();

  res.json({ message: 'Profile updated' });
});

export default router;
