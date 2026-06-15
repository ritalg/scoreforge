"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FEATURE_FLAGS = exports.computeLevel = exports.XP_LEVEL_THRESHOLDS = exports.XP_EVENTS = exports.BADGE_KEYS = exports.TOPIC_LABELS = exports.RW_TOPICS = exports.MATH_TOPICS = exports.TOPIC_KEYS = void 0;

exports.TOPIC_KEYS = ['algebra', 'adv_math', 'psda', 'geometry', 'info_ideas', 'craft_structure', 'expression', 'conventions'];
exports.MATH_TOPICS = ['algebra', 'adv_math', 'psda', 'geometry'];
exports.RW_TOPICS = ['info_ideas', 'craft_structure', 'expression', 'conventions'];
exports.TOPIC_LABELS = {
  algebra: 'Algebra',
  adv_math: 'Advanced Math',
  psda: 'Problem Solving & Data',
  geometry: 'Geometry & Trig',
  info_ideas: 'Information & Ideas',
  craft_structure: 'Craft & Structure',
  expression: 'Expression of Ideas',
  conventions: 'Standard English Conventions',
};
exports.BADGE_KEYS = ['first_step', 'on_a_roll', 'algebra_ace', 'speed_demon', 'mock_master', 'score_jump', 'perfect_score', 'night_owl', 'early_bird', 'streak_30'];
exports.XP_EVENTS = {
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
};
exports.XP_LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5500, 7500, 10000, 13000, 17000, 22000, 28000, 35000, 43000, 52000];
exports.computeLevel = function(totalXp) {
  return exports.XP_LEVEL_THRESHOLDS.filter(function(t) { return totalXp >= t; }).length;
};
exports.DEFAULT_FEATURE_FLAGS = [
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
];
