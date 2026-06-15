import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS } from '@scoreforge/shared';
import { PassagePanel } from '../../components/ui/PassagePanel';

interface SRCard {
  srId: number;
  questionId: number;
  nextReviewAt: string;
  intervalDays: number;
  easeFactor: number;
  question: {
    id: number;
    questionText: string;
    questionType: string;
    choiceA: string | null;
    choiceB: string | null;
    choiceC: string | null;
    choiceD: string | null;
    correctAnswer: string;
    explanation: string | null;
    topicKey: string | null;
    difficulty: string | null;
    passage?: { id: number; passageText: string; passageType: string | null } | null;
    figures?: Array<{ id: number; imagePath: string; figureType: string | null; altText: string | null }>;
  };
}

export default function SRDrill() {
  const { data: due, loading, refetch } = useApi<SRCard[]>('/api/sr/due');
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState<Record<number, 0 | 3 | 5>>({});
  const [done, setDone] = useState(false);

  const cards = due ?? [];
  const remaining = cards.filter(c => !(c.questionId in answered));
  const card = remaining[idx] ?? null;

  async function rate(quality: 0 | 3 | 5) {
    if (!card) return;
    setAnswered(a => ({ ...a, [card.questionId]: quality }));
    try {
      await api.post('/api/sr/review', { questionId: card.questionId, quality });
    } catch {}

    setFlipped(false);
    if (idx >= remaining.length - 1) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
    }
  }

  if (loading) return <PageSpinner />;

  if (cards.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <Card className="py-12">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">All caught up!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">No spaced repetition questions due today. Check back tomorrow.</p>
          <Link to="/student/dashboard" className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg">
            Back to Dashboard
          </Link>
        </Card>
      </div>
    );
  }

  if (done) {
    const correct = Object.values(answered).filter(q => q >= 3).length;
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <Card className="py-12">
          <div className="text-5xl mb-3">🎯</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Drill Complete!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            {correct} / {cards.length} answered correctly
          </p>
          <p className="text-xs text-gray-400 mb-6">Cards will resurface based on your performance.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/student/dashboard" className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">
              Dashboard
            </Link>
            <button onClick={() => { setIdx(0); setAnswered({}); setDone(false); refetch(); }}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg">
              Drill Again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!card) return null;

  const q = card.question;
  const choices = [
    { key: 'A', text: q.choiceA },
    { key: 'B', text: q.choiceB },
    { key: 'C', text: q.choiceC },
    { key: 'D', text: q.choiceD },
  ].filter(c => c.text);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">SR Drill</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {Object.keys(answered).length} / {cards.length} done
        </span>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className="bg-brand-600 h-2 rounded-full transition-all"
          style={{ width: `${(Object.keys(answered).length / cards.length) * 100}%` }} />
      </div>

      {(q.passage || (q.figures && q.figures.length > 0)) && (
        <PassagePanel passage={q.passage} figures={q.figures} />
      )}

      <Card>
        {q.topicKey && (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full mb-3 inline-block">
            {(TOPIC_LABELS as Record<string, string>)[q.topicKey] ?? q.topicKey}
          </span>
        )}
        <p className="text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap">{q.questionText}</p>
      </Card>

      {!flipped ? (
        <button onClick={() => setFlipped(true)}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl">
          Show Answer
        </button>
      ) : (
        <>
          {/* Show choices with correct highlighted */}
          <div className="space-y-2">
            {choices.map(({ key, text }) => (
              <div key={key}
                className={`p-3 rounded-lg border-2 ${q.correctAnswer.toUpperCase() === key
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                <span className="font-medium mr-2">{key}.</span>{text}
              </div>
            ))}
          </div>

          {q.explanation && (
            <Card padding="sm" className="border-l-4 border-l-brand-500">
              <p className="text-sm text-gray-600 dark:text-gray-400">{q.explanation}</p>
            </Card>
          )}

          <div>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-2">How well did you know this?</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => rate(0)} className="py-2.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-medium rounded-lg transition-colors">
                Again
                <span className="block text-xs font-normal opacity-70">Tomorrow</span>
              </button>
              <button onClick={() => rate(3)} className="py-2.5 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 font-medium rounded-lg transition-colors">
                Hard
                <span className="block text-xs font-normal opacity-70">+{Math.ceil(card.intervalDays)}d</span>
              </button>
              <button onClick={() => rate(5)} className="py-2.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 font-medium rounded-lg transition-colors">
                Easy
                <span className="block text-xs font-normal opacity-70">+{Math.ceil(card.intervalDays * 2.5)}d</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
