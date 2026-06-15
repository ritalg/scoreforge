import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── USERS ───────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['student', 'parent', 'tutor', 'admin', 'superadmin'] }).notNull().default('student'),
  status: text('status', { enum: ['active', 'pending_verification', 'suspended', 'deleted'] }).notNull().default('pending_verification'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  verificationToken: text('verification_token'),
  verificationExpiry: text('verification_expiry'),
  resetToken: text('reset_token'),
  resetExpiry: text('reset_expiry'),
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).default(false),
  language: text('language').default('en'),
  theme: text('theme', { enum: ['system', 'light', 'dark'] }).default('system'),
  fontSize: text('font_size', { enum: ['sm', 'md', 'lg', 'xl'] }).default('md'),
  leaderboardOptOut: integer('leaderboard_opt_out', { mode: 'boolean' }).default(false),
  birthYear: integer('birth_year'),
  coppaConsentGiven: integer('coppa_consent_given', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── PARENT / STUDENT LINKS ───────────────────────────────────────────────────

export const parentStudentLinks = sqliteTable('parent_student_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  parentId: integer('parent_id').notNull().references(() => users.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'active'] }).notNull().default('pending'),
  consentTimestamp: text('consent_timestamp'),
  linkedAt: text('linked_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('parent_student_unique').on(t.parentId, t.studentId),
}));

// ─── TUTOR LINKS ─────────────────────────────────────────────────────────────

export const tutorStudentLinks = sqliteTable('tutor_student_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tutorId: integer('tutor_id').notNull().references(() => users.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'active'] }).notNull().default('pending'),
  tutorNotes: text('tutor_notes'),
  linkedAt: text('linked_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('tutor_student_unique').on(t.tutorId, t.studentId),
}));

// ─── STUDENT PROFILES ─────────────────────────────────────────────────────────

