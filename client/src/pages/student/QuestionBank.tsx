import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS, MATH_TOPICS, RW_TOPICS } from '@scoreforge/shared';
import { PassagePanel } from '../../components/ui/PassagePanel';

interface Question {
  id: number;
  questionText: string;
  questionType: string;
  choiceA: string | null; choiceB: string | null; choiceC: string | null; choiceD: string | null;
  correctAnswer: string;
  explanation: string | null;
  topicKey: string | null;
  difficulty: string | null;
  module: string | null;
  passage?: { id: number; passageText: string; passageType: string | null } | null;
  figures?: Array<{ id: number; imagePath: string; figureType: string | null; altText: string | null }>;
  sr: { intervalDays: number; nextReviewAt: string } | null;
  empiricalDifficulty: number | null;
  attemptCount: number;
  correctCount: number;
}

interface PageResult {
  questions: Question[];
  total: number;
  page: number;
  pages: number;
}

const DIFF_BADGE: Record<string, string> = {
  easy: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  medium: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  hard: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

export default function QuestionBank() {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [mod, setMod] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (topic) params.set('topic', topic);
  if (difficulty) params.set('difficulty', difficulty);
  if (mod) params.set('module', mod);
  if (search) params.set('search', search);

  const { data, loading } = useApi<PageResult>(`/api/question-bank?${params}`, [topic, difficulty, mod, search, page]);
  const { data: topicCounts } = useApi<Record<string, number>>('/api/question-bank/topics');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function resetFilters() {
    setTopic(''); setDifficulty(''); setMod(''); setSearch(''); setSearchInput(''); setPage(1);
  }

  if (loading && !data) return <PageSpinner />;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Question Bank</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {data?.total ?? '…'} approved questions · Browse, filter, and review
          </p>
        </div>
        <Link to="/student/quiz" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg">
          Start Quiz →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-48">
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search questions…"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <button type="submit" className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg">
            Search
          </button>
        </form>

        <select value={topic} onChange={e => { setTopic(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All topics</option>
          <optgroup label="Math">
            {MATH_TOPICS.map(t => (
              <option key={t} value={t}>
                {(TOPIC_LABELS as Record<string, string>)[t]} {topicCounts?.[t] ? `(${topicCounts[t]})` : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Reading & Writing">
            {RW_TOPICS.map(t => (
              <option key={t} value={t}>
                {(TOPIC_LABELS as Record<string, string>)[t]} {topicCounts?.[t] ? `(${topicCounts[t]})` : ''}
              </option>
            ))}
          </optgroup>
        </select>

        <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <select value={mod} onChange={e => { setMod(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All modules</option>
          <option value="m1">M1 (All students)</option>
          <option value="m2_hard">M2 Hard</option>
          <option value="m2_easy">M2 Easy/Medium</option>
        </select>

        {(topic || difficulty || mod || search) && (
          <button onClick={resetFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            × Clear
          </button>
        )}
      </div>

      {/* Question list */}
      <div className="space-y-3">
        {(data?.questions ?? []).map(q => (
          <Card key={q.id} padding="none" className="overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {q.topicKey && (
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        {(TOPIC_LABELS as Record<string, string>)[q.topicKey] ?? q.topicKey}
                      </span>
                    )}
                    {q.difficulty && (
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${DIFF_BADGE[q.difficulty] ?? ''}`}>
                        {q.difficulty}
                      </span>
                    )}
                    {q.module && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full uppercase text-[10px]">
                        {q.module}
                      </span>
                    )}
                    {q.sr && (
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        SR: {q.sr.intervalDays}d interval
                      </span>
                    )}
                    {q.empiricalDifficulty != null && (
                      <span className="text-xs text-gray-400">
                        {q.empiricalDifficulty}% miss rate ({q.attemptCount} attempts)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.questionText}</p>
                </div>
                <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400 px-2 py-1 rounded flex-shrink-0">
                  {expandedId === q.id ? 'Hide' : 'View'}
                </button>
              </div>

              {expandedId === q.id && (
                <div className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                  {(q.passage || (q.figures && q.figures.length > 0)) && (
                    <PassagePanel passage={q.passage} figures={q.figures} />
                  )}

                  <p className="text-sm text-gray-900 dark:text-white">{q.questionText}</p>

                  <div className="space-y-2">
                    {[['A', q.choiceA], ['B', q.choiceB], ['C', q.choiceC], ['D', q.choiceD]].filter(([, t]) => t).map(([k, t]) => (
                      <div key={k} className={`flex gap-2 p-2.5 rounded-lg text-sm ${
                        q.correctAnswer.toUpperCase() === k
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-medium'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        <span className="font-medium w-4">{k}.</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Explanation</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{q.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {data && data.questions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No questions match your filters.
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
