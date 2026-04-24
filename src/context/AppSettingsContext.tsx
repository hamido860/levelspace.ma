import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../db/supabase';

interface AppSettingsContextValue {
  settings: Record<string, any>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({ settings: {}, loading: true });

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (channelRef.current) return; // already subscribed

    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('*');
        if (data) {
          setSettings(data.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
          }, {}));
        }
      } catch (err) {
        console.error('Error fetching app settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    channelRef.current = supabase
      .channel('app_settings_global')
      .on('postgres_changes', { event: '*', table: 'app_settings', schema: 'public' }, (payload) => {
        if (payload.new) {
          const s = payload.new as any;
          setSettings(prev => ({ ...prev, [s.key]: s.value }));
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
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
