import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS, MATH_TOPICS, RW_TOPICS } from '@scoreforge/shared';

interface ErrorEntry {
  id: number;
  questionId: number;
  studentAnswer: string | null;
  answeredAt: string | null;
  question: {
    questionText: string;
    correctAnswer: string;
    explanation: string | null;
    topicKey: string | null;
    difficulty: string | null;
  } | null;
  note: { id: number; reflection: string | null; createdAt: string } | null;
}

interface PageResult {
  errors: ErrorEntry[];
  total: number;
  page: number;
  pages: number;
}

const DIFF_COLOR: Record<string, string> = {
  easy: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  hard: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

export default function ErrorLog() {
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reflections, setReflections] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (topic) params.set('topic', topic);

  const { data, loading, refetch } = useApi<PageResult>(`/api/annotations/error-log?${params}`, [topic, page]);

  async function saveReflection(attemptId: number) {
    setSavingId(attemptId);
    try {
      await api.post(`/api/annotations/error-log/${attemptId}/note`, { reflection: reflections[attemptId] ?? '' });
      refetch();
    } finally { setSavingId(null); }
  }

  if (loading && !data) return <PageSpinner />;

  const errors = data?.errors ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Error Log</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {data?.total ?? 0} wrong answers · Review what went wrong and add reflections
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={topic} onChange={e => { setTopic(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All topics</option>
          <optgroup label="Math">
            {MATH_TOPICS.map(t => <option key={t} value={t}>{(TOPIC_LABELS as Record<string,string>)[t]}</option>)}
          </optgroup>
          <optgroup label="Reading & Writing">
            {RW_TOPICS.map(t => <option key={t} value={t}>{(TOPIC_LABELS as Record<string,string>)[t]}</option>)}
          </optgroup>
        </select>
        {topic && (
          <button onClick={() => { setTopic(''); setPage(1); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            × Clear
          </button>
        )}
      </div>

      {/* Error list */}
      {errors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {topic ? 'No errors for this topic.' : 'No wrong answers recorded yet. Keep studying!'}
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map(entry => {
            const q = entry.question;
            const isExpanded = expandedId === entry.id;
            const currentReflection = reflections[entry.id] ?? entry.note?.reflection ?? '';

            return (
              <Card key={entry.id} padding="none" className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {q?.topicKey && (
                          <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            {(TOPIC_LABELS as Record<string,string>)[q.topicKey] ?? q.topicKey}
                          </span>
                        )}
                        {q?.difficulty && (
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${DIFF_COLOR[q.difficulty] ?? ''}`}>
                            {q.difficulty}
                          </span>
                        )}
                        {entry.note?.reflection && (
                          <span className="text-xs text-purple-600 dark:text-purple-400">📝 Has reflection</span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {entry.answeredAt ? new Date(entry.answeredAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q?.questionText}</p>
                      {!isExpanded && (
                        <p className="text-xs text-red-500 mt-1">
                          Your answer: <strong>{entry.studentAnswer}</strong>
                          {' · '}Correct: <strong className="text-green-600">{q?.correctAnswer}</strong>
                        </p>
                      )}
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400 flex-shrink-0">
                      {isExpanded ? 'Hide' : 'Review'}
                    </button>
                  </div>

                  {isExpanded && q && (
                    <div className="mt-4 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                      <p className="text-sm text-gray-900 dark:text-white">{q.questionText}</p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">Your answer</p>
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{entry.studentAnswer}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-0.5">Correct answer</p>
                          <p className="text-sm font-semibold text-green-700 dark:text-green-300">{q.correctAnswer}</p>
                        </div>
                      </div>

                      {q.explanation && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Explanation</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}

                      {/* Reflection note */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          My reflection — why did I get this wrong?
                        </label>
                        <textarea rows={2} value={currentReflection}
                          onChange={e => setReflections(r => ({ ...r, [entry.id]: e.target.value }))}
                          placeholder="e.g. I misread the question, confused area with perimeter…"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                        <button onClick={() => saveReflection(entry.id)} disabled={savingId === entry.id}
                          className="mt-1.5 text-xs px-3 py-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg">
                          {savingId === entry.id ? 'Saving…' : 'Save reflection'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
