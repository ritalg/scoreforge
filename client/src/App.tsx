import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import LoginPage from './pages/auth/Login';
import RegisterPage from './pages/auth/Register';
import VerifyEmailPage from './pages/auth/VerifyEmail';
import ForgotPasswordPage from './pages/auth/ForgotPassword';
import ResetPasswordPage from './pages/auth/ResetPassword';
import OnboardingPage from './pages/onboarding/Onboarding';

import StudentLayout from './components/layout/StudentLayout';
import StudentDashboard from './pages/student/Dashboard';
import QuizSession from './pages/student/QuizSession';
import QuizResults from './pages/student/QuizResults';
import Analytics from './pages/student/Analytics';
import SRDrill from './pages/student/SRDrill';
import MockTest from './pages/student/MockTest';
import Flashcards from './pages/student/Flashcards';
import QuestionBank from './pages/student/QuestionBank';
import EssayScorer from './pages/student/EssayScorer';
import BadgesProfile from './pages/student/BadgesProfile';
import Leaderboard from './pages/student/Leaderboard';
import ErrorLog from './pages/student/ErrorLog';

import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UploadCenter from './pages/admin/UploadCenter';
import QuestionQueue from './pages/admin/QuestionQueue';
import QuestionEditor from './pages/admin/QuestionEditor';
import UserManagement from './pages/admin/UserManagement';
import FeatureFlags from './pages/admin/FeatureFlags';
import AuditLog from './pages/admin/AuditLog';
import ScoringTables from './pages/admin/ScoringTables';
import FlashcardManager from './pages/admin/FlashcardManager';
import BulkImport from './pages/admin/BulkImport';
import AdminAnalytics from './pages/admin/AdminAnalytics';

import { TutorLayout } from './pages/tutor/TutorDashboard';
import TutorDashboard from './pages/tutor/TutorDashboard';
import StudentRoster from './pages/tutor/StudentRoster';
import AssignmentManager from './pages/tutor/AssignmentManager';
import CohortAnalytics from './pages/tutor/CohortAnalytics';
import StudyGroups from './pages/student/StudyGroups';
import TestCalendar from './pages/student/TestCalendar';
import Settings from './pages/student/Settings';
import ScorePrediction from './pages/student/ScorePrediction';

import { ParentLayout } from './pages/parent/ParentDashboard';
import ParentDashboard from './pages/parent/ParentDashboard';
import LinkStudent from './pages/parent/LinkStudent';

import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { OfflineBanner } from './components/ui/OfflineBanner';

export default function App() {
  const { fetchMe, loading } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <OfflineBanner />
    <PWAInstallBanner />
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={
          <ProtectedRoute roles={['student']}>
            <OnboardingPage />
          </ProtectedRoute>
        } />

        {/* Student routes */}
        <Route path="/student/*" element={
          <ProtectedRoute roles={['student']}>
            <StudentLayout />
          </ProtectedRoute>
        }>
          <Route index element={<StudentDashboard />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="quiz" element={<QuizSession />} />
          <Route path="quiz/results/:sessionId" element={<QuizResults />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="sr-drill" element={<SRDrill />} />
          <Route path="mock-test" element={<MockTest />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="essay-scorer" element={<EssayScorer />} />
          <Route path="profile" element={<BadgesProfile />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="error-log" element={<ErrorLog />} />
          <Route path="study-groups" element={<StudyGroups />} />
          <Route path="test-calendar" element={<TestCalendar />} />
          <Route path="settings" element={<Settings />} />
          <Route path="score-prediction" element={<ScorePrediction />} />
        </Route>

        {/* Parent routes */}
        <Route path="/parent/*" element={
          <ProtectedRoute roles={['parent']}>
            <ParentLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ParentDashboard />} />
          <Route path="dashboard" element={<ParentDashboard />} />
          <Route path="link" element={<LinkStudent />} />
        </Route>

        {/* Tutor routes */}
        <Route path="/tutor/*" element={
          <ProtectedRoute roles={['tutor']}>
            <TutorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<TutorDashboard />} />
          <Route path="dashboard" element={<TutorDashboard />} />
          <Route path="roster" element={<StudentRoster />} />
          <Route path="assignments" element={<AssignmentManager />} />
          <Route path="cohort" element={<CohortAnalytics />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin/*" element={
          <ProtectedRoute roles={['admin', 'superadmin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="upload" element={<UploadCenter />} />
          <Route path="questions" element={<QuestionQueue />} />
          <Route path="questions/:id" element={<QuestionEditor />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="feature-flags" element={<FeatureFlags />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="scoring-tables" element={<ScoringTables />} />
          <Route path="flashcards" element={<FlashcardManager />} />
          <Route path="bulk-import" element={<BulkImport />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

function RootRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin' || user.role === 'superadmin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'tutor') return <Navigate to="/tutor/dashboard" replace />;
  if (user.role === 'parent') return <Navigate to="/parent/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
}
