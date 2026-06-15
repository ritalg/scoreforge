import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and, lte } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['student']));

// ─── SM-2 for flashcards ──────────────────────────────────────────────────────
type Quality = 0 | 3 | 5;

function updateFlashcardSR(studentId: number, cardId: number, quality: Quality) {
  const now = new Date();
  const existing = db.select().from(schema.flashcardSrRecords)
    .where(and(
      eq(schema.flashcardSrRecords.studentId, studentId),
      eq(schema.flashcardSrRecords.cardId, cardId)
    )).get();

  if (!existing) {
    const interval = quality < 3 ? 1 : 1;
    const nextReview = new Date(now.getTime() + interval * 86400000);
    db.insert(schema.flashcardSrRecords).values({
      studentId, cardId,
      nextReviewAt: nextReview.toISOString(),
      intervalDays: interval,
      easeFactor: 2.5,
      repetitionCount: 1,
    }).run();
    return;
  }

  let { intervalDays, easeFactor, repetitionCount } = existing;
  let newEase = easeFactor - 0.8 + 0.28 * quality - 0.02 * quality * quality;
  newEase = Math.max(1.3, Math.min(2.8, newEase));

  let newInterval: number;
  if (quality < 3) {
    newInterval = 1;
    repetitionCount = 0;
  } else {
    repetitionCount += 1;
    if (repetitionCount === 1) newInterval = 1;
    else if (repetitionCount === 2) newInterval = 6;
    else newInterval = Math.min(21, Math.round(intervalDays * newEase));
  }

  const nextReview = new Date(now.getTime() + newInterval * 86400000);
  db.update(schema.flashcardSrRecords).set({
    intervalDays: newInterval,
    easeFactor: newEase,
    repetitionCount,
    nextReviewAt: nextReview.toISOString(),
    updatedAt: now.toISOString(),
  }).where(and(
    eq(schema.flashcardSrRecords.studentId, studentId),
    eq(schema.flashcardSrRecords.cardId, cardId)
  )).run();
}

// ─── DECK ROUTES ──────────────────────────────────────────────────────────────

// GET /api/flashcards/decks
router.get('/decks', (req, res) => {
  const allDecks = db.select().from(schema.flashcardDecks)
    .all()
    .filter(d => d.published || d.createdBy === req.user!.id)
    .sort((a, b) => {
      // System decks first
      if (a.isSystemDeck && !b.isSystemDeck) return -1;
      if (!a.isSystemDeck && b.isSystemDeck) return 1;
      return a.name.localeCompare(b.name);
    });

  const decksWithCounts = allDecks.map(d => {
    const cardCount = db.select({ id: schema.flashcards.id })
      .from(schema.flashcards)
      .where(eq(schema.flashcards.deckId, d.id))
      .all().length;

    const nowIso = new Date().toISOString();
    const srRecords = db.select().from(schema.flashcardSrRecords)
      .where(and(
        eq(schema.flashcardSrRecords.studentId, req.user!.id),
        lte(schema.flashcardSrRecords.nextReviewAt, nowIso)
      )).all();

    const dueInDeck = srRecords.filter(r => {
      const card = db.select({ deckId: schema.flashcards.deckId })
        .from(schema.flashcards)
        .where(eq(schema.flashcards.id, r.cardId))
        .get();
      return card?.deckId === d.id;
    }).length;

    return { ...d, cardCount, dueCount: dueInDeck };
  });

  res.json(decksWithCounts);
});

