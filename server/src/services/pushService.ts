import webpush from 'web-push';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

let vapidInitialized = false;

export function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:noreply@scoreforge.coach';

  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
    vapidInitialized = true;
    console.log('[push] VAPID configured');
  } else {
    console.log('[push] VAPID keys not set — push notifications disabled');
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: number, payload: PushPayload) {
  if (!vapidInitialized) return;

  const subscriptions = db.select().from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))
    .all();

  const json = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        json,
        { TTL: 86400 }
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — remove it
        db.delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint))
          .run();
      } else {
        console.error('[push] sendNotification error', err?.statusCode, sub.endpoint.slice(0, 40));
      }
    }
  }
}

export async function pushStudyReminder(userId: number, dueCount: number) {
  await sendPushToUser(userId, {
    title: 'ScoreForge — Time to Study!',
    body: `You have ${dueCount} spaced repetition question${dueCount !== 1 ? 's' : ''} due today.`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: '/student/sr-drill',
    tag: 'study-reminder',
  });
}

export async function pushStreakAtRisk(userId: number, streak: number) {
  await sendPushToUser(userId, {
    title: `Don't break your ${streak}-day streak!`,
    body: 'You haven\'t studied today. Complete any activity to keep your streak alive.',
    icon: '/icons/icon-192.png',
    url: '/student/quiz',
    tag: 'streak-risk',
  });
}

export async function pushBadgeEarned(userId: number, badgeName: string) {
  await sendPushToUser(userId, {
    title: 'New Badge Earned!',
    body: `You earned the "${badgeName}" badge. Keep it up!`,
    icon: '/icons/icon-192.png',
    url: '/student/profile',
    tag: 'badge',
  });
}

export async function pushAssignmentDue(userId: number, title: string) {
  await sendPushToUser(userId, {
    title: 'Assignment Due Soon',
    body: title,
    icon: '/icons/icon-192.png',
    url: '/student/assignments',
    tag: 'assignment',
  });
}
