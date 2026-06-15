import { useState, useRef } from 'react';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { TOPIC_LABELS } from '@scoreforge/shared';

type Row = {
  questionText: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctAnswer: string;
  topicKey: string;
  difficulty: string;
  explanation: string;
  valid: boolean;
  error?: string;
};

function parseCSV(text: string): Row[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Handle quoted commas
    const cols: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });

    const r: Row = {
      questionText: row['question_text'] || row['questionText'] || '',
      choiceA: row['choice_a'] || row['choiceA'] || '',
      choiceB: row['choice_b'] || row['choiceB'] || '',
      choiceC: row['choice_c'] || row['choiceC'] || '',
      choiceD: row['choice_d'] || row['choiceD'] || '',
      correctAnswer: (row['correct_answer'] || row['correctAnswer'] || '').toUpperCase(),
      topicKey: row['topic_key'] || row['topicKey'] || '',
      difficulty: row['difficulty'] || '',
      explanation: row['explanation'] || '',
      valid: true,
    };

    if (!r.questionText) { r.valid = false; r.error = 'Missing question_text'; }
    else if (!r.correctAnswer.match(/^[A-D]$/)) { r.valid = false; r.error = 'correct_answer must be A-D'; }
    else if (!r.choiceA || !r.choiceB) { r.valid = false; r.error = 'choice_a and choice_b required'; }

    return r;
  });
}

export default function BulkImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) { setError('No valid rows to import'); return; }
    setImporting(true);
    setError(null);
    try {
      const res = await api.post('/api/admin/questions/csv-import', { rows: validRows }) as any;
      setResult(res.message);
      setRows([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk CSV Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import multiple questions at once from a CSV file. Questions are added as{' '}
          <span className="font-medium text-amber-600">pending_review</span> and require admin approval.
        </p>
      </div>

      {/* Format guide */}
      <Card>
        <CardHeader><CardTitle>CSV Format</CardTitle></CardHeader>
        <div className="px-6 pb-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Required columns:</p>
          <code className="block text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-x-auto whitespace-pre">
            {`question_text,choice_a,choice_b,choice_c,choice_d,correct_answer,topic_key,difficulty,explanation`}
          </code>
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">correct_answer:</p>
              <p>A, B, C, or D</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">difficulty:</p>
              <p>easy, medium, or hard</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">topic_key (examples):</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(TOPIC_LABELS).slice(0, 6).map(([k, v]) => (
                  <span key={k} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 rounded">{k}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* File picker */}
      <Card>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select CSV file</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              aria-label="Select CSV file for bulk import"
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
            />
          </label>
          {fileName && <p className="text-sm text-gray-500">Loaded: <span className="font-medium">{fileName}</span></p>}
        </div>
      </Card>

      {/* Preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Preview — {rows.length} rows
              {validCount > 0 && <span className="ml-2 text-sm font-normal text-green-600">{validCount} valid</span>}
              {invalidCount > 0 && <span className="ml-2 text-sm font-normal text-red-600">{invalidCount} invalid</span>}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="CSV preview table">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-gray-500">Question</th>
                  <th className="px-3 py-2 text-left text-gray-500">Ans</th>
                  <th className="px-3 py-2 text-left text-gray-500">Topic</th>
                  <th className="px-3 py-2 text-left text-gray-500">Difficulty</th>
                  <th className="px-3 py-2 text-left text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row, i) => (
                  <tr key={i} className={row.valid ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                      {row.questionText || <span className="text-red-500 italic">empty</span>}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">{row.correctAnswer}</td>
                    <td className="px-3 py-2 text-gray-500">{row.topicKey}</td>
                    <td className="px-3 py-2 text-gray-500">{row.difficulty}</td>
                    <td className="px-3 py-2">
                      {row.valid
                        ? <span className="text-green-600 font-medium">✓ Valid</span>
                        : <span className="text-red-600 font-medium" title={row.error}>✗ {row.error}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              aria-busy={importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing…' : `Import ${validCount} valid question${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </Card>
      )}

      {result && (
        <div role="status" className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-green-700 dark:text-green-300 text-sm font-medium">
          ✓ {result}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