// POST /api/flashcards/decks — create student deck
router.post('/decks', (req, res) => {
  const { name, topicKey } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  db.insert(schema.flashcardDecks).values({
    name: name.trim(),
    topicKey: topicKey ?? null,
    isSystemDeck: false,
    published: true,
    createdBy: req.user!.id,
  }).run();

  const deck = db.select().from(schema.flashcardDecks)
    .where(eq(schema.flashcardDecks.createdBy, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  res.status(201).json(deck);
});

// GET /api/flashcards/decks/:id/cards
router.get('/decks/:id/cards', (req, res) => {
  const deckId = parseInt(req.params.id);
  const deck = db.select().from(schema.flashcardDecks).where(eq(schema.flashcardDecks.id, deckId)).get();
  if (!deck) return res.status(404).json({ error: 'Deck not found' });

  const cards = db.select().from(schema.flashcards)
    .where(eq(schema.flashcards.deckId, deckId))
    .all()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const cardsWithSR = cards.map(c => {
    const sr = db.select().from(schema.flashcardSrRecords)
      .where(and(
        eq(schema.flashcardSrRecords.studentId, req.user!.id),
        eq(schema.flashcardSrRecords.cardId, c.id)
      )).get();
    return { ...c, sr: sr ?? null };
  });

  res.json({ deck, cards: cardsWithSR });
});

// POST /api/flashcards/cards — create card in a deck
router.post('/cards', (req, res) => {
  const { deckId, frontText, backText, hint } = req.body;
  if (!deckId || !frontText?.trim() || !backText?.trim()) {
    return res.status(400).json({ error: 'deckId, frontText, backText required' });
  }

  const deck = db.select().from(schema.flashcardDecks).where(eq(schema.flashcardDecks.id, deckId)).get();
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  if (deck.isSystemDeck && req.user!.role === 'student') {
    return res.status(403).json({ error: 'Cannot add cards to system decks' });
  }

  db.insert(schema.flashcards).values({
    deckId,
    frontText: frontText.trim(),
    backText: backText.trim(),
    hint: hint?.trim() ?? null,
    createdBy: req.user!.id,
  }).run();

  const card = db.select().from(schema.flashcards)
    .where(eq(schema.flashcards.deckId, deckId))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  res.status(201).json(card);
});

// POST /api/flashcards/cards/from-question — save explanation as flashcard
router.post('/cards/from-question', (req, res) => {
  const { questionId, deckId } = req.body;
  if (!questionId || !deckId) return res.status(400).json({ error: 'questionId, deckId required' });

  const q = db.select().from(schema.questions).where(eq(schema.questions.id, questionId)).get();
  if (!q) return res.status(404).json({ error: 'Question not found' });

  const frontText = q.questionText.length > 200
    ? q.questionText.slice(0, 200) + '…'
    : q.questionText;
  const backText = q.explanation
    ? `Answer: ${q.correctAnswer}\n\n${q.explanation}`
    : `Answer: ${q.correctAnswer}`;

  db.insert(schema.flashcards).values({
    deckId,
    frontText,
    backText,
    createdBy: req.user!.id,
  }).run();

  res.status(201).json({ message: 'Card created from question' });
});

// GET /api/flashcards/due — all cards due for review
router.get('/due', (req, res) => {
  const { deckId } = req.query;
  const nowIso = new Date().toISOString();

  const dueRecords = db.select().from(schema.flashcardSrRecords)
    .where(and(
      eq(schema.flashcardSrRecords.studentId, req.user!.id),
      lte(schema.flashcardSrRecords.nextReviewAt, nowIso)
    )).all();

  const enriched = dueRecords.map(r => {
    const card = db.select().from(schema.flashcards).where(eq(schema.flashcards.id, r.cardId)).get();
    if (!card) return null;
    if (deckId && card.deckId !== parseInt(String(deckId))) return null;
    return { ...r, card };
  }).filter(Boolean);

  // Cards never reviewed are not in SR table — fetch unseen cards (limited batch)
  const seenCardIds = new Set(dueRecords.map(r => r.cardId));
  let unseenQuery = db.select().from(schema.flashcards).all();
  if (deckId) unseenQuery = unseenQuery.filter(c => c.deckId === parseInt(String(deckId)));
  const unseen = unseenQuery.filter(c => !seenCardIds.has(c.id)).slice(0, 20)
    .map(c => ({ card: c, nextReviewAt: null, intervalDays: 1, easeFactor: 2.5, repetitionCount: 0 }));

  res.json({ due: enriched, unseen, totalDue: enriched.length + unseen.length });
});

// POST /api/flashcards/review — rate a card
router.post('/review', (req, res) => {
  const { cardId, quality } = req.body; // quality: 0 | 3 | 5
  if (![0, 3, 5].includes(quality)) return res.status(400).json({ error: 'quality must be 0, 3, or 5' });

  updateFlashcardSR(req.user!.id, cardId, quality as Quality);
  res.json({ message: 'Review recorded' });
});

// GET /api/flashcards/stats
router.get('/stats', (req, res) => {
  const nowIso = new Date().toISOString();
  const allRecords = db.select().from(schema.flashcardSrRecords)
    .where(eq(schema.flashcardSrRecords.studentId, req.user!.id)).all();

  const due = allRecords.filter(r => r.nextReviewAt <= nowIso).length;
  const mastered = allRecords.filter(r => r.easeFactor >= 2.5 && r.repetitionCount >= 3).length;
  const totalCards = db.select({ id: schema.flashcards.id }).from(schema.flashcards).all().length;

  res.json({ totalCards, studied: allRecords.length, due, mastered });
});

export default router;
