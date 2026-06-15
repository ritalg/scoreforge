import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ScoreForgeDB extends DBSchema {
  flashcards: {
    key: number;
    value: {
      id: number;
      deckId: number;
      deckName: string;
      frontText: string;
      backText: string;
      hint: string | null;
      cachedAt: string;
    };
    indexes: { byDeck: number };
  };
  savedQuestions: {
    key: number;
    value: {
      id: number;
      questionText: string;
      choiceA: string | null;
      choiceB: string | null;
      choiceC: string | null;
      choiceD: string | null;
      correctAnswer: string;
      explanation: string | null;
      topicKey: string | null;
      cachedAt: string;
    };
  };
  pendingAnswers: {
    key: string;
    value: {
      id: string;
      questionId: number;
      selectedAnswer: string;
      sessionId: string;
      timestamp: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ScoreForgeDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ScoreForgeDB>('scoreforge-offline', 1, {
      upgrade(db) {
        const fc = db.createObjectStore('flashcards', { keyPath: 'id' });
        fc.createIndex('byDeck', 'deckId');
        db.createObjectStore('savedQuestions', { keyPath: 'id' });
        db.createObjectStore('pendingAnswers', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function cacheFlashcards(cards: Array<{
  id: number; deckId: number; deckName: string;
  frontText: string; backText: string; hint: string | null;
}>) {
  const db = await getDB();
  const tx = db.transaction('flashcards', 'readwrite');
  for (const card of cards) {
    await tx.store.put({ ...card, cachedAt: new Date().toISOString() });
  }
  await tx.done;
}

export async function getCachedFlashcards(deckId?: number) {
  const db = await getDB();
  if (deckId != null) {
    return db.getAllFromIndex('flashcards', 'byDeck', deckId);
  }
  return db.getAll('flashcards');
}

export async function cacheQuestion(q: {
  id: number; questionText: string;
  choiceA: string | null; choiceB: string | null;
  choiceC: string | null; choiceD: string | null;
  correctAnswer: string; explanation: string | null; topicKey: string | null;
}) {
  const db = await getDB();
  await db.put('savedQuestions', { ...q, cachedAt: new Date().toISOString() });
}

export async function getCachedQuestions() {
  const db = await getDB();
  return db.getAll('savedQuestions');
}

export async function queueAnswer(entry: {
  questionId: number; selectedAnswer: string; sessionId: string;
}) {
  const db = await getDB();
  const id = `${entry.sessionId}-${entry.questionId}-${Date.now()}`;
  await db.put('pendingAnswers', { id, ...entry, timestamp: new Date().toISOString() });
}

export async function getPendingAnswers() {
  const db = await getDB();
  return db.getAll('pendingAnswers');
}

export async function clearPendingAnswer(id: string) {
  const db = await getDB();
  await db.delete('pendingAnswers', id);
}
