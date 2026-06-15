import { db, schema } from '../db';
import { eq, inArray } from 'drizzle-orm';

export interface EnrichedQuestion {
  id: number;
  questionText: string;
  questionType: string;
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  correctAnswer?: string;
  explanation?: string | null;
  topicKey: string | null;
  difficulty: string | null;
  passageId?: number | null;
  passage?: {
    id: number;
    passageText: string;
    passageType: string | null;
  } | null;
  figures?: Array<{
    id: number;
    imagePath: string;
    figureType: string | null;
    altText: string | null;
  }>;
}

export function enrichWithPassagesAndFigures<T extends { id: number; passageId?: number | null }>(
  questions: T[]
): (T & { passage: EnrichedQuestion['passage']; figures: NonNullable<EnrichedQuestion['figures']> })[] {
  if (questions.length === 0) return questions as any;

  // Batch-load all unique passages
  const passageIds = [...new Set(questions.map(q => q.passageId).filter((id): id is number => id != null))];
  const passagesMap = new Map<number, EnrichedQuestion['passage']>();
  if (passageIds.length > 0) {
    const passages = db.select({
      id: schema.passages.id,
      passageText: schema.passages.passageText,
      passageType: schema.passages.passageType,
    }).from(schema.passages)
      .where(inArray(schema.passages.id, passageIds))
      .all();
    for (const p of passages) passagesMap.set(p.id, p);
  }

  // Batch-load all figures
  const questionIds = questions.map(q => q.id);
  const figuresMap = new Map<number, NonNullable<EnrichedQuestion['figures']>>();
  if (questionIds.length > 0) {
    const figures = db.select({
      id: schema.questionFigures.id,
      questionId: schema.questionFigures.questionId,
      imagePath: schema.questionFigures.imagePath,
      figureType: schema.questionFigures.figureType,
      altText: schema.questionFigures.altText,
    }).from(schema.questionFigures)
      .where(inArray(schema.questionFigures.questionId, questionIds))
      .all();
    for (const f of figures) {
      if (!figuresMap.has(f.questionId)) figuresMap.set(f.questionId, []);
      figuresMap.get(f.questionId)!.push({ id: f.id, imagePath: f.imagePath, figureType: f.figureType, altText: f.altText });
    }
  }

  return questions.map(q => ({
    ...q,
    passage: q.passageId ? passagesMap.get(q.passageId) ?? null : null,
    figures: figuresMap.get(q.id) ?? [],
  })) as any;
}
