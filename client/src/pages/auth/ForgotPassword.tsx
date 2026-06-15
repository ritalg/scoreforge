import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reset password</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            Enter your email and we'll send a reset link.
          </p>

          {sent ? (
            <div className="text-center">
              <p className="text-green-700 dark:text-green-400 mb-4">Check your email for a reset link.</p>
              <Link to="/login" className="text-brand-600 hover:text-brand-500 font-medium">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-brand-600 hover:text-brand-500 dark:text-brand-400">Back to login</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
