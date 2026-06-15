import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';

interface Flag {
  id: number;
  flagKey: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
}

const FLAG_DESCRIPTIONS: Record<string, { label: string; desc: string; superadminOnly?: boolean }> = {
  leaderboard_public: { label: 'Public Leaderboard', desc: 'Show global leaderboard to students' },
  ai_extraction:      { label: 'AI Extraction',       desc: 'Enable Claude AI to extract questions from uploaded PDFs' },
  spaced_repetition:  { label: 'Spaced Repetition',   desc: 'Enable the SR drill system for students' },
  gamification:       { label: 'Gamification',         desc: 'XP, levels, badges, and streaks' },
  social_features:    { label: 'Social Features',      desc: 'Study groups and peer interactions' },
  essay_scoring:      { label: 'AI Essay Scoring',     desc: 'GPT-powered essay feedback (beta)' },
  score_prediction:   { label: 'Score Prediction',     desc: 'ML-based SAT score prediction' },
  beta_features:      { label: 'Beta Features',        desc: 'Experimental features for early testers' },
  maintenance_mode:   { label: 'Maintenance Mode',     desc: 'Show maintenance banner across the platform' },
  ferpa_mode:         { label: 'FERPA Mode',           desc: 'Disable leaderboard and reduce data exposure (compliance)', superadminOnly: true },
};

export default function FeatureFlags() {
  const { user } = useAuthStore();
  const isSuperadmin = user?.role === 'superadmin';
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: flags, loading, refetch } = useApi<Flag[]>('/api/admin/feature-flags');

  async function toggle(key: string, current: boolean) {
    setToggling(key);
    try {
      await api.put(`/api/admin/feature-flags/${key}`, { enabled: !current });
      refetch();
    } finally { setToggling(null); }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Flags</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Toggle platform features in real-time without a deployment</p>
      </div>

      <div className="space-y-3">
        {(flags ?? []).map(flag => {
          const meta = FLAG_DESCRIPTIONS[flag.flagKey];
          const isLocked = meta?.superadminOnly && !isSuperadmin;
          const isToggling = toggling === flag.flagKey;

          return (
            <Card key={flag.id} padding="md" className={isLocked ? 'opacity-60' : ''}>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {meta?.label ?? flag.flagKey}
                    </span>
                    {meta?.superadminOnly && (
                      <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
                        Superadmin
                      </span>
                    )}
                    <code className="text-xs text-gray-400 font-mono">{flag.flagKey}</code>
                  </div>
                  {meta?.desc && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meta.desc}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Last changed: {new Date(flag.updatedAt).toLocaleString()}</p>
                </div>

                {/* Toggle */}
                <button
                  disabled={isLocked || isToggling}
                  onClick={() => toggle(flag.flagKey, flag.enabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    flag.enabled
                      ? 'bg-brand-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  } ${isLocked || isToggling ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label={`Toggle ${flag.flagKey}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    flag.enabled ? 'translate-x-6' : 'translate-x-0'
                  } ${isToggling ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {!isSuperadmin && (
        <p className="text-xs text-center text-gray-400">
          FERPA Mode can only be toggled by a superadmin.
        </p>
      )}
    </div>
  );
}
