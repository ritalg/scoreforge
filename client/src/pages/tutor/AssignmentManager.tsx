import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Assignment {
  id: number; title: string; description: string | null; dueDate: string;
  studentCount: number; completedCount: number; timeLimitSeconds: number | null;
}

interface AssignmentDetail {
  assignment: Assignment;
  students: Array<{ studentId: number; firstName: string; lastName: string; status: string; scorePct: number | null; }>;
}

const ALL_TOPICS = ['algebra', 'advanced_math', 'problem_solving', 'geometry', 'craft_structure', 'info_ideas', 'standard_english', 'expression_of_ideas'];

export default function AssignmentManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', topicKey: '', questionCount: '20', dueDate: '', timeLimitSeconds: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function loadAssignments() {
    const data = await api.get<Assignment[]>('/api/tutor/assignments');
    setAssignments(data);
  }

  useEffect(() => { loadAssignments().finally(() => setLoading(false)); }, []);

  async function openAssignment(id: number) {
    const detail = await api.get<AssignmentDetail>(`/api/tutor/assignments/${id}`);
    setSelected(detail);
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.dueDate) return;
    setCreating(true); setError('');
    try {
      await api.post('/api/tutor/assignments', {
        title: form.title, description: form.description || null,
        topicKey: form.topicKey || null,
        questionCount: parseInt(form.questionCount),
        dueDate: form.dueDate,
        timeLimitSeconds: form.timeLimitSeconds ? parseInt(form.timeLimitSeconds) * 60 : null,
      });
      setShowCreate(false);
      setForm({ title: '', description: '', topicKey: '', questionCount: '20', dueDate: '', timeLimitSeconds: '' });
      await loadAssignments();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  const upcoming = assignments.filter(a => new Date(a.dueDate) >= new Date());
  const past = assignments.filter(a => new Date(a.dueDate) < new Date());

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Assignments</h1>
        <button onClick={() => { setShowCreate(true); setError(''); }}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          + Create Assignment
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create Assignment</h2>
            <div className="space-y-3">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Assignment title *" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Instructions (optional)" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Topic</label>
                  <select value={form.topicKey} onChange={e => setForm(f => ({ ...f, topicKey: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                    <option value="">All topics</option>
                    {ALL_TOPICS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Questions</label>
                  <select value={form.questionCount} onChange={e => setForm(f => ({ ...f, questionCount: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                    {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Time Limit (min)</label>
                  <input type="number" value={form.timeLimitSeconds} onChange={e => setForm(f => ({ ...f, timeLimitSeconds: e.target.value }))}
                    placeholder="No limit" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create & Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Active</h2>
              <div className="space-y-2">
                {upcoming.map(a => <AssignmentRow key={a.id} assignment={a} onClick={() => openAssignment(a.id)} isSelected={selected?.assignment.id === a.id} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Past</h2>
              <div className="space-y-2">
                {past.map(a => <AssignmentRow key={a.id} assignment={a} onClick={() => openAssignment(a.id)} isSelected={selected?.assignment.id === a.id} />)}
              </div>
            </section>
          )}
          {assignments.length === 0 && <p className="text-center py-12 text-gray-500">No assignments yet</p>}
        </div>

        {selected && (
          <div className="w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 self-start">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">{selected.assignment.title}</h2>
            <p className="text-xs text-gray-500 mb-4">Due {new Date(selected.assignment.dueDate).toLocaleDateString()}</p>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Completion</span>
                <span>{selected.assignment.completedCount}/{selected.assignment.studentCount}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div className="h-2 bg-brand-500 rounded-full transition-all"
                  style={{ width: `${selected.assignment.studentCount > 0 ? (selected.assignment.completedCount / selected.assignment.studentCount) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              {selected.students.map(s => (
                <div key={s.studentId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{s.firstName} {s.lastName}</span>
                  <div className="flex items-center gap-2">
                    {s.scorePct != null && <span className="text-xs text-brand-600">{s.scorePct}%</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'completed' ? 'bg-green-100 text-green-700' :
                      s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentRow({ assignment: a, onClick, isSelected }: { assignment: Assignment; onClick: () => void; isSelected: boolean }) {
  const pct = a.studentCount > 0 ? Math.round((a.completedCount / a.studentCount) * 100) : 0;
  const isOverdue = new Date(a.dueDate) < new Date();
  return (
    <button onClick={onClick} className={`w-full text-left bg-white dark:bg-gray-800 border rounded-xl px-4 py-3 hover:border-brand-300 transition-all ${isSelected ? 'border-brand-400' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">{a.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Due {new Date(a.dueDate).toLocaleDateString()} · {a.studentCount} students
            {isOverdue && <span className="ml-1 text-red-500">· Overdue</span>}
          </p>
        </div>
        <span className="text-xs font-medium text-brand-600">{pct}%</span>
      </div>
      <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-700 rounded-full">
        <div className="h-1 bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}
