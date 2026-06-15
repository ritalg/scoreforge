import { useState, useRef, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';

interface Upload {
  id: number;
  originalFilename: string;
  testName: string | null;
  section: string | null;
  status: string;
  questionCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600',
  extracting: 'bg-blue-100 text-blue-600',
  tagging: 'bg-purple-100 text-purple-600',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
};

const STATUS_ICON: Record<string, string> = {
  queued: '⏳', extracting: '🔄', tagging: '🏷️', done: '✅', failed: '❌',
};

export default function UploadCenter() {
  const { data: uploads, loading, refetch } = useApi<Upload[]>('/api/admin/uploads');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [testName, setTestName] = useState('');
  const [section, setSection] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.');
      return;
    }
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    if (testName) form.append('testName', testName);
    if (section) form.append('section', section);

    try {
      const res = await fetch('/api/admin/uploads', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Upload failed');
      }
      setTestName('');
      setSection('');
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, [testName, section, refetch]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) doUpload(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = '';
  }

  if (loading) return <PageSpinner />;

  const inProgress = (uploads ?? []).filter(u => ['queued','extracting','tagging'].includes(u.status));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Center</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload SAT practice test PDFs — Claude AI will extract and tag all questions automatically.
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Name <span className="text-gray-400">(optional)</span></label>
            <input value={testName} onChange={e => setTestName(e.target.value)}
              placeholder="e.g., SAT Practice Test 1"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section <span className="text-gray-400">(optional)</span></label>
            <select value={section} onChange={e => setSection(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm">
              <option value="">All Sections</option>
              <option value="math">Math</option>
              <option value="rw">Reading & Writing</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
            : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
              <p className="text-sm text-gray-500">Uploading and starting extraction…</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📄</div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Drop a PDF here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">Max 50 MB · PDF only</p>
            </>
          )}
        </div>
      </Card>

      {/* In-progress */}
      {inProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
            <button onClick={refetch} className="text-xs text-brand-600 hover:text-brand-500">Refresh</button>
          </CardHeader>
          <div className="space-y-3">
            {inProgress.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xl animate-pulse">{STATUS_ICON[u.status]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.originalFilename}</p>
                  <p className="text-xs text-gray-500 capitalize">{u.status}…</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upload history */}
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <span className="text-xs text-gray-400">{(uploads ?? []).length} total</span>
        </CardHeader>
        {(uploads ?? []).length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No uploads yet. Drop a PDF above to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium">File</th>
                  <th className="pb-2 pr-4 font-medium">Test</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Questions</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(uploads ?? []).map(u => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{u.originalFilename}</span>
                      {u.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5">{u.errorMessage}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">{u.testName ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[u.status] ?? ''}`}>
                        {STATUS_ICON[u.status]} {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">
                      {u.status === 'done' ? u.questionCount : '—'}
                    </td>
                    <td className="py-2.5 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
