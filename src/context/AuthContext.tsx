import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, getProfile, checkSupabaseConnection } from '../db/supabase';
import { syncService } from '../services/syncService';
import { db } from '../db/db';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInDemoAdmin: () => Promise<void>;
  isPro: boolean;
  isAdmin: boolean;
  isDemoAdmin: boolean;
  dbConnected: boolean | null;
  refreshDbConnection: () => Promise<void>;
  syncData: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEMO_ADMIN_STORAGE_KEY = 'demo_admin_logged_in';
const DEMO_ADMIN_USER_ID = 'demo-admin-id';

const createDemoAdminUser = (): User => ({
  id: DEMO_ADMIN_USER_ID,
  app_metadata: { provider: 'demo' },
  user_metadata: { full_name: 'Demo Admin' },
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
  email: 'admin-demo@levelspace.local',
  role: 'authenticated',
} as User);

const createDemoAdminProfile = () => ({
  id: DEMO_ADMIN_USER_ID,
  full_name: 'Demo Admin',
  role: 'admin',
  plan: 'pro',
  onboarding_completed: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const isDemoAdmin = user?.id === DEMO_ADMIN_USER_ID;

  const applyDemoAdminAuth = async () => {
    const demoUser = createDemoAdminUser();
    const demoProfile = createDemoAdminProfile();
    localStorage.setItem(DEMO_ADMIN_STORAGE_KEY, 'true');
    setSession(null);
    setUser(demoUser);
    setProfile(demoProfile);
    await db.settings.put({ key: `profile_${DEMO_ADMIN_USER_ID}`, value: demoProfile });
  };

  const refreshDbConnection = async () => {
    const connected = await checkSupabaseConnection();
    setDbConnected(connected);
  };

  const syncData = async () => {
    if (isDemoAdmin) {
      return { errors: ['Demo admin mode does not sync with cloud data.'] };
    }
    if (!dbConnected || !user) {
      return { errors: ['Not connected to cloud or user is not authenticated'] };
    }
    // Pull cloud → local first (restores lessons on new devices / fresh sessions),
    // then push local → cloud so any offline changes are not lost.
    await syncService.pullAll(user.id);
    return await syncService.syncAll(user.id);
  };

  useEffect(() => {
    if (dbConnected && user && user.id !== DEMO_ADMIN_USER_ID) {
      syncData();
    }
  }, [dbConnected, user?.id]);

  useEffect(() => {
    let subscription: any = null;

    const initialize = async () => {
      await refreshDbConnection();

      // 1. Listen for Supabase Auth changes
      const { data } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
        setSession(session);
        
        if (session?.user) {
          setUser(session.user);

          // Try to load from cache first
          const cachedProfile = await db.settings.get(`profile_${session.user.id}`);
          if (cachedProfile) {
            setProfile(cachedProfile.value);
          }

          const userProfile = await getProfile(session.user.id);
          if (userProfile) {
            setProfile(userProfile);
            await db.settings.put({ key: `profile_${session.user.id}`, value: userProfile });
          }
        } else if (localStorage.getItem(DEMO_ADMIN_STORAGE_KEY) === 'true') {
          await applyDemoAdminAuth();
        } else {
          localStorage.removeItem(DEMO_ADMIN_STORAGE_KEY);
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      if (data?.subscription) {
        subscription = data.subscription;
      }

      // 2. Initial session check
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        setUser(session.user);

        // Try to load from cache first
        const cachedProfile = await db.settings.get(`profile_${session.user.id}`);
        if (cachedProfile) {
          setProfile(cachedProfile.value);
        }

        const userProfile = await getProfile(session.user.id);
        if (userProfile) {
          setProfile(userProfile);
          await db.settings.put({ key: `profile_${session.user.id}`, value: userProfile });
        }
      } else if (localStorage.getItem(DEMO_ADMIN_STORAGE_KEY) === 'true') {
        await applyDemoAdminAuth();
      } else {
        localStorage.removeItem(DEMO_ADMIN_STORAGE_KEY);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    };

    initialize();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem(DEMO_ADMIN_STORAGE_KEY);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  const signInDemoAdmin = async () => {
    setLoading(true);
    await applyDemoAdminAuth();
    setLoading(false);
  };

  const isPro = profile?.plan === 'pro';
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    const initSettings = async () => {
      try {
        // Only run this when authenticated, and suppress errors silently if user doesn't have privileges
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;

        const { data, error } = await supabase
          .from('app_settings')
          .select('key')
          .eq('key', 'ask_ai_access')
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          // Ignore not found or RLS errors
          return;
        }

        if (!data) {
          // The insert will fail gracefully if the RLS policy "Admins can manage app settings" is not met
          // we don't need to await or check the error to prevent uncaught exceptions crashing the app
          supabase
            .from('app_settings')
            .insert({ key: 'ask_ai_access', value: 'admin', updated_at: new Date().toISOString() })
            .then(({error: insertErr}) => {
                if (insertErr) {
                    // Fail silently, expected if not admin
                }
            })
            .catch(() => {});
        }
      } catch (err) {
        // Silent catch to prevent UI disruption
      }
    };
    initSettings();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      signOut, 
      signInDemoAdmin,
      isPro, 
      isAdmin,
      isDemoAdmin,
      dbConnected,
      refreshDbConnection,
      syncData
    } as any}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
