import { Router } from 'express';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { authGuard, requireRole } from '../../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['admin', 'superadmin']));

// GET /api/admin/scoring-tables
router.get('/', (req, res) => {
  const { testName, section } = req.query;
  let rows = db.select().from(schema.scoringTables).all();
  if (testName) rows = rows.filter(r => r.testName === testName);
  if (section) rows = rows.filter(r => r.section === section);
  rows.sort((a, b) => a.testName.localeCompare(b.testName) || a.section.localeCompare(b.section) || a.rawScore - b.rawScore);

  // Group by testName + section
  const grouped: Record<string, Record<string, typeof rows>> = {};
  for (const r of rows) {
    if (!grouped[r.testName]) grouped[r.testName] = {};
    if (!grouped[r.testName][r.section]) grouped[r.testName][r.section] = [];
    grouped[r.testName][r.section].push(r);
  }

  const testNames = [...new Set(rows.map(r => r.testName))];
  res.json({ grouped, testNames, total: rows.length });
});

// POST /api/admin/scoring-tables/import — bulk import from parsed CSV rows
// Body: { testName, section, rows: [{rawScore, scaledScore}] }
router.post('/import', (req, res) => {
  const { testName, section, rows } = req.body;
  if (!testName || !section || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'testName, section, rows required' });
  }
  if (!['math', 'rw'].includes(section)) {
    return res.status(400).json({ error: 'section must be math or rw' });
  }

  // Remove existing rows for this test+section
  const existing = db.select().from(schema.scoringTables)
    .where(eq(schema.scoringTables.testName, testName)).all()
    .filter(r => r.section === section);
  for (const e of existing) {
    db.delete(schema.scoringTables).where(eq(schema.scoringTables.id, e.id)).run();
  }

  let inserted = 0;
  for (const row of rows) {
    const raw = parseInt(row.rawScore ?? row.raw_score);
    const scaled = parseInt(row.scaledScore ?? row.scaled_score);
    if (isNaN(raw) || isNaN(scaled)) continue;
    if (scaled < 200 || scaled > 800) continue;

    db.insert(schema.scoringTables).values({
      testName,
      section: section as 'math' | 'rw',
      rawScore: raw,
      scaledScore: scaled,
      createdBy: req.user!.id,
    }).run();
    inserted++;
  }

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'scoring_table_import',
    entityType: 'scoring_table',
    entityId: `${testName}/${section}`,
    payloadJson: JSON.stringify({ inserted }),
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: `Imported ${inserted} rows for ${testName} (${section})` });
});

// DELETE /api/admin/scoring-tables/:testName/:section
router.delete('/:testName/:section', (req, res) => {
  const { testName, section } = req.params;
  const rows = db.select().from(schema.scoringTables)
    .where(eq(schema.scoringTables.testName, testName))
    .all().filter(r => r.section === section);

  for (const r of rows) {
    db.delete(schema.scoringTables).where(eq(schema.scoringTables.id, r.id)).run();
  }

  db.insert(schema.auditLogs).values({
    userId: req.user!.id,
    action: 'scoring_table_delete',
    entityType: 'scoring_table',
    entityId: `${testName}/${section}`,
    ipAddress: req.ip || null,
  }).run();

  res.json({ message: `Deleted ${rows.length} rows` });
});

export default router;
