import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS } from '@scoreforge/shared';
import { PassagePanel } from '../../components/ui/PassagePanel';

interface Question {
  id: number;
  questionText: string;
  questionType: string;
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  topicKey: string | null;
  difficulty: string | null;
  passage?: { id: number; passageText: string; passageType: string | null } | null;
  figures?: Array<{ id: number; imagePath: string; figureType: string | null; altText: string | null }>;
}

interface QuizState {
  sessionId: number;
  questions: Question[];
  timeLimitSeconds: number | null;
  questionCount: number;
}

const MODES = [
  { value: 'practice', label: 'Practice', icon: '✏️', description: 'Untimed, with explanations' },
  { value: 'timed_quiz', label: 'Timed', icon: '⏱️', description: '75 sec/question, XP bonus' },
];

const TOPICS = [
  { value: '', label: 'All Topics' },
  { value: 'algebra', label: 'Algebra' },
  { value: 'adv_math', label: 'Advanced Math' },
  { value: 'psda', label: 'Problem Solving & Data' },
  { value: 'geometry', label: 'Geometry & Trig' },
  { value: 'info_ideas', label: 'Information & Ideas' },
  { value: 'craft_structure', label: 'Craft & Structure' },
  { value: 'expression', label: 'Expression of Ideas' },
  { value: 'conventions', label: 'Standard English Conventions' },
];

