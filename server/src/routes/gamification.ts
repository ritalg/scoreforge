import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, gte, desc } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { awardXP, updateStreak } from '../services/xpService';
import { computeLevel, XP_LEVEL_THRESHOLDS, BADGE_KEYS } from '@scoreforge/shared';

const router = Router();

// GET /api/gamification/profile
router.get('/profile', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;

  const level = db.select()
    .from(schema.studentLevels)
    .where(eq(schema.studentLevels.studentId, studentId))
    .get() ?? { currentLevel: 1, totalXp: 0 };

  const streak = db.select()
    .from(schema.streakRecords)
    .where(eq(schema.streakRecords.studentId, studentId))
    .get() ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: null, freezeCountRemaining: 0 };

  const badges = db.select()
    .from(schema.studentBadges)
    .where(eq(schema.studentBadges.studentId, studentId))
    .all();

  const currentLevel = level.currentLevel ?? 1;
  const totalXp = level.totalXp ?? 0;
  const currentThreshold = XP_LEVEL_THRESHOLDS[currentLevel - 1] ?? 0;
  const nextThreshold = XP_LEVEL_THRESHOLDS[currentLevel] ?? XP_LEVEL_THRESHOLDS[XP_LEVEL_THRESHOLDS.length - 1];
  const xpIntoLevel = totalXp - currentThreshold;
  const xpForLevel = nextThreshold - currentThreshold;

  res.json({
    level: currentLevel,
    totalXp,
    xpIntoLevel,
    xpForLevel,
    xpProgressPct: xpForLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100)) : 100,
    streak: {
      current: streak.currentStreak ?? 0,
      longest: streak.longestStreak ?? 0,
      lastStudyDate: streak.lastStudyDate,
      freezeCount: streak.freezeCountRemaining ?? 0,
    },
    badges: badges.map(b => ({ key: b.badgeKey, earnedAt: b.earnedAt })),
    badgeCount: badges.length,
  });
});

// POST /api/gamification/daily-login
router.post('/daily-login', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;
  const result = awardXP(studentId, 'daily_login');
  updateStreak(studentId);
  res.json({ message: 'Daily login recorded', xpEarned: result?.xpEarned ?? 0 });
});

// GET /api/gamification/leaderboard
router.get('/leaderboard', authGuard, (req, res) => {
  const { period = 'weekly', scope = 'global' } = req.query;

  // Check feature flag
  const ferpaMode = db.select()
    .from(schema.featureFlags)
    .where(eq(schema.featureFlags.flagKey, 'ferpa_mode'))
    .get();
  const leaderboardFlag = db.select()
    .from(schema.featureFlags)
    .where(eq(schema.featureFlags.flagKey, 'leaderboard_public'))
    .get();

  if (ferpaMode?.enabled || !leaderboardFlag?.enabled) {
    return res.status(403).json({ error: 'Leaderboard is disabled' });
  }

  if (period === 'weekly') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const xpEvents = db.select({
      studentId: schema.studentXpEvents.studentId,
      xpEarned: schema.studentXpEvents.xpEarned,
    })
      .from(schema.studentXpEvents)
      .where(gte(schema.studentXpEvents.createdAt, weekAgo))
      .all();

    const weeklyXp: Record<number, number> = {};
    for (const e of xpEvents) {
      weeklyXp[e.studentId] = (weeklyXp[e.studentId] ?? 0) + (e.xpEarned ?? 0);
    }

    const sorted = Object.entries(weeklyXp)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);

    const entries = sorted.map(([sid, xp], i) => {
      const user = db.select({
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        leaderboardOptOut: schema.users.leaderboardOptOut,
      })
        .from(schema.users)
        .where(eq(schema.users.id, Number(sid)))
        .get();

      if (user?.leaderboardOptOut) return null;
      return {
        rank: i + 1,
        studentId: Number(sid),
        displayName: `${user?.firstName ?? 'Student'} ${(user?.lastName ?? '').charAt(0)}.`,
        weeklyXp: xp,
        isCurrentUser: Number(sid) === req.user?.id,
      };
    }).filter(Boolean);

    return res.json(entries);
  }

  // All-time leaderboard
  const allTime = db.select({
    studentId: schema.studentLevels.studentId,
    totalXp: schema.studentLevels.totalXp,
    currentLevel: schema.studentLevels.currentLevel,
  })
    .from(schema.studentLevels)
    .all()
    .sort((a, b) => (b.totalXp ?? 0) - (a.totalXp ?? 0))
    .slice(0, 50);

  const entries = allTime.map((row, i) => {
    const user = db.select({
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      leaderboardOptOut: schema.users.leaderboardOptOut,
    })
      .from(schema.users)
      .where(eq(schema.users.id, row.studentId))
      .get();

    if (user?.leaderboardOptOut) return null;
    return {
      rank: i + 1,
      studentId: row.studentId,
      displayName: `${user?.firstName ?? 'Student'} ${(user?.lastName ?? '').charAt(0)}.`,
      totalXp: row.totalXp,
      level: row.currentLevel,
      isCurrentUser: row.studentId === req.user?.id,
    };
  }).filter(Boolean);

  res.json(entries);
});

// GET /api/gamification/badges/available
router.get('/badges/available', authGuard, requireRole(['student']), (req, res) => {
  const studentId = req.user!.id;
  const earned = db.select()
    .from(schema.studentBadges)
    .where(eq(schema.studentBadges.studentId, studentId))
    .all();
  const earnedSet = new Set(earned.map(b => b.badgeKey));

  const BADGE_INFO: Record<string, { label: string; description: string }> = {
    first_step: { label: 'First Step', description: 'Complete onboarding' },
    on_a_roll: { label: 'On A Roll', description: '7-day study streak' },
    algebra_ace: { label: 'Algebra Ace', description: '≥ 90% accuracy in Algebra (30+ questions)' },
    speed_demon: { label: 'Speed Demon', description: 'Complete a timed quiz with >10 min remaining' },
    mock_master: { label: 'Mock Master', description: 'Complete 5 full mock tests' },
    score_jump: { label: 'Score Jump', description: 'Improve composite score by 100+ points' },
    perfect_score: { label: 'Perfect Score', description: '100% on any 20+ question quiz' },
    night_owl: { label: 'Night Owl', description: 'Study session after 10 PM' },
    early_bird: { label: 'Early Bird', description: 'Study session before 7 AM' },
    streak_30: { label: 'Dedicated', description: '30-day study streak' },
  };

  const badges = Object.entries(BADGE_INFO).map(([key, info]) => ({
    key,
    ...info,
    earned: earnedSet.has(key),
    earnedAt: earned.find(b => b.badgeKey === key)?.earnedAt ?? null,
  }));

  res.json(badges);
});

export default router;
