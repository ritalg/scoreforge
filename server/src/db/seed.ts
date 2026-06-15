import 'dotenv/config';
import { db, schema } from './index';
const DEFAULT_FEATURE_FLAGS = [
  { flagKey: 'study_groups', enabled: true },
  { flagKey: 'essay_scorer', enabled: true },
  { flagKey: 'mock_tests', enabled: true },
  { flagKey: 'score_prediction', enabled: true },
  { flagKey: 'gamification', enabled: true },
  { flagKey: 'flashcards', enabled: true },
  { flagKey: 'tutor_portal', enabled: true },
  { flagKey: 'leaderboard_public', enabled: true },
  { flagKey: 'sms_notifications', enabled: false },
  { flagKey: 'ferpa_mode', enabled: false },
] as const;
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');

  // ─── Feature flags ────────────────────────────────────────────────────────────
  for (const flag of DEFAULT_FEATURE_FLAGS) {
    db.insert(schema.featureFlags).values({ flagKey: flag.flagKey, enabled: flag.enabled })
      .onConflictDoNothing().run();
  }

  // ─── Platform config ──────────────────────────────────────────────────────────
  for (const cfg of [
    { configKey: 'coppa_age_threshold', configValue: '13' },
    { configKey: 'maintenance_mode', configValue: 'false' },
    { configKey: 'data_retention_years', configValue: '3' },
    { configKey: 'leaderboard_visibility', configValue: 'public' },
  ]) {
    db.insert(schema.platformConfig).values(cfg).onConflictDoNothing().run();
  }

  // ─── SAT test dates ───────────────────────────────────────────────────────────
  for (const d of [
    { testDate: '2026-03-14', registrationDeadline: '2026-02-27' },
    { testDate: '2026-05-02', registrationDeadline: '2026-04-17' },
    { testDate: '2026-06-06', registrationDeadline: '2026-05-22' },
    { testDate: '2026-08-22', registrationDeadline: '2026-08-07' },
    { testDate: '2026-10-03', registrationDeadline: '2026-09-18' },
    { testDate: '2026-11-07', registrationDeadline: '2026-10-23' },
    { testDate: '2026-12-05', registrationDeadline: '2026-11-20' },
  ]) {
    db.insert(schema.satTestDates).values(d).onConflictDoNothing().run();
  }

  // ─── Users ────────────────────────────────────────────────────────────────────
  const makeHash = (pw: string) => bcrypt.hash(pw, 10);

  async function upsertUser(data: { email: string; password: string; role: string; firstName: string; lastName: string }) {
    const existing = db.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.email, data.email)).get();
    if (existing) return existing.id;
    const hash = await makeHash(data.password);
    db.insert(schema.users).values({
      email: data.email, passwordHash: hash,
      role: data.role as any, status: 'active',
      firstName: data.firstName, lastName: data.lastName,
    }).run();
    return db.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.email, data.email)).get()!.id;
  }

  const superadminId = await upsertUser({
    email: process.env.SUPERADMIN_EMAIL || 'admin@scoreforge.coach',
    password: process.env.SUPERADMIN_PASSWORD || 'Admin123!',
    role: 'superadmin', firstName: 'Super', lastName: 'Admin',
  });

  const adminId = await upsertUser({
    email: 'content@scoreforge.coach', password: 'Admin123!',
    role: 'admin', firstName: 'Content', lastName: 'Admin',
  });

  const tutorId = await upsertUser({
    email: 'tutor@scoreforge.coach', password: 'Tutor123!',
    role: 'tutor', firstName: 'Sarah', lastName: 'Chen',
  });

  const studentId = await upsertUser({
    email: 'student@scoreforge.coach', password: 'Student123!',
    role: 'student', firstName: 'Alex', lastName: 'Rivera',
  });

  const student2Id = await upsertUser({
    email: 'student2@scoreforge.coach', password: 'Student123!',
    role: 'student', firstName: 'Jordan', lastName: 'Kim',
  });

  const parentId = await upsertUser({
    email: 'parent@scoreforge.coach', password: 'Parent123!',
    role: 'parent', firstName: 'Maria', lastName: 'Rivera',
  });

  // ─── Parent-student link ──────────────────────────────────────────────────────
  try {
    db.insert(schema.parentStudentLinks).values({
      parentId, studentId, status: 'active', consentTimestamp: new Date().toISOString(),
    }).run();
  } catch {}

  // ─── Tutor-student link ───────────────────────────────────────────────────────
  for (const sid of [studentId, student2Id]) {
    try {
      db.insert(schema.tutorStudentLinks).values({ tutorId, studentId: sid, status: 'active' }).run();
    } catch {}
  }

  // ─── Sample questions ─────────────────────────────────────────────────────────
  const sampleQuestions = [
    {
      questionText: 'If 3x + 7 = 22, what is the value of x?',
      choices: ['3', '5', '6', '8'],
      correctAnswer: 'B',
      topicKey: 'algebra', module: 'm1', difficulty: 'easy',
      explanation: 'Subtract 7 from both sides: 3x = 15. Divide by 3: x = 5.',
    },
    {
      questionText: 'Which of the following is equivalent to (x + 3)² − 9?',
      choices: ['x² + 6x', 'x² + 9', 'x² − 6x + 9', 'x² + 3'],
      correctAnswer: 'A',
      topicKey: 'algebra', module: 'm1', difficulty: 'medium',
      explanation: '(x+3)² = x² + 6x + 9. Subtract 9: x² + 6x.',
    },
    {
      questionText: 'A line has slope 2 and passes through (1, 4). What is the y-intercept?',
      choices: ['1', '2', '3', '4'],
      correctAnswer: 'B',
      topicKey: 'algebra', module: 'm2_easy', difficulty: 'medium',
      explanation: 'y = mx + b → 4 = 2(1) + b → b = 2.',
    },
    {
      questionText: 'The function f(x) = x² − 4x + 4. For what value of x is f(x) = 0?',
      choices: ['0', '1', '2', '4'],
      correctAnswer: 'C',
      topicKey: 'advanced_math', module: 'm2_hard', difficulty: 'hard',
      explanation: 'f(x) = (x−2)². Set to 0: x = 2.',
    },
    {
      questionText: 'In the triangle below, if the two legs are 3 and 4, what is the hypotenuse?',
      choices: ['5', '6', '7', '8'],
      correctAnswer: 'A',
      topicKey: 'geometry', module: 'm1', difficulty: 'easy',
      explanation: 'Pythagorean theorem: 3² + 4² = 9 + 16 = 25 = 5².',
    },
    {
      questionText: 'As used in the passage, "ephemeral" most nearly means:',
      choices: ['long-lasting', 'brief', 'colorful', 'mysterious'],
      correctAnswer: 'B',
      topicKey: 'craft_structure', module: 'm1', difficulty: 'medium',
      explanation: '"Ephemeral" means lasting for a very short time.',
    },
    {
      questionText: 'The author uses the phrase "ticking clock" primarily to:',
      choices: ['describe the setting', 'create urgency', 'introduce a character', 'provide evidence'],
      correctAnswer: 'B',
      topicKey: 'craft_structure', module: 'm1', difficulty: 'medium',
      explanation: 'Figurative language like "ticking clock" creates a sense of urgency or time pressure.',
    },
    {
      questionText: 'Which sentence contains a comma splice error?',
      choices: [
        'She studied hard, and she passed the test.',
        'She studied hard, she passed the test.',
        'She studied hard; she passed the test.',
        'Because she studied hard, she passed the test.',
      ],
      correctAnswer: 'B',
      topicKey: 'standard_english', module: 'm1', difficulty: 'easy',
      explanation: 'Choice B has two independent clauses joined only by a comma — a comma splice.',
    },
    {
      questionText: 'Data from the graph shows the population grew at 5% per year. Which equation models P(t)?',
      choices: ['P = 1000 + 50t', 'P = 1000(1.05)^t', 'P = 1000t^1.05', 'P = 1000(0.05)^t'],
      correctAnswer: 'B',
      topicKey: 'problem_solving', module: 'm1', difficulty: 'medium',
      explanation: 'Exponential growth: P = P₀(1 + r)^t = 1000(1.05)^t.',
    },
    {
      questionText: 'Which of the following best supports the author\'s claim that exercise improves cognition?',
      choices: [
        'Athletes earn more on average',
        'A study found 30 min exercise improved test scores by 15%',
        'Exercise has been practiced for centuries',
        'Many schools require PE',
      ],
      correctAnswer: 'B',
      topicKey: 'info_ideas', module: 'm1', difficulty: 'medium',
      explanation: 'Only choice B provides direct empirical evidence for the claim.',
    },
  ];

  for (const q of sampleQuestions) {
    const existingQ = db.select({ id: schema.questions.id }).from(schema.questions)
      .where(eq(schema.questions.questionText, q.questionText)).get();
    if (!existingQ) {
      db.insert(schema.questions).values({
        questionText: q.questionText,
        choiceA: q.choices[0] ?? null,
        choiceB: q.choices[1] ?? null,
        choiceC: q.choices[2] ?? null,
        choiceD: q.choices[3] ?? null,
        correctAnswer: q.correctAnswer,
        topicKey: q.topicKey,
        module: q.module as 'm1' | 'm2_hard' | 'm2_easy',
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
        explanation: q.explanation,
        status: 'approved',
      }).run();
    }
  }

  // ─── Gamification: seed XP and levels for demo student ───────────────────────
  try {
    db.insert(schema.studentLevels).values({ studentId, currentLevel: 4, totalXp: 680 }).run();
  } catch {
    db.update(schema.studentLevels).set({ currentLevel: 4, totalXp: 680 }).where(eq(schema.studentLevels.studentId, studentId)).run();
  }
  try {
    db.insert(schema.studentLevels).values({ studentId: student2Id, currentLevel: 2, totalXp: 210 }).run();
  } catch {}
  try {
    db.insert(schema.streakRecords).values({ studentId, currentStreak: 5, longestStreak: 12, lastStudyDate: new Date().toISOString().split('T')[0] }).run();
  } catch {}

  // ─── Demo flashcard deck ──────────────────────────────────────────────────────
  const existingDeck = db.select({ id: schema.flashcardDecks.id }).from(schema.flashcardDecks)
    .where(eq(schema.flashcardDecks.name, 'SAT Math Formulas')).get();

  let deckId = existingDeck?.id;
  if (!deckId) {
    db.insert(schema.flashcardDecks).values({
      name: 'SAT Math Formulas', topicKey: 'algebra', isSystemDeck: true,
      published: true, createdBy: adminId,
    }).run();
    deckId = db.select({ id: schema.flashcardDecks.id }).from(schema.flashcardDecks)
      .where(eq(schema.flashcardDecks.name, 'SAT Math Formulas')).get()!.id;
  }

  const flashcards = [
    { front: 'Slope formula', back: 'm = (y₂ − y₁) / (x₂ − x₁)', hint: 'Rise over run' },
    { front: 'Pythagorean Theorem', back: 'a² + b² = c²', hint: 'c is the hypotenuse' },
    { front: 'Quadratic Formula', back: 'x = (−b ± √(b² − 4ac)) / 2a', hint: 'Solves ax² + bx + c = 0' },
    { front: 'Area of a circle', back: 'A = πr²', hint: 'r is the radius' },
    { front: 'Circumference of a circle', back: 'C = 2πr', hint: 'Or C = πd' },
    { front: 'Distance formula', back: 'd = √((x₂−x₁)² + (y₂−y₁)²)', hint: 'From Pythagorean theorem' },
    { front: 'Percent change', back: '((new − old) / old) × 100', hint: 'Positive = increase, negative = decrease' },
    { front: 'Slope-intercept form', back: 'y = mx + b', hint: 'm = slope, b = y-intercept' },
  ];

  for (const fc of flashcards) {
    const existingCard = db.select({ id: schema.flashcards.id }).from(schema.flashcards)
      .where(eq(schema.flashcards.frontText, fc.front)).get();
    if (!existingCard) {
      db.insert(schema.flashcards).values({ deckId: deckId!, frontText: fc.front, backText: fc.back, hint: fc.hint, createdBy: adminId }).run();
    }
  }

  // ─── Demo study group ─────────────────────────────────────────────────────────
  const existingGroup = db.select({ id: schema.studyGroups.id }).from(schema.studyGroups)
    .where(eq(schema.studyGroups.name, '1400+ Club')).get();
  if (!existingGroup) {
    db.insert(schema.studyGroups).values({
      name: '1400+ Club', inviteCode: 'DEMO1400', createdBy: studentId,
      maxMembers: 20, goalScore: 1400,
    }).run();
    const group = db.select({ id: schema.studyGroups.id }).from(schema.studyGroups)
      .where(eq(schema.studyGroups.name, '1400+ Club')).get()!;
    try { db.insert(schema.groupMembers).values({ groupId: group.id, studentId, role: 'owner' }).run(); } catch {}
    try { db.insert(schema.groupMembers).values({ groupId: group.id, studentId: student2Id, role: 'member' }).run(); } catch {}
  }

  console.log(`
✓ Feature flags, platform config, SAT dates
✓ Users seeded:
  superadmin: admin@scoreforge.coach / Admin123!
  admin:      content@scoreforge.coach / Admin123!
  tutor:      tutor@scoreforge.coach / Tutor123!
  student:    student@scoreforge.coach / Student123!
  student2:   student2@scoreforge.coach / Student123!
  parent:     parent@scoreforge.coach / Parent123!
✓ 10 sample approved questions
✓ SAT Math Formulas flashcard deck (8 cards)
✓ Study group "1400+ Club" (invite code: DEMO1400)
✓ Tutor linked to both students
✓ Parent linked to Alex Rivera
  `);
}

export { seed };

if (require.main === module) {
  seed().catch(console.error).finally(() => process.exit(0));
}
