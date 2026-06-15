import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

interface Student {
  id: number; firstName: string; lastName: string; email: string;
  level: number; totalXp: number; sessionCount: number; recentScore: number | null;
  trend: 'up' | 'down' | 'flat' | null; lastStudyDate: string | null;
  daysSinceStudy: number | null; needsAttention: boolean; streak: number;
}

interface Assignment {
  id: number; title: string; dueDate: string; studentCount: number; completedCount: number;
}

const TUTOR_NAV = [
  { to: '/tutor/dashboard', label: 'Dashboard' },
  { to: '/tutor/roster', label: 'Student Roster' },
  { to: '/tutor/assignments', label: 'Assignments' },
  { to: '/tutor/cohort', label: 'Cohort Analytics' },
];

export function TutorLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  async function handleLogout() { await logout(); navigate('/login'); }
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h1 className="font-bold text-gray-900 dark:text-white">ScoreForge</h1>
          <p className="text-xs text-gray-500 mt-0.5">Tutor: {user?.firstName} {user?.lastName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TUTOR_NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              {n.label}
            </NavLink>
          ))}
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

export default function TutorDashboard() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Student[]>('/api/tutor/students'), api.get<Assignment[]>('/api/tutor/assignments')])
      .then(([s, a]) => { setStudents(s); setAssignments(a); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard…</div>;

  const needAttention = students.filter(s => s.needsAttention);
  const pendingAssignments = assignments.filter(a => new Date(a.dueDate) >= new Date());

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tutor Dashboard</h1>
        <p className="text-sm text-gray-500">Share your tutor ID <strong>{user?.id}</strong> with students to link them to you</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Students', value: students.length, icon: '👥' },
          { label: 'Need Attention', value: needAttention.length, icon: '⚠️', alert: needAttention.length > 0 },
          { label: 'Active Assignments', value: pendingAssignments.length, icon: '📋' },
          { label: 'Avg. Level', value: students.length ? Math.round(students.reduce((a, s) => a + s.level, 0) / students.length) : '—', icon: '⭐' },
        ].map(stat => (
          <div key={stat.label} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${stat.alert ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700'}`}>
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {needAttention.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-5">
            <h2 className="font-semibold text-orange-800 dark:text-orange-300 mb-3">Students Needing Attention</h2>
            <div className="space-y-2">
              {needAttention.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-gray-500">Last studied {s.daysSinceStudy}d ago</p>
                  </div>
                  <span className="text-xs text-orange-600">Inactive</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Active Assignments</h2>
          {pendingAssignments.length === 0 ? (
            <p className="text-sm text-gray-500">No active assignments</p>
          ) : (
            <div className="space-y-2">
              {pendingAssignments.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{a.title}</p>
                    <p className="text-xs text-gray-500">Due {new Date(a.dueDate).toLocaleDateString()} · {a.studentCount} students</p>
                  </div>
                  <span className="text-xs text-brand-600">{a.completedCount}/{a.studentCount} done</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
