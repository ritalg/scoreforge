import Anthropic from '@anthropic-ai/sdk';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ExtractedQuestion {
  questionNumber?: number;
  questionText: string;
  questionType: 'multiple_choice' | 'grid_in';
  choiceA?: string;
  choiceB?: string;
  choiceC?: string;
  choiceD?: string;
  correctAnswer?: string;
  explanation?: string;
  topicKey?: string;
  difficulty?: string;
  module?: string;
  passageText?: string;
}

const EXTRACTION_PROMPT = `You are an expert SAT question extractor. Extract ALL questions from the provided text.

For each question, output a JSON object with:
- questionNumber: number (if visible)
- questionText: the full question stem
- questionType: "multiple_choice" or "grid_in"
- choiceA, choiceB, choiceC, choiceD: answer choices (for multiple choice)
- correctAnswer: "A", "B", "C", or "D" (if answer key is present, else null)
- explanation: explanation text (if present, else null)
- topicKey: one of ["algebra", "adv_math", "psda", "geometry", "info_ideas", "craft_structure", "expression", "conventions"] based on question content
- difficulty: "easy", "medium", or "hard" (estimate from question complexity)
- module: "m1", "m2_hard", or "m2_easy" (if identifiable, else null)
- passageText: the full passage text if this question references a passage (else null)

Return ONLY a valid JSON array of question objects, no other text.
Example: [{"questionNumber":1,"questionText":"...","questionType":"multiple_choice","choiceA":"...","choiceB":"...","choiceC":"...","choiceD":"...","correctAnswer":"B","explanation":null,"topicKey":"algebra","difficulty":"medium","module":"m1","passageText":null}]`;

export async function extractQuestionsFromText(
  text: string,
  uploadId: number
): Promise<number> {
  db.update(schema.uploads)
    .set({ status: 'extracting' })
    .where(eq(schema.uploads.id, uploadId))
    .run();

  try {
    // Chunk text if too large (Claude max ~180k tokens)
    const chunks = chunkText(text, 40000);
    const allQuestions: ExtractedQuestion[] = [];

    for (const chunk of chunks) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nSAT TEST TEXT:\n${chunk}`,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') continue;

      try {
        // Extract JSON array from response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) continue;
        const extracted: ExtractedQuestion[] = JSON.parse(jsonMatch[0]);
        allQuestions.push(...extracted);
      } catch {
        console.error('Failed to parse extraction response for chunk');
      }
    }

    // Update status to tagging
    db.update(schema.uploads)
      .set({ status: 'tagging' })
      .where(eq(schema.uploads.id, uploadId))
      .run();

    // Insert questions into DB
    let count = 0;
    const passageCache = new Map<string, number>();

    for (const q of allQuestions) {
      // Handle passage deduplication
      let passageId: number | null = null;
      if (q.passageText) {
        const key = q.passageText.slice(0, 100);
        if (passageCache.has(key)) {
          passageId = passageCache.get(key)!;
        } else {
          const result = db.insert(schema.passages).values({
            uploadId,
            passageText: q.passageText,
            topicKey: q.topicKey || null,
          }).run();
          passageId = Number(result.lastInsertRowid);
          passageCache.set(key, passageId);
        }
      }

      db.insert(schema.questions).values({
        uploadId,
        passageId,
        questionNumber: q.questionNumber || null,
        questionText: q.questionText,
        questionType: (q.questionType || 'multiple_choice') as 'multiple_choice' | 'grid_in',
        choiceA: q.choiceA || null,
        choiceB: q.choiceB || null,
        choiceC: q.choiceC || null,
        choiceD: q.choiceD || null,
        correctAnswer: q.correctAnswer || 'A',
        explanation: q.explanation || null,
        topicKey: q.topicKey || null,
        difficulty: (q.difficulty || null) as 'easy' | 'medium' | 'hard' | null,
        module: (q.module || null) as 'm1' | 'm2_hard' | 'm2_easy' | null,
        status: 'pending_review',
      }).run();
      count++;
    }

    db.update(schema.uploads)
      .set({
        status: 'done',
        questionCount: count,
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.uploads.id, uploadId))
      .run();

    return count;
  } catch (err) {
    db.update(schema.uploads)
      .set({
        status: 'failed',
        errorMessage: (err as Error).message,
      })
      .where(eq(schema.uploads.id, uploadId))
      .run();
    throw err;
  }
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    // Break at paragraph boundary if possible
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      if (paraBreak > start + maxChars / 2) end = paraBreak;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
