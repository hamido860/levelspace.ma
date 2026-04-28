export type ClassroomCatalogModule = {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  progress: number;
  selected: boolean;
  createdAt: number;
};

type ClassroomCatalogDeps = {
  loadFromSupabase: (params: { grade: string; selectedBacTrackId?: string }) => Promise<ClassroomCatalogModule[]>;
  clearModules: () => Promise<void>;
  saveModules: (modules: ClassroomCatalogModule[]) => Promise<void>;
};

export const createClassroomCatalogSupabaseFirstWithDeps = async (
  deps: ClassroomCatalogDeps,
  params: {
    grade: string;
    selectedBacTrackId?: string;
    generateAiSuggestions?: () => Promise<ClassroomCatalogModule[]>;
  }
) => {
  const supabaseModules = await deps.loadFromSupabase({
    grade: params.grade,
    selectedBacTrackId: params.selectedBacTrackId,
  });

  if (supabaseModules.length > 0) {
    await deps.clearModules();
    await deps.saveModules(supabaseModules);
  }

  let aiSuggestions: ClassroomCatalogModule[] = [];
  if (params.generateAiSuggestions) {
    try {
      aiSuggestions = await params.generateAiSuggestions();
    } catch (error) {
      console.warn('[ClassroomCatalog] Optional AI suggestions failed:', error);
    }
  }

  return { supabaseModules, aiSuggestions };
};
