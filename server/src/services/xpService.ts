import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { computeLevel } from '@scoreforge/shared';

export const XP_EVENTS = {
  daily_login: 5,
  study_session_30min: 10,
  quiz_question_answered: 2,
  quiz_question_correct: 5,
  timed_quiz_bonus: 5,
  full_mock_complete: 100,
  mock_test_complete: 100,
  sr_drill_correct: 3,
  essay_submitted: 25,
  challenge_won: 20,
  challenge_participated: 10,
  streak_7_day: 50,
  streak_30_day: 200,
} as const;

export type XPEvent = keyof typeof XP_EVENTS;

export function awardXP(studentId: number, eventType: XPEvent, referenceId?: number) {
  const xp = XP_EVENTS[eventType];

  try {
    db.insert(schema.studentXpEvents)
      .values({ studentId, eventType, xpEarned: xp, referenceId })
      .run();
  } catch {
    return;
  }

  const current = db.select()
    .from(schema.studentLevels)
    .where(eq(schema.studentLevels.studentId, studentId))
    .get();

  const newTotal = (current?.totalXp ?? 0) + xp;
  const newLevel = computeLevel(newTotal);

  db.insert(schema.studentLevels)
    .values({ studentId, currentLevel: newLevel, totalXp: newTotal })
    .onConflictDoUpdate({
      target: schema.studentLevels.studentId,
      set: { currentLevel: newLevel, totalXp: newTotal, updatedAt: new Date().toISOString() },
    })
    .run();

  checkBadges(studentId, eventType, newTotal, newLevel, current?.currentLevel ?? 1);
  return { xpEarned: xp, totalXp: newTotal, level: newLevel };
}

export function updateStreak(studentId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const streak = db.select()
    .from(schema.streakRecords)
    .where(eq(schema.streakRecords.studentId, studentId))
    .get();

  if (!streak) {
    db.insert(schema.streakRecords)
      .values({ studentId, currentStreak: 1, longestStreak: 1, lastStudyDate: today })
      .run();
    return 1;
  }

  if (streak.lastStudyDate === today) return streak.currentStreak;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = streak.lastStudyDate === yesterday
    ? (streak.currentStreak ?? 0) + 1
    : 1;
  const longest = Math.max(streak.longestStreak ?? 0, newStreak);

  db.update(schema.streakRecords)
    .set({
      currentStreak: newStreak,
      longestStreak: longest,
      lastStudyDate: today,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.streakRecords.studentId, studentId))
    .run();

  if (newStreak === 7) awardXP(studentId, 'streak_7_day');
  if (newStreak === 30) awardXP(studentId, 'streak_30_day');

  return newStreak;
}

function checkBadges(
  studentId: number,
  eventType: string,
  totalXp: number,
  newLevel: number,
  oldLevel: number,
) {
  const toAward: string[] = [];

  if (newLevel > oldLevel && newLevel >= 1) toAward.push(`level_${newLevel}`);
  if (eventType === 'full_mock_complete') {
    const mockCount = db.select({ id: schema.studentXpEvents.id })
      .from(schema.studentXpEvents)
      .where(eq(schema.studentXpEvents.studentId, studentId))
      .all()
      .filter(e => (e as any).event_type === 'full_mock_complete').length;
    if (mockCount >= 5) toAward.push('mock_master');
  }

  for (const badge of toAward) {
    try {
      db.insert(schema.studentBadges)
        .values({ studentId, badgeKey: badge })
        .run();
    } catch { /* already earned */ }
  }
}

export function awardFirstStepBadge(studentId: number) {
  try {
    db.insert(schema.studentBadges)
      .values({ studentId, badgeKey: 'first_step' })
      .run();
  } catch { /* already earned */ }
}
