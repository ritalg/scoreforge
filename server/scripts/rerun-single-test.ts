/**
 * Re-runs extraction for a single upload ID.
 * Usage: npx tsx scripts/rerun-single-test.ts <uploadId>
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { db, sqlite, schema } from '../src/db';
import { eq } from 'drizzle-orm';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_PROMPT = `You are an expert SAT question extractor. Extract ALL questions from the provided text.

For each question, output a JSON object with:
- questionNumber: number (if visible)
- questionText: the full question stem (required, never null or empty)
- questionType: "multiple_choice" or "grid_in"
- choiceA, choiceB, choiceC, choiceD: answer choices (for multiple choice)
- correctAnswer: "A", "B", "C", or "D" (from answer key if present, else null)
- explanation: null
- topicKey: one of ["algebra", "adv_math", "psda", "geometry", "info_ideas", "craft_structure", "expression", "conventions"]
- difficulty: "easy", "medium", or "hard"
- module: "m1", "m2_hard", or "m2_easy" (if identifiable, else null)
- passageText: full passage text if this question references a passage (else null)

IMPORTANT: Only include questions where questionText is a non-empty string.
Return ONLY a valid JSON array. No other text.`;

function chunkText(text: string, maxChars = 20000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
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

async function main() {
  const uploadId = parseInt(process.argv[2]);
  if (!uploadId) { console.error('Usage: npx tsx scripts/rerun-single-test.ts <uploadId>'); process.exit(1); }

  const upload = db.select().from(schema.uploads).where(eq(schema.uploads.id, uploadId)).get();
  if (!upload) { console.error('Upload not found:', uploadId); process.exit(1); }

  console.log(`Re-running: [${upload.testName}] (upload ${uploadId})`);
  console.log(`File: ${upload.storedPath}`);

  // Clear any partial data
  db.delete(schema.questions).where(eq(schema.questions.uploadId, uploadId)).run();
  db.delete(schema.passages).where(eq(schema.passages.uploadId!, uploadId)).run();
  db.update(schema.uploads).set({ status: 'extracting', questionCount: 0, completedAt: null, errorMessage: null })
    .where(eq(schema.uploads.id, uploadId)).run();

  const buf = fs.readFileSync(upload.storedPath!);
  const parsed = await pdfParse(buf);
  const text = parsed.text;
  console.log(`Text extracted: ${Math.round(text.length / 1000)}k chars`);

  const chunks = chunkText(text);
  const allQuestions: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  chunk ${i + 1}/${chunks.length} (~${Math.round(chunks[i].length / 1000)}k chars)`);
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16000,
        messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nSAT TEXT:\n${chunks[i]}` }],
      });
      const content = response.content[0];
      if (content.type !== 'text') continue;
      const match = content.text.match(/\[[\s\S]*\]/);
      if (!match) continue;
      const extracted = JSON.parse(match[0]);
      allQuestions.push(...extracted);
    } catch (e) {
      console.error(`  chunk ${i + 1} error:`, (e as Error).message.slice(0, 100));
    }
  }

  db.update(schema.uploads).set({ status: 'tagging' }).where(eq(schema.uploads.id, uploadId)).run();

  const passageCache = new Map<string, number>();
  let count = 0;

  for (const q of allQuestions) {
    if (!q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) continue;
    let passageId: number | null = null;
    if (q.passageText && typeof q.passageText === 'string' && q.passageText.trim()) {
      const key = q.passageText.slice(0, 100);
      if (passageCache.has(key)) {
        passageId = passageCache.get(key)!;
      } else {
        const r = db.insert(schema.passages).values({
          uploadId, passageText: q.passageText, topicKey: q.topicKey || null,
        }).run();
        passageId = Number(r.lastInsertRowid);
        passageCache.set(key, passageId);
      }
    }
    db.insert(schema.questions).values({
      uploadId, passageId,
      questionNumber: q.questionNumber || null,
      questionText: q.questionText.trim(),
      questionType: q.questionType || 'multiple_choice',
      choiceA: q.choiceA || null, choiceB: q.choiceB || null,
      choiceC: q.choiceC || null, choiceD: q.choiceD || null,
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || null,
      topicKey: q.topicKey || null,
      difficulty: q.difficulty || null,
      module: q.module || null,
      status: 'approved',
    }).run();
    count++;
  }

  db.update(schema.uploads).set({
    status: 'done', questionCount: count, completedAt: new Date().toISOString(),
  }).where(eq(schema.uploads.id, uploadId)).run();

  console.log(`\nDone: ${count} questions extracted and approved`);
  const total = sqlite.prepare("SELECT COUNT(*) as n FROM questions WHERE status='approved'").get() as { n: number };
  console.log(`Total approved in DB: ${total.n}`);
}

main().catch(console.error);
