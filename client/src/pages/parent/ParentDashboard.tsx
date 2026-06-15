import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

interface Child {
  id: number; firstName: string; lastName: string; email: string;
  level: number; totalXp: number; streak: number;
  prediction: { predictedComposite: number; confidenceInterval: number } | null;
}

interface ChildDashboard {
  student: { id: number; firstName: string; lastName: string };
  level: { currentLevel: number; totalXp: number } | null;
  streak: { currentStreak: number; longestStreak: number } | null;
  prediction: { predictedComposite: number; predictedMath: number; predictedRw: number; confidenceInterval: number } | null;
  recentSessions: Array<{ id: number; scorePct: number | null; topicKey: string | null; completedAt: string | null }>;
  weekSessions: number; avgScore: number | null; xpThisWeek: number;
  badges: number; targetDate: any | null; daysUntilTest: number | null;
}

export function ParentLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  async function handleLogout() { await logout(); navigate('/login'); }
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h1 className="font-bold text-gray-900 dark:text-white">ScoreForge</h1>
          <p className="text-xs text-gray-500 mt-0.5">{user?.firstName} {user?.lastName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/parent/dashboard" className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            Children's Progress
          </NavLink>
          <NavLink to="/parent/link" className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            Link a Student
          </NavLink>
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg w-full">
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  );
}

export default function ParentDashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [dashboard, setDashboard] = useState<ChildDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    api.get<Child[]>('/api/parent/children').then(c => { setChildren(c); setLoading(false); });
  }, []);

  async function selectChild(child: Child) {
    setSelected(child);
    setDashLoading(true);
    const data = await api.get<ChildDashboard>(`/api/parent/children/${child.id}/dashboard`);
    setDashboard(data);
    setDashLoading(false);
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  if (children.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-4xl mb-3">👨‍👩‍👧</p>
        <p className="text-lg font-medium text-gray-900 dark:text-white">No children linked yet</p>
        <p className="text-sm text-gray-500 mt-1">Go to "Link a Student" to connect with your child's account</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Children's Progress</h1>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-3">
          {children.map(c => (
            <button key={c.id} onClick={() => selectChild(c)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${selected?.id === c.id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-300'}`}>
              {c.firstName} {c.lastName}
            </button>
          ))}
        </div>
      )}

      {/* Auto-select first child */}
      {!selected && children.length === 1 && (
        <button onClick={() => selectChild(children[0])} className="hidden" ref={el => el && selectChild(children[0])} />
      )}

      {dashLoading && <div className="text-center py-12 text-gray-500">Loading…</div>}

      {dashboard && !dashLoading && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 text-xl font-bold">
              {dashboard.student.firstName[0]}{dashboard.student.lastName[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.student.firstName} {dashboard.student.lastName}</h2>
              {dashboard.daysUntilTest !== null && dashboard.daysUntilTest > 0 && (
                <p className="text-sm text-brand-600">{dashboard.daysUntilTest} days until target test</p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Level', value: `Lv ${dashboard.level?.currentLevel ?? 1}`, icon: '⭐' },
              { label: 'This Week', value: `${dashboard.weekSessions} sessions`, icon: '📚' },
              { label: 'Avg Score', value: dashboard.avgScore != null ? `${dashboard.avgScore}%` : '—', icon: '📊' },
              { label: 'Streak', value: `${dashboard.streak?.currentStreak ?? 0}🔥`, icon: '' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Score prediction */}
          {dashboard.prediction && (
            <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800 p-5">
              <h3 className="font-semibold text-brand-800 dark:text-brand-300 mb-3">Score Prediction</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-brand-700 dark:text-brand-300">{dashboard.prediction.predictedComposite}</span>
                <span className="text-sm text-brand-600">± {dashboard.prediction.confidenceInterval}</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-brand-600">
                <span>Math: ~{dashboard.prediction.predictedMath}</span>
                <span>R&W: ~{dashboard.prediction.predictedRw}</span>
              </div>
            </div>
          )}

          {/* Recent sessions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Practice Sessions</h3>
            {dashboard.recentSessions.length === 0 ? (
              <p className="text-sm text-gray-500">No sessions yet</p>
            ) : (
              <div className="space-y-2">
                {dashboard.recentSessions.slice(0, 8).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{s.topicKey?.replace(/_/g, ' ') ?? 'Mixed practice'}</p>
                      <p className="text-xs text-gray-500">{s.completedAt ? new Date(s.completedAt).toLocaleDateString() : ''}</p>
                    </div>
                    {s.scorePct != null && (
                      <span className={`text-sm font-bold ${s.scorePct >= 80 ? 'text-green-600' : s.scorePct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {s.scorePct}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!selected && children.length > 1 && (
        <div className="text-center py-12 text-gray-500">Select a child above to view their progress</div>
      )}
    </div>
  );
}
