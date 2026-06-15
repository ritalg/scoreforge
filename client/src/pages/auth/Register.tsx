import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'parent' | 'tutor',
    birthYear: '',
    parentEmail: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const age = form.birthYear ? currentYear - parseInt(form.birthYear) : null;
  const needsParentEmail = age !== null && age < 13;

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        birthYear: form.birthYear ? parseInt(form.birthYear) : undefined,
        parentEmail: needsParentEmail ? form.parentEmail : undefined,
      };
      const data = await api.post<{ message: string }>('/api/auth/register', payload);
      setSuccess(data.message);
    } catch (err: unknown) {
      setError((err as Error).message || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.checkEmail')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{success}</p>
            <Link to="/login" className="text-brand-600 hover:text-brand-500 dark:text-brand-400 font-medium">
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('app.name')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('auth.createYourAccount')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.firstName')}
                </label>
                <input id="firstName" name="firstName" type="text" required
                  value={form.firstName} onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.lastName')}
                </label>
                <input id="lastName" name="lastName" type="text" required
                  value={form.lastName} onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.email')}
              </label>
              <input id="email" name="email" type="email" autoComplete="email" required
                value={form.email} onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.password')}
              </label>
              <input id="password" name="password" type="password" autoComplete="new-password" required
                value={form.password} onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.iAm')}
              </label>
              <select id="role" name="role" value={form.role} onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                <option value="student">{t('roles.student')}</option>
                <option value="parent">{t('roles.parent')}</option>
                <option value="tutor">{t('roles.tutor')}</option>
              </select>
            </div>

            {form.role === 'student' && (
              <div>
                <label htmlFor="birthYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.birthYear')} <span className="text-gray-400">{t('common.optional')}</span>
                </label>
                <input id="birthYear" name="birthYear" type="number"
                  min="1990" max={currentYear}
                  value={form.birthYear} onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder={String(currentYear - 16)}
                />
              </div>
            )}

            {needsParentEmail && (
              <div>
                <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.parentEmail')} <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('auth.coppaNotice')}</p>
                <input id="parentEmail" name="parentEmail" type="email" required
                  value={form.parentEmail} onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors mt-2"
            >
              {loading ? t('common.loading') : t('auth.createAccount')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-500 dark:text-brand-400 font-medium">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
