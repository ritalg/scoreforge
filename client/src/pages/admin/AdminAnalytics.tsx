import { useApi } from '../../hooks/useApi';
import { PageSpinner } from '../../components/ui/Spinner';
import { Card } from '../../components/ui/Card';
import { TOPIC_LABELS } from '@scoreforge/shared';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface AnalyticsData {
  dailySessions: { date: string; sessions: number }[];
  weeklyUsers: { week: string; newUsers: number }[];
  topicAccuracy: { topicKey: string; accuracy: number; total: number }[];
  scoreDistribution: { range: string; count: number }[];
  uploadStats: { total: number; completed: number; failed: number; processing: number };
  roleBreakdown: Record<string, number>;
  totals: { users: number; sessions: number; mockTests: number };
}

const BAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626'];

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card padding="md" className="text-center">
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function AdminAnalytics() {
  const { data, loading } = useApi<AnalyticsData>('/api/admin/analytics');

  if (loading || !data) return <PageSpinner />;

  const { dailySessions, weeklyUsers, topicAccuracy, scoreDistribution, uploadStats, roleBreakdown, totals } = data;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Analytics</h1>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={totals.users} />
        <StatCard label="Sessions (30d)" value={totals.sessions} />
        <StatCard label="Mock Tests" value={totals.mockTests} />
        <StatCard label="Uploads" value={uploadStats.total}
          sub={`${uploadStats.completed} done · ${uploadStats.failed} failed`} />
      </div>

      {/* Role breakdown */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(roleBreakdown).map(([role, count]) => (
          <span key={role} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
            <span className="font-semibold capitalize">{role}</span>: {count}
          </span>
        ))}
      </div>

      {/* Daily sessions */}
      <Card padding="md">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4">Daily Quiz Sessions (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dailySessions} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, background: 'var(--tw-bg-opacity)', borderRadius: 8 }}
              formatter={(v: number) => [v, 'Sessions']}
            />
            <Line type="monotone" dataKey="sessions" stroke="#2563EB" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Weekly new users */}
      <Card padding="md">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4">New Users per Week (Last 12 Weeks)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyUsers} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [v, 'New Users']} />
            <Bar dataKey="newUsers" fill="#7C3AED" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic accuracy */}
        <Card padding="md">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4">
            Topic Accuracy (weakest first)
          </h2>
          {topicAccuracy.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Not enough data yet (5+ attempts per topic required)</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, topicAccuracy.length * 36)}>
              <BarChart layout="vertical" data={topicAccuracy} margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="topicKey" width={130} tick={{ fontSize: 10 }}
                  tickFormatter={key => (TOPIC_LABELS as Record<string, string>)[key] ?? key} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(v: number, _name, props) => [`${v}% (${props.payload.total} attempts)`, 'Accuracy']}
                />
                <Bar dataKey="accuracy" radius={[0, 3, 3, 0]}>
                  {topicAccuracy.map((entry, i) => (
                    <Cell key={i} fill={entry.accuracy < 50 ? '#DC2626' : entry.accuracy < 70 ? '#D97706' : '#059669'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Score distribution */}
        <Card padding="md">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4">Mock Test Score Distribution</h2>
          {scoreDistribution.every(d => d.count === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">No completed mock tests yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreDistribution} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [v, 'Students']} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {scoreDistribution.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
