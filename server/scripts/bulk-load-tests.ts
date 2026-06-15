/**
 * Bulk loads all SAT QAS PDFs from the files directory.
 * Pairs test PDFs with their answer sheets where applicable,
 * then runs AI extraction and auto-approves the results.
 *
 * Usage: npx tsx scripts/bulk-load-tests.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { db, sqlite, schema } from '../src/db';
import { eq } from 'drizzle-orm';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FILES_DIR = path.resolve(__dirname, '../../files/All SATs-selected');

// Each entry: { testName, testPdf, answerPdf (optional) }
const TEST_PAIRS: { testName: string; testPdf: string; answerPdf?: string }[] = [
  {
    testName: 'April 2017 School Day SAT',
    testPdf: '2017/April 2017 School Day SAT QAS Full Test.pdf',
    answerPdf: '2017/April 2017 School Day SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'May 2017 SAT',
    testPdf: '2017/May 2017 SAT QAS Scan.pdf',
    answerPdf: '2017/May 2017 SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'March 2018 SAT',
    testPdf: '2018/March 2018 SAT QAS Full Test.pdf',
    answerPdf: '2018/March 2018 SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'April 2018 School Day SAT',
    testPdf: '2018/April 2018 School Day SAT QAS Full Test.pdf',
    answerPdf: '2018/April 2018 School Day SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'May 2018 SAT',
    testPdf: '2018/May 2018 SAT QAS Full Test.pdf',
    answerPdf: '2018/May 2018 SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'March 2019 SAT',
    testPdf: '2019/March 2019 SAT QAS Full Test.pdf',
    answerPdf: '2019/March 2019 SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'April 2019 School Day SAT',
    testPdf: '2019/April 2019 School Day SAT QAS Full Test.pdf',
    answerPdf: '2019/April 2019 School Day SAT QAS Answers and Scoring.pdf',
  },
  {
    testName: 'May 2019 US SAT',
    testPdf: '2019/May 2019 US SAT QAS Full Test.pdf',
    answerPdf: '2019/May 2019 US SAT QAS Answers.pdf',
  },
  {
    testName: 'May 2019 International SAT',
    testPdf: '2019/May 2019 International SAT QAS Typed with Answers.pdf',
  },
  {
    testName: 'October 2019 SAT',
    testPdf: '2019/October 2019 SAT QAS Full Test with Answers and Partial Scoring.pdf',
  },
  {
    testName: 'March 2020 SAT',
    testPdf: '2020/March 2020 SAT QAS Full Test with Answers and Scoring.pdf',
  },
  {
    testName: 'October 2020 SAT',
    testPdf: '2020/October 2020 SAT QAS Full Test with Answers.pdf',
  },
  {
    testName: 'March 2021 SAT',
    testPdf: '2021/2021 March SAT QAS.pdf',
    // answers are PNG image — skip, let AI infer
  },
  {
    testName: 'April 2021 School Day SAT',
    testPdf: '2021/April 2021 School Day QAS.pdf',
    // answers are PNG image — skip
  },
  {
    testName: 'May 2021 US SAT',
    testPdf: '2021/May 2021 US QAS with ANSWERS at back.pdf',
  },
  {
    testName: 'May 2021 International SAT',
    testPdf: '2021/May 2021 International QAS with ANSWERS at back.pdf',
  },
  {
    testName: 'October 2021 SAT',
    testPdf: '2021/October 2021 SAT QAS.pdf',
  },
  {
    testName: 'March 2022 SAT',
    testPdf: '2022/March 2022 SAT QAS.pdf',
    answerPdf: '2022/March 2022 SAT QAS ANSWERS.pdf',
  },
  {
    testName: 'April 2022 School Day SAT',
    testPdf: '2022/April 2022 School Day SAT QAS.pdf',
    answerPdf: '2022/April 2022 School Day SAT QAS ANSWERS.pdf',
  },
  {
    testName: 'May 2022 US SAT',
    testPdf: '2022/May 2022 US SAT QAS.pdf',
    answerPdf: '2022/May 2022 US SAT QAS ANSWERS.pdf',
  },
  {
    testName: 'May 2022 International SAT',
    testPdf: '2022/May 2022 International SAT QAS.pdf',
    // answers are JPG — skip
  },
  {
    testName: 'October 2022 SAT',
    testPdf: '2022/October 2022 SAT QAS.pdf',
    answerPdf: '2022/October 2022 SAT QAS Answers.pdf',
  },
];

const EXTRACTION_PROMPT = `You are an expert SAT question extractor. Extract ALL questions from the provided text.

For each question, output a JSON object with:
- questionNumber: number (if visible)
- questionText: the full question stem
- questionType: "multiple_choice" or "grid_in"
- choiceA, choiceB, choiceC, choiceD: answer choices (for multiple choice)
- correctAnswer: "A", "B", "C", or "D" (from answer key if present, else null)
- explanation: null
- topicKey: one of ["algebra", "adv_math", "psda", "geometry", "info_ideas", "craft_structure", "expression", "conventions"]
- difficulty: "easy", "medium", or "hard"
- module: "m1", "m2_hard", or "m2_easy" (if identifiable, else null)
- passageText: full passage text if this question references a passage (else null)

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

async function parsePdf(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const result = await pdfParse(buf);
  return result.text;
}

async function extractFromText(text: string, uploadId: number): Promise<number> {
  db.update(schema.uploads).set({ status: 'extracting' }).where(eq(schema.uploads.id, uploadId)).run();

  const chunks = chunkText(text);
  const allQuestions: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`    chunk ${i + 1}/${chunks.length} (~${Math.round(chunks[i].length / 1000)}k chars)`);
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
      console.error(`    chunk ${i + 1} parse error:`, (e as Error).message.slice(0, 80));
    }
  }

  db.update(schema.uploads).set({ status: 'tagging' }).where(eq(schema.uploads.id, uploadId)).run();

  const passageCache = new Map<string, number>();
  let count = 0;

  for (const q of allQuestions) {
    let passageId: number | null = null;
    if (q.passageText) {
      const key = q.passageText.slice(0, 100);
      if (passageCache.has(key)) {
        passageId = passageCache.get(key)!;
      } else {
        const r = db.insert(schema.passages).values({
          uploadId,
          passageText: q.passageText,
          topicKey: q.topicKey || null,
        }).run();
        passageId = Number(r.lastInsertRowid);
        passageCache.set(key, passageId);
      }
    }

    db.insert(schema.questions).values({
      uploadId,
      passageId,
      questionNumber: q.questionNumber || null,
      questionText: q.questionText,
      questionType: q.questionType || 'multiple_choice',
      choiceA: q.choiceA || null,
      choiceB: q.choiceB || null,
      choiceC: q.choiceC || null,
      choiceD: q.choiceD || null,
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || null,
      topicKey: q.topicKey || null,
      difficulty: q.difficulty || null,
      module: q.module || null,
      status: 'approved',  // auto-approve official SAT material
    }).run();
    count++;
  }

  db.update(schema.uploads).set({
    status: 'done',
    questionCount: count,
    completedAt: new Date().toISOString(),
  }).where(eq(schema.uploads.id, uploadId)).run();

  return count;
}

async function main() {
  // Find a superadmin user to attribute uploads to
  const adminUser = db.select().from(schema.users)
    .where(eq(schema.users.role, 'superadmin'))
    .get() ?? db.select().from(schema.users).where(eq(schema.users.role, 'admin')).get();

  if (!adminUser) {
    console.error('No admin user found in DB');
    process.exit(1);
  }

  console.log(`Uploading as user: ${adminUser.email}`);
  console.log(`Processing ${TEST_PAIRS.length} tests...\n`);

  let totalQuestions = 0;

  for (const entry of TEST_PAIRS) {
    const testPath = path.join(FILES_DIR, entry.testPdf);
    if (!fs.existsSync(testPath)) {
      console.warn(`  SKIP (file not found): ${entry.testPdf}`);
      continue;
    }

    console.log(`\n[${entry.testName}]`);

    // Create upload record
    const row = db.insert(schema.uploads).values({
      uploadedBy: adminUser.id,
      originalFilename: path.basename(entry.testPdf),
      storedPath: testPath,
      status: 'queued',
      testName: entry.testName,
      section: null,
    }).run();
    const uploadId = Number(row.lastInsertRowid);

    // Parse PDFs
    console.log(`  Parsing PDF(s)...`);
    let text = await parsePdf(testPath);

    if (entry.answerPdf) {
      const answerPath = path.join(FILES_DIR, entry.answerPdf);
      if (fs.existsSync(answerPath)) {
        const answerText = await parsePdf(answerPath);
        text += '\n\n--- ANSWER KEY ---\n\n' + answerText;
        console.log(`  Combined with answer sheet (${Math.round(answerText.length / 1000)}k chars)`);
      }
    }

    console.log(`  Total text: ${Math.round(text.length / 1000)}k chars`);
    console.log(`  Extracting questions...`);

    try {
      const count = await extractFromText(text, uploadId);
      totalQuestions += count;
      console.log(`  Done: ${count} questions extracted and approved`);
    } catch (e) {
      console.error(`  FAILED:`, (e as Error).message);
    }
  }

  console.log(`\n=============================`);
  console.log(`Total questions added: ${totalQuestions}`);

  const approved = sqlite.prepare("SELECT COUNT(*) as n FROM questions WHERE status='approved'").get() as { n: number };
  console.log(`Total approved in DB: ${approved.n}`);

  const byTopic = sqlite.prepare(`
    SELECT topic_key, COUNT(*) as n FROM questions WHERE status='approved'
    GROUP BY topic_key ORDER BY n DESC
  `).all() as { topic_key: string; n: number }[];
  console.log('\nBy topic:');
  for (const row of byTopic) {
    console.log(`  ${row.topic_key ?? 'null'}: ${row.n}`);
  }
}

main().catch(console.error);
