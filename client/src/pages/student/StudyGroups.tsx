import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Group {
  id: number; name: string; inviteCode: string; memberCount: number;
  maxMembers: number; goalScore: number | null; isMember: boolean;
  myRole: 'owner' | 'member' | null; createdAt: string;
}

interface GroupDetail {
  group: Group;
  members: Array<{ studentId: number; firstName: string; lastName: string; level: number; xp: number; role: string; }>;
  activity: Array<{ id: number; eventType: string; userName: string; payload: any; createdAt: string; }>;
}

interface LeaderboardEntry {
  studentId: number; firstName: string; lastName: string; xp: number; level: number; rank: number; role: string;
}

const EVENT_LABELS: Record<string, string> = {
  member_joined: 'joined the group',
  quiz_completed: 'completed a quiz',
  mock_test_complete: 'completed a mock test',
  badge_earned: 'earned a badge',
  essay_scored: 'submitted an essay',
};

export default function StudyGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<GroupDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbPeriod, setLbPeriod] = useState<'weekly' | 'alltime'>('weekly');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', goalScore: '', maxMembers: '20' });
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    setLoading(true);
    try { setGroups(await api.get('/api/groups')); }
    finally { setLoading(false); }
  }

  async function openGroup(groupId: number) {
    const detail: GroupDetail = await api.get(`/api/groups/${groupId}`);
    setSelected(detail);
    const lb: { entries: LeaderboardEntry[] } = await api.get(`/api/groups/${groupId}/leaderboard?period=${lbPeriod}`);
    setLeaderboard(lb.entries);
    setView('detail');
  }

  async function fetchLeaderboard(groupId: number, period: 'weekly' | 'alltime') {
    const lb: { entries: LeaderboardEntry[] } = await api.get(`/api/groups/${groupId}/leaderboard?period=${period}`);
    setLeaderboard(lb.entries);
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return;
    setActionLoading(true); setError('');
    try {
      await api.post('/api/groups', {
        name: createForm.name,
        goalScore: createForm.goalScore ? parseInt(createForm.goalScore) : null,
        maxMembers: parseInt(createForm.maxMembers),
      });
      setShowCreate(false);
      setCreateForm({ name: '', goalScore: '', maxMembers: '20' });
      fetchGroups();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setActionLoading(true); setError('');
    try {
      await api.post('/api/groups/join', { inviteCode: joinCode });
      setShowJoin(false); setJoinCode('');
      fetchGroups();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleLeave(groupId: number) {
    if (!confirm('Leave this group?')) return;
    await api.delete(`/api/groups/${groupId}/leave`);
    setView('list'); setSelected(null); fetchGroups();
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading groups…</div>;

  if (view === 'detail' && selected) {
    const { group, members, activity } = selected;
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="text-sm text-brand-600 hover:underline">← Back</button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
            <p className="text-sm text-gray-500">Invite code: <span className="font-mono font-bold tracking-wider text-brand-600">{group.inviteCode}</span></p>
          </div>
          {group.isMember && (
            <button onClick={() => handleLeave(group.id)}
              className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
              Leave Group
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Leaderboard</h2>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                {(['weekly', 'alltime'] as const).map(p => (
                  <button key={p} onClick={() => { setLbPeriod(p); fetchLeaderboard(group.id, p); }}
                    className={`px-3 py-1 ${lbPeriod === p ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {p === 'weekly' ? 'This Week' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.studentId}
                  className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : i === 1 ? 'bg-gray-50 dark:bg-gray-700/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                    ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {entry.rank}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.firstName} {entry.lastName}
                      {entry.role === 'owner' && <span className="ml-1 text-xs text-brand-500">Owner</span>}
                    </p>
                    <p className="text-xs text-gray-500">Level {entry.level}</p>
                  </div>
                  <span className="text-sm font-bold text-brand-600">{entry.xp.toLocaleString()} XP</span>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-center text-gray-500 text-sm py-4">No activity yet</p>}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Activity Feed</h2>
            <div className="space-y-3">
              {activity.slice(0, 15).map(a => (
                <div key={a.id} className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{a.userName}</span>
                  <span className="text-gray-500"> {EVENT_LABELS[a.eventType] ?? a.eventType}</span>
                  {a.payload?.score && <span className="text-brand-600"> ({a.payload.score}%)</span>}
                  <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              {activity.length === 0 && <p className="text-gray-500 text-sm">No activity yet</p>}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Members ({members.length}/{group.maxMembers})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {members.map(m => (
              <div key={m.studentId} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold mx-auto mb-1">
                  {m.firstName?.[0]}{m.lastName?.[0]}
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{m.firstName} {m.lastName}</p>
                <p className="text-xs text-gray-500">Lv {m.level} · {m.xp.toLocaleString()} XP</p>
                {m.role === 'owner' && <span className="text-xs text-brand-500">Owner</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const myGroups = groups.filter(g => g.isMember);
  const otherGroups = groups.filter(g => !g.isMember);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study Groups</h1>
          <p className="text-sm text-gray-500">Study together, compete, and stay accountable</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(true); setError(''); }}
            className="px-4 py-2 text-sm border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50">
            Join by Code
          </button>
          <button onClick={() => { setShowCreate(true); setError(''); }}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
            Create Group
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create Study Group</h2>
            <div className="space-y-3">
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Group name" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              <input type="number" value={createForm.goalScore} onChange={e => setCreateForm(f => ({ ...f, goalScore: e.target.value }))}
                placeholder="Target SAT score (optional)" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
              <select value={createForm.maxMembers} onChange={e => setCreateForm(f => ({ ...f, maxMembers: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>Max {n} members</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleCreate} disabled={actionLoading}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
                {actionLoading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Join by Invite Code</h2>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-character code" maxLength={8}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-sm font-mono text-center text-gray-900 dark:text-white" />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleJoin} disabled={actionLoading}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">
                {actionLoading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {myGroups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">My Groups</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myGroups.map(g => <GroupCard key={g.id} group={g} onClick={() => openGroup(g.id)} />)}
          </div>
        </section>
      )}

      {otherGroups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Discover Groups</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherGroups.map(g => <GroupCard key={g.id} group={g} onClick={() => openGroup(g.id)} />)}
          </div>
        </section>
      )}

      {groups.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">No groups yet</p>
          <p className="text-sm text-gray-500 mt-1">Create one or join with an invite code</p>
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, onClick }: { group: Group; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-brand-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
          {group.goalScore && <p className="text-xs text-gray-500 mt-0.5">Target: {group.goalScore}</p>}
        </div>
        {group.isMember && (
          <span className="text-xs px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-600 rounded-full">
            {group.myRole === 'owner' ? 'Owner' : 'Member'}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>{group.memberCount}/{group.maxMembers ?? 20} members</span>
        {group.isMember && <span className="font-mono text-brand-600">{group.inviteCode}</span>}
      </div>
    </button>
  );
}
