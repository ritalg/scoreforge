import { MeiliSearch } from 'meilisearch';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

const QUESTIONS_INDEX = 'questions';

let client: MeiliSearch | null = null;

function getClient(): MeiliSearch | null {
  if (!process.env.MEILISEARCH_URL) return null;
  if (!client) {
    client = new MeiliSearch({
      host: process.env.MEILISEARCH_URL,
      apiKey: process.env.MEILISEARCH_KEY || 'masterKey',
    });
  }
  return client;
}

export async function initSearchIndex() {
  const ms = getClient();
  if (!ms) return;
  try {
    await ms.createIndex(QUESTIONS_INDEX, { primaryKey: 'id' });
    const index = ms.index(QUESTIONS_INDEX);
    await index.updateSearchableAttributes(['questionText', 'explanation', 'topicKey']);
    await index.updateFilterableAttributes(['topicKey', 'difficulty', 'module', 'status']);
    await index.updateSortableAttributes(['createdAt']);
    console.log('[search] MeiliSearch index initialised');
  } catch {
    // index may already exist
  }
}

export async function indexQuestion(id: number) {
  const ms = getClient();
  if (!ms) return;
  const q = db.select().from(schema.questions).where(eq(schema.questions.id, id)).get();
  if (!q) return;
  try {
    await ms.index(QUESTIONS_INDEX).addDocuments([{
      id: q.id,
      questionText: q.questionText,
      explanation: q.explanation,
      topicKey: q.topicKey,
      difficulty: q.difficulty,
      module: q.module,
      status: q.status,
      createdAt: q.createdAt,
    }]);
  } catch (err) {
    console.error('[search] indexQuestion error', err);
  }
}

export async function removeFromIndex(id: number) {
  const ms = getClient();
  if (!ms) return;
  try {
    await ms.index(QUESTIONS_INDEX).deleteDocument(id);
  } catch {}
}

export async function searchQuestions(query: string, filters?: {
  topicKey?: string;
  difficulty?: string;
  module?: string;
  status?: string;
}) {
  const ms = getClient();
  if (!ms) return null; // caller falls back to SQLite

  const filterParts: string[] = [];
  if (filters?.topicKey) filterParts.push(`topicKey = "${filters.topicKey}"`);
  if (filters?.difficulty) filterParts.push(`difficulty = "${filters.difficulty}"`);
  if (filters?.module) filterParts.push(`module = "${filters.module}"`);
  if (filters?.status) filterParts.push(`status = "${filters.status}"`);

  try {
    const result = await ms.index(QUESTIONS_INDEX).search(query, {
      filter: filterParts.length ? filterParts.join(' AND ') : undefined,
      limit: 200,
    });
    return result.hits as Array<{ id: number }>;
  } catch (err) {
    console.error('[search] searchQuestions error', err);
    return null;
  }
}

export async function reindexAllApproved() {
  const ms = getClient();
  if (!ms) return;
  const questions = db.select({
    id: schema.questions.id,
    questionText: schema.questions.questionText,
    explanation: schema.questions.explanation,
    topicKey: schema.questions.topicKey,
    difficulty: schema.questions.difficulty,
    module: schema.questions.module,
    status: schema.questions.status,
    createdAt: schema.questions.createdAt,
  }).from(schema.questions).all().filter(q => q.status === 'approved');

  try {
    await ms.index(QUESTIONS_INDEX).addDocuments(questions);
    console.log(`[search] Reindexed ${questions.length} approved questions`);
  } catch (err) {
    console.error('[search] reindex error', err);
  }
}
