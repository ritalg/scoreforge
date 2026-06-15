import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard } from '../middleware/auth';

const router = Router();
router.use(authGuard);

// GET /api/notifications
router.get('/', (req, res) => {
  const { unreadOnly, limit = '30' } = req.query;
  let notifs = db.select().from(schema.notifications)
    .where(eq(schema.notifications.userId, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, parseInt(String(limit)));

  if (unreadOnly === 'true') notifs = notifs.filter(n => !n.read);
  res.json(notifs);
});

// GET /api/notifications/count
router.get('/count', (req, res) => {
  const unread = db.select({ id: schema.notifications.id, read: schema.notifications.read })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, req.user!.id))
    .all()
    .filter(n => !n.read).length;
  res.json({ unread });
});

// POST /api/notifications/:id/read
router.post('/:id/read', (req, res) => {
  db.update(schema.notifications)
    .set({ read: true })
    .where(and(
      eq(schema.notifications.id, parseInt(req.params.id)),
      eq(schema.notifications.userId, req.user!.id)
    )).run();
  res.json({ message: 'Marked as read' });
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  const notifs = db.select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, req.user!.id))
    .all();
  for (const n of notifs) {
    db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.id, n.id)).run();
  }
  res.json({ message: 'All marked as read' });
});

// Helper used by other routes to push notifications
export function pushNotification(userId: number, type: string, title: string, body: string, actionUrl?: string) {
  try {
    db.insert(schema.notifications).values({ userId, type, title, body, actionUrl: actionUrl ?? null }).run();
  } catch {}
}

export default router;
