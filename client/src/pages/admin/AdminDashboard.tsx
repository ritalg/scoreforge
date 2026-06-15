import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';

interface KPIs {
  totalUsers: number;
  todaySessions: number;
  pendingReview: number;
  totalQuestions: number;
  approvedQuestions: number;
  processingUploads: number;
  totalUploads: number;
}

interface Health {
  status: string; db: string; redis: string; ai: string; timestamp: string;
}

const STATUS_COLOR: Record<string, string> = {
  ok: 'bg-green-500',
  degraded: 'bg-yellow-500',
  not_configured: 'bg-gray-400',
  not_checked: 'bg-gray-400',
  error: 'bg-red-500',
};

export default function AdminDashboard() {
  const { data: kpis, loading } = useApi<KPIs>('/api/admin/kpis');
  const { data: health } = useApi<Health>('/api/health');

  if (loading) return <PageSpinner />;

  const actions = [
    { href: '/admin/upload', icon: '📤', title: 'Upload Test PDF', desc: 'AI-powered question extraction' },
    { href: '/admin/questions', icon: '❓', title: 'Question Queue', desc: `${kpis?.pendingReview ?? 0} pending review`, badge: kpis?.pendingReview },
    { href: '/admin/users', icon: '👥', title: 'Manage Users', desc: `${kpis?.totalUsers ?? 0} total accounts` },
    { href: '/admin/feature-flags', icon: '🚩', title: 'Feature Flags', desc: 'Toggle platform modules' },
    { href: '/admin/audit-log', icon: '📜', title: 'Audit Log', desc: 'View admin action history' },
    { href: '/admin/analytics', icon: '📈', title: 'Analytics', desc: 'Platform-wide statistics' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Platform overview and management</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Users" value={kpis?.totalUsers ?? 0} icon="👥" />
        <KPICard label="Questions in Bank" value={kpis?.totalQuestions ?? 0} icon="📚"
          sub={`${kpis?.approvedQuestions ?? 0} approved`} />
        <KPICard label="Pending Review" value={kpis?.pendingReview ?? 0} icon="⏳"
          color={(kpis?.pendingReview ?? 0) > 0 ? 'text-yellow-600' : undefined} />
        <KPICard label="Today's Sessions" value={kpis?.todaySessions ?? 0} icon="✏️" />
      </div>

      {/* Platform health */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Health</CardTitle>
          <span className="text-xs text-gray-400">{health ? new Date(health.timestamp).toLocaleTimeString() : ''}</span>
        </CardHeader>
        {health ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['status', 'db', 'redis', 'ai'] as const).map(k => (
              <div key={k} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[health[k]] ?? 'bg-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{k}</span>
                <span className="text-xs text-gray-500">{health[k]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4">{[1,2,3,4].map(i => <div key={i} className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
        )}
      </Card>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map(item => (
            <Link key={item.href} to={item.href}
              className="block p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                {item.badge ? (
                  <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mt-2">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, sub, color }: { label: string; value: number; icon: string; sub?: string; color?: string }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-black mt-1 ${color ?? 'text-gray-900 dark:text-white'}`}>{value.toLocaleString()}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <span className="text-2xl" aria-hidden="true">{icon}</span>
      </div>
    </Card>
  );
}
