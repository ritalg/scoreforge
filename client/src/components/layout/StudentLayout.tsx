import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { NotificationBell } from '../ui/NotificationBell';

const navItems = [
  { to: '/student/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/student/mock-test', label: 'Mock Test', icon: '📝' },
  { to: '/student/quiz', label: 'Practice Quiz', icon: '✏️' },
  { to: '/student/sr-drill', label: 'SR Drill', icon: '🔄' },
  { to: '/student/flashcards', label: 'Flashcards', icon: '🗂️' },
  { to: '/student/question-bank', label: 'Question Bank', icon: '🏦' },
  { to: '/student/analytics', label: 'Analytics', icon: '📈' },
  { to: '/student/score-prediction', label: 'Score Prediction', icon: '🎯' },
  { to: '/student/essay-scorer', label: 'Essay Scorer', icon: '✍️' },
  { to: '/student/error-log', label: 'Error Log', icon: '🔍' },
  { to: '/student/study-groups', label: 'Study Groups', icon: '👥' },
  { to: '/student/test-calendar', label: 'Test Calendar', icon: '📅' },
  { to: '/student/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { to: '/student/profile', label: 'Profile & Badges', icon: '🎖️' },
];

export default function StudentLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">ScoreForge</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {user?.firstName} {user?.lastName}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <NavLink to="/student/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full mb-1"
          >
            <span aria-hidden="true">⚙️</span> Settings
          </NavLink>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <span aria-hidden="true">🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto flex flex-col" tabIndex={-1}>
        <div className="flex justify-end items-center px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
