import { db, schema } from '../db';
import { eq, and, lte } from 'drizzle-orm';

export type Quality = 0 | 3 | 5;

export function updateSR(studentId: number, questionId: number, quality: Quality) {
  const now = new Date();
  const existing = db.select()
    .from(schema.spacedRepetitionRecords)
    .where(and(
      eq(schema.spacedRepetitionRecords.studentId, studentId),
      eq(schema.spacedRepetitionRecords.questionId, questionId),
    )).get();

  let interval = existing?.intervalDays ?? 1;
  let ease = existing?.easeFactor ?? 2.5;
  const reps = (existing?.repetitionCount ?? 0) + 1;

  if (quality < 3) {
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    const newEase = ease - 0.8 + 0.28 * quality - 0.02 * quality * quality;
    ease = Math.max(1.3, newEase);
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ease);
    interval = Math.min(interval, 21);
  }

  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  db.insert(schema.spacedRepetitionRecords)
    .values({
      studentId,
      questionId,
      nextReviewAt: nextReview.toISOString(),
      intervalDays: interval,
      easeFactor: ease,
      repetitionCount: reps,
      lastQuality: quality,
    })
    .onConflictDoUpdate({
      target: [schema.spacedRepetitionRecords.studentId, schema.spacedRepetitionRecords.questionId],
      set: {
        nextReviewAt: nextReview.toISOString(),
        intervalDays: interval,
        easeFactor: ease,
        repetitionCount: reps,
        lastQuality: quality,
        updatedAt: now.toISOString(),
      },
    })
    .run();

  return { nextReviewAt: nextReview.toISOString(), intervalDays: interval, easeFactor: ease };
}

export function getDueCount(studentId: number): number {
  const now = new Date().toISOString();
  const rows = db.select({ id: schema.spacedRepetitionRecords.id })
    .from(schema.spacedRepetitionRecords)
    .where(and(
      eq(schema.spacedRepetitionRecords.studentId, studentId),
      lte(schema.spacedRepetitionRecords.nextReviewAt, now),
    ))
    .all();
  return rows.length;
}
