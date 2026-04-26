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
import { StudyPlanner } from './pages/StudyPlanner';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';
import { BlueprintHub } from './pages/BlueprintHub';
import { ClassroomView } from './pages/ClassroomView';
import { Library } from './pages/Library';
import { Admin } from './pages/Admin';
import { AiCommandCenter } from './pages/AiCommandCenter';
import { Profile } from './pages/Profile';
import { SearchProvider } from './context/SearchContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { Pricing } from './pages/Pricing';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AICrewStatus } from './components/AICrewStatus';

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
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/modules" element={<ProtectedRoute><Modules /></ProtectedRoute>} />
                <Route path="/lesson/:id" element={<ProtectedRoute><LessonView /></ProtectedRoute>} />
                <Route path="/classroom/:id" element={<ProtectedRoute><ClassroomView /></ProtectedRoute>} />
                <Route path="/quiz/:id" element={<ProtectedRoute><QuizInterface /></ProtectedRoute>} />
                <Route path="/blueprints" element={<ProtectedRoute><BlueprintHub /></ProtectedRoute>} />
                <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
                <Route path="/admin/ai-command-center" element={<ProtectedRoute requireAdmin><AiCommandCenter /></ProtectedRoute>} />
              </Routes>
            </Router>
            <Toaster position="bottom-right" richColors />
            <AICrewStatus />
          </SearchProvider>
        </LanguageProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}
