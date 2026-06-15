import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS, MATH_TOPICS, RW_TOPICS } from '@scoreforge/shared';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Session {
  id: number;
  mode: string;
  topicKey: string | null;
  scorePct: number | null;
  questionCountActual: number;
  correctCount: number;
  completedAt: string;
  startedAt: string;
}

interface TopicStat {
  topicKey: string;
  accuracy: number;
  correct: number;
  wrong: number;
  total: number;
}

interface WeeklyDay {
  date: string;
  sessions: number;
  questionsAnswered: number;
}

type Tab = 'overview' | 'topics' | 'history';

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('overview');
  const { data: history, loading: histLoading } = useApi<Session[]>('/api/analytics/score-history');
  const { data: topics, loading: topicsLoading } = useApi<TopicStat[]>('/api/analytics/topic-breakdown');
  const { data: weekly, loading: weeklyLoading } = useApi<WeeklyDay[]>('/api/analytics/weekly-activity');

  if (histLoading || topicsLoading || weeklyLoading) return <PageSpinner />;

  const sessions = history ?? [];
  const topicData = topics ?? [];
  const weeklyData = weekly ?? [];

  // Chart data: last 20 sessions for score trend
  const trendData = sessions.slice(-20).map(s => ({
    date: new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: s.scorePct !== null ? Math.round(s.scorePct) : null,
    mode: s.mode,
  })).filter(d => d.score !== null);

  // Summary stats
  const totalSessions = sessions.length;
  const totalQuestions = sessions.reduce((sum, s) => sum + (s.questionCountActual ?? 0), 0);
  const avgScore = sessions.filter(s => s.scorePct !== null).length > 0
    ? Math.round(sessions.filter(s => s.scorePct !== null).reduce((sum, s) => sum + (s.scorePct ?? 0), 0) / sessions.filter(s => s.scorePct !== null).length)
    : null;
  const recentAvg = sessions.slice(-5).filter(s => s.scorePct !== null).length > 0
    ? Math.round(sessions.slice(-5).filter(s => s.scorePct !== null).reduce((sum, s) => sum + (s.scorePct ?? 0), 0) / sessions.slice(-5).filter(s => s.scorePct !== null).length)
    : null;

  // Topic bar chart data
  const mathTopics = topicData.filter(t => MATH_TOPICS.includes(t.topicKey as any));
  const rwTopics = topicData.filter(t => RW_TOPICS.includes(t.topicKey as any));

  const barColor = (acc: number) => acc >= 70 ? '#22c55e' : acc >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(['overview', 'topics', 'history'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatMini label="Total Sessions" value={String(totalSessions)} />
            <StatMini label="Questions Answered" value={String(totalQuestions)} />
            <StatMini label="All-time Avg" value={avgScore !== null ? `${avgScore}%` : '—'} />
            <StatMini label="Recent Avg (5)" value={recentAvg !== null ? `${recentAvg}%` : '—'}
              color={recentAvg !== null && avgScore !== null
                ? recentAvg > avgScore ? 'text-green-600' : recentAvg < avgScore ? 'text-red-600' : undefined
                : undefined} />
          </div>

          {/* Score trend chart */}
          {trendData.length >= 2 ? (
            <Card>
              <CardHeader><CardTitle>Score Trend</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <Card className="text-center py-10 text-gray-400">
              <p>Complete at least 2 quizzes to see your score trend.</p>
            </Card>
          )}

          {/* Weekly activity */}
          <Card>
            <CardHeader><CardTitle>Weekly Activity</CardTitle></CardHeader>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  formatter={(v: number) => [v, 'Questions']} />
                <Bar dataKey="questionsAnswered" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {tab === 'topics' && (
        <>
          {topicData.length === 0 ? (
            <Card className="text-center py-10 text-gray-400">
              <p>No topic data yet. Complete some quizzes first.</p>
            </Card>
          ) : (
            <>
              {mathTopics.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Math Topics</CardTitle></CardHeader>
                  <div className="space-y-3">
                    {mathTopics.map(t => (
                      <TopicRow key={t.topicKey} stat={t} />
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={180} className="mt-4">
                    <BarChart data={mathTopics.map(t => ({ name: (TOPIC_LABELS as any)[t.topicKey]?.split(' ')[0] ?? t.topicKey, acc: t.accuracy }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                      <Bar dataKey="acc" radius={[3, 3, 0, 0]}>
                        {mathTopics.map((t, i) => <Cell key={i} fill={barColor(t.accuracy)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {rwTopics.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Reading & Writing Topics</CardTitle></CardHeader>
                  <div className="space-y-3">
                    {rwTopics.map(t => (
                      <TopicRow key={t.topicKey} stat={t} />
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={180} className="mt-4">
                    <BarChart data={rwTopics.map(t => ({ name: (TOPIC_LABELS as any)[t.topicKey]?.split(' ')[0] ?? t.topicKey, acc: t.accuracy }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                      <Bar dataKey="acc" radius={[3, 3, 0, 0]}>
                        {rwTopics.map((t, i) => <Cell key={i} fill={barColor(t.accuracy)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <Card>
          {sessions.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No quiz history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Mode</th>
                    <th className="pb-2 pr-4 font-medium">Topic</th>
                    <th className="pb-2 pr-4 font-medium">Questions</th>
                    <th className="pb-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice().reverse().map(s => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                        {new Date(s.startedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 capitalize text-gray-700 dark:text-gray-300">
                        {s.mode.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                        {s.topicKey ? (TOPIC_LABELS as Record<string, string>)[s.topicKey] ?? s.topicKey : 'All'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                        {s.correctCount ?? 0}/{s.questionCountActual ?? 0}
                      </td>
                      <td className="py-2">
                        {s.scorePct !== null ? (
                          <span className={`font-medium ${s.scorePct >= 70 ? 'text-green-600' : s.scorePct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {Math.round(s.scorePct)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
    </Card>
  );
}

function TopicRow({ stat }: { stat: TopicStat }) {
  const label = (TOPIC_LABELS as Record<string, string>)[stat.topicKey] ?? stat.topicKey;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{stat.total} attempts</span>
          <span className={`text-sm font-semibold ${stat.accuracy >= 70 ? 'text-green-600' : stat.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {stat.accuracy}%
          </span>
        </div>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${stat.accuracy >= 70 ? 'bg-green-500' : stat.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${stat.accuracy}%` }} />
      </div>
    </div>
  );
}
