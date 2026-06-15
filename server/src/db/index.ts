import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/sat_prep.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite: DatabaseType = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite, schema };
export type DB = typeof db;

export function autoSetup(): void {
  const row = sqlite.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='users'").get() as { count: number };
  if (row.count > 0) return;
  console.log('[DB] First boot: creating tables...');
  runSetupSql(sqlite);
  console.log('[DB] Tables created successfully');
}

function runSetupSql(db: import('better-sqlite3').Database): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT NOT NULL DEFAULT 'pending_verification',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  verification_token TEXT,
  verification_expiry TEXT,
  reset_token TEXT,
  reset_expiry TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER DEFAULT 0,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'system',
  font_size TEXT DEFAULT 'md',
  leaderboard_opt_out INTEGER DEFAULT 0,
  birth_year INTEGER,
  coppa_consent_given INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS parent_student_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  consent_timestamp TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(parent_id, student_id)
);
CREATE TABLE IF NOT EXISTS tutor_student_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  tutor_notes TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tutor_id, student_id)
);
CREATE TABLE IF NOT EXISTS student_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  grade_level INTEGER,
  target_score INTEGER,
  target_test_date TEXT,
  study_hours_per_week INTEGER DEFAULT 5,
  onboarding_completed INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  test_name TEXT,
  section TEXT,
  error_message TEXT,
  question_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER REFERENCES uploads(id),
  passage_text TEXT NOT NULL,
  passage_type TEXT,
  topic_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER REFERENCES uploads(id),
  passage_id INTEGER REFERENCES passages(id),
  question_number INTEGER,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  choice_a TEXT,
  choice_b TEXT,
  choice_c TEXT,
  choice_d TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  topic_key TEXT,
  difficulty TEXT,
  module TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  attempt_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS question_figures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  image_path TEXT NOT NULL,
  figure_type TEXT,
  alt_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS question_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  version_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  edited_by INTEGER NOT NULL REFERENCES users(id),
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL,
  topic_key TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  question_count_target INTEGER DEFAULT 20,
  question_count_actual INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  score_pct REAL,
  time_limit_seconds INTEGER,
  time_spent_seconds INTEGER,
  assignment_id INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS quiz_question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES quiz_sessions(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  student_answer TEXT,
  is_correct INTEGER,
  time_spent_seconds INTEGER,
  flagged_for_review INTEGER DEFAULT 0,
  answered_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS scoring_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_name TEXT NOT NULL,
  section TEXT NOT NULL,
  raw_score INTEGER NOT NULL,
  scaled_score INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mock_test_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress',
  sections TEXT NOT NULL,
  m1_math_session_id INTEGER REFERENCES quiz_sessions(id),
  m2_math_session_id INTEGER REFERENCES quiz_sessions(id),
  m1_rw_session_id INTEGER REFERENCES quiz_sessions(id),
  m2_rw_session_id INTEGER REFERENCES quiz_sessions(id),
  math_module2_level TEXT,
  rw_module2_level TEXT,
  raw_math_score INTEGER,
  raw_rw_score INTEGER,
  scaled_math_score INTEGER,
  scaled_rw_score INTEGER,
  composite_score INTEGER,
  scoring_table_id INTEGER REFERENCES scoring_tables(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS spaced_repetition_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  next_review_at TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetition_count INTEGER NOT NULL DEFAULT 0,
  last_quality INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, question_id)
);
CREATE INDEX IF NOT EXISTS sr_next_review_idx ON spaced_repetition_records(student_id, next_review_at);
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  topic_key TEXT,
  is_system_deck INTEGER DEFAULT 0,
  published INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id),
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  hint TEXT,
  image_url TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS flashcard_sr_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  card_id INTEGER NOT NULL REFERENCES flashcards(id),
  next_review_at TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetition_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, card_id)
);
CREATE TABLE IF NOT EXISTS essay_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  essay_type TEXT NOT NULL,
  prompt_text TEXT,
  essay_text TEXT NOT NULL,
  reading_score INTEGER,
  analysis_score INTEGER,
  writing_score INTEGER,
  total_score INTEGER,
  ai_feedback_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS score_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  predicted_composite INTEGER,
  predicted_math INTEGER,
  predicted_rw INTEGER,
  confidence_interval INTEGER,
  model_version TEXT,
  feature_snapshot_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS question_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,
  note_text TEXT,
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS error_log_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  attempt_id INTEGER NOT NULL REFERENCES quiz_question_attempts(id),
  reflection TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS study_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  max_members INTEGER DEFAULT 20,
  goal_score INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES study_groups(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, student_id)
);
CREATE TABLE IF NOT EXISTS group_activity_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES study_groups(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS group_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES study_groups(id),
  challenger_id INTEGER NOT NULL REFERENCES users(id),
  challenged_id INTEGER NOT NULL REFERENCES users(id),
  quiz_session_id INTEGER REFERENCES quiz_sessions(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS student_xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  reference_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, event_type, reference_id)
);
CREATE TABLE IF NOT EXISTS student_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  current_level INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS student_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  badge_key TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, badge_key)
);
CREATE TABLE IF NOT EXISTS streak_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  freeze_count_remaining INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL,
  in_app INTEGER DEFAULT 1,
  email INTEGER DEFAULT 1,
  push INTEGER DEFAULT 0,
  sms INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, notification_type)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  action_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  question_selection_json TEXT NOT NULL,
  due_date TEXT NOT NULL,
  time_limit_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS assignment_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  quiz_session_id INTEGER REFERENCES quiz_sessions(id),
  UNIQUE(assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE TABLE IF NOT EXISTS feature_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flag_key TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sat_test_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_date TEXT NOT NULL,
  registration_deadline TEXT,
  is_official INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS student_test_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  sat_test_date_id INTEGER REFERENCES sat_test_dates(id),
  custom_date TEXT,
  is_target INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned',
  actual_score INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
  `);
}
