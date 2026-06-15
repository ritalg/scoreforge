import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, requireRole } from '../middleware/auth';

const router = Router();
router.use(authGuard, requireRole(['student']));

// POST /api/student/link-tutor — student links themselves to a tutor by tutor ID
router.post('/link-tutor', (req, res) => {
  const { tutorId } = req.body;
  if (!tutorId) return res.status(400).json({ error: 'tutorId required' });

  const tutor = db.select({ id: schema.users.id, role: schema.users.role, firstName: schema.users.firstName, lastName: schema.users.lastName })
    .from(schema.users).where(eq(schema.users.id, parseInt(tutorId))).get();

  if (!tutor || tutor.role !== 'tutor') return res.status(404).json({ error: 'Tutor not found' });

  try {
    db.insert(schema.tutorStudentLinks).values({
      tutorId: tutor.id, studentId: req.user!.id, status: 'active',
    }).run();
  } catch {
    return res.status(400).json({ error: 'Already linked to this tutor' });
  }

  res.status(201).json({ message: `Linked to ${tutor.firstName} ${tutor.lastName}` });
});

// GET /api/student/my-tutors
router.get('/my-tutors', (req, res) => {
  const links = db.select().from(schema.tutorStudentLinks)
    .where(and(eq(schema.tutorStudentLinks.studentId, req.user!.id), eq(schema.tutorStudentLinks.status, 'active')))
    .all();

  const tutors = links.map(l => {
    const u = db.select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email })
      .from(schema.users).where(eq(schema.users.id, l.tutorId)).get();
    return { ...u, linkedAt: l.linkedAt };
  });

  res.json(tutors);
});

// GET /api/student/assignments — assignments assigned to this student
router.get('/assignments', (req, res) => {
  const studentId = req.user!.id;
  const myAssignments = db.select().from(schema.assignmentStudents)
    .where(eq(schema.assignmentStudents.studentId, studentId)).all();

  const enriched = myAssignments.map(a => {
    const assignment = db.select().from(schema.assignments)
      .where(eq(schema.assignments.id, a.assignmentId)).get();
    if (!assignment) return null;
    const tutor = db.select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users).where(eq(schema.users.id, assignment.tutorId)).get();
    const selection = assignment.questionSelectionJson ? JSON.parse(assignment.questionSelectionJson) : {};
    const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date() && a.status !== 'completed';
    return {
      assignmentStudentId: a.id,
      status: a.status,
      completedAt: a.completedAt,
      quizSessionId: a.quizSessionId,
      assignment: { ...assignment, tutorName: tutor ? `${tutor.firstName} ${tutor.lastName}` : 'Unknown' },
      questionCount: selection.questionIds?.length ?? 0,
      isOverdue,
    };
  }).filter(Boolean).sort((a, b) => {
    const ad = a!.assignment.dueDate ?? '';
    const bd = b!.assignment.dueDate ?? '';
    return new Date(ad).getTime() - new Date(bd).getTime();
  });

  res.json(enriched);
});

export default router;
