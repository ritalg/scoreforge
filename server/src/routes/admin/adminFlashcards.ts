import { Router } from 'express';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { authGuard, requireRole } from '../../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['admin', 'superadmin']));

// GET /api/admin/flashcards/decks
router.get('/decks', (req, res) => {
  const decks = db.select().from(schema.flashcardDecks).all()
    .sort((a, b) => a.name.localeCompare(b.name));

  const withCounts = decks.map(d => ({
    ...d,
    cardCount: db.select({ id: schema.flashcards.id }).from(schema.flashcards)
      .where(eq(schema.flashcards.deckId, d.id)).all().length,
  }));

  res.json(withCounts);
});

// POST /api/admin/flashcards/decks — create system deck
router.post('/decks', (req, res) => {
  const { name, topicKey, isSystemDeck = true } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  db.insert(schema.flashcardDecks).values({
    name: name.trim(),
    topicKey: topicKey ?? null,
    isSystemDeck: Boolean(isSystemDeck),
    published: false,
    createdBy: req.user!.id,
  }).run();

  const deck = db.select().from(schema.flashcardDecks)
    .where(eq(schema.flashcardDecks.createdBy, req.user!.id))
    .all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  res.status(201).json(deck);
});

// PUT /api/admin/flashcards/decks/:id
router.put('/decks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, topicKey, published } = req.body;

  const updates: Record<string, string | boolean | null> = {};
  if (name !== undefined) updates.name = name;
  if (topicKey !== undefined) updates.topicKey = topicKey;
  if (published !== undefined) updates.published = Boolean(published);

  db.update(schema.flashcardDecks).set(updates as any).where(eq(schema.flashcardDecks.id, id)).run();
  res.json({ message: 'Deck updated' });
});

// DELETE /api/admin/flashcards/decks/:id
router.delete('/decks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  // Delete all cards first
  db.delete(schema.flashcards).where(eq(schema.flashcards.deckId, id)).run();
  db.delete(schema.flashcardDecks).where(eq(schema.flashcardDecks.id, id)).run();
  res.json({ message: 'Deck deleted' });
});

// POST /api/admin/flashcards/decks/:id/cards — add card to deck
router.post('/decks/:id/cards', (req, res) => {
  const deckId = parseInt(req.params.id);
  const { frontText, backText, hint } = req.body;
  if (!frontText?.trim() || !backText?.trim()) {
    return res.status(400).json({ error: 'frontText, backText required' });
  }

  db.insert(schema.flashcards).values({
    deckId,
    frontText: frontText.trim(),
    backText: backText.trim(),
    hint: hint?.trim() ?? null,
    createdBy: req.user!.id,
  }).run();

  res.status(201).json({ message: 'Card added' });
});

// POST /api/admin/flashcards/decks/:id/cards/bulk — CSV import
router.post('/decks/:id/cards/bulk', (req, res) => {
  const deckId = parseInt(req.params.id);
  const { rows } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows array required' });

  let imported = 0;
  for (const row of rows) {
    if (!row.frontText && !row.front_text) continue;
    db.insert(schema.flashcards).values({
      deckId,
      frontText: (row.frontText ?? row.front_text).trim(),
      backText: (row.backText ?? row.back_text ?? '').trim(),
      hint: row.hint?.trim() ?? null,
      createdBy: req.user!.id,
    }).run();
    imported++;
  }

  res.json({ message: `Imported ${imported} cards` });
});

// PUT /api/admin/flashcards/cards/:id
router.put('/cards/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { frontText, backText, hint } = req.body;
  const updates: Record<string, string | null> = {};
  if (frontText !== undefined) updates.frontText = frontText;
  if (backText !== undefined) updates.backText = backText;
  if (hint !== undefined) updates.hint = hint;
  db.update(schema.flashcards).set(updates as any).where(eq(schema.flashcards.id, id)).run();
  res.json({ message: 'Card updated' });
});

// DELETE /api/admin/flashcards/cards/:id
router.delete('/cards/:id', (req, res) => {
  db.delete(schema.flashcards).where(eq(schema.flashcards.id, parseInt(req.params.id))).run();
  res.json({ message: 'Card deleted' });
});

export default router;
