import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  totpEnabled: boolean;
  createdAt: string;
  sessionCount: number;
  xp: number;
  level: number;
}
interface Stats { total: number; students: number; admins: number; active: number; pending: number; suspended: number; }

const ROLE_BADGE: Record<string, string> = {
  student: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  tutor: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  admin: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  superadmin: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  parent: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  pending_verification: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  suspended: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  deleted: 'bg-gray-100 text-gray-500',
};

export default function UserManagement() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (roleFilter) params.set('role', roleFilter);
  if (statusFilter) params.set('status', statusFilter);

  const { data: users, loading, refetch } = useApi<User[]>(`/api/admin/users?${params}`);
  const { data: stats } = useApi<Stats>('/api/admin/users/stats');

  function openEdit(u: User) {
    setEditId(u.id);
    setEditRole(u.role);
    setEditStatus(u.status);
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/users/${editId}`, { role: editRole, status: editStatus });
      setEditId(null);
      refetch();
    } finally { setSaving(false); }
  }

  async function reset2FA(id: number) {
    if (!confirm('Reset 2FA for this user?')) return;
    await api.post(`/api/admin/users/${id}/reset-2fa`, {});
    refetch();
  }

  if (loading && !users) return <PageSpinner />;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        {stats && (
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {stats.total} total · {stats.active} active · {stats.pending} pending · {stats.suspended} suspended
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 min-w-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All roles</option>
          <option value="student">Student</option>
          <option value="tutor">Tutor</option>
          <option value="parent">Parent</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_verification">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sessions</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Level</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">2FA</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(users ?? []).map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</div>
                    <div className="text-gray-400 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[u.role] ?? ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[u.status] ?? ''}`}>
                      {u.status === 'pending_verification' ? 'Pending' : u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{u.sessionCount}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Lv.{u.level}</span>
                    <span className="text-xs text-gray-400 ml-1">{u.xp}xp</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.totpEnabled
                      ? <span className="text-xs text-green-600 dark:text-green-400">✓ On</span>
                      : <span className="text-xs text-gray-400">Off</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)}
                        className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400">
                        Edit
                      </button>
                      {u.totpEnabled && (
                        <button onClick={() => reset2FA(u.id)}
                          className="text-xs text-orange-500 hover:text-orange-600 dark:text-orange-400">
                          Reset 2FA
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Edit User #{editId}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="tutor">Tutor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="active">Active</option>
                <option value="pending_verification">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditId(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
