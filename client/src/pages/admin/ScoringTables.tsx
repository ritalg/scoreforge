import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';

interface TableResult {
  grouped: Record<string, Record<string, { rawScore: number; scaledScore: number }[]>>;
  testNames: string[];
  total: number;
}

export default function ScoringTables() {
  const { data, loading, refetch } = useApi<TableResult>('/api/admin/scoring-tables');
  const [importForm, setImportForm] = useState({ testName: '', section: 'math', csvText: '' });
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  function parseCsv(text: string): { rawScore: string; scaledScore: string }[] {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];
    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const rawIdx = header.findIndex(h => h.includes('raw'));
    const scaledIdx = header.findIndex(h => h.includes('scaled'));
    if (rawIdx === -1 || scaledIdx === -1) {
      // Try first two columns
      return lines.slice(1).map(l => {
        const cols = l.split(',');
        return { rawScore: cols[0]?.trim(), scaledScore: cols[1]?.trim() };
      });
    }
    return lines.slice(1).map(l => {
      const cols = l.split(',');
      return { rawScore: cols[rawIdx]?.trim(), scaledScore: cols[scaledIdx]?.trim() };
    });
  }

  async function importTable() {
    setError('');
    if (!importForm.testName.trim() || !importForm.csvText.trim()) {
      setError('Test name and CSV data required');
      return;
    }
    const rows = parseCsv(importForm.csvText);
    if (rows.length === 0) { setError('No valid rows parsed from CSV'); return; }

    setImporting(true);
    try {
      await api.post('/api/admin/scoring-tables/import', {
        testName: importForm.testName.trim(),
        section: importForm.section,
        rows,
      });
      setImportForm({ testName: '', section: 'math', csvText: '' });
      refetch();
    } catch (e: any) {
      setError(e.message ?? 'Import failed');
    } finally { setImporting(false); }
  }

  async function deleteTable(testName: string, section: string) {
    if (!confirm(`Delete scoring table for ${testName} (${section})?`)) return;
    await api.delete(`/api/admin/scoring-tables/${encodeURIComponent(testName)}/${section}`);
    refetch();
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scoring Tables</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Import College Board raw-to-scaled score conversion tables. {data?.total ?? 0} rows loaded.
        </p>
      </div>

      {/* Import form */}
      <Card padding="md" className="space-y-4">
        <CardHeader><CardTitle>Import Scoring Table</CardTitle></CardHeader>
        <p className="text-xs text-gray-500">CSV format: two columns — raw_score, scaled_score (or with headers)</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Name</label>
            <input value={importForm.testName} onChange={e => setImportForm(f => ({ ...f, testName: e.target.value }))}
              placeholder="e.g. SAT Practice Test 1"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
            <select value={importForm.section} onChange={e => setImportForm(f => ({ ...f, section: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="math">Math</option>
              <option value="rw">Reading & Writing</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CSV Data</label>
          <textarea rows={8} value={importForm.csvText} onChange={e => setImportForm(f => ({ ...f, csvText: e.target.value }))}
            placeholder="raw_score,scaled_score&#10;0,200&#10;1,210&#10;2,220&#10;..."
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={importTable} disabled={importing}
          className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
          {importing ? 'Importing…' : 'Import Table'}
        </button>
      </Card>

      {/* Existing tables */}
      {data && data.testNames.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Loaded Tables</h2>
          {data.testNames.map(testName => (
            <Card key={testName} padding="md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">{testName}</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {(['math', 'rw'] as const).map(section => {
                  const rows = data.grouped[testName]?.[section] ?? [];
                  if (rows.length === 0) return null;
                  return (
                    <div key={section}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {section === 'rw' ? 'Reading & Writing' : 'Math'}
                        </span>
                        <button onClick={() => deleteTable(testName, section)}
                          className="text-xs text-red-500 hover:text-red-600">
                          Delete
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="text-left py-1">Raw</th>
                              <th className="text-left py-1">Scaled</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {rows.slice(0, 15).map((r, i) => (
                              <tr key={i}>
                                <td className="py-0.5 text-gray-600 dark:text-gray-400">{r.rawScore}</td>
                                <td className="py-0.5 font-medium text-gray-800 dark:text-gray-200">{r.scaledScore}</td>
                              </tr>
                            ))}
                            {rows.length > 15 && (
                              <tr><td colSpan={2} className="py-1 text-gray-400">…{rows.length - 15} more rows</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
