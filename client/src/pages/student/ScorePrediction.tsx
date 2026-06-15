import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

interface PredictionData {
  predictedComposite: number | null;
  predictedMath: number | null;
  predictedRw: number | null;
  confidenceInterval: number;
  modelVersion: string;
  featureImportances: Record<string, number>;
}

interface HistoryEntry {
  predictedComposite: number | null;
  predictedMath: number | null;
  predictedRw: number | null;
  confidenceInterval: number;
  modelVersion: string;
  createdAt: string;
}

interface ApiResponse {
  prediction: PredictionData | null;
  history: HistoryEntry[];
  message?: string;
}

interface FeatureImportanceResponse {
  feature_importances: Record<string, number>;
  model_type: string;
}

const FEATURE_LABELS: Record<string, string> = {
  algebra_acc: 'Algebra',
  adv_math_acc: 'Advanced Math',
  psda_acc: 'Problem Solving / Data',
  geometry_acc: 'Geometry',
  info_ideas_acc: 'Information & Ideas',
  craft_structure_acc: 'Craft & Structure',
  expression_acc: 'Expression of Ideas',
  conventions_acc: 'Conventions (Grammar)',
  sr_mastery_rate: 'SR Mastery Rate',
  weekly_hours: 'Study Hours/Week',
  score_trend_slope: 'Score Trend',
  mock_test_count: 'Mock Tests Completed',
};

const MODEL_LABELS: Record<string, string> = {
  XGBRegressor: 'XGBoost model',
  Ridge: 'Linear regression model',
  linear_regression: 'Linear regression',
  single_mock: 'Single mock test',
  accuracy_estimate: 'Quiz accuracy estimate',
  early_estimate: 'Early estimate',
  average: 'Average',
  fallback: 'Fallback estimate',
  none: 'No model yet',
};

function modelLabel(v: string) {
  return MODEL_LABELS[v] ?? v;
}

function ScoreGauge({ score, max = 1600, label }: { score: number; max?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, ((score - 400) / (max - 400)) * 100));
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="relative inline-flex items-center justify-center w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-lg font-bold text-gray-900 dark:text-white">{score}</span>
      </div>
    </div>
  );
}

