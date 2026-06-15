import { useState } from 'react';
import { api } from '../../lib/api';

export default function LinkStudent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleLink() {
    if (!email.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const res: { message: string } = await api.post('/api/parent/link', { studentEmail: email });
      setSuccess(res.message);
      setEmail('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Link a Student</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter your child's ScoreForge email address to view their progress. They must already have a student account.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="student@example.com"
            onKeyDown={e => e.key === 'Enter' && handleLink()}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
          </div>
        )}

        <button onClick={handleLink} disabled={loading || !email.trim()}
          className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
          {loading ? 'Linking…' : 'Link Student'}
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">What you'll see after linking:</p>
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>Score prediction and progress over time</li>
          <li>Recent practice session results</li>
          <li>Study streaks and XP earned</li>
          <li>Upcoming test dates</li>
          <li>Weekly email digest (Sunday)</li>
        </ul>
      </div>
    </div>
  );
}
