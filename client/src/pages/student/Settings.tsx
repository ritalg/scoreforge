import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

interface NotifPref {
  notificationType: string; label: string; description: string;
  inApp: boolean; email: boolean; push: boolean; sms: boolean;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const FONT_SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [prefs, setPrefs] = useState<NotifPref[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Web push state
  const [pushSupported] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window);
  const [pushStatus, setPushStatus] = useState<'idle' | 'subscribed' | 'subscribing' | 'error'>('idle');
  const [pushError, setPushError] = useState('');

  // Appearance state
  const [theme, setTheme] = useState<string>(
    () => localStorage.getItem('theme') || 'system'
  );
  const [fontSize, setFontSize] = useState<string>(
    () => localStorage.getItem('fontSize') || 'md'
  );
  const [language, setLanguage] = useState<string>(i18n.language || 'en');
  const [leaderboardOptOut, setLeaderboardOptOut] = useState(false);

  useEffect(() => {
    api.get<NotifPref[]>('/api/notification-preferences').then(data => {
      setPrefs(data);
      setPrefsLoading(false);
    });
  }, []);

  useEffect(() => {
    // Apply font size
    const sizes: Record<string, string> = { sm: '14px', md: '16px', lg: '18px', xl: '20px' };
    document.documentElement.style.fontSize = sizes[fontSize] || '16px';
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    if (theme === 'dark') { root.classList.add('dark'); }
    else if (theme === 'light') { root.classList.remove('dark'); }
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
      else root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  async function subscribeToPush() {
    if (!pushSupported) return;
    setPushStatus('subscribing');
    setPushError('');
    try {
      const { publicKey } = await api.get<{ publicKey: string | null }>('/api/vapid-public-key');
      if (!publicKey) throw new Error('Push notifications not configured on server');

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const sub = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post('/api/notification-preferences/push-subscribe', {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });

      setPushStatus('subscribed');
    } catch (e: any) {
      setPushError(e.message ?? 'Failed to subscribe');
      setPushStatus('error');
    }
  }

  function changeLanguage(lang: string) {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    // Persist to server
    api.patch('/api/users/me', { language: lang }).catch(() => {});
  }

  async function togglePref(type: string, channel: 'inApp' | 'email' | 'push', value: boolean) {
    setSaving(type + channel);
    await api.put(`/api/notification-preferences/${type}`, { [channel === 'inApp' ? 'inApp' : channel]: value });
    setPrefs(prev => prev.map(p => p.notificationType === type ? { ...p, [channel]: value } : p));
    setSaving(null);
    setSaved(type + channel);
    setTimeout(() => setSaved(null), 1500);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>

      {/* Appearance */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.language')}</label>
          <div className="flex gap-2">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => changeLanguage(l.code)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${language === l.code
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-300'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.theme')}</label>
          <div className="flex gap-2">
            {[
              { value: 'system', label: t('settings.themeSystem'), icon: '💻' },
              { value: 'light', label: t('settings.themeLight'), icon: '☀️' },
              { value: 'dark', label: t('settings.themeDark'), icon: '🌙' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${theme === opt.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-300'}`}>
                <span>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.fontSize')}</label>
          <div className="flex gap-2">
            {FONT_SIZES.map(f => (
              <button key={f.value} onClick={() => setFontSize(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${fontSize === f.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('settings.notifications')}</h2>
        {prefsLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 pb-2 border-b border-gray-100 dark:border-gray-700">
              <span className="col-span-1">Notification</span>
              <span className="text-center">{t('settings.notifInApp')}</span>
              <span className="text-center">{t('settings.notifEmail')}</span>
              <span className="text-center">{t('settings.notifPush')}</span>
            </div>
            {prefs.map(p => (
              <div key={p.notificationType} className="grid grid-cols-4 gap-2 items-center py-1">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{p.label}</p>
                  <p className="text-xs text-gray-500">{p.description}</p>
                </div>
                {(['inApp', 'email', 'push'] as const).map(ch => {
                  const k = p.notificationType + ch;
                  const val = p[ch];
                  return (
                    <div key={ch} className="flex justify-center">
                      <button onClick={() => togglePref(p.notificationType, ch, !val)}
                        disabled={saving === k}
                        className={`relative w-10 h-6 rounded-full transition-colors ${val ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${val ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Web Push */}
      {pushSupported && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Browser Push Notifications</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Receive study reminders, badge alerts, and assignment notifications directly in your browser.
          </p>
          {pushStatus === 'subscribed' ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <span>✓</span>
              <span>Push notifications enabled</span>
            </div>
          ) : (
            <button
              onClick={subscribeToPush}
              disabled={pushStatus === 'subscribing'}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {pushStatus === 'subscribing' ? 'Enabling…' : 'Enable Push Notifications'}
            </button>
          )}
          {pushError && <p className="text-xs text-red-500">{pushError}</p>}
        </section>
      )}

      {/* Privacy */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">{t('settings.privacy')}</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={leaderboardOptOut} onChange={e => {
            setLeaderboardOptOut(e.target.checked);
            api.patch('/api/users/me', { leaderboardOptOut: e.target.checked }).catch(() => {});
          }} className="w-4 h-4 text-brand-600 rounded" />
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.leaderboardOptOut')}</span>
        </label>
      </section>
    </div>
  );
}
