import { supabase } from '../db/supabase';

export interface AppSettings {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

export const getAppSettings = async (key: string) => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', key)
    .maybeSingle();
  
  if (error) {
    console.error(`Error fetching app setting ${key}:`, error);
    return null;
  }
  return data;
};

export const updateAppSettings = async (key: string, value: any) => {
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  
  if (error) {
    console.error(`Error updating app setting ${key}:`, error);
    throw error;
  }
  return data;
};
