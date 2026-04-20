import { db } from "../db/db";
import { supabase } from "../db/supabase";

export const syncService = {
  syncAll: async (userId: string) => {
    console.log("Starting full cloud sync...");
    const results = {
      modules: 0,
      lessons: 0,
      tasks: 0,
      schedule: 0,
      notes: 0,
      errors: [] as string[]
    };

    try {
      // 1. Sync Modules
      const modules = await db.modules.toArray();
      if (modules.length > 0) {
        const { error } = await supabase.from("modules").upsert(
          modules.map(m => ({
            id: m.id,
            user_id: userId,
            name: m.name,
            code: m.code,
            description: m.description,
            category: m.category,
            progress: m.progress,
            selected: m.selected,
            tags: m.tags || [],
            created_at: new Date(m.createdAt).toISOString()
          }))
        );
        if (error) results.errors.push(`Modules sync error: ${error.message}`);
        else results.modules = modules.length;
      }

      // 2. Sync Lessons (to user_lessons)
      const lessons = await db.lessons.toArray();
      if (lessons.length > 0) {
        const { error } = await supabase.from("user_lessons").upsert(
          lessons.map(l => ({
            id: l.id,
            user_id: userId,
            module_id: l.moduleId,
            title: l.title,
            subtitle: l.subtitle,
            content: l.content,
            blocks: l.blocks,
            status: l.status,
            tags: l.tags || [],
            created_at: new Date(l.createdAt).toISOString()
          }))
        );
        if (error) results.errors.push(`Lessons sync error: ${error.message}`);
        else results.lessons = lessons.length;
      }

      // 3. Sync Tasks
      const tasks = await db.tasks.toArray();
      if (tasks.length > 0) {
        const { error } = await supabase.from("tasks").upsert(
          tasks.map(t => ({
            id: t.id,
            user_id: userId,
            title: t.title,
            completed: t.completed,
            due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
            type: t.type,
            tags: t.tags || [],
            created_at: new Date(t.createdAt).toISOString()
          }))
        );
        if (error) results.errors.push(`Tasks sync error: ${error.message}`);
        else results.tasks = tasks.length;
      }

      // 4. Sync Schedule
      const schedule = await db.schedule.toArray();
      if (schedule.length > 0) {
        const { error } = await supabase.from("schedule").upsert(
          schedule.map(s => ({
            id: s.id,
            user_id: userId,
            date: s.date,
            month: s.month,
            title: s.title,
            time: s.time,
            location: s.location
          }))
        );
        if (error) results.errors.push(`Schedule sync error: ${error.message}`);
        else results.schedule = schedule.length;
      }

      // 5. Sync Notes
      const notes = await db.notes.toArray();
      if (notes.length > 0) {
        const { error } = await supabase.from("notes").upsert(
          notes.map(n => ({
            id: n.id,
            user_id: userId,
            lesson_id: n.lessonId,
            content: n.content,
            created_at: new Date(n.createdAt).toISOString()
          }))
        );
        if (error) results.errors.push(`Notes sync error: ${error.message}`);
        else results.notes = notes.length;
      }

      // 6. Sync Settings
      const settings = await db.settings.toArray();
      if (settings.length > 0) {
        const { error } = await supabase.from("settings").upsert(
          settings.map(s => ({
            key: s.key,
            user_id: userId,
            value: s.value,
            updated_at: new Date().toISOString()
          }))
        );
        if (error) results.errors.push(`Settings sync error: ${error.message}`);
      }

      console.log("Sync completed:", results);
      return results;
    } catch (err: any) {
      console.error("Sync failed:", err);
      results.errors.push(err.message);
      return results;
    }
  }
};
