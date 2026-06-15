import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS, MATH_TOPICS, RW_TOPICS } from '@scoreforge/shared';

interface Question {
  id: number;
  questionText: string;
  questionType: string;
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  correctAnswer: string;
  explanation: string | null;
  topicKey: string | null;
  difficulty: string | null;
  module: string | null;
  status: string;
}
interface Version { id: number; versionNumber: number; snapshotJson: string; editedBy: number; createdAt: string; }
interface Passage { passageText: string; }
interface Figure { id: number; imagePath: string; figureType: string | null; altText: string | null; }

export default function QuestionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, refetch } = useApi<{ question: Question; passage: Passage | null; versions: Version[]; figures: Figure[] }>(
    `/api/admin/questions/${id}`
  );

  const [form, setForm] = useState<Partial<Question> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [figureAltText, setFigureAltText] = useState('');
  const [figureUploading, setFigureUploading] = useState(false);
  const [figureError, setFigureError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = data?.question;

  // Initialize form once loaded
  if (q && !form) {
    setForm({
      questionText: q.questionText,
      questionType: q.questionType,
      choiceA: q.choiceA, choiceB: q.choiceB, choiceC: q.choiceC, choiceD: q.choiceD,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topicKey: q.topicKey,
      difficulty: q.difficulty,
      module: q.module,
    });
  }

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put(`/api/admin/questions/${id}`, form);
      setSuccess('Saved successfully.');
      refetch();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally { setSaving(false); }
  }

  async function approve() {
    await api.post(`/api/admin/questions/${id}/approve`);
    refetch();
  }
  async function reject() {
    await api.post(`/api/admin/questions/${id}/reject`, { reason: '' });
    refetch();
  }

  async function uploadFigure(file: File) {
    setFigureUploading(true);
    setFigureError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (figureAltText) formData.append('altText', figureAltText);
      const res = await fetch(`/api/admin/questions/${id}/figures`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      setFigureAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetch();
    } catch (e: any) {
      setFigureError(e.message ?? 'Upload failed');
    } finally {
      setFigureUploading(false);
    }
  }

  async function deleteFigure(figureId: number) {
    if (!confirm('Delete this figure?')) return;
    try {
      await api.delete(`/api/admin/questions/${id}/figures/${figureId}`);
      refetch();
    } catch {}
  }

  if (loading || !form) return <PageSpinner />;
  if (!q) return <div className="p-8 text-red-500">Question not found.</div>;

  const allTopics = [...MATH_TOPICS, ...RW_TOPICS];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/questions" className="text-brand-600 hover:text-brand-500 text-sm">← Queue</Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit Question #{q.id}</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
          q.status === 'approved' ? 'bg-green-50 text-green-700' :
          q.status === 'rejected' ? 'bg-red-50 text-red-700' :
          'bg-yellow-50 text-yellow-700'
        }`}>{q.status.replace('_', ' ')}</span>
      </div>

      {data?.passage && (
        <Card padding="sm" className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">PASSAGE</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{data.passage.passageText}</p>
        </Card>
      )}

      <Card padding="md" className="space-y-4">
        <CardHeader><CardTitle>Question Content</CardTitle></CardHeader>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Text</label>
          <textarea rows={4} value={form.questionText ?? ''} onChange={e => setForm(f => ({ ...f!, questionText: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(['A', 'B', 'C', 'D'] as const).map(k => {
            const key = `choice${k}` as 'choiceA' | 'choiceB' | 'choiceC' | 'choiceD';
            const isCorrect = (form.correctAnswer ?? '').toUpperCase() === k;
            return (
              <div key={k}>
                <label className={`block text-sm font-medium mb-1 ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  Choice {k} {isCorrect && '✓'}
                </label>
                <div className="flex gap-2">
                  <input value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f!, [key]: e.target.value }))}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 ${isCorrect ? 'border-green-400 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'}`} />
                  <button onClick={() => setForm(f => ({ ...f!, correctAnswer: k }))}
                    className={`px-2 py-1 text-xs rounded ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-50'}`}>
                    ✓
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Explanation</label>
          <textarea rows={3} value={form.explanation ?? ''} onChange={e => setForm(f => ({ ...f!, explanation: e.target.value }))}
            placeholder="Why is this the correct answer?"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </Card>

      <Card padding="md" className="space-y-4">
        <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic</label>
            <select value={form.topicKey ?? ''} onChange={e => setForm(f => ({ ...f!, topicKey: e.target.value || null }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">— None —</option>
              <optgroup label="Math">
                {MATH_TOPICS.map(t => <option key={t} value={t}>{(TOPIC_LABELS as Record<string,string>)[t]}</option>)}
              </optgroup>
              <optgroup label="Reading & Writing">
                {RW_TOPICS.map(t => <option key={t} value={t}>{(TOPIC_LABELS as Record<string,string>)[t]}</option>)}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
            <select value={form.difficulty ?? ''} onChange={e => setForm(f => ({ ...f!, difficulty: e.target.value || null }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">— None —</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
            <select value={form.module ?? ''} onChange={e => setForm(f => ({ ...f!, module: e.target.value || null }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">— None —</option>
              <option value="m1">M1 (All students)</option>
              <option value="m2_hard">M2 Hard</option>
              <option value="m2_easy">M2 Easy</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}
        <div className="flex-1" />
        <button onClick={reject}
          className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
          Reject
        </button>
        <button onClick={approve}
          className="px-4 py-2 text-sm text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
          Approve
        </button>
        <button onClick={save} disabled={saving}
          className="px-5 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Figure management */}
      <Card padding="md" className="space-y-4">
        <CardHeader><CardTitle>Figures / Images</CardTitle></CardHeader>

        {data?.figures && data.figures.length > 0 && (
          <div className="space-y-2">
            {data.figures.map(fig => (
              <div key={fig.id} className="flex items-center gap-3 p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                <img src={fig.imagePath} alt={fig.altText ?? 'figure'} className="h-16 w-24 object-contain rounded bg-gray-50 dark:bg-gray-800" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{fig.imagePath}</p>
                  {fig.altText && <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{fig.altText}</p>}
                </div>
                <button onClick={() => deleteFigure(fig.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload New Figure</label>
          <input
            type="text"
            placeholder="Alt text (optional)"
            value={figureAltText}
            onChange={e => setFigureAltText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFigure(f); }}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/20 dark:file:text-brand-400"
          />
          {figureUploading && <p className="text-xs text-gray-400">Uploading…</p>}
          {figureError && <p className="text-xs text-red-500">{figureError}</p>}
        </div>
      </Card>

      {/* Version history */}
      {data?.versions && data.versions.length > 0 && (
        <Card padding="md">
          <button onClick={() => setShowVersions(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <span>{showVersions ? '▾' : '▸'}</span>
            Version History ({data.versions.length})
          </button>
          {showVersions && (
            <div className="mt-3 space-y-2">
              {data.versions.map(v => (
                <div key={v.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500">
                  <span className="font-medium text-gray-700 dark:text-gray-300">v{v.versionNumber}</span>
                  {' · '}{new Date(v.createdAt).toLocaleString()}
                  {' · by user #{v.editedBy}'}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
