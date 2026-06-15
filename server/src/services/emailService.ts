import nodemailer from 'nodemailer';

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Dev: Ethereal catch-all
  return nodemailer.createTransport({ jsonTransport: true });
}

const transport = createTransport();
const FROM = process.env.EMAIL_FROM || 'ScoreForge <noreply@scoreforge.coach>';
const BASE_URL = process.env.APP_URL || 'http://localhost:5173';

function html(body: string, title: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .wrapper { max-width: 600px; margin: 32px auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
  .header { background: #2563eb; padding: 24px 32px; }
  .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 700; }
  .body { padding: 32px; }
  .btn { display: inline-block; background: #2563eb; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
  .footer { padding: 16px 32px; background: #f9fafb; color: #9ca3af; font-size: 12px; }
  .stat { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 8px 16px; border-radius: 8px; margin: 4px; font-weight: 600; }
</style></head>
<body><div class="wrapper">
  <div class="header"><h1>ScoreForge</h1></div>
  <div class="body">${body}</div>
  <div class="footer">ScoreForge · scoreforge.coach · <a href="${BASE_URL}/student/settings">Manage notifications</a></div>
</div></body></html>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  const body = `<p>Welcome to ScoreForge!</p><p>Click below to verify your email:</p><a href="${link}" class="btn">Verify Email →</a><p style="color:#9ca3af;font-size:12px;">Link expires in 24 hours.</p>`;
  await transport.sendMail({ from: FROM, to, subject: 'Verify your ScoreForge email', html: html(body, 'Email Verification') });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  const body = `<p>We received a request to reset your ScoreForge password.</p><a href="${link}" class="btn">Reset Password →</a><p style="color:#9ca3af;font-size:12px;">Link expires in 1 hour.</p>`;
  await transport.sendMail({ from: FROM, to, subject: 'Reset your ScoreForge password', html: html(body, 'Password Reset') });
}

export async function sendParentConsentEmail(to: string, studentName: string, token: string) {
  const link = `${BASE_URL}/parent-consent?token=${token}`;
  const body = `<p>Your child <strong>${studentName}</strong> is creating a ScoreForge account.</p><a href="${link}" class="btn">Review &amp; Give Consent →</a><p style="color:#9ca3af;font-size:12px;">Expires in 72 hours.</p>`;
  await transport.sendMail({ from: FROM, to, subject: `Parental consent required for ${studentName}`, html: html(body, 'Parental Consent') });
}

export async function sendStudyReminder(to: string, firstName: string, dueCount: number) {
  const body = `
    <p>Hi ${firstName},</p>
    <p>Time to study! You have <span class="stat">${dueCount} questions</span> due for spaced repetition review today.</p>
    <p>Consistent daily practice is the fastest path to a higher SAT score.</p>
    <a href="${BASE_URL}/student/sr-drill" class="btn">Start Review →</a>
    <p>Good luck! 🔥</p>`;
  await transport.sendMail({ from: FROM, to, subject: 'Your daily SAT study reminder', html: html(body, 'Study Reminder') });
}

export async function sendAssignmentDue(to: string, firstName: string, assignmentTitle: string, dueDate: string, tutorName: string) {
  const body = `
    <p>Hi ${firstName},</p>
    <p>A reminder that your assignment from ${tutorName} is due soon:</p>
    <p><strong>${assignmentTitle}</strong></p>
    <p><strong>Due:</strong> ${new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    <a href="${BASE_URL}/student/assignments" class="btn">View Assignment →</a>`;
  await transport.sendMail({ from: FROM, to, subject: `Assignment due soon: ${assignmentTitle}`, html: html(body, 'Assignment Due') });
}

export async function sendTestCountdown(to: string, firstName: string, testDate: string, daysUntil: number) {
  const body = `
    <p>Hi ${firstName},</p>
    <p>Your SAT is <strong>${daysUntil} day${daysUntil !== 1 ? 's' : ''} away</strong> on ${new Date(testDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
    <p>Keep up the practice — every session counts!</p>
    <a href="${BASE_URL}/student/mock-test" class="btn">Take a Mock Test →</a>`;
  await transport.sendMail({ from: FROM, to, subject: `Your SAT is ${daysUntil} day${daysUntil !== 1 ? 's' : ''} away`, html: html(body, 'Test Countdown') });
}

export async function sendWeeklyParentDigest(
  to: string, parentName: string, studentName: string,
  stats: { sessionsThisWeek: number; avgScore: number | null; currentStreak: number; xpEarned: number; prediction: number | null }
) {
  const body = `
    <p>Hi ${parentName},</p>
    <p>Here's ${studentName}'s weekly study summary:</p>
    <div>
      <span class="stat">${stats.sessionsThisWeek} sessions</span>
      ${stats.avgScore != null ? `<span class="stat">${stats.avgScore}% avg score</span>` : ''}
      <span class="stat">${stats.currentStreak}🔥 day streak</span>
      <span class="stat">+${stats.xpEarned} XP earned</span>
      ${stats.prediction != null ? `<span class="stat">Score est: ~${stats.prediction}</span>` : ''}
    </div>
    <br>
    <a href="${BASE_URL}/parent/dashboard" class="btn">View Full Dashboard →</a>`;
  await transport.sendMail({ from: FROM, to, subject: `${studentName}'s weekly SAT progress`, html: html(body, 'Weekly Digest') });
}

export async function sendBadgeEarned(to: string, firstName: string, badgeName: string, badgeDescription: string) {
  const body = `
    <p>Hi ${firstName},</p>
    <p>Congratulations! You just earned a new badge:</p>
    <p style="font-size:48px; text-align:center;">🎖️</p>
    <p style="text-align:center; font-size:20px; font-weight:700;">${badgeName}</p>
    <p style="text-align:center; color:#6b7280;">${badgeDescription}</p>
    <br>
    <a href="${BASE_URL}/student/profile" class="btn">View Your Profile →</a>`;
  await transport.sendMail({ from: FROM, to, subject: `You earned the "${badgeName}" badge!`, html: html(body, 'Badge Earned') });
}

export async function sendStreakAtRisk(to: string, firstName: string, currentStreak: number) {
  const body = `
    <p>Hi ${firstName},</p>
    <p>⚠️ Your <strong>${currentStreak}-day study streak</strong> is at risk!</p>
    <p>You haven't studied yet today. Complete any activity to keep your streak alive.</p>
    <a href="${BASE_URL}/student/quiz" class="btn">Study Now →</a>`;
  await transport.sendMail({ from: FROM, to, subject: `Don't break your ${currentStreak}-day streak!`, html: html(body, 'Streak At Risk') });
}
