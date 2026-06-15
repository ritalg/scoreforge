import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS } from '@scoreforge/shared';

interface Question {
  id: number;
  questionNumber: number | null;
  questionText: string;
  questionType: string;
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  correctAnswer: string;
  topicKey: string | null;
  difficulty: string | null;
  module: string | null;
  status: string;
  uploadId: number | null;
  attemptCount: number;
  correctCount: number;
  createdAt: string;
}

interface QStats { pending_review: number; approved: number; rejected: number; flagged: number; total: number; }

const STATUS_TABS = ['pending_review', 'approved', 'rejected', 'flagged'] as const;
const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending', approved: 'Approved', rejected: 'Rejected', flagged: 'Flagged',
};
const DIFF_COLOR: Record<string, string> = {
  easy: 'text-green-600 bg-green-50', medium: 'text-yellow-600 bg-yellow-50', hard: 'text-red-600 bg-red-50',
};

export default function QuestionQueue() {
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { data: stats, refetch: refetchStats } = useApi<QStats>('/api/admin/questions/stats');
  const { data: result, loading, refetch } = useApi<{ questions: Question[]; total: number }>(
    `/api/admin/questions?status=${statusFilter}&limit=100`
  );

  const questions = result?.questions ?? [];

  async function approve(id: number) {
    setActionLoading(id);
    try {
      await api.post(`/api/admin/questions/${id}/approve`);
      refetch(); refetchStats();
    } finally { setActionLoading(null); }
  }

  async function reject(id: number) {
    setActionLoading(id);
    try {
      await api.post(`/api/admin/questions/${id}/reject`, { reason: '' });
      refetch(); refetchStats();
    } finally { setActionLoading(null); }
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    await api.post('/api/admin/questions/bulk-approve', { ids: Array.from(selected) });
    setSelected(new Set());
    refetch(); refetchStats();
  }

  function toggleSelect(id: number) {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected(s => s.size === questions.length ? new Set() : new Set(questions.map(q => q.id)));
  }

  if (loading && !result) return <PageSpinner />;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Question Queue</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Review AI-extracted questions before they enter the live bank</p>
        </div>
        <Link to="/admin/upload" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg">
          + Upload PDF
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setSelected(new Set()); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {STATUS_LABEL[s]}
            {stats && <span className="ml-1.5 opacity-75">({stats[s as keyof QStats] ?? 0})</span>}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {statusFilter === 'pending_review' && questions.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={selected.size === questions.length} onChange={toggleAll}
              className="rounded text-brand-600" />
            Select all
          </label>
          {selected.size > 0 && (
            <button onClick={bulkApprove}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
              ✓ Approve {selected.size} selected
            </button>
          )}
        </div>
      )}

      {/* Question list */}
      {questions.length === 0 ? (
        <Card className="text-center py-12 text-gray-400">
          <p>No {STATUS_LABEL[statusFilter].toLowerCase()} questions.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map(q => (
            <Card key={q.id} padding="none" className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {statusFilter === 'pending_review' && (
                    <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)}
                      className="mt-1 rounded text-brand-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {q.questionNumber && <span className="text-xs text-gray-400">Q{q.questionNumber}</span>}
                      {q.topicKey && (
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          {(TOPIC_LABELS as Record<string,string>)[q.topicKey] ?? q.topicKey}
                        </span>
                      )}
                      {q.difficulty && (
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${DIFF_COLOR[q.difficulty] ?? ''}`}>
                          {q.difficulty}
                        </span>
                      )}
                      {q.module && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full uppercase">
                          {q.module}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.questionText}</p>

                    {/* Expanded choices */}
                    {expandedId === q.id && (
                      <div className="mt-3 space-y-1.5">
                        {[['A', q.choiceA], ['B', q.choiceB], ['C', q.choiceC], ['D', q.choiceD]].filter(([, t]) => t).map(([k, t]) => (
                          <div key={k} className={`flex gap-2 p-2 rounded-lg text-sm ${q.correctAnswer.toUpperCase() === k ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                            <span className="font-medium w-4">{k}.</span>
                            <span>{t}</span>
                          </div>
                        ))}
                        {q.attemptCount > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            Empirical difficulty: {Math.round((1 - (q.correctCount / q.attemptCount)) * 100)}% wrong
                            ({q.attemptCount} attempts)
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded">
                      {expandedId === q.id ? 'Hide' : 'View'}
                    </button>
                    <Link to={`/admin/questions/${q.id}`}
                      className="text-xs text-brand-600 hover:text-brand-500 px-2 py-1 rounded border border-brand-200 dark:border-brand-800">
                      Edit
                    </Link>
                    {statusFilter === 'pending_review' && (
                      <>
                        <button onClick={() => approve(q.id)} disabled={actionLoading === q.id}
                          className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium">
                          ✓ Approve
                        </button>
                        <button onClick={() => reject(q.id)} disabled={actionLoading === q.id}
                          className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-lg font-medium border border-red-200 dark:border-red-800">
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {statusFilter === 'approved' && (
                      <span className="text-xs text-green-600 font-medium">✓ Live</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
