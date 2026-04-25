import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../db/supabase';

interface AppSettingsContextValue {
  settings: Record<string, any>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({ settings: {}, loading: true });

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('*');
        if (active && data) {
          setSettings(data.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
          }, {}));
        }
      } catch (err) {
        console.error('Error fetching app settings:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSettings();

    // Unique name per effect run — survives React StrictMode's double-invoke
    const channel = supabase
      .channel(`app_settings_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', table: 'app_settings', schema: 'public' }, (payload) => {
        if (active && payload.new) {
          const s = payload.new as any;
          setSettings(prev => ({ ...prev, [s.key]: s.value }));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
