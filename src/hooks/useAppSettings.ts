import { useState, useEffect } from 'react';
import { supabase } from '../db/supabase';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*');
        
        if (data) {
          const settingsMap = data.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
          }, {});
          setSettings(settingsMap);
        }
      } catch (err) {
        console.error("Error fetching app settings hook:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to changes
    const subscription = supabase
      .channel('app_settings_changes')
      .on('postgres_changes', { event: '*', table: 'app_settings', schema: 'public' }, (payload) => {
        if (payload.new) {
          const newSetting = payload.new as any;
          setSettings(prev => ({ ...prev, [newSetting.key]: newSetting.value }));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { settings, loading };
};
