import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/upload', label: 'Upload Center', icon: '📤' },
  { to: '/admin/bulk-import', label: 'Bulk CSV Import', icon: '📥' },
  { to: '/admin/questions', label: 'Question Queue', icon: '❓' },
  { to: '/admin/flashcards', label: 'Flashcard Decks', icon: '🗂️' },
  { to: '/admin/scoring-tables', label: 'Scoring Tables', icon: '📋' },
  { to: '/admin/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { to: '/admin/audit-log', label: 'Audit Log', icon: '📜' },
  { to: '/admin/analytics', label: 'Analytics', icon: '📈' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">ScoreForge Admin</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{user?.role}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
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
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <span aria-hidden="true">🚪</span> Sign Out
          </button>
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
