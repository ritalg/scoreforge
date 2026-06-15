import { useParams, useLocation, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS } from '@scoreforge/shared';

interface ResultData {
  sessionId: number;
  totalQuestions: number;
  answered: number;
  correct: number;
  scorePct: number;
  breakdown: {
    questionId: number;
    questionText: string;
    topicKey: string | null;
    correctAnswer: string;
    explanation: string | null;
    studentAnswer: string | null;
    isCorrect: boolean | null;
  }[];
  topicStats: Record<string, { correct: number; total: number }>;
}

export default function QuizResults() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const locationResult = location.state?.result as ResultData | undefined;

  // Use state from navigation if available, else fetch
  const { data: fetched, loading } = useApi<ResultData>(
    locationResult ? '' : `/api/quiz/${sessionId}/complete`,
  );

  const result = locationResult ?? fetched;
  if (loading && !locationResult) return <PageSpinner />;
  if (!result) return <div className="p-6 text-gray-500">Result not found.</div>;

  const scoreColor = result.scorePct >= 80 ? 'text-green-600' : result.scorePct >= 60 ? 'text-yellow-600' : 'text-red-600';
  const topicEntries = Object.entries(result.topicStats);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Results</h1>
        <Link to="/student/quiz" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
          New Quiz
        </Link>
      </div>

      {/* Score summary */}
      <Card className="text-center py-8">
        <div className={`text-6xl font-black ${scoreColor}`}>{result.scorePct}%</div>
        <div className="text-lg text-gray-600 dark:text-gray-400 mt-2">
          {result.correct} / {result.totalQuestions} correct
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          {result.scorePct >= 80 && <span className="text-green-600 font-medium">Excellent work! 🎉</span>}
          {result.scorePct >= 60 && result.scorePct < 80 && <span className="text-yellow-600 font-medium">Good effort! Keep practicing.</span>}
          {result.scorePct < 60 && <span className="text-red-600 font-medium">Review the explanations below.</span>}
        </div>
      </Card>

      {/* Topic breakdown */}
      {topicEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle>By Topic</CardTitle></CardHeader>
          <div className="space-y-3">
            {topicEntries.map(([key, stats]) => {
              const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {(TOPIC_LABELS as Record<string, string>)[key] ?? key}
                    </span>
                    <span className={`text-sm font-medium ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {stats.correct}/{stats.total} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Question breakdown */}
      <Card>
        <CardHeader><CardTitle>Question Review</CardTitle></CardHeader>
        <div className="space-y-4">
          {result.breakdown.map((item, i) => (
            <div key={item.questionId}
              className={`p-4 rounded-lg border ${item.isCorrect ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{item.isCorrect ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">Q{i + 1}</span>
                    {item.topicKey && (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                        {(TOPIC_LABELS as Record<string, string>)[item.topicKey] ?? item.topicKey}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{item.questionText}</p>
                  {!item.isCorrect && item.studentAnswer && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Your answer: <strong>{item.studentAnswer.toUpperCase()}</strong> · Correct: <strong>{item.correctAnswer.toUpperCase()}</strong>
                    </p>
                  )}
                  {item.explanation && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-3">
        <Link to="/student/dashboard" className="flex-1 text-center py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          Back to Dashboard
        </Link>
        <Link to="/student/quiz" className="flex-1 text-center py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg">
          New Quiz
        </Link>
      </div>
    </div>
  );
}
