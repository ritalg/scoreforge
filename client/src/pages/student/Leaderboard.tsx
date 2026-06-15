import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';

interface LeaderboardEntry {
  studentId: number; firstName: string; lastName: string;
  xp: number; level: number; rank: number;
}

export default function Leaderboard() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<'weekly' | 'alltime'>('weekly');
  const { data, loading } = useApi<{ entries: LeaderboardEntry[]; disabled: boolean; message?: string }>(
    `/api/gamification/leaderboard?period=${period}&scope=global`, [period]
  );

  if (loading && !data) return <PageSpinner />;

  if (data?.disabled) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leaderboard Disabled</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{data.message ?? 'The leaderboard has been disabled by the platform.'}</p>
        </div>
      </div>
    );
  }

  const entries = data?.entries ?? [];
  const myEntry = entries.find(e => e.studentId === user?.id);
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaderboard</h1>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          {(['weekly', 'alltime'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'}`}>
              {p === 'weekly' ? 'This Week' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {period === 'weekly' && (
        <p className="text-xs text-gray-400">Resets every Monday midnight · Based on XP earned this week</p>
      )}

      {/* Top 3 podium */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-4 py-6">
          {[top3[1], top3[0], top3[2]].map((entry, i) => {
            const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const isMe = entry.studentId === user?.id;
            const heights = ['h-24', 'h-32', 'h-20'];
            return (
              <div key={entry.studentId} className="flex flex-col items-center gap-2">
                <span className="text-2xl">{MEDAL[actualRank - 1]}</span>
                <div className={`${heights[i]} w-20 rounded-t-xl flex flex-col items-center justify-end pb-3 gap-1
                  ${isMe ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <span className={`text-sm font-bold ${isMe ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                    {entry.firstName}
                  </span>
                  <span className={`text-xs ${isMe ? 'text-brand-200' : 'text-gray-500'}`}>
                    {entry.xp.toLocaleString()} xp
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <Card padding="none" className="overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map(entry => {
            const isMe = entry.studentId === user?.id;
            return (
              <div key={entry.studentId}
                className={`flex items-center gap-4 px-4 py-3 ${isMe ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                <span className={`text-sm font-bold w-6 text-center ${entry.rank <= 3 ? 'text-lg' : 'text-gray-400'}`}>
                  {entry.rank <= 3 ? MEDAL[entry.rank - 1] : entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {entry.firstName[0]}{entry.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isMe ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>
                    {entry.firstName} {entry.lastName} {isMe && <span className="text-xs text-brand-500">(you)</span>}
                  </span>
                  <p className="text-xs text-gray-400">Level {entry.level}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {entry.xp.toLocaleString()} xp
                </span>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No data yet. Start studying to appear here!</div>
          )}
        </div>
      </Card>

      {/* My rank (if not visible in main list) */}
      {myEntry && myEntry.rank > 10 && (
        <Card padding="md" className="border-brand-400 border-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-400 w-6 text-center">#{myEntry.rank}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
                {myEntry.firstName} {myEntry.lastName} (you)
              </p>
            </div>
            <span className="text-sm font-semibold">{myEntry.xp.toLocaleString()} xp</span>
          </div>
        </Card>
      )}
    </div>
  );
}
