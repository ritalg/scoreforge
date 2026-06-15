import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';

type EssayType = 'sat_essay' | 'act_essay' | 'general';

interface DimFeedback {
  score: number;
  rationale: string;
  strength: string;
  improvement: string;
}
interface Feedback {
  reading: DimFeedback;
  analysis: DimFeedback;
  writing: DimFeedback;
  overallFeedback: string;
  keyImprovements: string[];
}
interface Submission {
  id: number;
  essayType: string;
  readingScore: number | null;
  analysisScore: number | null;
  writingScore: number | null;
  totalScore: number | null;
  aiFeedbackJson: string | null;
  createdAt: string;
}

const ESSAY_TYPES: { value: EssayType; label: string; desc: string }[] = [
  { value: 'sat_essay', label: 'SAT Essay', desc: 'Reading · Analysis · Writing (1–4 each)' },
  { value: 'act_essay', label: 'ACT Essay', desc: 'Ideas · Development · Organization · Language (1–6 each)' },
  { value: 'general', label: 'General Essay', desc: 'Argument · Evidence · Style (1–4 each)' },
];

function ScoreDial({ label, score, max = 4, color }: { label: string; score: number; max?: number; color: string }) {
  const pct = (score / max) * 100;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className={color}
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-900 dark:text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-xs text-gray-400">{score}/{max}</span>
    </div>
  );
}

export default function EssayScorer() {
  const [essayType, setEssayType] = useState<EssayType>('sat_essay');
  const [promptText, setPromptText] = useState('');
  const [essayText, setEssayText] = useState('');
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<(Submission & { feedback: Feedback }) | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'score' | 'history'>('score');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: history, refetch: refetchHistory } = useApi<Submission[]>('/api/essays/history');

  async function submit() {
    if (essayText.trim().length < 100) {
      setError('Essay must be at least 100 characters.');
      return;
    }
    setScoring(true); setError(''); setResult(null);
    try {
      const res = await api.post<any>('/api/essays/submit', { essayType, promptText, essayText });
      setResult(res);
      refetchHistory();
      setTab('score');
    } catch (e: any) {
      setError(e.message ?? 'Scoring failed. Please try again.');
    } finally { setScoring(false); }
  }

  const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Essay Scorer</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Get instant rubric-aligned feedback on your essay</p>
        </div>
        <div className="flex gap-2">
          {(['score', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {t === 'history' ? `History (${history?.length ?? 0})` : 'Score Essay'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'score' && (
        <div className="space-y-6">
          {/* Essay type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Essay Type</label>
            <div className="grid grid-cols-3 gap-3">
              {ESSAY_TYPES.map(t => (
                <button key={t.value} onClick={() => setEssayType(t.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${essayType === t.value
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-gray-700'}`}>
                  <p className={`text-sm font-medium ${essayType === t.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>{t.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prompt or Source Text <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea rows={3} value={promptText} onChange={e => setPromptText(e.target.value)}
              placeholder="Paste the essay prompt or source passage here…"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
          </div>

          {/* Essay input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Essay</label>
              <span className={`text-xs ${wordCount < 250 ? 'text-orange-500' : 'text-gray-400'}`}>
                {wordCount} words {wordCount < 250 ? '(aim for 250+)' : ''}
              </span>
            </div>
            <textarea rows={14} value={essayText} onChange={e => setEssayText(e.target.value)}
              placeholder="Paste or type your essay here…"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none font-serif leading-relaxed" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={submit} disabled={scoring || essayText.trim().length < 100}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-base">
            {scoring ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Claude is scoring your essay…
              </span>
            ) : 'Score My Essay →'}
          </button>

          {/* Result */}
          {result?.feedback && (
            <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Score</h2>
                <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
                  {result.totalScore}/12
                </div>
              </div>

              {/* Score dials */}
              <div className="flex justify-around py-4">
                <ScoreDial label="Reading" score={result.readingScore ?? 0} color="text-blue-500" />
                <ScoreDial label="Analysis" score={result.analysisScore ?? 0} color="text-purple-500" />
                <ScoreDial label="Writing" score={result.writingScore ?? 0} color="text-green-500" />
              </div>

              {/* Overall */}
              <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Overall Feedback</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{result.feedback.overallFeedback}</p>
              </Card>

              {/* Per-dimension */}
              <div className="grid gap-4">
                {([
                  { key: 'reading', label: 'Reading', color: 'border-blue-400' },
                  { key: 'analysis', label: 'Analysis', color: 'border-purple-400' },
                  { key: 'writing', label: 'Writing', color: 'border-green-400' },
                ] as const).map(({ key, label, color }) => {
                  const dim = result.feedback[key];
                  if (!dim) return null;
                  return (
                    <Card key={key} padding="md" className={`border-l-4 ${color}`}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{dim.score}/4</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{dim.rationale}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-2">
                          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-0.5">✓ Strength</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{dim.strength}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-2">
                          <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-0.5">↑ Improve</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{dim.improvement}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Key improvements */}
              {result.feedback.keyImprovements?.length > 0 && (
                <Card padding="md">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Key Improvements</p>
                  <ol className="space-y-2">
                    {result.feedback.keyImprovements.map((imp, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-brand-600 dark:text-brand-400 font-medium flex-shrink-0">{i + 1}.</span>
                        {imp}
                      </li>
                    ))}
                  </ol>
                </Card>
              )}

              <button onClick={() => { setResult(null); setEssayText(''); setPromptText(''); }}
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
                ← Score another essay
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {(history ?? []).length === 0 ? (
            <Card className="text-center py-12 text-gray-400">No essay submissions yet.</Card>
          ) : (
            (history ?? []).map(essay => {
              const feedback = essay.aiFeedbackJson ? JSON.parse(essay.aiFeedbackJson) : null;
              const isExpanded = expandedId === essay.id;
              return (
                <Card key={essay.id} padding="md">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {essay.essayType.replace('_', ' ')}
                        </span>
                        {essay.totalScore != null && (
                          <span className="text-xs bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full font-semibold">
                            {essay.totalScore}/12
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(essay.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : essay.id)}
                      className="text-xs text-brand-600 dark:text-brand-400">
                      {isExpanded ? 'Hide' : 'View feedback'}
                    </button>
                  </div>

                  {isExpanded && feedback && !feedback.error && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                      <div className="flex gap-6">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{feedback.reading?.score ?? essay.readingScore}</div>
                          <div className="text-xs text-gray-400">Reading</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600">{feedback.analysis?.score ?? essay.analysisScore}</div>
                          <div className="text-xs text-gray-400">Analysis</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{feedback.writing?.score ?? essay.writingScore}</div>
                          <div className="text-xs text-gray-400">Writing</div>
                        </div>
                      </div>
                      {feedback.overallFeedback && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{feedback.overallFeedback}</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
