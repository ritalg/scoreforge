export const TOPIC_KEYS = [
  'algebra', 'adv_math', 'psda', 'geometry',
  'info_ideas', 'craft_structure', 'expression', 'conventions',
] as const;
export type TopicKey = typeof TOPIC_KEYS[number];

export const MATH_TOPICS: TopicKey[] = ['algebra', 'adv_math', 'psda', 'geometry'];
export const RW_TOPICS: TopicKey[] = ['info_ideas', 'craft_structure', 'expression', 'conventions'];

export const TOPIC_LABELS: Record<TopicKey, string> = {
  algebra: 'Algebra',
  adv_math: 'Advanced Math',
  psda: 'Problem Solving & Data',
  geometry: 'Geometry & Trig',
  info_ideas: 'Information & Ideas',
  craft_structure: 'Craft & Structure',
  expression: 'Expression of Ideas',
  conventions: 'Standard English Conventions',
};

export type UserRole = 'student' | 'parent' | 'tutor' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'pending_verification' | 'suspended' | 'deleted';
export type QuestionStatus = 'pending_review' | 'approved' | 'rejected' | 'flagged';
export type QuestionType = 'multiple_choice' | 'grid_in';
export type QuizMode = 'practice' | 'timed_quiz' | 'adaptive' | 'sr_drill' | 'assignment';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type UploadStatus = 'queued' | 'extracting' | 'tagging' | 'pending_review' | 'done' | 'failed';
export type ModuleLevel = 'easy_medium' | 'hard';
export type SRQuality = 0 | 3 | 5;
export type QuestionModule = 'm1' | 'm2_hard' | 'm2_easy';

export const BADGE_KEYS = [
  'first_step', 'on_a_roll', 'algebra_ace', 'speed_demon', 'mock_master',
  'score_jump', 'perfect_score', 'night_owl', 'early_bird', 'streak_30',
] as const;
export type BadgeKey = typeof BADGE_KEYS[number];

export const XP_EVENTS = {
  daily_login: 5,
  study_session_30min: 10,
  quiz_question_correct: 5,
  quiz_question_answered: 2,
  timed_quiz_bonus: 5,
  full_mock_complete: 100,
  sr_drill_correct: 3,
  essay_submitted: 25,
  challenge_won: 20,
  challenge_participated: 10,
  streak_7_day: 50,
  streak_30_day: 200,
} as const;
export type XPEventType = keyof typeof XP_EVENTS;

export const XP_LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000,
  5500, 7500, 10000, 13000, 17000, 22000, 28000, 35000, 43000, 52000,
];

export function computeLevel(totalXp: number): number {
  return XP_LEVEL_THRESHOLDS.filter(t => totalXp >= t).length;
}

export const DEFAULT_FEATURE_FLAGS = [
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
