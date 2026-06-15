// Client for the Python FastAPI ML microservice.
// All calls are fire-and-forget or optional — the server works without the ML service.

const ML_URL = process.env.ML_SERVICE_URL || 'http://ml-service:8000';

async function mlFetch(path: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${ML_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function mlPredict(studentId: number, features: Record<string, number>) {
  return mlFetch('/predict', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, features }),
  });
}

export async function mlRetrain(studentId: number, trainingData: Array<{ features: Record<string, number>; composite_score: number }>) {
  return mlFetch('/retrain', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, training_data: trainingData }),
  });
}

export async function mlFeatureImportance(studentId: number) {
  return mlFetch(`/feature-importance?student_id=${studentId}`);
}

export async function mlHealth() {
  return mlFetch('/health');
}
