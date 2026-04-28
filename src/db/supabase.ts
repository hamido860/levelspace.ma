import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const runtimeEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) ?? {};
const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.VITE_SUPABASE_ANON_KEY;

// Validate URL format
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// Create a dummy client if credentials are missing or invalid to prevent crashes
const createDummyClient = () => {
  console.warn('Supabase is not configured or invalid credentials provided. Attempting to use server-side proxy.');
  
  const proxyRequest = async (table: string, action: string, data?: any, query?: any) => {
    const url = '/api/supabase/proxy';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, action, data, query })
      });
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        console.error(`Supabase Proxy (URL: ${url}) returned non-JSON response (Status: ${response.status}):`, text.substring(0, 100));
        return { data: null, error: { message: `Server returned non-JSON response (${response.status})` } };
      }
    } catch (err) {
      console.error(`Supabase Proxy Request Failed (URL: ${url}):`, err);
      return { data: null, error: err };
    }
  };

  const noop = (table: string) => {
    const query: any = { select: '*' };
    
    const chain: any = {
      select: (selectStr: string = '*') => {
        query.select = selectStr;
        return chain;
      },
      eq: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'eq', key, val }];
        return chain;
      },
      neq: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'neq', key, val }];
        return chain;
      },
      gt: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'gt', key, val }];
        return chain;
      },
      gte: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'gte', key, val }];
        return chain;
      },
      lt: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'lt', key, val }];
        return chain;
      },
      lte: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'lte', key, val }];
        return chain;
      },
      ilike: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'ilike', key, val }];
        return chain;
      },
      like: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'like', key, val }];
        return chain;
      },
      in: (key: string, val: any[]) => {
        query.filters = [...(query.filters || []), { type: 'in', key, val }];
        return chain;
      },
      contains: (key: string, val: any) => {
        query.filters = [...(query.filters || []), { type: 'contains', key, val }];
        return chain;
      },
      or: (filterStr: string) => {
        query.filters = [...(query.filters || []), { type: 'or', val: filterStr }];
        return chain;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        query.order = { column, ...options };
        return chain;
      },
      limit: (count: number) => {
        query.limit = count;
        return chain;
      },
      single: () => proxyRequest(table, 'select', null, { ...query, single: true }),
      maybeSingle: () => proxyRequest(table, 'select', null, { ...query, maybeSingle: true }),
      insert: (data: any) => ({
        then: (onfulfilled: any) => proxyRequest(table, 'insert', data).then(onfulfilled)
      }),
      update: (data: any) => {
        const updateChain: any = {
          eq: (key: string, val: any) => {
            query.filters = [...(query.filters || []), { type: 'eq', key, val }];
            return updateChain;
          },
          then: (onfulfilled: any) => proxyRequest(table, 'update', data, query).then(onfulfilled)
        };
        return updateChain;
      },
      upsert: (data: any) => ({
        then: (onfulfilled: any) => proxyRequest(table, 'upsert', data).then(onfulfilled)
      }),
      delete: () => {
        const deleteChain: any = {
          eq: (key: string, val: any) => {
            query.filters = [...(query.filters || []), { type: 'eq', key, val }];
            return deleteChain;
          },
          then: (onfulfilled: any) => proxyRequest(table, 'delete', null, query).then(onfulfilled)
        };
        return deleteChain;
      },
      then: (onfulfilled: any) => proxyRequest(table, 'select', null, query).then(onfulfilled),
    };
    
    return chain;
  };

  return {
    from: noop,
    rpc: (fn: string, params?: any) => proxyRequest(null as any, 'rpc', params, { fn }),
    channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }),
    auth: {
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signUp: () => Promise.resolve({ data: null, error: null }),
      signInWithOAuth: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    storage: { from: noop },
  } as any;
};

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  // Running in offline mode or with invalid credentials
}

export const supabase = (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY')
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createDummyClient();

// Helper to check connection
export const checkSupabaseConnection = async () => {
  // 1. Check client-side keys
  if (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
      const { error: authError } = await supabase.auth.getSession();
      if (!authError) return true;
    } catch (err) {
      console.warn('Client-side Supabase check failed, trying proxy...');
    }
  }

  // 2. Check server-side proxy
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    if (data.supabase) {
      console.log('Supabase auto-connected via server-side proxy');
      return true;
    }
  } catch (err) {
    console.error('Server-side Supabase check failed:', err);
  }

  return false;
};

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
};

export const updateProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  
  if (error) throw error;
  return data;
};
