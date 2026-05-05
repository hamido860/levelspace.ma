import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full rounded-3xl border border-ink/10 bg-paper p-8 text-center shadow-xl shadow-ink/5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-destructive/70">
            403 Forbidden
          </div>
          <h1 className="mt-3 text-2xl font-serif text-ink">Admin access required</h1>
          <p className="mt-3 text-sm text-muted">
            Your account is authenticated, but your `profiles.role` is not `admin`, so this area is blocked.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="rounded-full border border-ink/10 px-5 py-2 text-sm font-medium text-ink hover:bg-ink/5 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.assign('/dashboard')}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper hover:bg-accent transition-colors"
            >
              Open Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