export default function QuizSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [phase, setPhase] = useState<'setup' | 'quiz' | 'submitting'>('setup');
  const [mode, setMode] = useState('practice');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, { isCorrect: boolean; correctAnswer: string; explanation: string | null }>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (quiz?.timeLimitSeconds && phase === 'quiz') {
      setTimeLeft(quiz.timeLimitSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t === null || t <= 1) {
            clearInterval(timerRef.current!);
            handleComplete();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quiz, phase]);

  async function startQuiz() {
    setLoading(true);
    setError('');
    try {
      const data = await api.post<QuizState>('/api/quiz/start', { mode, topicKey: topic || undefined, questionCount });
      setQuiz(data);
      setStartTime(Date.now());
      setPhase('quiz');
    } catch (e: any) {
      setError(e.message || 'Failed to start quiz. Make sure there are approved questions in the bank.');
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(questionId: number, answer: string) {
    if (revealed[questionId]) return;
    setAnswers(a => ({ ...a, [questionId]: answer }));

    try {
      const result = await api.post<{ isCorrect: boolean; correctAnswer: string; explanation: string | null }>(
        `/api/quiz/${quiz!.sessionId}/answer`,
        { questionId, answer, flagged: flagged[questionId] ?? false }
      );
      if (mode === 'practice') {
        setRevealed(r => ({ ...r, [questionId]: result }));
      }
    } catch {}
  }

  const handleComplete = useCallback(async () => {
    if (!quiz || phase === 'submitting') return;
    setPhase('submitting');
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);
      const result = await api.post(`/api/quiz/${quiz.sessionId}/complete`, { timeSpentSeconds });
      navigate(`/student/quiz/results/${quiz.sessionId}`, { state: { result } });
    } catch (e: any) {
      setError(e.message || 'Failed to submit quiz');
      setPhase('quiz');
    }
  }, [quiz, phase, startTime, navigate]);

  if (phase === 'setup') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Start a Quiz</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Mode</h2>
            <div className="grid grid-cols-2 gap-3">
              {MODES.map(m => (
                <button key={m.value} onClick={() => setMode(m.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === m.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <span className="text-xl">{m.icon}</span>
                  <p className="font-medium text-gray-900 dark:text-white mt-1">{m.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Topic</h2>
            <select value={topic} onChange={e => setTopic(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white">
              {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Questions: <span className="text-brand-600 font-bold">{questionCount}</span>
            </h2>
            <input type="range" min="5" max="50" step="5" value={questionCount}
              onChange={e => setQuestionCount(parseInt(e.target.value))}
              className="w-full" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5</span><span>50</span></div>
          </Card>

          <button onClick={startQuiz} disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-lg">
            {loading ? 'Setting up quiz…' : `Start ${questionCount}-Question Quiz`}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'submitting') return <PageSpinner />;

  const q = quiz!.questions[currentIdx];
  const answer = answers[q.id];
  const rev = revealed[q.id];
  const choices = [
    { key: 'A', text: q.choiceA },
    { key: 'B', text: q.choiceB },
    { key: 'C', text: q.choiceC },
    { key: 'D', text: q.choiceD },
  ].filter(c => c.text);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Question {currentIdx + 1} of {quiz!.questions.length}
          </span>
          {q.topicKey && (
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {(TOPIC_LABELS as any)[q.topicKey] ?? q.topicKey}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <span className={`font-mono text-sm font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
              {formatTime(timeLeft)}
            </span>
          )}
          <button onClick={() => setFlagged(f => ({ ...f, [q.id]: !f[q.id] }))}
            className={`text-sm px-2 py-1 rounded ${flagged[q.id] ? 'bg-yellow-100 text-yellow-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            aria-label="Flag for review">
            {flagged[q.id] ? '🚩 Flagged' : '⚑ Flag'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-3xl mx-auto mb-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-brand-600 h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIdx + 1) / quiz!.questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <div className="max-w-3xl mx-auto">
        {/* Passage / figures above question */}
        {(q.passage || (q.figures && q.figures.length > 0)) && (
          <div className="mb-4">
            <PassagePanel passage={q.passage} figures={q.figures} />
          </div>
        )}
        <Card className="mb-4">
          <p className="text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap">{q.questionText}</p>
        </Card>

        {/* Choices */}
        <div className="space-y-2">
          {choices.map(({ key, text }) => {
            let cls = 'border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20';
            if (answer === key) {
              if (rev) {
                cls = rev.correctAnswer.toUpperCase() === key
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-red-500 bg-red-50 dark:bg-red-900/20';
              } else {
                cls = 'border-brand-500 bg-brand-50 dark:bg-brand-900/20';
              }
            } else if (rev && rev.correctAnswer.toUpperCase() === key) {
              cls = 'border-green-500 bg-green-50 dark:bg-green-900/20';
            }

            return (
              <button key={key} onClick={() => submitAnswer(q.id, key)} disabled={!!answer}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${cls} ${!!answer ? 'cursor-default' : 'cursor-pointer'}`}>
                <span className="font-medium text-gray-900 dark:text-white mr-3">{key}.</span>
                <span className="text-gray-700 dark:text-gray-300">{text}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation (practice mode) */}
        {rev && (
          <Card className="mt-4 border-l-4 border-l-brand-500" padding="md">
            <div className="flex items-center gap-2 mb-2">
              <span>{rev.isCorrect ? '✅' : '❌'}</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {rev.isCorrect ? 'Correct!' : `Incorrect — Answer: ${rev.correctAnswer.toUpperCase()}`}
              </span>
            </div>
            {rev.explanation && <p className="text-sm text-gray-600 dark:text-gray-400">{rev.explanation}</p>}
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
            ← Back
          </button>

          {currentIdx < quiz!.questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(i => i + 1)}
              disabled={mode !== 'practice' && !answer}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg">
              Next →
            </button>
          ) : (
            <button onClick={handleComplete}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">
              Submit Quiz
            </button>
          )}
        </div>

        {/* Question map */}
        <div className="mt-6 flex flex-wrap gap-1.5 justify-center">
          {quiz!.questions.map((qq, i) => (
            <button key={qq.id} onClick={() => setCurrentIdx(i)}
              className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                i === currentIdx ? 'bg-brand-600 text-white' :
                answers[qq.id] ? (mode === 'practice' && revealed[qq.id]
                  ? (revealed[qq.id].isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                  : 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300')
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              } ${flagged[qq.id] ? 'ring-2 ring-yellow-400' : ''}`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
