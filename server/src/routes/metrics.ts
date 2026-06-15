import { Router } from 'express';
import { db, schema } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// In-process counters (reset on restart — good enough for dev/staging without Redis)
let requestCount = 0;
let requestLatencyMs: number[] = [];
let aiCallCount = 0;
let aiTotalMs = 0;
let errorCount = 0;

export function recordRequest(durationMs: number) {
  requestCount++;
  requestLatencyMs.push(durationMs);
  if (requestLatencyMs.length > 10000) requestLatencyMs.shift();
}

export function recordAICall(durationMs: number) {
  aiCallCount++;
  aiTotalMs += durationMs;
}

export function recordError() { errorCount++; }

function percentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p / 100)];
}

// GET /api/metrics — Prometheus text format (restrict to internal in prod)
router.get('/', (req, res) => {
  const ip = req.ip ?? '';
  const isInternal = ip === '::1' || ip === '127.0.0.1' || process.env.ALLOW_PUBLIC_METRICS === 'true';
  if (!isInternal) return res.status(403).end('Forbidden');

  let userCount = 0, questionCount = 0, sessionCount = 0;
  try {
    userCount = (db.get(sql`SELECT COUNT(*) as c FROM users`) as any)?.c ?? 0;
    questionCount = (db.get(sql`SELECT COUNT(*) as c FROM questions`) as any)?.c ?? 0;
    sessionCount = (db.get(sql`SELECT COUNT(*) as c FROM quiz_sessions WHERE status = 'completed'`) as any)?.c ?? 0;
  } catch {}

  const p50 = percentile(requestLatencyMs, 50);
  const p95 = percentile(requestLatencyMs, 95);
  const p99 = percentile(requestLatencyMs, 99);
  const avgAiMs = aiCallCount > 0 ? aiTotalMs / aiCallCount : 0;

  const output = [
    '# HELP scoreforge_http_requests_total Total HTTP requests',
    '# TYPE scoreforge_http_requests_total counter',
    `scoreforge_http_requests_total ${requestCount}`,
    '',
    '# HELP scoreforge_http_errors_total Total HTTP errors (5xx)',
    '# TYPE scoreforge_http_errors_total counter',
    `scoreforge_http_errors_total ${errorCount}`,
    '',
    '# HELP scoreforge_http_latency_p50_ms HTTP request latency p50 (ms)',
    '# TYPE scoreforge_http_latency_p50_ms gauge',
    `scoreforge_http_latency_p50_ms ${p50}`,
    '',
    '# HELP scoreforge_http_latency_p95_ms HTTP request latency p95 (ms)',
    '# TYPE scoreforge_http_latency_p95_ms gauge',
    `scoreforge_http_latency_p95_ms ${p95}`,
    '',
    '# HELP scoreforge_http_latency_p99_ms HTTP request latency p99 (ms)',
    '# TYPE scoreforge_http_latency_p99_ms gauge',
    `scoreforge_http_latency_p99_ms ${p99}`,
    '',
    '# HELP scoreforge_ai_calls_total Total Anthropic AI API calls',
    '# TYPE scoreforge_ai_calls_total counter',
    `scoreforge_ai_calls_total ${aiCallCount}`,
    '',
    '# HELP scoreforge_ai_latency_avg_ms Average AI API call latency (ms)',
    '# TYPE scoreforge_ai_latency_avg_ms gauge',
    `scoreforge_ai_latency_avg_ms ${Math.round(avgAiMs)}`,
    '',
    '# HELP scoreforge_users_total Total registered users',
    '# TYPE scoreforge_users_total gauge',
    `scoreforge_users_total ${userCount}`,
    '',
    '# HELP scoreforge_questions_total Total questions in bank',
    '# TYPE scoreforge_questions_total gauge',
    `scoreforge_questions_total ${questionCount}`,
    '',
    '# HELP scoreforge_quiz_sessions_completed_total Total completed quiz sessions',
    '# TYPE scoreforge_quiz_sessions_completed_total counter',
    `scoreforge_quiz_sessions_completed_total ${sessionCount}`,
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4').send(output);
});

export default router;
