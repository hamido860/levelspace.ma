import { supabase } from '../db/supabase';
import { Database } from '../types/supabase';

export type Level = Database['public']['Tables']['levels']['Row'];
export type Subject = Database['public']['Tables']['subjects']['Row'];
export type Content = Database['public']['Tables']['content']['Row'];

export const contentService = {
  // Levels
  async getLevels() {
    const { data, error } = await supabase
      .from('levels')
      .select('*')
      .order('order_num', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createLevel(level: Database['public']['Tables']['levels']['Insert']) {
    const { data, error } = await supabase
      .from('levels')
      .insert(level)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLevel(id: string, updates: Database['public']['Tables']['levels']['Update']) {
    const { data, error } = await supabase
      .from('levels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteLevel(id: string) {
    const { error } = await supabase
      .from('levels')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Subjects
  async getSubjects(levelId?: string) {
    let query = supabase.from('subjects').select('*, levels(*)');
    if (levelId) {
      query = query.eq('level_id', levelId);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createSubject(subject: Database['public']['Tables']['subjects']['Insert']) {
    const { data, error } = await supabase
      .from('subjects')
      .insert(subject)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteSubject(id: string) {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Content (Versioned)
  async getContent(subjectId: string, activeOnly = true) {
    let query = supabase
      .from('content')
      .select('*, subjects(*)')
      .eq('subject_id', subjectId);
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('version', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createContent(content: Database['public']['Tables']['content']['Insert']) {
    // If this is active, deactivate other versions of the same subject
    if (content.is_active) {
      await supabase
        .from('content')
        .update({ is_active: false })
        .eq('subject_id', content.subject_id as string);
    }

    const { data, error } = await supabase
      .from('content')
      .insert(content)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateContent(id: string, updates: Database['public']['Tables']['content']['Update']) {
    if (updates.is_active) {
      // Get the current content to find the subject_id
      const { data: current } = await supabase
        .from('content')
        .select('subject_id')
        .eq('id', id)
        .single();
      
      if (current?.subject_id) {
        await supabase
          .from('content')
          .update({ is_active: false })
          .eq('subject_id', current.subject_id);
      }
    }

    const { data, error } = await supabase
      .from('content')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