export const studentProfiles = sqliteTable('student_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id).unique(),
  gradeLevel: integer('grade_level'),
  targetScore: integer('target_score'),
  targetTestDate: text('target_test_date'),
  studyHoursPerWeek: integer('study_hours_per_week').default(5),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── UPLOADS ──────────────────────────────────────────────────────────────────

export const uploads = sqliteTable('uploads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  originalFilename: text('original_filename').notNull(),
  storedPath: text('stored_path').notNull(),
  status: text('status', { enum: ['queued', 'extracting', 'tagging', 'pending_review', 'done', 'failed'] }).notNull().default('queued'),
  testName: text('test_name'),
  section: text('section', { enum: ['math', 'rw', 'both'] }),
  errorMessage: text('error_message'),
  questionCount: integer('question_count').default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

// ─── PASSAGES ─────────────────────────────────────────────────────────────────

export const passages = sqliteTable('passages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uploadId: integer('upload_id').references(() => uploads.id),
  passageText: text('passage_text').notNull(),
  passageType: text('passage_type'),
  topicKey: text('topic_key'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uploadId: integer('upload_id').references(() => uploads.id),
  passageId: integer('passage_id').references(() => passages.id),
  questionNumber: integer('question_number'),
  questionText: text('question_text').notNull(),
  questionType: text('question_type', { enum: ['multiple_choice', 'grid_in'] }).notNull().default('multiple_choice'),
  choiceA: text('choice_a'),
  choiceB: text('choice_b'),
  choiceC: text('choice_c'),
  choiceD: text('choice_d'),
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation'),
  topicKey: text('topic_key'),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
  module: text('module', { enum: ['m1', 'm2_hard', 'm2_easy'] }),
  status: text('status', { enum: ['pending_review', 'approved', 'rejected', 'flagged'] }).notNull().default('pending_review'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: text('reviewed_at'),
  attemptCount: integer('attempt_count').default(0),
  correctCount: integer('correct_count').default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const questionFigures = sqliteTable('question_figures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: integer('question_id').notNull().references(() => questions.id),
  imagePath: text('image_path').notNull(),
  figureType: text('figure_type'),
  altText: text('alt_text'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const questionVersions = sqliteTable('question_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: integer('question_id').notNull().references(() => questions.id),
  versionNumber: integer('version_number').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  editedBy: integer('edited_by').notNull().references(() => users.id),
  editedAt: text('edited_at').notNull().default(sql`(datetime('now'))`),
});

// ─── QUIZ SESSIONS ────────────────────────────────────────────────────────────

export const quizSessions = sqliteTable('quiz_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  mode: text('mode', { enum: ['practice', 'timed_quiz', 'adaptive', 'sr_drill', 'assignment'] }).notNull(),
  topicKey: text('topic_key'),
  status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] }).notNull().default('in_progress'),
  questionCountTarget: integer('question_count_target').default(20),
  questionCountActual: integer('question_count_actual').default(0),
  correctCount: integer('correct_count').default(0),
  scorePct: real('score_pct'),
  timeLimitSeconds: integer('time_limit_seconds'),
  timeSpentSeconds: integer('time_spent_seconds'),
  assignmentId: integer('assignment_id'),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

export const quizQuestionAttempts = sqliteTable('quiz_question_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => quizSessions.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  studentAnswer: text('student_answer'),
  isCorrect: integer('is_correct', { mode: 'boolean' }),
  timeSpentSeconds: integer('time_spent_seconds'),
  flaggedForReview: integer('flagged_for_review', { mode: 'boolean' }).default(false),
  answeredAt: text('answered_at').default(sql`(datetime('now'))`),
});

// ─── MOCK TESTS ───────────────────────────────────────────────────────────────

export const scoringTables = sqliteTable('scoring_tables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testName: text('test_name').notNull(),
  section: text('section', { enum: ['math', 'rw'] }).notNull(),
  rawScore: integer('raw_score').notNull(),
  scaledScore: integer('scaled_score').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const mockTestSessions = sqliteTable('mock_test_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] }).notNull().default('in_progress'),
  sections: text('sections').notNull(),
  m1MathSessionId: integer('m1_math_session_id').references(() => quizSessions.id),
  m2MathSessionId: integer('m2_math_session_id').references(() => quizSessions.id),
  m1RwSessionId: integer('m1_rw_session_id').references(() => quizSessions.id),
  m2RwSessionId: integer('m2_rw_session_id').references(() => quizSessions.id),
  mathModule2Level: text('math_module2_level', { enum: ['easy_medium', 'hard'] }),
  rwModule2Level: text('rw_module2_level', { enum: ['easy_medium', 'hard'] }),
  rawMathScore: integer('raw_math_score'),
  rawRwScore: integer('raw_rw_score'),
  scaledMathScore: integer('scaled_math_score'),
  scaledRwScore: integer('scaled_rw_score'),
  compositeScore: integer('composite_score'),
  scoringTableId: integer('scoring_table_id').references(() => scoringTables.id),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

// ─── SPACED REPETITION ────────────────────────────────────────────────────────

export const spacedRepetitionRecords = sqliteTable('spaced_repetition_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  nextReviewAt: text('next_review_at').notNull(),
  intervalDays: real('interval_days').notNull().default(1),
  easeFactor: real('ease_factor').notNull().default(2.5),
  repetitionCount: integer('repetition_count').notNull().default(0),
  lastQuality: integer('last_quality'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('sr_student_question_unique').on(t.studentId, t.questionId),
  nextReviewIdx: index('sr_next_review_idx').on(t.studentId, t.nextReviewAt),
}));

// ─── FLASHCARDS ───────────────────────────────────────────────────────────────

export const flashcardDecks = sqliteTable('flashcard_decks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  topicKey: text('topic_key'),
  isSystemDeck: integer('is_system_deck', { mode: 'boolean' }).default(false),
  published: integer('published', { mode: 'boolean' }).default(false),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const flashcards = sqliteTable('flashcards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deckId: integer('deck_id').notNull().references(() => flashcardDecks.id),
  frontText: text('front_text').notNull(),
  backText: text('back_text').notNull(),
  hint: text('hint'),
  imageUrl: text('image_url'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const flashcardSrRecords = sqliteTable('flashcard_sr_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  cardId: integer('card_id').notNull().references(() => flashcards.id),
  nextReviewAt: text('next_review_at').notNull(),
  intervalDays: real('interval_days').notNull().default(1),
  easeFactor: real('ease_factor').notNull().default(2.5),
  repetitionCount: integer('repetition_count').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('flashcard_sr_unique').on(t.studentId, t.cardId),
}));

// ─── ESSAY SCORER ─────────────────────────────────────────────────────────────

export const essaySubmissions = sqliteTable('essay_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  essayType: text('essay_type', { enum: ['sat_essay', 'act_essay', 'general'] }).notNull(),
  promptText: text('prompt_text'),
  essayText: text('essay_text').notNull(),
  readingScore: integer('reading_score'),
  analysisScore: integer('analysis_score'),
  writingScore: integer('writing_score'),
  totalScore: integer('total_score'),
  aiFeedbackJson: text('ai_feedback_json'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── SCORE PREDICTIONS ────────────────────────────────────────────────────────

export const scorePredictions = sqliteTable('score_predictions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  predictedComposite: integer('predicted_composite'),
  predictedMath: integer('predicted_math'),
  predictedRw: integer('predicted_rw'),
  confidenceInterval: integer('confidence_interval'),
  modelVersion: text('model_version'),
  featureSnapshotJson: text('feature_snapshot_json'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── ANNOTATIONS & ERROR LOG ──────────────────────────────────────────────────

export const questionAnnotations = sqliteTable('question_annotations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  startChar: integer('start_char').notNull(),
  endChar: integer('end_char').notNull(),
  noteText: text('note_text'),
  tag: text('tag', { enum: ['confusion', 'key_insight', 'strategy_note'] }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const errorLogNotes = sqliteTable('error_log_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  attemptId: integer('attempt_id').notNull().references(() => quizQuestionAttempts.id),
  reflection: text('reflection'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── STUDY GROUPS ─────────────────────────────────────────────────────────────

export const studyGroups = sqliteTable('study_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  maxMembers: integer('max_members').default(20),
  goalScore: integer('goal_score'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const groupMembers = sqliteTable('group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => studyGroups.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
  joinedAt: text('joined_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('group_member_unique').on(t.groupId, t.studentId),
}));

export const groupActivityFeed = sqliteTable('group_activity_feed', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => studyGroups.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  eventType: text('event_type').notNull(),
  payloadJson: text('payload_json'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const groupChallenges = sqliteTable('group_challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => studyGroups.id),
  challengerId: integer('challenger_id').notNull().references(() => users.id),
  challengedId: integer('challenged_id').notNull().references(() => users.id),
  quizSessionId: integer('quiz_session_id').references(() => quizSessions.id),
  status: text('status', { enum: ['pending', 'accepted', 'completed', 'declined'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── GAMIFICATION ─────────────────────────────────────────────────────────────

export const studentXpEvents = sqliteTable('student_xp_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  eventType: text('event_type').notNull(),
  xpEarned: integer('xp_earned').notNull(),
  referenceId: integer('reference_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  idempotencyIdx: uniqueIndex('xp_idempotency').on(t.studentId, t.eventType, t.referenceId),
}));

export const studentLevels = sqliteTable('student_levels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id).unique(),
  currentLevel: integer('current_level').notNull().default(1),
  totalXp: integer('total_xp').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const studentBadges = sqliteTable('student_badges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  badgeKey: text('badge_key').notNull(),
  earnedAt: text('earned_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('student_badge_unique').on(t.studentId, t.badgeKey),
}));

export const streakRecords = sqliteTable('streak_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id).unique(),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastStudyDate: text('last_study_date'),
  freezeCountRemaining: integer('freeze_count_remaining').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const notificationPreferences = sqliteTable('notification_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  notificationType: text('notification_type').notNull(),
  inApp: integer('in_app', { mode: 'boolean' }).default(true),
  email: integer('email', { mode: 'boolean' }).default(true),
  push: integer('push', { mode: 'boolean' }).default(false),
  sms: integer('sms', { mode: 'boolean' }).default(false),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniquePair: uniqueIndex('notif_pref_unique').on(t.userId, t.notificationType),
}));

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  read: integer('read', { mode: 'boolean' }).default(false),
  actionUrl: text('action_url'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

export const assignments = sqliteTable('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tutorId: integer('tutor_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  questionSelectionJson: text('question_selection_json').notNull(),
  dueDate: text('due_date').notNull(),
  timeLimitSeconds: integer('time_limit_seconds'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const assignmentStudents = sqliteTable('assignment_students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'in_progress', 'completed'] }).notNull().default('pending'),
  completedAt: text('completed_at'),
  quizSessionId: integer('quiz_session_id').references(() => quizSessions.id),
}, (t) => ({
  uniquePair: uniqueIndex('assignment_student_unique').on(t.assignmentId, t.studentId),
}));

// ─── ADMIN / PLATFORM ─────────────────────────────────────────────────────────

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  payloadJson: text('payload_json'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const featureFlags = sqliteTable('feature_flags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  flagKey: text('flag_key').notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const platformConfig = sqliteTable('platform_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configKey: text('config_key').notNull().unique(),
  configValue: text('config_value').notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── TEST CALENDAR ────────────────────────────────────────────────────────────

export const satTestDates = sqliteTable('sat_test_dates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testDate: text('test_date').notNull(),
  registrationDeadline: text('registration_deadline'),
  isOfficial: integer('is_official', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const studentTestCalendar = sqliteTable('student_test_calendar', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  satTestDateId: integer('sat_test_date_id').references(() => satTestDates.id),
  customDate: text('custom_date'),
  isTarget: integer('is_target', { mode: 'boolean' }).default(false),
  status: text('status', { enum: ['planned', 'completed', 'missed'] }).default('planned'),
  actualScore: integer('actual_score'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
