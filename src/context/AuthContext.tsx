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
  signInAsDemoAdmin: () => Promise<void>;
  isPro: boolean;
  isAdmin: boolean;
  dbConnected: boolean | null;
  refreshDbConnection: () => Promise<void>;
  syncData: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  // Demo Admin details for dev mode
  const dummyAdminUser = {
    id: 'demo-admin-id',
    email: 'admin@demo.com',
    app_metadata: {},
    user_metadata: {
      full_name: 'Demo Admin',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
    },
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as unknown as User;

  const dummyAdminProfile = {
    id: 'demo-admin-id',
    plan: 'pro',
    role: 'admin',
    created_at: new Date().toISOString()
  };

  const refreshDbConnection = async () => {
    const connected = await checkSupabaseConnection();
    setDbConnected(connected);
  };

  const syncData = async () => {
    if (!dbConnected || !user || user.id === 'demo-admin-id') {
      return { errors: ['Not connected to cloud or user acting as demo admin'] };
    }
    // Pull cloud → local first (restores lessons on new devices / fresh sessions),
    // then push local → cloud so any offline changes are not lost.
    await syncService.pullAll(user.id);
    return await syncService.syncAll(user.id);
  };

  useEffect(() => {
    if (dbConnected && user && user.id !== 'demo-admin-id') {
      syncData();
    }
  }, [dbConnected, user?.id]);

  useEffect(() => {
    refreshDbConnection();

    // 1. Listen for Supabase Auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
      } else {
        if (localStorage.getItem('demo_admin_logged_in') === 'true') {
          setUser(dummyAdminUser);
          setProfile(dummyAdminProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    // 2. Initial session check
    const initAuth = async () => {
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
      } else {
        if (localStorage.getItem('demo_admin_logged_in') === 'true') {
          setUser(dummyAdminUser);
          setProfile(dummyAdminProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem('demo_admin_logged_in');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  const signInAsDemoAdmin = async () => {
    setLoading(true);
    localStorage.setItem('demo_admin_logged_in', 'true');
    setUser(dummyAdminUser);
    setProfile(dummyAdminProfile);
    setLoading(false);
  };


  const isPro = profile?.plan === 'pro';
  const isAdmin = profile?.role === 'admin' || profile?.plan === 'pro';

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
      signInAsDemoAdmin,
      isPro, 
      isAdmin,
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
