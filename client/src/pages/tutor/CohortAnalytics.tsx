import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface CohortStats {
  studentCount: number;
  topicAccuracy: Array<{ key: string; label: string; accuracy: number; attempts: number }>;
  mostMissed: Array<{ questionId: number; questionText: string; topicKey: string | null; count: number }>;
}

function AccuracyBar({ accuracy, label, attempts }: { accuracy: number; label: string; attempts: number }) {
  const color = accuracy >= 75 ? 'bg-green-500' : accuracy >= 55 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className={accuracy >= 75 ? 'text-green-600' : accuracy >= 55 ? 'text-yellow-600' : 'text-red-500'}>
          {accuracy}% <span className="text-gray-400">({attempts})</span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
        <div className={`h-2 ${color} rounded-full transition-all`} style={{ width: `${accuracy}%` }} />
      </div>
    </div>
  );
}

export default function CohortAnalytics() {
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CohortStats>('/api/tutor/cohort').then(data => { setStats(data); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading cohort data…</div>;
  if (!stats) return null;

  const topPerforming = [...stats.topicAccuracy].sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);
  const struggling = [...stats.topicAccuracy].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cohort Analytics</h1>
        <p className="text-sm text-gray-500">{stats.studentCount} students</p>
      </div>

      {stats.studentCount === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">No student data yet</p>
          <p className="text-sm mt-1">Add students to see cohort analytics</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">All Topics — Cohort Accuracy</h2>
            <div className="space-y-3">
              {stats.topicAccuracy.length === 0
                ? <p className="text-sm text-gray-500">No quiz data yet</p>
                : stats.topicAccuracy.map(t => <AccuracyBar key={t.key} accuracy={t.accuracy} label={t.label} attempts={t.attempts} />)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-green-500">✓</span> Strongest Topics
            </h2>
            <div className="space-y-3">
              {topPerforming.length === 0
                ? <p className="text-sm text-gray-500">No data</p>
                : topPerforming.map(t => <AccuracyBar key={t.key} accuracy={t.accuracy} label={t.label} attempts={t.attempts} />)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-red-500">✗</span> Topics Needing Work
            </h2>
            <div className="space-y-3">
              {struggling.length === 0
                ? <p className="text-sm text-gray-500">No data</p>
                : struggling.map(t => <AccuracyBar key={t.key} accuracy={t.accuracy} label={t.label} attempts={t.attempts} />)}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Most Missed Questions (Cohort)</h2>
            {stats.mostMissed.length === 0 ? (
              <p className="text-sm text-gray-500">No data yet</p>
            ) : (
              <div className="space-y-2">
                {stats.mostMissed.map((q, i) => (
                  <div key={q.questionId} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 text-xs flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{q.questionText || `Question #${q.questionId}`}</p>
                      {q.topicKey && <p className="text-xs text-gray-500 mt-0.5">{q.topicKey.replace(/_/g, ' ')}</p>}
                    </div>
                    <span className="text-xs font-bold text-red-500 shrink-0">{q.count}× missed</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
