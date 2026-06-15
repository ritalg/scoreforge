import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth';

const router = Router();
router.use(authGuard);

const NOTIFICATION_TYPES = [
  { key: 'study_reminder', label: 'Daily Study Reminder', description: 'Reminds you to study at your chosen time' },
  { key: 'sr_due', label: 'Spaced Repetition Due', description: 'When you have questions due for review' },
  { key: 'streak_at_risk', label: 'Streak At Risk', description: 'When your streak might break before midnight' },
  { key: 'streak_lost', label: 'Streak Lost', description: 'When your streak resets' },
  { key: 'badge_earned', label: 'Badge Earned', description: 'When you unlock a new badge' },
  { key: 'assignment_due', label: 'Assignment Due', description: '48 hours before an assignment deadline' },
  { key: 'test_countdown', label: 'Test Countdown', description: '30, 7, and 1 days before your target test date' },
  { key: 'score_prediction_updated', label: 'Score Prediction Updated', description: 'When your predicted score is recalculated' },
  { key: 'group_challenge', label: 'Group Challenge', description: 'When a study group member challenges you' },
  { key: 'parent_digest', label: 'Weekly Digest', description: 'Sunday weekly summary email (parent role)' },
];

// GET /api/notification-preferences
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const existing = db.select().from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.userId, userId)).all();

  const existingByKey = new Map(existing.map(p => [p.notificationType, p]));

  const prefs = NOTIFICATION_TYPES.map(t => {
    const pref = existingByKey.get(t.key);
    return {
      notificationType: t.key,
      label: t.label,
      description: t.description,
      inApp: pref?.inApp ?? true,
      email: pref?.email ?? true,
      push: pref?.push ?? false,
      sms: pref?.sms ?? false,
    };
  });

  res.json(prefs);
});

// PUT /api/notification-preferences/:type
router.put('/:type', (req, res) => {
  const userId = req.user!.id;
  const { type } = req.params;
  const { inApp, email, push, sms } = req.body;

  if (!NOTIFICATION_TYPES.find(t => t.key === type)) {
    return res.status(400).json({ error: 'Unknown notification type' });
  }

  const existing = db.select().from(schema.notificationPreferences)
    .where(and(
      eq(schema.notificationPreferences.userId, userId),
      eq(schema.notificationPreferences.notificationType, type)
    )).get();

  if (existing) {
    db.update(schema.notificationPreferences).set({
      inApp: inApp ?? existing.inApp,
      email: email ?? existing.email,
      push: push ?? existing.push,
      sms: sms ?? existing.sms,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.notificationPreferences.id, existing.id)).run();
  } else {
    db.insert(schema.notificationPreferences).values({
      userId, notificationType: type,
      inApp: inApp ?? true,
      email: email ?? true,
      push: push ?? false,
      sms: sms ?? false,
    }).run();
  }

  res.json({ message: 'Preferences updated' });
});

// POST /api/notification-preferences/push-subscribe
router.post('/push-subscribe', (req, res) => {
  const { endpoint, p256dh, auth } = req.body;
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Missing subscription fields' });

  try {
    db.insert(schema.pushSubscriptions).values({
      userId: req.user!.id, endpoint, p256dh, auth,
    }).run();
  } catch {
    // Already exists — update
    db.update(schema.pushSubscriptions)
      .set({ p256dh, auth })
      .where(eq(schema.pushSubscriptions.endpoint, endpoint)).run();
  }

  res.json({ message: 'Push subscription saved' });
});

// DELETE /api/notification-preferences/push-subscribe
router.delete('/push-subscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    db.delete(schema.pushSubscriptions)
      .where(and(
        eq(schema.pushSubscriptions.userId, req.user!.id),
        eq(schema.pushSubscriptions.endpoint, endpoint)
      )).run();
  }
  res.json({ message: 'Unsubscribed' });
});

export default router;