export default function ScorePrediction() {
  const { data, loading, refetch } = useApi<ApiResponse>('/api/score-prediction/latest');
  const { data: fiData } = useApi<FeatureImportanceResponse>('/api/score-prediction/feature-importance');
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState('');

  async function handleRetrain() {
    setRetraining(true);
    setRetrainMsg('');
    try {
      await api.post('/api/score-prediction/retrain', {});
      setRetrainMsg('Model retrain requested. Refresh in a moment for updated predictions.');
      await refetch();
    } catch {
      setRetrainMsg('Retrain failed — ML service may be offline.');
    } finally {
      setRetraining(false);
    }
  }

  if (loading) return <PageSpinner />;

  const prediction = data?.prediction;
  const history = data?.history ?? [];

  // Chart data — last 15 predictions
  const chartData = history.slice(-15).map(h => ({
    date: new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    composite: h.predictedComposite,
    math: h.predictedMath,
    rw: h.predictedRw,
    ci: h.confidenceInterval,
  }));

  // Feature importances
  const importances = fiData?.feature_importances ?? prediction?.featureImportances ?? {};
  const sortedImportances = Object.entries(importances)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxImportance = sortedImportances[0]?.[1] ?? 1;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Score Prediction</h1>
          <p className="text-sm text-gray-500 mt-1">
            ML-powered SAT composite estimate based on your quiz history, mock tests, and spaced repetition progress.
          </p>
        </div>
        <button
          onClick={handleRetrain}
          disabled={retraining}
          aria-busy={retraining}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          {retraining ? 'Retraining…' : 'Retrain model'}
        </button>
      </div>

      {retrainMsg && (
        <div role="status" className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2">
          {retrainMsg}
        </div>
      )}

      {!prediction || prediction.predictedComposite === null ? (
        <Card className="text-center py-16">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 dark:text-gray-400">
            {data?.message ?? 'Complete more quizzes to generate a score prediction.'}
          </p>
          <p className="text-sm text-gray-400 mt-2">You need at least 1 practice session to get started.</p>
        </Card>
      ) : (
        <>
          {/* Score hero */}
          <Card>
            <div className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Composite */}
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Predicted Composite</p>
                  <p className="text-6xl font-bold text-gray-900 dark:text-white">{prediction.predictedComposite}</p>
                  <p className="text-sm text-gray-400 mt-1">± {prediction.confidenceInterval} points</p>
                  <span className="mt-2 inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                    {modelLabel(prediction.modelVersion)}
                  </span>
                </div>

                {/* Section gauges */}
                <div className="flex gap-8">
                  {prediction.predictedMath != null && (
                    <ScoreGauge score={prediction.predictedMath} max={800} label="Math" />
                  )}
                  {prediction.predictedRw != null && (
                    <ScoreGauge score={prediction.predictedRw} max={800} label="Reading & Writing" />
                  )}
                </div>

                {/* Score range visual */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Likely range</p>
                  <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full">
                    {/* Range bar */}
                    <div
                      className="absolute top-0 h-full rounded-full bg-blue-200 dark:bg-blue-800"
                      style={{
                        left: `${Math.max(0, ((prediction.predictedComposite - prediction.confidenceInterval - 400) / 1200) * 100)}%`,
                        width: `${Math.min(100, (prediction.confidenceInterval * 2 / 1200) * 100)}%`,
                      }}
                    />
                    {/* Center dot */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"
                      style={{ left: `${((prediction.predictedComposite - 400) / 1200) * 100}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>400</span>
                    <span>{prediction.predictedComposite - prediction.confidenceInterval} – {prediction.predictedComposite + prediction.confidenceInterval}</span>
                    <span>1600</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Prediction history chart */}
          {chartData.length >= 2 && (
            <Card>
              <CardHeader><CardTitle>Prediction History</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[400, 1600]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name === 'composite' ? 'Composite' : name === 'math' ? 'Math' : 'R&W']}
                  />
                  <Line type="monotone" dataKey="composite" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} name="composite" />
                  {chartData.some(d => d.math) && (
                    <Line type="monotone" dataKey="math" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="math" />
                  )}
                  {chartData.some(d => d.rw) && (
                    <Line type="monotone" dataKey="rw" stroke="#9333ea" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="rw" />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 px-6 pb-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-blue-600 inline-block" /> Composite</span>
                <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-green-600 inline-block" /> Math</span>
                <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-purple-600 inline-block" /> R&W</span>
              </div>
            </Card>
          )}

          {/* Feature importance */}
          {sortedImportances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What's Driving Your Score</CardTitle>
              </CardHeader>
              <div className="px-6 pb-6 space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Topics with higher importance have the most impact on your predicted score.
                </p>
                {sortedImportances.map(([key, val]) => {
                  const pct = (val / maxImportance) * 100;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300">{FEATURE_LABELS[key] ?? key}</span>
                        <span className="text-gray-500 text-xs">{(val * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {fiData?.model_type && (
                  <p className="text-xs text-gray-400 mt-3">
                    Model: <span className="font-medium">{modelLabel(fiData.model_type)}</span>
                    {fiData.model_type === 'none' && ' — complete more quizzes to train the ML model'}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* History table */}
          {history.length > 1 && (
            <Card>
              <CardHeader><CardTitle>Prediction Log</CardTitle></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Prediction history">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Composite</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Math</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">R&W</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">± CI</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Model</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {history.slice().reverse().map((h, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {new Date(h.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{h.predictedComposite ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{h.predictedMath ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{h.predictedRw ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-400">±{h.confidenceInterval}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{modelLabel(h.modelVersion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
