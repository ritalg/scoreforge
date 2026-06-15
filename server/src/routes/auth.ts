import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authGuard, generateToken, setAuthCookie } from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail, sendParentConsentEmail } from '../services/emailService';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['student', 'parent', 'tutor']).default('student'),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, firstName, lastName, role, birthYear } = parsed.data;

  const existing = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get();
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // COPPA check
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : null;
  const needsCoppaConsent = age !== null && age < 13;

  db.insert(schema.users).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role,
    status: 'pending_verification',
    verificationToken,
    verificationExpiry,
    birthYear,
  }).run();
  const user = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get()!;

  // Create student profile if role is student
  if (role === 'student') {
    db.insert(schema.studentProfiles).values({ studentId: user.id }).run();
    db.insert(schema.studentLevels).values({ studentId: user.id }).run();
    db.insert(schema.streakRecords).values({ studentId: user.id }).run();
  }

  try {
    await sendVerificationEmail(email, verificationToken);
  } catch (err) {
    console.error('Failed to send verification email:', err);
  }

  if (needsCoppaConsent && req.body.parentEmail) {
    const consentToken = crypto.randomBytes(32).toString('hex');
    db.update(schema.users)
      .set({ verificationToken: consentToken })
      .where(eq(schema.users.id, user.id))
      .run();
    try {
      await sendParentConsentEmail(req.body.parentEmail, firstName, consentToken);
    } catch (err) {
      console.error('Failed to send COPPA consent email:', err);
    }
  }

  res.status(201).json({
    message: needsCoppaConsent
      ? 'Account created. Parental consent required before activation.'
      : 'Account created. Please check your email to verify.',
    requiresCoppaConsent: needsCoppaConsent,
  });
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const user = db.select().from(schema.users).where(eq(schema.users.verificationToken, token)).get();
  if (!user) return res.status(400).json({ error: 'Invalid token' });
  if (user.verificationExpiry && new Date(user.verificationExpiry) < new Date()) {
    return res.status(400).json({ error: 'Token expired' });
  }

  db.update(schema.users).set({
    status: 'active',
    verificationToken: null,
    verificationExpiry: null,
  }).where(eq(schema.users.id, user.id)).run();

  res.json({ message: 'Email verified successfully' });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, totpCode } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (user.status === 'pending_verification') {
    return res.status(403).json({ error: 'Please verify your email before logging in' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
  if (user.status === 'deleted') return res.status(403).json({ error: 'Account not found' });

  // 2FA check
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return res.status(200).json({ requiresTOTP: true, message: 'TOTP code required' });
    }
    const valid2fa = authenticator.verify({ token: totpCode, secret: user.totpSecret });
    if (!valid2fa) return res.status(401).json({ error: 'Invalid 2FA code' });
  }

  // Enforce 2FA for admin/superadmin (allow first login so they can reach setup page)
  const needsTOTPSetup = (user.role === 'admin' || user.role === 'superadmin') && !user.totpEnabled;

  const token = generateToken(user.id);
  setAuthCookie(res, token);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      theme: user.theme,
      language: user.language,
      fontSize: user.fontSize,
    },
    token,
    requiresTOTPSetup: needsTOTPSetup || undefined,
  });
});

// POST /api/auth/logout
router.post('/logout', authGuard, (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authGuard, (req, res) => {
  const user = db.select({
    id: schema.users.id,
    email: schema.users.email,
    firstName: schema.users.firstName,
    lastName: schema.users.lastName,
    role: schema.users.role,
    status: schema.users.status,
    theme: schema.users.theme,
    language: schema.users.language,
    fontSize: schema.users.fontSize,
    totpEnabled: schema.users.totpEnabled,
    leaderboardOptOut: schema.users.leaderboardOptOut,
    createdAt: schema.users.createdAt,
  }).from(schema.users).where(eq(schema.users.id, req.user!.id)).get();

  res.json(user);
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get();
  // Always return success to prevent email enumeration
  if (!user) return res.json({ message: 'If that email exists, a reset link has been sent' });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.update(schema.users).set({ resetToken, resetExpiry }).where(eq(schema.users.id, user.id)).run();

  try {
    await sendPasswordResetEmail(email, resetToken);
  } catch (err) {
    console.error('Failed to send reset email:', err);
  }

  res.json({ message: 'If that email exists, a reset link has been sent' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

  const parsed = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).safeParse(password);
  if (!parsed.success) return res.status(400).json({ error: 'Password must be 8+ characters with uppercase and number' });

  const user = db.select().from(schema.users).where(eq(schema.users.resetToken, token)).get();
  if (!user || !user.resetExpiry) return res.status(400).json({ error: 'Invalid or expired reset token' });
  if (new Date(user.resetExpiry) < new Date()) return res.status(400).json({ error: 'Reset token expired' });

  const passwordHash = await bcrypt.hash(password, 12);
  db.update(schema.users).set({ passwordHash, resetToken: null, resetExpiry: null })
    .where(eq(schema.users.id, user.id)).run();

  res.json({ message: 'Password reset successfully' });
});

// POST /api/auth/change-password
router.post('/change-password', authGuard, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });

  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

  const parsed = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).safeParse(newPassword);
  if (!parsed.success) return res.status(400).json({ error: 'Password must be 8+ characters with uppercase and number' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, req.user!.id)).run();

  res.json({ message: 'Password changed successfully' });
});

// POST /api/auth/2fa/setup
router.post('/2fa/setup', authGuard, async (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(user.email, 'ScoreForge', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  // Store secret temporarily (not yet enabled)
  db.update(schema.users).set({ totpSecret: secret }).where(eq(schema.users.id, user.id)).run();

  res.json({ secret, qrCodeDataUrl, otpAuthUrl });
});

// POST /api/auth/2fa/verify-setup
router.post('/2fa/verify-setup', authGuard, async (req, res) => {
  const { totpCode } = req.body;
  if (!totpCode) return res.status(400).json({ error: 'TOTP code required' });

  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  if (!user?.totpSecret) return res.status(400).json({ error: '2FA setup not initiated' });

  const valid = authenticator.verify({ token: totpCode, secret: user.totpSecret });
  if (!valid) return res.status(400).json({ error: 'Invalid TOTP code' });

  db.update(schema.users).set({ totpEnabled: true }).where(eq(schema.users.id, user.id)).run();
  res.json({ message: '2FA enabled successfully' });
});

// DELETE /api/auth/2fa
router.delete('/2fa', authGuard, async (req, res) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Admins cannot disable 2FA
  if (user.role === 'admin' || user.role === 'superadmin') {
    return res.status(403).json({ error: '2FA cannot be disabled for admin accounts' });
  }

  const { password } = req.body;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Password incorrect' });

  db.update(schema.users).set({ totpEnabled: false, totpSecret: null })
    .where(eq(schema.users.id, user.id)).run();

  res.json({ message: '2FA disabled' });
});

export default router;
