import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Student {
  id: number; firstName: string; lastName: string; email: string;
  level: number; totalXp: number; sessionCount: number; recentScore: number | null;
  trend: 'up' | 'down' | 'flat' | null; lastStudyDate: string | null;
  daysSinceStudy: number | null; needsAttention: boolean; streak: number;
  tutorNotes: string | null; linkId: number;
}

export default function StudentRoster() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<Student[]>('/api/tutor/students').then(s => { setStudents(s); setLoading(false); });
  }, []);

  function selectStudent(s: Student) { setSelected(s); setNotes(s.tutorNotes ?? ''); }

  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    await api.put(`/api/tutor/students/${selected.id}/notes`, { notes });
    setSavingNotes(false);
    setStudents(prev => prev.map(s => s.id === selected.id ? { ...s, tutorNotes: notes } : s));
    setSelected(s => s ? { ...s, tutorNotes: notes } : s);
  }

  const trendIcon = (t: Student['trend']) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  const filtered = students.filter(s =>
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-gray-500">Loading roster…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Roster</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…"
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white w-60" />
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {students.length === 0
                ? <><p className="text-lg font-medium">No students yet</p><p className="text-sm mt-1">Share your tutor ID with students so they can link to you</p></>
                : 'No matches'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Level / XP</th>
                  <th className="px-4 py-3">Last Score</th>
                  <th className="px-4 py-3">Streak</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => selectStudent(s)}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selected?.id === s.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-gray-500">{s.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">Lv {s.level}</p>
                      <p className="text-xs text-gray-500">{s.totalXp.toLocaleString()} XP</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.recentScore != null ? (
                        <span className={`font-medium ${s.trend === 'up' ? 'text-green-600' : s.trend === 'down' ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          {s.recentScore}% {trendIcon(s.trend)}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700 dark:text-gray-300">{s.streak}🔥</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.needsAttention
                        ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">Inactive {s.daysSinceStudy}d</span>
                        : <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="w-72 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 self-start">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 text-xl font-bold mx-auto mb-2">
                {selected.firstName[0]}{selected.lastName[0]}
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{selected.firstName} {selected.lastName}</h2>
              <p className="text-xs text-gray-500">{selected.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              {[
                { label: 'Level', value: `Lv ${selected.level}` },
                { label: 'Total XP', value: selected.totalXp.toLocaleString() },
                { label: 'Sessions', value: selected.sessionCount },
                { label: 'Streak', value: `${selected.streak}🔥` },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                  <p className="font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tutor Notes</label>
              <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Private notes…"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none" />
              <button onClick={saveNotes} disabled={savingNotes}
                className="mt-2 w-full py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {savingNotes ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
