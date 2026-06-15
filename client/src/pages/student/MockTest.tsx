import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

type Phase = 'setup' | 'module' | 'module_complete' | 'all_done';
type SectionChoice = 'math' | 'rw' | 'both';
type ModuleKey = 'm1_math' | 'm1_rw' | 'm2_math' | 'm2_rw';

interface Question {
  id: number;
  questionText: string;
  questionType: string;
  choiceA: string | null; choiceB: string | null; choiceC: string | null; choiceD: string | null;
  correctAnswer: string;
  passageId: number | null;
}
interface Attempt {
  id: number; questionId: number; orderIndex: number | null;
  selectedAnswer: string | null; isCorrect: boolean | null; isFlagged: boolean;
}
interface Passage { id: number; passageText: string; }

const MODULE_LABELS: Record<string, string> = {
  m1_math: 'Math — Module 1', m1_rw: 'Reading & Writing — Module 1',
  m2_math: 'Math — Module 2', m2_rw: 'Reading & Writing — Module 2',
};
const MODULE_TIMES: Record<string, number> = {
  m1_math: 35 * 60, m1_rw: 32 * 60, m2_math: 35 * 60, m2_rw: 32 * 60,
};

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MockTest() {
  const navigate = useNavigate();
  const [sections, setSections] = useState<SectionChoice>('both');
  const [phase, setPhase] = useState<Phase>('setup');
  const [mockTestId, setMockTestId] = useState<number | null>(null);
  const [moduleQueue, setModuleQueue] = useState<ModuleKey[]>([]);
  const [currentModuleIdx, setCurrentModuleIdx] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [hideTimer, setHideTimer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [m2Level, setM2Level] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [finalScores, setFinalScores] = useState<any>(null);
  const [starting, setStarting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentModuleKey = moduleQueue[currentModuleIdx] ?? null;

  useEffect(() => {
    if (phase !== 'module') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); submitModule(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase, sessionId]);

  async function startTest() {
    setStarting(true);
    try {
      const res = await api.post<any>('/api/mock-test/start', { sections });
      const { mockTestId: mid, m1MathSessionId, m1RwSessionId } = res;
      setMockTestId(mid);

      const queue: ModuleKey[] = [];
      if (sections === 'rw' || sections === 'both') queue.push('m1_rw');
      if (sections === 'math' || sections === 'both') queue.push('m1_math');
      setModuleQueue(queue);

      // Load the first module
      const firstSessionId = queue[0] === 'm1_rw' ? m1RwSessionId : m1MathSessionId;
      await loadModule(mid, queue[0], firstSessionId);
      setCurrentModuleIdx(0);
      setPhase('module');
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch (e: any) {
      alert(e.message ?? 'Could not start test. Make sure the question bank has approved questions.');
    } finally {
      setStarting(false);
    }
  }

  async function loadModule(mid: number, modKey: ModuleKey, sid: number) {
    const data = await api.get<any>(`/api/mock-test/${mid}`);
    const sessionKey = modKey === 'm1_math' ? 'm1Math' : modKey === 'm1_rw' ? 'm1Rw' : modKey === 'm2_math' ? 'm2Math' : 'm2Rw';
    const moduleData = data[sessionKey];
    if (!moduleData) throw new Error('Module data not found');

    setSessionId(sid);
    setAttempts(moduleData.attempts ?? []);
    setQuestions(moduleData.questions ?? []);
    setPassages(moduleData.passages ?? []);
    setAnswers({});
    setFlagged(new Set());
    setCurrentQ(0);
    setTimeLeft(MODULE_TIMES[modKey] ?? 35 * 60);
    setReviewMode(false);
  }

  async function submitAnswer(attemptId: number, answer: string) {
    if (!sessionId) return;
    await api.post('/api/mock-test/answer', {
      sessionId, attemptId, selectedAnswer: answer,
      timeSpentSeconds: Math.floor((MODULE_TIMES[currentModuleKey ?? 'm1_math'] - timeLeft)),
    });
  }

  function selectAnswer(attemptId: number, answer: string) {
    setAnswers(a => ({ ...a, [attemptId]: answer }));
    submitAnswer(attemptId, answer).catch(console.error);
  }

  async function submitModule() {
    if (!mockTestId || !currentModuleKey || submitting) return;
    clearInterval(timerRef.current!);
    setSubmitting(true);

    try {
      const isM1 = currentModuleKey.startsWith('m1');
      if (isM1) {
        const res = await api.post<any>(`/api/mock-test/${mockTestId}/submit-module`, { module: currentModuleKey });
        setM2Level(res.m2Level);

        const m2Key = currentModuleKey === 'm1_math' ? 'm2_math' : 'm2_rw';
        const remainingModules = [...moduleQueue];
        const m1OtherIdx = remainingModules.findIndex(m => m.startsWith('m1') && m !== currentModuleKey);

        if (res.m2SessionId) {
          const newQueue = [...moduleQueue];
          const insertIdx = currentModuleIdx + 1;
          newQueue.splice(insertIdx, 0, m2Key);
          setModuleQueue(newQueue);
        }

        setPhase('module_complete');
      } else {
        // M2 — check if there's more
        const nextIdx = currentModuleIdx + 1;
        if (nextIdx < moduleQueue.length) {
          setPhase('module_complete');
        } else {
          // All done — complete
          const scores = await api.post<any>(`/api/mock-test/${mockTestId}/complete`, {});
          setFinalScores(scores);
          setPhase('all_done');
          document.exitFullscreen?.().catch(() => {});
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function continueToNextModule() {
    if (!mockTestId) return;
    const nextIdx = currentModuleIdx + 1;
    if (nextIdx >= moduleQueue.length) {
      const scores = await api.post<any>(`/api/mock-test/${mockTestId}/complete`, {});
      setFinalScores(scores);
      setPhase('all_done');
      document.exitFullscreen?.().catch(() => {});
      return;
    }

    setCurrentModuleIdx(nextIdx);
    const nextKey = moduleQueue[nextIdx];
    const data = await api.get<any>(`/api/mock-test/${mockTestId}`);
    const sessionKey = nextKey === 'm1_math' ? 'm1Math' : nextKey === 'm1_rw' ? 'm1Rw' : nextKey === 'm2_math' ? 'm2Math' : 'm2Rw';
    const sid = data.mockTest[`${nextKey.replace('_', '')}SessionId`.replace('m1', 'm1').replace('m2', 'm2')] ??
      data[sessionKey]?.session?.id;

    await loadModule(mockTestId, nextKey, data[sessionKey]?.session?.id);
    setPhase('module');
  }

  const currentAttempt = attempts.find(a => a.orderIndex === currentQ) ?? attempts[currentQ];
  const currentQuestion = questions.find(q => q.id === currentAttempt?.questionId);
  const currentPassage = currentQuestion?.passageId ? passages.find(p => p.id === currentQuestion.passageId) : null;

  // ─── SETUP SCREEN ─────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Full Mock SAT</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Simulates the Digital SAT with two adaptive modules per section
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Sections</label>
            <div className="grid grid-cols-3 gap-3">
              {(['both', 'math', 'rw'] as const).map(s => (
                <button key={s} onClick={() => setSections(s)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    sections === s
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                  {s === 'both' ? 'Both Sections' : s === 'math' ? 'Math Only' : 'R&W Only'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <p className="font-medium">What to expect:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              {sections !== 'math' && <li>R&W Module 1: 27 questions, 32 min</li>}
              {sections !== 'math' && <li>R&W Module 2: 27 questions, 32 min (adaptive)</li>}
              {sections !== 'rw' && <li>Math Module 1: 27 questions, 35 min</li>}
              {sections !== 'rw' && <li>Math Module 2: 27 questions, 35 min (adaptive)</li>}
              <li>Timer runs — submit before time expires</li>
              <li>No navigation back between modules</li>
            </ul>
          </div>

          <button onClick={startTest} disabled={starting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-lg">
            {starting ? 'Starting…' : 'Begin Mock Test →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── MODULE COMPLETE SCREEN ───────────────────────────────────────────────
  if (phase === 'module_complete') {
    const nextKey = moduleQueue[currentModuleIdx + 1];
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <div className="text-5xl">✓</div>
          <div>
            <h2 className="text-2xl font-bold text-white">{MODULE_LABELS[currentModuleKey ?? '']} Complete</h2>
            {m2Level && currentModuleKey?.startsWith('m1') && (
              <p className="text-gray-400 mt-2 text-sm">
                Module 2 level: <span className={`font-semibold ${m2Level === 'hard' ? 'text-red-400' : 'text-green-400'}`}>
                  {m2Level === 'hard' ? 'Challenging (you\'re doing great!)' : 'Standard'}
                </span>
              </p>
            )}
          </div>
          {nextKey ? (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">Next: {MODULE_LABELS[nextKey]}</p>
              <button onClick={continueToNextModule}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl">
                Continue to {MODULE_LABELS[nextKey]} →
              </button>
            </div>
          ) : (
            <button onClick={continueToNextModule}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl">
              Submit Test & See Results
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ──────────────────────────────────────────────────────
  if (phase === 'all_done' && finalScores) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-8 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mock Test Complete!</h1>

          {finalScores.composite && (
            <div className="text-center py-6">
              <div className="text-6xl font-black text-brand-600 dark:text-brand-400">{finalScores.composite}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">Estimated Composite Score</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {finalScores.scaledMath != null && (
              <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{finalScores.scaledMath}</div>
                <div className="text-xs text-gray-500 mt-1">Math Score</div>
                <div className="text-xs text-gray-400">Raw: {finalScores.rawMath}</div>
              </div>
            )}
            {finalScores.scaledRw != null && (
              <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">{finalScores.scaledRw}</div>
                <div className="text-xs text-gray-500 mt-1">R&W Score</div>
                <div className="text-xs text-gray-400">Raw: {finalScores.rawRw}</div>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-gray-400">
            Scores are estimates based on raw accuracy. Import official College Board scoring tables for precise scaled scores.
          </p>

          <div className="flex gap-3">
            <button onClick={() => navigate('/student/dashboard')}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-300">
              Back to Dashboard
            </button>
            <button onClick={() => setPhase('setup')}
              className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
              Take Another Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ACTIVE MODULE SCREEN ────────────────────────────────────────────────
  const answered = attempts.filter(a => answers[a.id] || a.selectedAnswer).length;
  const totalQs = attempts.length;
  const isFlagged = currentAttempt ? flagged.has(currentAttempt.id) : false;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between bg-white dark:bg-gray-800">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {MODULE_LABELS[currentModuleKey ?? '']}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{answered}/{totalQs} answered</span>
          {!hideTimer && (
            <span className={`font-mono text-sm font-semibold px-3 py-1 rounded-lg ${
              timeLeft < 300 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
              {formatTime(timeLeft)}
            </span>
          )}
          <button onClick={() => setHideTimer(h => !h)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            {hideTimer ? 'Show timer' : 'Hide timer'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Passage pane (if applicable) */}
        {currentPassage && (
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                {currentPassage.passageText}
              </p>
            </div>
          </div>
        )}

        {/* Question pane */}
        <div className={`${currentPassage ? 'w-1/2' : 'w-full max-w-3xl mx-auto'} p-6 overflow-y-auto`}>
          {currentQuestion ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-gray-400 mt-1">Question {currentQ + 1} of {totalQs}</span>
                <button onClick={() => {
                  if (!currentAttempt) return;
                  setFlagged(f => {
                    const n = new Set(f);
                    n.has(currentAttempt.id) ? n.delete(currentAttempt.id) : n.add(currentAttempt.id);
                    return n;
                  });
                }} className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1 ${
                  isFlagged ? 'border-yellow-400 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-500'
                }`}>
                  🚩 {isFlagged ? 'Flagged' : 'Flag for review'}
                </button>
              </div>

              <p className="text-gray-900 dark:text-white text-base leading-relaxed">{currentQuestion.questionText}</p>

              {currentQuestion.questionType === 'multiple_choice' && (
                <div className="space-y-3">
                  {[
                    ['A', currentQuestion.choiceA],
                    ['B', currentQuestion.choiceB],
                    ['C', currentQuestion.choiceC],
                    ['D', currentQuestion.choiceD],
                  ].filter(([, t]) => t).map(([k, t]) => {
                    const selected = (answers[currentAttempt?.id ?? 0] ?? currentAttempt?.selectedAnswer) === k;
                    return (
                      <button key={k} onClick={() => currentAttempt && selectAnswer(currentAttempt.id, String(k))}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-colors text-sm ${
                          selected
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-200'
                            : 'border-gray-200 dark:border-gray-700 hover:border-brand-400 text-gray-700 dark:text-gray-300'
                        }`}>
                        <span className="font-semibold">{k}.</span> {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">Loading question…</div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between bg-white dark:bg-gray-800">
        <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:text-gray-900 dark:hover:text-white">
          ← Back
        </button>

        {/* Question map */}
        <div className="flex gap-1 flex-wrap justify-center max-w-sm">
          {attempts.map((a, i) => {
            const ans = answers[a.id] ?? a.selectedAnswer;
            return (
              <button key={a.id} onClick={() => setCurrentQ(i)}
                className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                  i === currentQ ? 'ring-2 ring-brand-500' : ''
                } ${
                  flagged.has(a.id) ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' :
                  ans ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                {i + 1}
              </button>
            );
          })}
        </div>

        {currentQ < totalQs - 1 ? (
          <button onClick={() => setCurrentQ(q => Math.min(totalQs - 1, q + 1))}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            Next →
          </button>
        ) : (
          <button onClick={submitModule} disabled={submitting}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {submitting ? 'Submitting…' : 'Submit Module'}
          </button>
        )}
      </div>
    </div>
  );
}
