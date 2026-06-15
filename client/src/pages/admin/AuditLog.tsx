import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';

interface LogEntry {
  id: number;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payloadJson: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface PageResult {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_BADGES: Record<string, string> = {
  question_approve: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  question_reject: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  question_edit: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  question_bulk_approve: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  user_update: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  user_reset_2fa: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  feature_flag_update: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  platform_config_update: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  question_csv_import: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
};

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (actionFilter) params.set('action', actionFilter);
  if (entityFilter) params.set('entityType', entityFilter);

  const { data, loading } = useApi<PageResult>(`/api/admin/audit-logs?${params}`, [page, actionFilter, entityFilter]);

  function parsePayload(json: string | null) {
    if (!json) return null;
    try { return JSON.stringify(JSON.parse(json), null, 2); }
    catch { return json; }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  if (loading && !data) return <PageSpinner />;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          All admin actions · {data?.total ?? '…'} total entries
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Filter by action…"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All entity types</option>
          <option value="question">Question</option>
          <option value="user">User</option>
          <option value="feature_flag">Feature Flag</option>
          <option value="platform_config">Platform Config</option>
          <option value="upload">Upload</option>
        </select>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">When</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.logs ?? []).map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{log.userName ?? `#${log.userId}`}</div>
                    {log.userEmail && <div className="text-xs text-gray-400">{log.userEmail}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_BADGES[log.action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.entityType && <span>{log.entityType}</span>}
                    {log.entityId && <span className="text-gray-400 ml-1">#{log.entityId}</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {log.payloadJson && (
                      <code className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                        {parsePayload(log.payloadJson)}
                      </code>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
              {(data?.logs ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
