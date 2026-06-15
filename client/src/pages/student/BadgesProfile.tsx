import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { BADGE_KEYS, XP_LEVEL_THRESHOLDS } from '@scoreforge/shared';

interface GamProfile {
  level: number; totalXp: number; xpIntoLevel: number; xpForLevel: number; xpProgressPct: number;
  streak: { current: number; longest: number; lastStudyDate: string | null; freezeCount: number };
  badges: { key: string; earnedAt: string }[];
  badgeCount: number;
}
interface AvailBadge {
  key: string; name: string; description: string; earned: boolean; earnedAt: string | null;
}

const BADGE_META: Record<string, { name: string; icon: string; desc: string }> = {
  first_step:     { name: 'First Step',      icon: '👣', desc: 'Complete onboarding' },
  on_a_roll:      { name: 'On a Roll',        icon: '🔥', desc: '7-day study streak' },
  month_warrior:  { name: 'Month Warrior',    icon: '⚡', desc: '30-day study streak' },
  algebra_ace:    { name: 'Algebra Ace',      icon: '🧮', desc: '≥90% accuracy in Algebra over 30+ questions' },
  speed_demon:    { name: 'Speed Demon',      icon: '⏱️', desc: 'Finish a timed quiz with >10 min remaining' },
  mock_master:    { name: 'Mock Master',      icon: '🏆', desc: 'Complete 5 full mock tests' },
  score_jump:     { name: 'Score Jump',       icon: '🚀', desc: 'Improve composite score by 100+ points' },
  perfect_score:  { name: 'Perfect Score',    icon: '💯', desc: '100% on any 20+ question quiz' },
  night_owl:      { name: 'Night Owl',        icon: '🦉', desc: 'Study session after 10 PM' },
  early_bird:     { name: 'Early Bird',       icon: '🌅', desc: 'Study session before 7 AM' },
};

export default function BadgesProfile() {
  const { data: profile, loading: profileLoading } = useApi<GamProfile>('/api/gamification/profile');
  const { data: available } = useApi<AvailBadge[]>('/api/gamification/badges/available');

  if (profileLoading || !profile) return <PageSpinner />;

  const earnedKeys = new Set(profile.badges.map(b => b.key));

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>

      {/* Level + XP card */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-black">
                {profile.level}
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Level {profile.level}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profile.totalXp.toLocaleString()} total XP</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {profile.xpIntoLevel.toLocaleString()} / {profile.xpForLevel.toLocaleString()} XP
            </p>
            <p className="text-xs text-gray-400">to level {profile.level + 1}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Lv {profile.level}</span>
            <span>{profile.xpProgressPct}%</span>
            <span>Lv {profile.level + 1}</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${profile.xpProgressPct}%` }} />
          </div>
        </div>
      </Card>

      {/* Streak */}
      <Card padding="md">
        <div className="flex gap-8">
          <div className="text-center">
            <div className="text-3xl font-black text-orange-500">🔥 {profile.streak.current}</div>
            <p className="text-xs text-gray-500 mt-1">Current streak</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-gray-700 dark:text-gray-300">{profile.streak.longest}</div>
            <p className="text-xs text-gray-500 mt-1">Longest streak</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{profile.badgeCount}</div>
            <p className="text-xs text-gray-500 mt-1">Badges earned</p>
          </div>
          {profile.streak.freezeCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-500">❄️ {profile.streak.freezeCount}</div>
              <p className="text-xs text-gray-500 mt-1">Streak freezes</p>
            </div>
          )}
        </div>
      </Card>

      {/* Badges grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Badges <span className="text-gray-400 text-base font-normal">{profile.badgeCount}/{Object.keys(BADGE_META).length}</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(BADGE_META).map(([key, meta]) => {
            const earned = earnedKeys.has(key);
            const earnedAt = profile.badges.find(b => b.key === key)?.earnedAt;
            return (
              <div key={key}
                className={`p-4 rounded-xl border-2 transition-all ${earned
                  ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 opacity-50 grayscale'}`}>
                <div className="text-3xl mb-2">{meta.icon}</div>
                <p className={`text-sm font-semibold ${earned ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                  {meta.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{meta.desc}</p>
                {earned && earnedAt && (
                  <p className="text-xs text-brand-600 dark:text-brand-400 mt-1.5">
                    Earned {new Date(earnedAt).toLocaleDateString()}
                  </p>
                )}
                {!earned && (
                  <p className="text-xs text-gray-400 mt-1.5">Locked</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* XP Level roadmap */}
      <Card padding="md">
        <CardHeader><CardTitle>Level Roadmap</CardTitle></CardHeader>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {(XP_LEVEL_THRESHOLDS as number[]).slice(0, 20).map((threshold, i) => {
            const lvl = i + 1;
            const isCurrent = lvl === profile.level;
            const isPast = lvl < profile.level;
            return (
              <div key={lvl} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                isCurrent ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-400' :
                isPast ? 'opacity-50' : ''
              }`}>
                <span className={`w-8 text-center font-bold text-xs ${
                  isCurrent ? 'text-brand-600 dark:text-brand-400' :
                  isPast ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'
                }`}>Lv{lvl}</span>
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full ${isPast || isCurrent ? 'bg-brand-500' : 'bg-transparent'}`}
                    style={{ width: isCurrent ? `${profile.xpProgressPct}%` : isPast ? '100%' : '0%' }} />
                </div>
                <span className="text-xs text-gray-400 w-20 text-right">{threshold.toLocaleString()} XP</span>
                {isCurrent && <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">← You</span>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
