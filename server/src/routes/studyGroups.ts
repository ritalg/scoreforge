import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';
import { awardXP } from '../services/xpService';
import crypto from 'crypto';

const router = Router();
router.use(authGuard, requireRole(['student']));

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function getGroupWithMeta(groupId: number, studentId: number) {
  const group = db.select().from(schema.studyGroups).where(eq(schema.studyGroups.id, groupId)).get();
  if (!group) return null;
  const members = db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId)).all();
  const isMember = members.some(m => m.studentId === studentId);
  const myRole = members.find(m => m.studentId === studentId)?.role ?? null;
  const memberCount = members.length;
  return { ...group, memberCount, isMember, myRole };
}

// GET /api/groups — list joined groups + discoverable groups
router.get('/', (req, res) => {
  const studentId = req.user!.id;
  const myMemberships = db.select().from(schema.groupMembers)
    .where(eq(schema.groupMembers.studentId, studentId)).all();
  const myGroupIds = new Set(myMemberships.map(m => m.groupId));

  const allGroups = db.select().from(schema.studyGroups).all();
  const enriched = allGroups.map(g => {
    const members = db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, g.id)).all();
    return {
      ...g,
      memberCount: members.length,
      isMember: myGroupIds.has(g.id),
      myRole: myMemberships.find(m => m.groupId === g.id)?.role ?? null,
    };
  }).sort((a, b) => Number(b.isMember) - Number(a.isMember) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(enriched);
});

// POST /api/groups — create group
router.post('/', (req, res) => {
  const { name, goalScore, maxMembers = 20 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const inviteCode = generateInviteCode();
  db.insert(schema.studyGroups).values({
    name: name.trim(),
    inviteCode,
    createdBy: req.user!.id,
    maxMembers,
    goalScore: goalScore ?? null,
  }).run();

  const group = db.select().from(schema.studyGroups)
    .where(eq(schema.studyGroups.inviteCode, inviteCode)).get()!;

  // Creator is auto-joined as owner
  db.insert(schema.groupMembers).values({ groupId: group.id, studentId: req.user!.id, role: 'owner' }).run();

  res.status(201).json({ ...group, memberCount: 1, isMember: true, myRole: 'owner' });
});

// POST /api/groups/join — join by invite code
router.post('/join', (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode required' });

  const group = db.select().from(schema.studyGroups)
    .where(eq(schema.studyGroups.inviteCode, inviteCode.toUpperCase())).get();
  if (!group) return res.status(404).json({ error: 'Invalid invite code' });

  const members = db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, group.id)).all();
  if (members.length >= (group.maxMembers ?? 20)) return res.status(400).json({ error: 'Group is full' });

  const already = members.find(m => m.studentId === req.user!.id);
  if (already) return res.status(400).json({ error: 'Already a member' });

  db.insert(schema.groupMembers).values({ groupId: group.id, studentId: req.user!.id, role: 'member' }).run();

  // Post to activity feed
  const user = db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
    .from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  db.insert(schema.groupActivityFeed).values({
    groupId: group.id, studentId: req.user!.id,
    eventType: 'member_joined',
    payloadJson: JSON.stringify({ name: `${user?.firstName} ${user?.lastName}` }),
  }).run();

  res.json({ message: 'Joined group', groupId: group.id });
});

// GET /api/groups/:id — group detail
router.get('/:id', (req, res) => {
  const groupId = parseInt(req.params.id);
  const studentId = req.user!.id;
  const group = getGroupWithMeta(groupId, studentId);
  if (!group) return res.status(404).json({ error: 'Not found' });

  const members = db.select().from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, groupId)).all();

  const membersWithInfo = members.map(m => {
    const u = db.select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users).where(eq(schema.users.id, m.studentId)).get();
    const level = db.select({ currentLevel: schema.studentLevels.currentLevel, totalXp: schema.studentLevels.totalXp })
      .from(schema.studentLevels).where(eq(schema.studentLevels.studentId, m.studentId)).get();
    return { ...m, user: u, level: level?.currentLevel ?? 1, xp: level?.totalXp ?? 0 };
  }).sort((a, b) => b.xp - a.xp);

  const activity = db.select().from(schema.groupActivityFeed)
    .where(eq(schema.groupActivityFeed.groupId, groupId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  const activityEnriched = activity.map(a => {
    const u = db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users).where(eq(schema.users.id, a.studentId)).get();
    return { ...a, userName: u ? `${u.firstName} ${u.lastName}` : 'Unknown', payload: a.payloadJson ? JSON.parse(a.payloadJson) : null };
  });

  res.json({ group, members: membersWithInfo, activity: activityEnriched });
});

// DELETE /api/groups/:id/leave
router.delete('/:id/leave', (req, res) => {
  const groupId = parseInt(req.params.id);
  const studentId = req.user!.id;
  const membership = db.select().from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.studentId, studentId))).get();
  if (!membership) return res.status(404).json({ error: 'Not a member' });

  db.delete(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.studentId, studentId))).run();

  res.json({ message: 'Left group' });
});

// GET /api/groups/:id/leaderboard
router.get('/:id/leaderboard', (req, res) => {
  const groupId = parseInt(req.params.id);
  const { period = 'weekly' } = req.query;

  const members = db.select().from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, groupId)).all();

  const cutoff = period === 'weekly'
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const entries = members.map((m, i) => {
    const u = db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users).where(eq(schema.users.id, m.studentId)).get();
    let xpEvents = db.select({ xpEarned: schema.studentXpEvents.xpEarned, createdAt: schema.studentXpEvents.createdAt })
      .from(schema.studentXpEvents).where(eq(schema.studentXpEvents.studentId, m.studentId)).all();
    if (cutoff) xpEvents = xpEvents.filter(e => e.createdAt >= cutoff);
    const xp = xpEvents.reduce((acc, e) => acc + (e.xpEarned ?? 0), 0);
    const level = db.select({ currentLevel: schema.studentLevels.currentLevel })
      .from(schema.studentLevels).where(eq(schema.studentLevels.studentId, m.studentId)).get();
    return { studentId: m.studentId, firstName: u?.firstName ?? '', lastName: u?.lastName ?? '', xp, level: level?.currentLevel ?? 1, role: m.role };
  }).sort((a, b) => b.xp - a.xp).map((e, i) => ({ ...e, rank: i + 1 }));

  res.json({ entries, period });
});

// POST /api/groups/activity — post activity to all student's groups (called internally)
export function postGroupActivity(studentId: number, eventType: string, payload: object) {
  const memberships = db.select().from(schema.groupMembers)
    .where(eq(schema.groupMembers.studentId, studentId)).all();
  for (const m of memberships) {
    db.insert(schema.groupActivityFeed).values({
      groupId: m.groupId, studentId, eventType, payloadJson: JSON.stringify(payload),
    }).run();
  }
}

export default router;
