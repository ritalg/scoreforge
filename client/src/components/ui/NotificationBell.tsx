import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Notification {
  id: number; type: string; title: string; body: string; read: boolean;
  actionUrl: string | null; createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchCount() {
    try {
      const data = await api.get<{ unread: number }>('/api/notifications/count');
      setCount(data.unread);
    } catch {}
  }

  async function openPanel() {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      try {
        const data = await api.get<Notification[]>('/api/notifications?limit=20');
        setNotifications(data);
      } finally { setLoading(false); }
    }
  }

  async function markAllRead() {
    await api.post('/api/notifications/read-all', {});
    setCount(0);
    setNotifications(n => n.map(item => ({ ...item, read: true })));
  }

  async function markRead(id: number) {
    await api.post(`/api/notifications/${id}/read`, {});
    setNotifications(n => n.map(item => item.id === id ? { ...item, read: true } : item));
    setCount(c => Math.max(0, c - 1));
  }

  const TYPE_ICONS: Record<string, string> = {
    badge_earned: '🏅', streak_at_risk: '⚠️', streak_lost: '💔',
    sr_due: '🔄', assignment_due: '📋', score_prediction_updated: '📊',
    quiz_result: '✏️', parent_digest: '📧', study_reminder: '📚',
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={openPanel}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400 text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">You're all caught up!</div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  onClick={() => !n.read && markRead(n.id)}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-sm font-medium leading-snug ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        {n.title}
                      </p>
                      {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    {n.actionUrl && (
                      <Link to={n.actionUrl} className="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1 block"
                        onClick={() => setOpen(false)}>
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
