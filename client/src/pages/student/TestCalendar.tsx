import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface SATDate {
  id: number; testDate: string; registrationDeadline: string | null; isOfficial: boolean;
}

interface CalendarEntry {
  id: number; satTestDateId: number | null; customDate: string | null;
  isTarget: boolean; status: 'planned' | 'completed' | 'missed'; actualScore: number | null;
  officialDate: SATDate | null; resolvedDate: string | null; daysUntil: number | null;
}

const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  missed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function TestCalendar() {
  const [satDates, setSatDates] = useState<SATDate[]>([]);
  const [myEntries, setMyEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ mode: 'official', satDateId: '', customDate: '', isTarget: false });
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [dates, entries] = await Promise.all([
      api.get<SATDate[]>('/api/test-calendar/dates'),
      api.get<CalendarEntry[]>('/api/test-calendar/my'),
    ]);
    setSatDates(dates);
    setMyEntries(entries);
    setLoading(false);
  }

  const target = myEntries.find(e => e.isTarget);

  async function handleAdd() {
    setAddLoading(true); setError('');
    try {
      await api.post('/api/test-calendar', {
        satTestDateId: addForm.mode === 'official' && addForm.satDateId ? parseInt(addForm.satDateId) : null,
        customDate: addForm.mode === 'custom' ? addForm.customDate : null,
        isTarget: addForm.isTarget,
      });
      setShowAdd(false);
      setAddForm({ mode: 'official', satDateId: '', customDate: '', isTarget: false });
      fetchAll();
    } catch (e: any) { setError(e.message); }
    finally { setAddLoading(false); }
  }

  async function updateStatus(id: number, status: string) {
    await api.patch(`/api/test-calendar/${id}`, { status });
    fetchAll();
  }

  async function setAsTarget(id: number) {
    await api.patch(`/api/test-calendar/${id}`, { isTarget: true });
    fetchAll();
  }

  async function handleRemove(id: number) {
    if (!confirm('Remove this test date?')) return;
    await api.delete(`/api/test-calendar/${id}`);
    fetchAll();
  }

  const upcomingOfficialDates = satDates.filter(d => new Date(d.testDate) >= new Date());
  const myDateIds = new Set(myEntries.filter(e => e.satTestDateId).map(e => e.satTestDateId));

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Calendar</h1>
          <p className="text-sm text-gray-500">Track your SAT test dates and study timeline</p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); }}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          + Add Test Date
        </button>
      </div>

      {target && target.resolvedDate && (
        <div className={`rounded-xl p-5 ${target.daysUntil && target.daysUntil > 0 ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎯</span>
            <h2 className="font-semibold text-gray-900 dark:text-white">Target Test Date</h2>
          </div>
          <p className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatDate(target.resolvedDate)}</p>
          {target.daysUntil !== null && target.daysUntil > 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              <span className="text-3xl font-bold text-brand-600">{target.daysUntil}</span> days to go
            </p>
          ) : target.daysUntil !== null && target.daysUntil <= 0 ? (
            <p className="text-sm text-green-600 font-medium mt-1">Test day is here!</p>
          ) : null}
        </div>
      )}

      {myEntries.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">My Test Dates</h2>
          <div className="space-y-3">
            {myEntries.map(e => (
              <div key={e.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.isTarget && <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full">Target</span>}
                      {e.officialDate?.isOfficial && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">Official</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[e.status]}`}>{e.status}</span>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">
                      {e.resolvedDate ? formatDate(e.resolvedDate) : 'Unknown date'}
                    </p>
                    {e.daysUntil !== null && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {e.daysUntil > 0 ? `${e.daysUntil} days away` : e.daysUntil === 0 ? 'Today!' : `${Math.abs(e.daysUntil)} days ago`}
                      </p>
                    )}
                    {e.officialDate?.registrationDeadline && (
                      <p className="text-xs text-orange-600 mt-0.5">Reg deadline: {formatDate(e.officialDate.registrationDeadline)}</p>
                    )}
                    {e.actualScore && <p className="text-sm font-bold text-green-600 mt-1">Score: {e.actualScore}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    {e.status === 'planned' && !e.isTarget && (
                      <button onClick={() => setAsTarget(e.id)}
                        className="text-xs px-2 py-1 border border-brand-300 text-brand-600 rounded hover:bg-brand-50">
                        Set Target
                      </button>
                    )}
                    {e.status === 'planned' && e.daysUntil !== null && e.daysUntil <= 0 && (
                      <>
                        <button onClick={() => updateStatus(e.id, 'completed')}
                          className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600">Completed</button>
                        <button onClick={() => updateStatus(e.id, 'missed')}
                          className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">Missed</button>
                      </>
                    )}
                    <button onClick={() => handleRemove(e.id)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcomingOfficialDates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Upcoming SAT Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingOfficialDates.map(d => {
              const added = myDateIds.has(d.id);
              const daysAway = Math.ceil((new Date(d.testDate).getTime() - Date.now()) / 86400000);
              return (
                <div key={d.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(d.testDate)}</p>
                    {d.registrationDeadline && <p className="text-xs text-orange-600">Reg by: {formatDate(d.registrationDeadline)}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">{daysAway} days away</p>
                  </div>
                  {added ? (
                    <span className="text-xs text-brand-600 font-medium">Added</span>
                  ) : (
                    <button onClick={async () => { await api.post('/api/test-calendar', { satTestDateId: d.id }); fetchAll(); }}
                      className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {myEntries.length === 0 && upcomingOfficialDates.length === 0 && (
        <div className="text-center py-16 text-gray-500">No test dates available yet.</div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Test Date</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['official', 'custom'] as const).map(m => (
                  <button key={m} onClick={() => setAddForm(f => ({ ...f, mode: m }))}
                    className={`flex-1 py-2 text-sm rounded-lg border ${addForm.mode === m ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 dark:text-gray-300 dark:border-gray-600'}`}>
                    {m === 'official' ? 'Official SAT Date' : 'Custom Date'}
                  </button>
                ))}
              </div>
              {addForm.mode === 'official' ? (
                <select value={addForm.satDateId} onChange={e => setAddForm(f => ({ ...f, satDateId: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                  <option value="">Select a date</option>
                  {upcomingOfficialDates.map(d => <option key={d.id} value={d.id}>{formatDate(d.testDate)}</option>)}
                </select>
              ) : (
                <input type="date" value={addForm.customDate} onChange={e => setAddForm(f => ({ ...f, customDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={addForm.isTarget} onChange={e => setAddForm(f => ({ ...f, isTarget: e.target.checked }))} className="rounded" />
                Set as my target test date
              </label>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleAdd} disabled={addLoading}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
                {addLoading ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
