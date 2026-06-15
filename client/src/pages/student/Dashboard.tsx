import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { api } from '../../lib/api';
import { TOPIC_LABELS, XP_LEVEL_THRESHOLDS } from '@scoreforge/shared';

interface OverviewData {
  streak: { current: number; longest: number; lastStudyDate: string | null };
  srDueCount: number;
  level: { current: number; totalXp: number };
  prediction: { predictedComposite: number; predictedMath: number | null; predictedRw: number | null; confidenceInterval: number } | null;
  recentTrend: { date: string; scorePct: number | null; mode: string }[];
  topicBreakdown: { topicKey: string; accuracy: number; questionsAttempted: number }[];
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function xpProgress(level: number, totalXp: number) {
  const next = XP_LEVEL_THRESHOLDS[level] ?? XP_LEVEL_THRESHOLDS[XP_LEVEL_THRESHOLDS.length - 1];
  const current = XP_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const into = totalXp - current;
  const span = next - current;
  return { into, span, pct: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100 };
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const { data: overview, loading } = useApi<OverviewData>('/api/analytics/overview');
  const { data: onboarding } = useApi<{ profile: { targetScore: number | null; targetTestDate: string | null } | null }>('/api/onboarding/status');

  useEffect(() => {
    api.post('/api/gamification/daily-login').catch(() => {});
  }, []);

  if (loading) return <PageSpinner />;

  const level = overview?.level?.current ?? 1;
  const totalXp = overview?.level?.totalXp ?? 0;
  const xp = xpProgress(level, totalXp);
  const streak = overview?.streak?.current ?? 0;
  const srDue = overview?.srDueCount ?? 0;
  const prediction = overview?.prediction;
  const profile = onboarding?.profile ?? null;
  const countdown = daysUntil(profile?.targetTestDate ?? null);
  const weakTopics = (overview?.topicBreakdown ?? []).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Good {getGreeting()}, {user?.firstName}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {streak > 0 ? `${streak}-day streak — keep it up!` : 'Start studying to build your streak.'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/student/score-prediction" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl">
          <StatCard icon="🎯" label="Score Estimate"
            value={prediction ? `${prediction.predictedComposite} ±${prediction.confidenceInterval}` : '—'}
            sub={prediction?.predictedMath != null && prediction?.predictedRw != null
              ? `M: ${prediction.predictedMath} · RW: ${prediction.predictedRw}`
              : profile?.targetScore ? `Target: ${profile.targetScore}` : 'No target set'} />
        </Link>
        <StatCard icon="🔥" label="Study Streak" value={`${streak}d`}
          sub={streak >= 7 ? 'On fire!' : streak > 0 ? 'Keep going!' : 'Start today'} />
        <StatCard icon="🔄" label="SR Due" value={String(srDue)}
          sub={srDue > 0 ? 'Questions due' : 'All caught up!'} />
        <StatCard icon="📅" label="Test Countdown"
          value={countdown !== null ? `${countdown}d` : '—'}
          sub={profile?.targetTestDate
            ? new Date(profile.targetTestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'No test date'} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Level {level}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{xp.into.toLocaleString()} / {xp.span.toLocaleString()} XP</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="bg-brand-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${xp.pct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Total XP: {totalXp.toLocaleString()}</p>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Today's Tasks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TaskCard icon="🔄" title="SR Drill" href="/student/sr-drill"
            description={srDue > 0 ? `${srDue} questions due` : 'All caught up!'}
            disabled={srDue === 0} badge={srDue > 0 ? String(srDue) : undefined} />
          <TaskCard icon="✏️" title="Practice Quiz" href="/student/quiz" description="20 questions · ~25 min" />
          <TaskCard icon="📝" title="Full Mock Test" href="/student/mock-test" description="4 modules · Digital SAT" />
        </div>
      </div>

      {weakTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weakest Topics</CardTitle>
            <Link to="/student/analytics" className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400">View all →</Link>
          </CardHeader>
          <div className="space-y-3">
            {weakTopics.map(t => (
              <div key={t.topicKey}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {(TOPIC_LABELS as Record<string, string>)[t.topicKey] ?? t.topicKey}
                  </span>
                  <span className={`text-sm font-medium ${t.accuracy >= 70 ? 'text-green-600' : t.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {t.accuracy}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${t.accuracy >= 70 ? 'bg-green-500' : t.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${t.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(overview?.recentTrend ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <Link to="/student/analytics" className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400">Full analytics →</Link>
          </CardHeader>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {overview!.recentTrend.slice().reverse().slice(0, 8).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{s.mode === 'timed_quiz' ? '⏱️' : s.mode === 'sr_drill' ? '🔄' : '✏️'}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{s.mode.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  {s.scorePct !== null && (
                    <span className={`text-sm font-medium ${s.scorePct >= 70 ? 'text-green-600' : s.scorePct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {Math.round(s.scorePct)}%
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{new Date(s.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(overview?.recentTrend ?? []).length === 0 && (
        <Card className="text-center py-12">
          <div className="text-5xl mb-3">📚</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to start?</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-5">Take a practice quiz to get personalized recommendations.</p>
          <Link to="/student/quiz"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors">
            Start Practice Quiz
          </Link>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: string }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
        </div>
        <span className="text-2xl" aria-hidden="true">{icon}</span>
      </div>
    </Card>
  );
}

function TaskCard({ icon, title, description, href, disabled, badge }: {
  icon: string; title: string; description: string; href: string; disabled?: boolean; badge?: string;
}) {
  return (
    <Link to={disabled ? '#' : href} aria-disabled={disabled}
      className={`block p-4 rounded-xl border-2 transition-all ${
        disabled
          ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
          : 'border-gray-200 dark:border-gray-700 hover:border-brand-500 hover:shadow-md'
      }`}>
      <div className="flex items-start justify-between">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        {badge && <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mt-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
    </Link>
  );
}
