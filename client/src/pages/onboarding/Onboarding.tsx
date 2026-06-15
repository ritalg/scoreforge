import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const steps = ['Welcome', 'Your Goal', 'Study Plan'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    gradeLevel: 11,
    targetScore: 1400,
    targetTestDate: '',
    studyHoursPerWeek: 5,
  });
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const val = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await api.post('/api/onboarding/complete', form);
      navigate('/student/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= step
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-24 mx-2 transition-colors ${i < step ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {step === 0 && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Welcome, {user?.firstName}!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Let's personalize your SAT prep experience. It only takes 2 minutes.
              </p>
              <button onClick={() => setStep(1)}
                className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors">
                Get Started
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">What's your goal?</h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="targetScore" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target SAT Score
                  </label>
                  <input id="targetScore" name="targetScore" type="range"
                    min="400" max="1600" step="10" value={form.targetScore} onChange={handleChange}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>400</span>
                    <span className="font-bold text-brand-600 text-lg">{form.targetScore}</span>
                    <span>1600</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="targetTestDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Test Date <span className="text-gray-400">(optional)</span>
                  </label>
                  <input id="targetTestDate" name="targetTestDate" type="date"
                    value={form.targetTestDate} onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="gradeLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grade Level
                  </label>
                  <select id="gradeLevel" name="gradeLevel" value={form.gradeLevel} onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value={9}>9th Grade</option>
                    <option value={10}>10th Grade</option>
                    <option value={11}>11th Grade</option>
                    <option value={12}>12th Grade</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setStep(0)} className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
                  Back
                </button>
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl">
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">How much time can you study?</h2>
              <div className="space-y-4">
                {[3, 5, 8, 12, 20].map(h => (
                  <label key={h} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    form.studyHoursPerWeek === h
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="studyHoursPerWeek" value={h}
                      checked={form.studyHoursPerWeek === h}
                      onChange={() => setForm(f => ({ ...f, studyHoursPerWeek: h }))}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {h < 5 ? '~' : ''}{h} hours/week
                      {h <= 3 && <span className="ml-2 text-sm text-gray-500">Casual prep</span>}
                      {h === 5 && <span className="ml-2 text-sm text-gray-500">Recommended</span>}
                      {h >= 8 && h < 15 && <span className="ml-2 text-sm text-gray-500">Intensive</span>}
                      {h >= 15 && <span className="ml-2 text-sm text-gray-500">Immersive</span>}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setStep(1)} className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
                  Back
                </button>
                <button onClick={handleFinish} disabled={loading} className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-xl">
                  {loading ? 'Setting up...' : 'Start Studying!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
