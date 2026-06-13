import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Modules } from './pages/Modules';
import { LessonView } from './pages/LessonView';
import { QuizInterface } from './pages/QuizInterface';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { ClassroomView } from './pages/ClassroomView';
import { LevelUp } from './pages/LevelUp';
import { Admin } from './pages/Admin';
import { AdminCurriculumReview } from './pages/AdminCurriculumReview';
import { AiCommandCenter } from './pages/AiCommandCenter';
import { AdminAiRecovery } from './pages/AdminAiRecovery';
import { AdminAiRecoveryTaskDetail } from './pages/AdminAiRecoveryTaskDetail';
import { AdminRecoveredLessonReview } from './pages/AdminRecoveredLessonReview';
import { AdminAiDiagnostics } from './pages/AdminAiDiagnostics';
import { Profile } from './pages/Profile';
import { SearchProvider } from './context/SearchContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { Pricing } from './pages/Pricing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AICrewStatus } from './components/AICrewStatus';
import { SelectionActions } from './components/SelectionActions';

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <LanguageProvider>
          <SearchProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/modules" element={<ProtectedRoute><Modules /></ProtectedRoute>} />
                <Route path="/lesson/:id" element={<ProtectedRoute><LessonView /></ProtectedRoute>} />
                <Route path="/classroom/:id" element={<ProtectedRoute><ClassroomView /></ProtectedRoute>} />
                <Route path="/quiz/:id" element={<ProtectedRoute><QuizInterface /></ProtectedRoute>} />
                <Route path="/levelup" element={<ProtectedRoute><LevelUp /></ProtectedRoute>} />
                <Route path="/library" element={<Navigate to="/levelup" replace />} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
                <Route path="/admin/curriculum-review" element={<ProtectedRoute requireAdmin><AdminCurriculumReview /></ProtectedRoute>} />
                <Route path="/admin/ai-command-center" element={<ProtectedRoute requireAdmin><AiCommandCenter /></ProtectedRoute>} />
                <Route path="/admin/ai-diagnostics" element={<ProtectedRoute requireAdmin><AdminAiDiagnostics /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery" element={<ProtectedRoute requireAdmin><AdminAiRecovery /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery/failed-jobs" element={<ProtectedRoute requireAdmin><AdminAiRecovery /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery/ai-tasks" element={<ProtectedRoute requireAdmin><AdminAiRecovery /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery/ai-tasks/:taskId" element={<ProtectedRoute requireAdmin><AdminAiRecoveryTaskDetail /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery/recovered-lessons" element={<ProtectedRoute requireAdmin><AdminAiRecovery /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery/recovered-lessons/:lessonId" element={<ProtectedRoute requireAdmin><AdminRecoveredLessonReview /></ProtectedRoute>} />
                <Route path="/admin/ai-recovery/logs" element={<ProtectedRoute requireAdmin><AdminAiRecovery /></ProtectedRoute>} />
              </Routes>
            </Router>
            <SelectionActions />
            <Toaster position="bottom-right" richColors />
            <AICrewStatus />
          </SearchProvider>
        </LanguageProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}
