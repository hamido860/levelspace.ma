import React, { useState } from "react";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { supabase, checkSupabaseConnection } from "../db/supabase";
import {
  UploadCloud,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Info,
  Database,
  X,
  Plus,
  Sparkles,
  Copy,
  Settings,
  Trash2,
  Search,
  BookOpen,
  Key,
  Cloud,
  CloudOff,
  Database as DatabaseIcon,
  Terminal,
  Cpu,
  Activity,
  Zap,
  Globe,
  Layers,
  MessageSquare,
  Link,
  FileText,
  Library,
  ListChecks,
  Braces,
  FileJson,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  PlayCircle
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../hooks/useAppSettings";
import { saveLesson, deleteLessonsByScope, deleteLessonById, updateLesson } from "../services/ragService";
import { LessonTemplate, generateFullLesson, generateSyllabus, askAdminAI, getLessonPrompt, getAIStatus, AIStatus, auditCurriculumConfig, CurriculumAuditResult, smartExtractFromResource, evaluateExtractionWeakness, findSimilarResources, ExtractionEvaluation } from "../services/geminiService";
import { aiCrew, AITask } from "../services/aiCrewService";
import { contentService, Level, Subject, Content } from "../services/contentService";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

import ReactMarkdown from "react-markdown";
import { LessonView } from "../components/LessonView";
import { DatabaseFixerModal } from "../components/DatabaseFixerModal";

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [synced, setSynced] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [aiStatus, setAiStatus] = useState<AIStatus>(getAIStatus());
  const [crewTasks, setCrewTasks] = useState<AITask[]>(aiCrew.getTasks());

  useEffect(() => {
    const handleStatusUpdate = (e: any) => {
      setAiStatus(e.detail);
    };
    const handleCrewUpdate = (e: any) => {
      setCrewTasks(e.detail);
    };
    window.addEventListener("ai-status-update", handleStatusUpdate);
    window.addEventListener("ai-crew-update", handleCrewUpdate);
    return () => {
      window.removeEventListener("ai-status-update", handleStatusUpdate);
      window.removeEventListener("ai-crew-update", handleCrewUpdate);
    };
  }, []);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const [isRagModalOpen, setIsRagModalOpen] = useState(false);
  const [ragLessonData, setRagLessonData] = useState("");
  const [isSavingRag, setIsSavingRag] = useState(false);

  // Prompt Builder State
  const [pbCountry, setPbCountry] = useState("");
  const [pbGrade, setPbGrade] = useState("");
  const [pbSubject, setPbSubject] = useState("");
  const [pbTopic, setPbTopic] = useState("");
  const [pbInstruction, setPbInstruction] = useState("");
  const [pbSources, setPbSources] = useState("");
  const [pbFormat, setPbFormat] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);

  // Resource Picker State
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'quick' | 'builder'>('quick');

  const handlePickResource = (url: string) => {
    if (pickerTarget === 'quick') {
      setQgUrls(prev => prev ? `${prev}\n${url}` : url);
    } else {
      setPbSources(prev => prev ? `${prev}\n${url}` : url);
    }
    setIsResourcePickerOpen(false);
    toast.success("Resource added to sources");
  };

  // AI Assistant Tab State
  const [askAiInput, setAskAiInput] = useState("");
  const [askAiResponse, setAskAiResponse] = useState("");
  const [isAskingAi, setIsAskingAi] = useState(false);

  // Quick Generate State
  const [qgCountry, setQgCountry] = useState(localStorage.getItem("selected_country") || "");
  const [qgGrade, setQgGrade] = useState(localStorage.getItem("selected_grade") || "Grade 10");
  const [qgSubject, setQgSubject] = useState(localStorage.getItem("selected_subject") || "");
  const [qgTopic, setQgTopic] = useState("");
  const [qgUrls, setQgUrls] = useState("");
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);

  // Baccalaureate Options State
  const [qgBacSection, setQgBacSection] = useState("");
  const [qgBacTrack, setQgBacTrack] = useState("");
  const [qgBacIntOption, setQgBacIntOption] = useState("");

  const [dbBacSections, setDbBacSections] = useState<any[]>([]);
  const [dbBacTracks, setDbBacTracks] = useState<any[]>([]);
  const [dbBacIntOptions, setDbBacIntOptions] = useState<any[]>([]);
  const [dbBacTrackIntOptions, setDbBacTrackIntOptions] = useState<any[]>([]);
  const [dbBacTrackSubjects, setDbBacTrackSubjects] = useState<any[]>([]);

  // Bulk Generate State
  const [bgSyllabus, setBgSyllabus] = useState("");
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentTopic: "" });
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);

  // Live RAG Viewer State
  const [ragLessons, setRagLessons] = useState<any[]>([]);
  const [isFetchingRag, setIsFetchingRag] = useState(false);
  const [ragSearchTerm, setRagSearchTerm] = useState("");

  // Session Lock State
  const [isSessionLocked, setIsSessionLocked] = useState(false);

  // Test View State
  const [testLesson, setTestLesson] = useState<any | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Audit State
  const [isAuditingConfig, setIsAuditingConfig] = useState(false);
  const [auditConfigResult, setAuditConfigResult] = useState<CurriculumAuditResult | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isDbFixModalOpen, setIsDbFixModalOpen] = useState(false);

  // Inline Editor State
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Drop State
  const [isDropping, setIsDropping] = useState(false);

  // Tabs State
  const [activeTab, setActiveTab] = useState<'creation' | 'curriculum' | 'system' | 'ai' | 'resources'>('creation');

  // App Settings State
  const askAiAccess = settings.ask_ai_access || 'admin';
  const topicGenerationAccess = settings.topic_generation_access || 'admin';
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Resource Library State
  const resources = useLiveQuery(() => db.resources.toArray()) || [];
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  
  // Smart Resource Processor State
  const [smartFile, setSmartFile] = useState<File | null>(null);
  const [smartInstruction, setSmartInstruction] = useState("");
  const [isSmartProcessing, setIsSmartProcessing] = useState(false);
  const [smartExtractedContent, setSmartExtractedContent] = useState<string | null>(null);
  const [smartEvaluation, setSmartEvaluation] = useState<ExtractionEvaluation | null>(null);
  const [smartSimilarResources, setSmartSimilarResources] = useState<string | null>(null);
  const [isSmartResultModalOpen, setIsSmartResultModalOpen] = useState(false);

  const [newResourceType, setNewResourceType] = useState<'url' | 'document' | 'other'>('url');
  const [newResourceCategory, setNewResourceCategory] = useState("");

  const handleAddResource = async () => {
    if (!newResourceUrl) {
      toast.error("Please provide a URL");
      return;
    }

    try {
      await db.resources.add({
        id: crypto.randomUUID(),
        title: newResourceUrl, // Use URL as title
        url: newResourceUrl,
        type: 'url',
        category: 'Web',
        createdAt: Date.now()
      });
      toast.success("Resource saved to library");
      setNewResourceUrl("");
    } catch (err) {
      console.error("Error saving resource:", err);
      toast.error("Failed to save resource");
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      await db.resources.delete(id);
      toast.success("Resource removed");
    } catch (err) {
      console.error("Error deleting resource:", err);
      toast.error("Failed to delete resource");
    }
  };

  // System & Cloud State
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  React.useEffect(() => {
    checkSupabaseConnection().then(setDbConnected);
  }, []);

  // Curriculum Metadata State
  const [dbCountries, setDbCountries] = useState<string[]>([]);
  const [dbGrades, setDbGrades] = useState<Record<string, string[]>>({});
  const [dbSubjects, setDbSubjects] = useState<Record<string, string[]>>({});
  const [dbTopics, setDbTopics] = useState<Record<string, string[]>>({});
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // New Levels/Subjects/Content State
  const [levels, setLevels] = useState<Level[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [isFetchingCurriculum, setIsFetchingCurriculum] = useState(false);

  const [newLevelName, setNewLevelName] = useState("");
  const [newLevelOrder, setNewLevelOrder] = useState(1);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newContentTitle, setNewContentTitle] = useState("");
  const [newContentBody, setNewContentBody] = useState("");
  const [newContentVersion, setNewContentVersion] = useState("1.0");

  const fetchCurriculum = async () => {
    setIsFetchingCurriculum(true);
    try {
      const l = await contentService.getLevels();
      setLevels(l);
      if (l.length > 0 && !selectedLevelId) {
        setSelectedLevelId(l[0].id);
      }
    } catch (err) {
      console.error("Error fetching levels:", err);
    } finally {
      setIsFetchingCurriculum(false);
    }
  };

  const fetchSubjects = async (levelId: string) => {
    try {
      const s = await contentService.getSubjects(levelId);
      setSubjects(s);
      if (s.length > 0) {
        setSelectedSubjectId(s[0].id);
      } else {
        setSelectedSubjectId("");
        setContents([]);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

  const fetchContents = async (subjectId: string) => {
    try {
      const c = await contentService.getContent(subjectId, false);
      setContents(c);
    } catch (err) {
      console.error("Error fetching contents:", err);
    }
  };

  React.useEffect(() => {
    if (selectedLevelId) {
      fetchSubjects(selectedLevelId);
    }
  }, [selectedLevelId]);

  React.useEffect(() => {
    if (selectedSubjectId) {
      fetchContents(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const handleAddLevel = async () => {
    if (!newLevelName) return;
    try {
      await contentService.createLevel({ name: newLevelName, order_num: newLevelOrder });
      toast.success("Level added");
      setNewLevelName("");
      fetchCurriculum();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName || !selectedLevelId) return;
    try {
      await contentService.createSubject({ 
        name: newSubjectName, 
        level_id: selectedLevelId,
        code: newSubjectCode 
      });
      toast.success("Subject added");
      setNewSubjectName("");
      setNewSubjectCode("");
      fetchSubjects(selectedLevelId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddContent = async () => {
    if (!newContentTitle || !selectedSubjectId) return;
    try {
      await contentService.createContent({
        subject_id: selectedSubjectId,
        title: newContentTitle,
        body: newContentBody,
        version: newContentVersion,
        is_active: true,
        created_by: user?.id
      });
      toast.success("Content version added");
      setNewContentTitle("");
      setNewContentBody("");
      setNewContentVersion("1.0");
      fetchContents(selectedSubjectId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fetchAppSettings = async () => {
    // Handled by useAppSettings hook
  };

  const updateAskAiAccess = async (value: 'all' | 'admin') => {
    setIsUpdatingSettings(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ask_ai_access", value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
      if (error) throw error;
      toast.success(`Consult AI access updated to: ${value}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update app settings");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const updateTopicGenerationAccess = async (value: 'all' | 'admin') => {
    setIsUpdatingSettings(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "topic_generation_access", value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
      if (error) throw error;
      toast.success(`Topic generation access updated to: ${value}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update app settings");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleSaveSyllabusToCurriculum = async () => {
    if (!bgSyllabus || !qgGrade || !qgSubject) {
      toast.error("Syllabus, Grade, and Subject are required.");
      return;
    }

    const topics = bgSyllabus.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    if (topics.length === 0) {
      toast.error("No topics found in syllabus.");
      return;
    }

    setIsBulkGenerating(true);
    let savedCount = 0;
    try {
      for (const topic of topics) {
        const existingTopics = dbTopics[`${qgGrade}|${qgSubject}`] || [];
        if (existingTopics.includes(topic)) continue;

        await addMetadata('topic', topic, qgGrade, qgSubject);
        savedCount++;
      }
      toast.success(`Successfully saved ${savedCount} topics to the global taxonomy.`);
      fetchMetadata();
    } catch (err: any) {
      toast.error(`Error saving topics: ${err.message}`);
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const modules = useLiveQuery(() => db.modules.toArray());
  const lessons = useLiveQuery(() => db.lessons.toArray());

  const isDummyUser = user?.id === "dummy-user-id";

  const handleSyncToSupabase = async (moduleId: string) => {
    if (isDummyUser) {
      setError(
        "Cannot sync to Supabase while using Auth Bypass. Please log in with a real account.",
      );
      return;
    }

    setSyncing(moduleId);
    setError(null);
    try {
      const moduleToSync = modules?.find((m) => m.id === moduleId);
      if (!moduleToSync) throw new Error("Module not found locally.");

      // 1. Upsert Module
      const { error: moduleError } = await supabase.from("modules").upsert({
        id: moduleToSync.id,
        user_id: user!.id,
        name: moduleToSync.name,
        code: moduleToSync.code,
        description: moduleToSync.description,
        category: moduleToSync.category,
        progress: moduleToSync.progress,
        selected: moduleToSync.selected,
        tags: moduleToSync.tags || [],
        created_at: new Date(moduleToSync.createdAt).toISOString(),
      });

      if (moduleError) throw moduleError;

      // 2. Upsert Lessons for this module
      const moduleLessons =
        lessons?.filter((l) => l.moduleId === moduleId) || [];

      if (moduleLessons.length > 0) {
        const lessonsToInsert = moduleLessons.map((l) => ({
          id: l.id,
          user_id: user!.id,
          module_id: l.moduleId,
          title: l.title,
          subtitle: l.subtitle,
          content: l.content,
          blocks: l.blocks,
          status: l.status,
          tags: l.tags || [],
          created_at: new Date(l.createdAt).toISOString(),
        }));

        const { error: lessonsError } = await supabase
          .from("user_lessons")
          .upsert(lessonsToInsert);

        if (lessonsError) throw lessonsError;
      }

      setSynced((prev) => ({ ...prev, [moduleId]: true }));
    } catch (err: any) {
      console.error("Sync error:", err);
      setError(err.message || "Failed to sync to Supabase.");
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    if (!modules || modules.length === 0) return;
    setIsSyncingAll(true);
    let successCount = 0;
    for (const module of modules) {
      try {
        await handleSyncToSupabase(module.id);
        successCount++;
      } catch (e) {
        console.error(`Failed to sync module ${module.id}`, e);
      }
    }
    setIsSyncingAll(false);
    toast.success(`Synced ${successCount} modules to cloud.`);
  };

  const handleImport = async () => {
    setImportError(null);
    setImportSuccess(false);
    try {
      const parsed = JSON.parse(importData);
      if (parsed.modules && Array.isArray(parsed.modules)) {
        await db.modules.bulkPut(parsed.modules);
      }
      if (parsed.lessons && Array.isArray(parsed.lessons)) {
        await db.lessons.bulkPut(parsed.lessons);
      }
      setImportSuccess(true);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(false);
        setImportData("");
      }, 2000);
    } catch (e: any) {
      setImportError(e.message || "Invalid JSON format.");
    }
  };

  const handleInsertRagLesson = async () => {
    setIsSavingRag(true);
    try {
      const parsed: LessonTemplate = JSON.parse(ragLessonData);

      // Validate required fields
      if (
        !parsed.country ||
        !parsed.grade ||
        !parsed.subject ||
        !parsed.lesson_title ||
        !parsed.content
      ) {
        throw new Error(
          "Missing required fields: country, grade, subject, lesson_title, or content.",
        );
      }

      const success = await saveLesson(parsed, user?.id, false);
      if (success) {
        toast.success("Lesson inserted into RAG database successfully!");
        setIsRagModalOpen(false);
        setRagLessonData("");
      } else {
        throw new Error("Failed to save lesson to Supabase.");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid JSON format or missing fields.");
    } finally {
      setIsSavingRag(false);
    }
  };

  const handleAskAi = async () => {
    if (!askAiInput.trim()) return;
    setIsAskingAi(true);
    setAskAiResponse("");
    try {
      const context = {
        country: qgCountry,
        grade: qgGrade,
        subject: qgSubject,
        localModulesCount: modules?.length || 0,
        localLessonsCount: lessons?.length || 0,
        ragLessonsCount: ragLessons.length,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      const response = await askAdminAI(askAiInput, context);
      setAskAiResponse(response);
    } catch (err: any) {
      toast.error(err.message || "Failed to get AI response.");
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!qgCountry || !qgGrade || !qgSubject || !qgTopic) {
      toast.error("Please fill in Country, Grade, Subject, and Topic first.");
      return;
    }

    if (qgTopic === "All Topics") {
      const key = `${qgGrade}|${qgSubject}`;
      const topics = dbTopics[key] || [];
      if (topics.length > 0) {
        const prompt = `You are an expert curriculum designer for ${qgCountry}.
I have a list of topics for ${qgGrade} ${qgSubject}:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For EACH of these topics, generate a comprehensive lesson following the official national curriculum standards of ${qgCountry}.
Each lesson should include content, exercises, quizzes, and an exam question.
The output format should be a JSON array of lesson objects.`;

        await navigator.clipboard.writeText(prompt);
        toast.success("Bulk Subject Lessons Prompt copied to clipboard!");
        return;
      } else {
        toast.error("No topics found for the selected grade and subject to generate all.");
        return;
      }
    }

    try {
      // Fetch existing lessons for context (same as handleQuickGenerate)
      const { data: existingLessons } = await supabase
        .from("lessons")
        .select("lesson_title, content")
        .eq("country", qgCountry)
        .eq("grade", qgGrade)
        .eq("subject", qgSubject)
        .limit(5);
      
      let existingContext = undefined;
      if (existingLessons && existingLessons.length > 0) {
        existingContext = existingLessons.map(l => `- ${l.lesson_title}: ${l.content.substring(0, 100)}...`).join('\n');
      }

      const referenceUrls = qgUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const prompt = getLessonPrompt(
        qgTopic,
        qgCountry,
        qgGrade,
        qgSubject,
        "AI Generated Module",
        referenceUrls,
        existingContext,
        true
      );

      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied to clipboard! You can now use it in AI Studio or ChatGPT.");
    } catch (err: any) {
      toast.error("Failed to copy prompt.");
    }
  };

  const handleQuickGenerate = async () => {
    if (!qgCountry || !qgGrade || !qgSubject || !qgTopic) {
      toast.error("Please fill in all required fields (Country, Grade, Subject, Topic).");
      return;
    }

    if (qgTopic === "All Topics") {
      const key = `${qgGrade}|${qgSubject}`;
      const topics = dbTopics[key] || [];
      if (topics.length > 0) {
        setBgSyllabus(topics.join('\n'));
        toast.success("All topics selected. Starting bulk generation...");
        // Use setTimeout to allow state to update before starting bulk generation
        setTimeout(() => {
          handleBulkGenerate();
        }, 100);
        return;
      } else {
        toast.error("No topics found for the selected grade and subject to generate all.");
        return;
      }
    }

    setIsQuickGenerating(true);
    try {
      // Parse URLs
      const referenceUrls = qgUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      // Fetch existing lessons for context
      const { data: existingLessons } = await supabase
        .from("lessons")
        .select("lesson_title, content")
        .eq("country", qgCountry)
        .eq("grade", qgGrade)
        .eq("subject", qgSubject)
        .limit(5);
      
      let existingContext = undefined;
      if (existingLessons && existingLessons.length > 0) {
        existingContext = existingLessons.map(l => `- ${l.lesson_title}: ${l.content.substring(0, 100)}...`).join('\n');
      }

      const lesson = await generateFullLesson(
        qgTopic,
        qgCountry,
        qgGrade,
        qgSubject,
        "AI Generated Module",
        2,
        referenceUrls,
        existingContext,
        true
      );

      if (lesson) {
        const success = await saveLesson(lesson, user?.id, true);
        if (success) {
          toast.success(`Lesson "${lesson.lesson_title}" generated and saved successfully!`);
          setQgTopic(""); // Clear topic for next generation
          setQgUrls(""); // Clear URLs
        } else {
          toast.error("Lesson generated, but failed to save to database.");
        }
      } else {
        toast.error("Failed to generate lesson.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during generation.");
    } finally {
      setIsQuickGenerating(false);
    }
  };

  const handleBuildPrompt = async () => {
    setIsBuildingPrompt(true);
    try {
      let query = supabase.from("lessons").select("lesson_title, content");
      
      if (pbCountry) query = query.eq("country", pbCountry);
      if (pbGrade) query = query.eq("grade", pbGrade);
      if (pbSubject) query = query.eq("subject", pbSubject);
      
      // Limit to avoid massive prompts
      query = query.limit(5);

      const { data: existingLessons, error } = await query;

      let prompt = "";
      
      // Context
      const contextParts = [];
      if (pbCountry) contextParts.push(`Country: ${pbCountry}`);
      if (pbGrade) contextParts.push(`Grade: ${pbGrade}`);
      if (pbSubject) contextParts.push(`Subject: ${pbSubject}`);
      
      if (pbTopic === "All Topics") {
        const key = `${pbGrade}|${pbSubject}`;
        const topics = dbTopics[key] || [];
        if (topics.length > 0) {
          contextParts.push(`Topics: ${topics.join(', ')}`);
        } else {
          contextParts.push(`Topic: ${pbTopic}`);
        }
      } else if (pbTopic) {
        contextParts.push(`Topic: ${pbTopic}`);
      }
      
      if (contextParts.length > 0) {
        prompt += `TARGET CONTEXT:\n${contextParts.join(', ')}\n\n`;
      }

      if (pbInstruction) {
        prompt += `INSTRUCTION:\n${pbInstruction}\n\n`;
      }

      if (existingLessons && existingLessons.length > 0) {
        prompt += `EXISTING CONTEXT (Do not duplicate, use for alignment):\n`;
        existingLessons.forEach(l => {
          prompt += `- ${l.lesson_title}: ${l.content.substring(0, 200)}...\n`;
        });
        prompt += `\n`;
      }

      if (pbSources) {
        prompt += `SOURCES:\nBase your response strictly on the following sources:\n${pbSources}\n\n`;
      }

      if (pbFormat) {
        prompt += `OUTPUT FORMAT:\n${pbFormat}\n`;
      }

      setGeneratedPrompt(prompt);
      setIsPromptModalOpen(true);
    } catch (err) {
      toast.error("Failed to build prompt.");
    } finally {
      setIsBuildingPrompt(false);
    }
  };

  const handleCopySyllabusPrompt = async () => {
    if (!qgCountry || !qgGrade || !qgSubject) {
      toast.error("Please fill in Country, Grade, and Subject first.");
      return;
    }

    const referenceUrls = qgUrls
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    const prompt = `You are an expert curriculum designer for ${qgCountry}.
Generate a comprehensive syllabus/topic list for ${qgGrade} ${qgSubject}.
Return ONLY a list of topics, one per line. Do not include numbers, bullet points, or introductory text. Just the raw topic names.
Make it logically ordered from beginning of the year to end of the year.
${referenceUrls && referenceUrls.length > 0 ? `Base your syllabus on these official guidelines: ${referenceUrls.join(', ')}` : ''}`;

    await navigator.clipboard.writeText(prompt);
    toast.success("Syllabus prompt copied to clipboard!");
  };

  const handleCopyBulkTopicJsonPrompt = async () => {
    if (!qgCountry || !qgGrade || !qgSubject) {
      toast.error("Please fill in Country, Grade, and Subject first.");
      return;
    }

    const referenceUrls = qgUrls
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    const prompt = `You are an expert curriculum designer for ${qgCountry}.
Generate a comprehensive syllabus/topic list for ${qgGrade} ${qgSubject}.
The output MUST be a valid JSON array of strings, where each string is a topic name.
Topics should be logically ordered from the beginning of the year to the end.
Example: ["Topic 1", "Topic 2", "Topic 3"]
Return ONLY the JSON array.
${referenceUrls && referenceUrls.length > 0 ? `Base your syllabus on these official guidelines: ${referenceUrls.join(', ')}` : ''}`;

    await navigator.clipboard.writeText(prompt);
    toast.success("Bulk Topic JSON Prompt copied to clipboard!");
  };

  const handleCopySubjectLessonsPrompt = async () => {
    if (!qgCountry || !qgGrade || !qgSubject || !bgSyllabus) {
      toast.error("Please fill in Country, Grade, Subject, and Syllabus first.");
      return;
    }

    const topics = bgSyllabus.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    if (topics.length === 0) {
      toast.error("No topics found in syllabus.");
      return;
    }

    const prompt = `You are an expert curriculum designer for ${qgCountry}.
I have a list of topics for ${qgGrade} ${qgSubject}:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For EACH of these topics, generate a comprehensive lesson following the official national curriculum standards of ${qgCountry}.
Each lesson should include content, exercises, quizzes, and an exam question.
The output format should be a JSON array of lesson objects.`;

    await navigator.clipboard.writeText(prompt);
    toast.success("Subject Lessons Prompt copied to clipboard!");
  };

  const handleSelectAllTopics = () => {
    const key = `${qgGrade}|${qgSubject}`;
    const topics = dbTopics[key] || [];
    if (topics.length > 0) {
      setBgSyllabus(topics.join('\n'));
      toast.success("All topics selected for bulk generation!");
    } else {
      toast.error("No topics found for the selected grade and subject.");
    }
  };

  const handleGenerateSyllabus = async () => {
    if (!qgCountry || !qgGrade || !qgSubject) {
      toast.error("Please fill in Country, Grade, and Subject first.");
      return;
    }
    setIsGeneratingSyllabus(true);
    try {
      const referenceUrls = qgUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const syllabus = await generateSyllabus(qgCountry, qgGrade, qgSubject, referenceUrls);
      if (syllabus) {
        setBgSyllabus(syllabus);
        toast.success("Syllabus generated successfully!");
      } else {
        toast.error("Failed to generate syllabus.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate syllabus.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!qgCountry || !qgGrade || !qgSubject || !bgSyllabus) {
      toast.error("Please fill in Country, Grade, Subject, and Syllabus.");
      return;
    }

    setIsBulkGenerating(true);
    try {
      // 1. Break down syllabus into topics
      const topics = bgSyllabus.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      setBulkProgress({ current: 0, total: topics.length, currentTopic: "" });

      if (topics.length === 0) {
        toast.error("No valid topics found in syllabus.");
        setIsBulkGenerating(false);
        return;
      }

      // Parse URLs
      const referenceUrls = qgUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      // Fetch existing lessons for context
      const { data: existingLessons } = await supabase
        .from("lessons")
        .select("lesson_title, content")
        .eq("country", qgCountry)
        .eq("grade", qgGrade)
        .eq("subject", qgSubject)
        .limit(5);
      
      let existingContext = undefined;
      if (existingLessons && existingLessons.length > 0) {
        existingContext = existingLessons.map(l => `- ${l.lesson_title}: ${l.content.substring(0, 100)}...`).join('\n');
      }

      let successCount = 0;
      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        setBulkProgress({ current: i + 1, total: topics.length, currentTopic: topic });
        
        try {
          const lesson = await generateFullLesson(
            topic,
            qgCountry,
            qgGrade,
            qgSubject,
            "AI Generated Module",
            2,
            referenceUrls,
            existingContext,
            true
          );

          if (lesson) {
            const success = await saveLesson(lesson, user?.id, true);
            if (success) {
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Failed to generate lesson for topic: ${topic}`, err);
          // Continue to next topic even if one fails
        }
      }

      toast.success(`Successfully generated and saved ${successCount} out of ${topics.length} lessons!`);
      setBgSyllabus("");
      fetchRagLessons(); // Refresh the viewer
    } catch (err: any) {
      toast.error(err.message || "An error occurred during bulk generation.");
    } finally {
      setIsBulkGenerating(false);
      setBulkProgress({ current: 0, total: 0, currentTopic: "" });
    }
  };

  const delegateToCrew = async (type: AITask["type"], payload: any) => {
    try {
      await aiCrew.addTask(type, payload);
      toast.success(`Task delegated to AI Crew: ${type}`);
    } catch (err: any) {
      toast.error(`Delegation failed: ${err.message}`);
    }
  };

  const fetchRagLessons = async () => {
    setIsFetchingRag(true);
    try {
      let query = supabase.from("lessons").select("*").order("created_at", { ascending: false }).limit(50);
      
      if (qgCountry) query = query.ilike("country", `%${qgCountry}%`);
      if (qgGrade) query = query.ilike("grade", `%${qgGrade}%`);
      if (qgSubject) query = query.ilike("subject", `%${qgSubject}%`);
      if (ragSearchTerm) query = query.ilike("lesson_title", `%${ragSearchTerm}%`);

      const { data, error } = await query;
      
      if (error) throw error;
      setRagLessons(data || []);
    } catch (err: any) {
      console.error("Error fetching RAG lessons:", err);
      toast.error("Failed to fetch RAG database lessons.");
    } finally {
      setIsFetchingRag(false);
    }
  };

  const handleFetchRag = fetchRagLessons;

  // Session Lock Persistence
  useEffect(() => {
    if (isSessionLocked) {
      localStorage.setItem("admin_session_country", qgCountry);
      localStorage.setItem("admin_session_grade", qgGrade);
      localStorage.setItem("admin_session_subject", qgSubject);
    }
  }, [isSessionLocked, qgCountry, qgGrade, qgSubject]);

  // CRUD Handlers
  const handleDropSession = async () => {
    if (!isSessionLocked || !qgCountry || !qgGrade || !qgSubject) return;
    
    const confirm = window.confirm(`DANGER: This will delete ALL lessons for ${qgCountry} > ${qgGrade} > ${qgSubject}. Are you sure?`);
    if (!confirm) return;

    setIsDropping(true);
    try {
      const success = await deleteLessonsByScope(qgCountry, qgGrade, qgSubject);
      if (success) {
        toast.success("Session content purged successfully.");
        fetchRagLessons();
      } else {
        toast.error("Failed to purge session content.");
      }
    } catch (err) {
      toast.error("An error occurred during purge.");
    } finally {
      setIsDropping(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    const confirm = window.confirm("Delete this lesson node?");
    if (!confirm) return;

    try {
      const success = await deleteLessonById(id);
      if (success) {
        toast.success("Node deleted.");
        fetchRagLessons();
      } else {
        toast.error("Failed to delete node.");
      }
    } catch (err) {
      toast.error("Error deleting node.");
    }
  };

  const handleTestLesson = (lesson: any) => {
    setTestLesson(lesson);
    setIsTestModalOpen(true);
  };

  const handleEditLesson = (lesson: any) => {
    setEditingLesson({ ...lesson });
    setIsEditModalOpen(true);
  };

  const handleUpdateLesson = async () => {
    if (!editingLesson) return;

    try {
      const success = await updateLesson(editingLesson.id, editingLesson);
      if (success) {
        toast.success("Node updated and re-indexed.");
        setIsEditModalOpen(false);
        fetchRagLessons();
      } else {
        toast.error("Failed to update node.");
      }
    } catch (err) {
      toast.error("Error updating node.");
    }
  };

  const handleAuditConfig = async () => {
    if (!qgCountry || !qgGrade || !qgSubject) {
      toast.error("Please select at least Country, Grade, and Subject to audit.");
      return;
    }

    setIsAuditingConfig(true);
    try {
      const sectionName = dbBacSections.find(s => s.id === qgBacSection)?.name || "";
      const trackName = dbBacTracks.find(t => t.id === qgBacTrack)?.name || "";
      
      const result = await auditCurriculumConfig(
        qgCountry,
        qgGrade,
        sectionName,
        trackName,
        qgSubject,
        qgUrls ? qgUrls.split('\n').filter(url => url.trim() !== '') : []
      );

      if (result) {
        setAuditConfigResult(result);
        setIsAuditModalOpen(true);
      } else {
        toast.error("Failed to run audit. Please try again.");
      }
    } catch (err) {
      toast.error("An error occurred during the audit.");
    } finally {
      setIsAuditingConfig(false);
    }
  };

  // Fetch curriculum metadata from Supabase
  const fetchMetadata = async () => {
    setIsFetchingMetadata(true);
    try {
      const { data: curriculaData, error: curriculaError } = await supabase.from('curricula').select('id, country');
      
      if (curriculaError) {
        console.warn("Curricula table not found or error fetching, using local defaults.", curriculaError);
        return;
      }

      const countries = curriculaData?.map(i => i.country) || [];
      const gradesMap: Record<string, string[]> = {};
      const subjectsMap: Record<string, string[]> = {};
      const topicsMap: Record<string, string[]> = {};
      
      const { data: cyclesData } = await supabase.from('cycles').select('id, curriculum_id');
      const { data: gradesData } = await supabase.from('grades').select('id, cycle_id, name');
      
      if (curriculaData && cyclesData && gradesData) {
        curriculaData.forEach(curriculum => {
          const countryCycles = cyclesData.filter(c => c.curriculum_id === curriculum.id);
          const countryGrades = gradesData.filter(g => countryCycles.some(c => c.id === g.cycle_id));
          gradesMap[curriculum.country] = countryGrades.map(g => g.name);
        });
      }

      const { data: subjectsData } = await supabase.from('subjects').select('id, name');
      const { data: gradeSubjectsData } = await supabase.from('grade_subjects').select('grade_id, subject_id');

      if (gradesData && subjectsData && gradeSubjectsData) {
        gradesData.forEach(grade => {
          const gradeSubjectIds = gradeSubjectsData.filter(gs => gs.grade_id === grade.id).map(gs => gs.subject_id);
          const gradeSubjectNames = subjectsData.filter(s => gradeSubjectIds.includes(s.id)).map(s => s.name);
          subjectsMap[grade.name] = gradeSubjectNames;
        });
      }

      const { data: topicsData } = await supabase.from('topics').select('grade_id, subject_id, title');
      if (gradesData && subjectsData && topicsData) {
        topicsData.forEach(topic => {
          const grade = gradesData.find(g => g.id === topic.grade_id)?.name;
          const subject = subjectsData.find(s => s.id === topic.subject_id)?.name;
          if (grade && subject) {
            const key = `${grade}|${subject}`;
            if (!topicsMap[key]) topicsMap[key] = [];
            topicsMap[key].push(topic.title);
          }
        });
      }

      setDbCountries(countries);
      setDbSubjects(subjectsMap);
      setDbGrades(gradesMap);
      setDbTopics(topicsMap);

      // Fetch Baccalaureate options
      try {
        const { data: sectionsData } = await supabase.from('bac_sections').select('*');
        if (sectionsData) setDbBacSections(sectionsData);
        
        const { data: tracksData } = await supabase.from('bac_tracks').select('*');
        if (tracksData) setDbBacTracks(tracksData);
        
        const { data: intOptionsData } = await supabase.from('bac_international_options').select('*');
        if (intOptionsData) setDbBacIntOptions(intOptionsData);
        
        const { data: trackIntOptionsData } = await supabase.from('bac_track_international_options').select('*');
        if (trackIntOptionsData) setDbBacTrackIntOptions(trackIntOptionsData);

        const { data: trackSubjectsData } = await supabase.from('bac_track_subjects').select('track_id, subject_id, subjects(name)');
        if (trackSubjectsData) setDbBacTrackSubjects(trackSubjectsData);
      } catch (e) {
        console.warn("Baccalaureate tables not found or error fetching", e);
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const addMetadata = async (type: 'country' | 'grade' | 'subject' | 'topic' | 'bac_section' | 'bac_track' | 'track_subject', name: string, parent_name?: string, second_parent_name?: string) => {
    if (!name && type !== 'track_subject') return;
    
    try {
      if (type === 'country') {
        const { error } = await supabase.from('curricula').insert({ country: name, name: name });
        if (error) throw error;
      } else if (type === 'grade') {
        if (!parent_name) throw new Error("Country is required for grade");
        // Get curriculum
        const { data: curricula } = await supabase.from('curricula').select('id').eq('country', parent_name).single();
        if (!curricula) throw new Error("Country not found");
        
        // Get or create cycle
        let cycleId;
        const { data: cycles } = await supabase.from('cycles').select('id').eq('curriculum_id', curricula.id).limit(1);
        if (cycles && cycles.length > 0) {
          cycleId = cycles[0].id;
        } else {
          const { data: newCycle, error: cycleError } = await supabase.from('cycles').insert({ curriculum_id: curricula.id, name: 'Default Cycle' }).select('id').single();
          if (cycleError) throw cycleError;
          cycleId = newCycle.id;
        }
        
        const { error } = await supabase.from('grades').insert({ cycle_id: cycleId, name: name });
        if (error) throw error;
      } else if (type === 'subject') {
        if (!parent_name) throw new Error("Grade is required for subject");
        
        // Get grade
        const { data: grades } = await supabase.from('grades').select('id').eq('name', parent_name).limit(1);
        if (!grades || grades.length === 0) throw new Error("Grade not found");
        const gradeId = grades[0].id;
        
        // Get or create subject
        let subjectId;
        const { data: subjects } = await supabase.from('subjects').select('id').eq('name', name).limit(1);
        if (subjects && subjects.length > 0) {
          subjectId = subjects[0].id;
        } else {
          const { data: newSubject, error: subjectError } = await supabase.from('subjects').insert({ name: name }).select('id').single();
          if (subjectError) throw subjectError;
          subjectId = newSubject.id;
        }
        
        const { error } = await supabase.from('grade_subjects').insert({ grade_id: gradeId, subject_id: subjectId });
        if (error) throw error;
      } else if (type === 'topic') {
        if (!parent_name || !second_parent_name) throw new Error("Grade and Subject are required for topic");
        
        // Get grade
        const { data: grades } = await supabase.from('grades').select('id').eq('name', parent_name).limit(1);
        if (!grades || grades.length === 0) throw new Error("Grade not found");
        const gradeId = grades[0].id;
        
        // Get subject
        const { data: subjects } = await supabase.from('subjects').select('id').eq('name', second_parent_name).limit(1);
        if (!subjects || subjects.length === 0) throw new Error("Subject not found");
        const subjectId = subjects[0].id;
        
        const { error } = await supabase.from('topics').insert({ 
          grade_id: gradeId, 
          subject_id: subjectId, 
          title: name 
        });
        if (error) throw error;
      } else if (type === 'bac_section') {
        const { error } = await supabase.from('bac_sections').insert({ name: name });
        if (error) throw error;
      } else if (type === 'bac_track') {
        if (!parent_name) throw new Error("Section is required for track");
        const { error } = await supabase.from('bac_tracks').insert({ name: name, section_id: parent_name });
        if (error) throw error;
      } else if (type === 'track_subject') {
        if (!parent_name || !second_parent_name) throw new Error("Track and Subject are required");
        const { error } = await supabase.from('bac_track_subjects').insert({ track_id: parent_name, subject_id: second_parent_name });
        if (error) throw error;
      }

      toast.success(`${type} ${name || ''} added successfully`);
      fetchMetadata();
    } catch (err: any) {
      console.error(`Error adding ${type}:`, err);
      toast.error(`Failed to add ${type}: ${err.message}`);
    }
  };

  const deleteMetadata = async (name: string, type: 'country' | 'grade' | 'subject' | 'topic' | 'bac_section' | 'bac_track' | 'track_subject', parent_name?: string, second_parent_name?: string) => {
    try {
      if (type === 'country') {
        const { data: curricula } = await supabase.from('curricula').select('id').eq('country', name).single();
        if (curricula) {
          const { data: cycles } = await supabase.from('cycles').select('id').eq('curriculum_id', curricula.id);
          if (cycles && cycles.length > 0) {
            const cycleIds = cycles.map(c => c.id);
            const { data: grades } = await supabase.from('grades').select('id').in('cycle_id', cycleIds);
            if (grades && grades.length > 0) {
              const gradeIds = grades.map(g => g.id);
              await supabase.from('grade_subjects').delete().in('grade_id', gradeIds);
              await supabase.from('topics').delete().in('grade_id', gradeIds);
              await supabase.from('grades').delete().in('cycle_id', cycleIds);
            }
            await supabase.from('cycles').delete().in('curriculum_id', curricula.id);
          }
          await supabase.from('curricula').delete().eq('id', curricula.id);
        }
      } else if (type === 'grade') {
        const { data: grades } = await supabase.from('grades').select('id').eq('name', name);
        if (grades && grades.length > 0) {
          const gradeIds = grades.map(g => g.id);
          await supabase.from('grade_subjects').delete().in('grade_id', gradeIds);
          await supabase.from('topics').delete().in('grade_id', gradeIds);
          await supabase.from('grades').delete().in('id', gradeIds);
        }
      } else if (type === 'subject') {
        if (parent_name) {
          const { data: grades } = await supabase.from('grades').select('id').eq('name', parent_name).limit(1);
          if (grades && grades.length > 0) {
            const gradeId = grades[0].id;
            const { data: subjects } = await supabase.from('subjects').select('id').eq('name', name).limit(1);
            if (subjects && subjects.length > 0) {
              const subjectId = subjects[0].id;
              await supabase.from('grade_subjects').delete().eq('grade_id', gradeId).eq('subject_id', subjectId);
              await supabase.from('topics').delete().eq('grade_id', gradeId).eq('subject_id', subjectId);
            }
          }
        } else {
          const { data: subjects } = await supabase.from('subjects').select('id').eq('name', name);
          if (subjects && subjects.length > 0) {
            const subjectIds = subjects.map(s => s.id);
            await supabase.from('grade_subjects').delete().in('subject_id', subjectIds);
            await supabase.from('topics').delete().in('subject_id', subjectIds);
            await supabase.from('subjects').delete().in('id', subjectIds);
          }
        }
      } else if (type === 'topic') {
        if (!parent_name || !second_parent_name) throw new Error("Grade and Subject are required for topic");
        
        // Get grade
        const { data: grades } = await supabase.from('grades').select('id').eq('name', parent_name).limit(1);
        if (!grades || grades.length === 0) throw new Error("Grade not found");
        const gradeId = grades[0].id;
        
        // Get subject
        const { data: subjects } = await supabase.from('subjects').select('id').eq('name', second_parent_name).limit(1);
        if (!subjects || subjects.length === 0) throw new Error("Subject not found");
        const subjectId = subjects[0].id;
        
        await supabase.from('topics').delete().eq('grade_id', gradeId).eq('subject_id', subjectId).eq('title', name);
      } else if (type === 'bac_section') {
        await supabase.from('bac_sections').delete().eq('name', name);
      } else if (type === 'bac_track') {
        await supabase.from('bac_tracks').delete().eq('name', name);
      } else if (type === 'track_subject') {
        if (!parent_name || !second_parent_name) throw new Error("Track and Subject are required");
        await supabase.from('bac_track_subjects').delete().eq('track_id', parent_name).eq('subject_id', second_parent_name);
      }
      
      toast.success(`${type} deleted successfully`);
      fetchMetadata();
    } catch (err: any) {
      console.error(`Error deleting ${type}:`, err);
      toast.error(`Failed to delete ${type}: ${err.message}`);
    }
  };

  const [newCountry, setNewCountry] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newGradeCountry, setNewGradeCountry] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newSubjectCountry, setNewSubjectCountry] = useState("");
  const [newSubjectGrade, setNewSubjectGrade] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newTopicCountry, setNewTopicCountry] = useState("");
  const [newTopicGrade, setNewTopicGrade] = useState("");
  const [newTopicSubject, setNewTopicSubject] = useState("");

  // Baccalaureate Metadata State
  const [newBacSection, setNewBacSection] = useState("");
  const [newBacTrack, setNewBacTrack] = useState("");
  const [newBacTrackSection, setNewBacTrackSection] = useState("");
  const [newTrackSubjectTrack, setNewTrackSubjectTrack] = useState("");
  const [newTrackSubjectSubject, setNewTrackSubjectSubject] = useState("");

  const handleSeedMorocco = async () => {
    setIsFetchingMetadata(true);
    try {
      // 1. Add Country
      const { data: existingCountry } = await supabase.from('curricula').select('id').eq('country', 'Morocco').single();
      if (!existingCountry) {
        await supabase.from('curricula').insert({ country: 'Morocco', name: 'Morocco' });
      }
      
      // 2. Add Grades
      const grades = ["Tronc Commun", "1ère année Bac", "2ème année Bac"];
      for (const g of grades) {
        try { await addMetadata('grade', g, 'Morocco'); } catch (e) {}
      }
      
      // 3. Add Sections
      const sections = ["Scientifique", "Littéraire", "Technologique"];
      for (const s of sections) {
        try { await addMetadata('bac_section', s); } catch (e) {}
      }
      
      // 4. Add Tracks
      const { data: dbSections } = await supabase.from('bac_sections').select('*');
      if (dbSections) {
        const sci = dbSections.find(s => s.name === 'Scientifique')?.id;
        const lit = dbSections.find(s => s.name === 'Littéraire')?.id;
        const tech = dbSections.find(s => s.name === 'Technologique')?.id;
        
        if (sci) {
          try { await addMetadata('bac_track', 'Sciences Mathématiques A/B', sci); } catch (e) {}
          try { await addMetadata('bac_track', 'Sciences Expérimentales', sci); } catch (e) {}
        }
        if (lit) {
          try { await addMetadata('bac_track', 'Lettres', lit); } catch (e) {}
          try { await addMetadata('bac_track', 'Sciences Humaines', lit); } catch (e) {}
        }
      }

      // 5. Add Subjects & Map to Tracks
      const subjects = ["Mathématiques", "Physique-Chimie", "Sciences de la Vie et de la Terre (SVT)", "Français", "Informatique"];
      const { data: dbTracks } = await supabase.from('bac_tracks').select('*');
      const smTrack = dbTracks?.find(t => t.name === 'Sciences Mathématiques A/B')?.id;
      
      for (const s of subjects) {
        // Add to global subjects
        let subjectId;
        const { data: existingSub } = await supabase.from('subjects').select('id').eq('name', s).limit(1);
        if (existingSub && existingSub.length > 0) {
          subjectId = existingSub[0].id;
        } else {
          const { data: newSub } = await supabase.from('subjects').insert({ name: s }).select('id').single();
          subjectId = newSub?.id;
        }
        
        // Map to SM track
        if (smTrack && subjectId) {
          try { await addMetadata('track_subject', '', smTrack, subjectId); } catch (e) {}
        }
      }

      toast.success("Moroccan curriculum seeded successfully!");
      fetchMetadata();
    } catch (err) {
      console.error("Error seeding Morocco:", err);
      toast.error("Failed to seed Moroccan curriculum.");
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  // Fetch when context changes
  React.useEffect(() => {
    fetchRagLessons();
    localStorage.setItem("selected_country", qgCountry);
    localStorage.setItem("selected_grade", qgGrade);
    localStorage.setItem("selected_subject", qgSubject);
  }, [qgCountry, qgGrade, qgSubject, ragSearchTerm]);

  React.useEffect(() => {
    fetchMetadata();
    fetchAppSettings();
    fetchCurriculum();
  }, []);

  const availableCountries = dbCountries;
  const availableSubjects = Object.keys(dbSubjects).length > 0 ? Array.from(new Set(Object.values(dbSubjects).flat())) : [];
  const availableGrades = (qgCountry && dbGrades[qgCountry]) || [];

  const handleSmartProcess = async () => {
    if (!smartFile || !smartInstruction.trim()) {
      toast.error("Please provide both a file and an instruction.");
      return;
    }

    setIsSmartProcessing(true);
    setSmartExtractedContent(null);
    setSmartEvaluation(null);
    setSmartSimilarResources(null);

    try {
      // 1. Convert File to Base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 part
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(smartFile);
      const fileData = await fileDataPromise;

      // 2. Extract Content
      toast.info("Extracting content...");
      const extracted = await smartExtractFromResource(fileData, smartFile.type, smartInstruction);
      if (!extracted) throw new Error("Failed to extract content.");
      setSmartExtractedContent(extracted);

      // 3. Evaluate Weakness
      toast.info("Evaluating extraction quality...");
      const evaluation = await evaluateExtractionWeakness(extracted, smartInstruction);
      if (!evaluation) throw new Error("Failed to evaluate extraction.");
      setSmartEvaluation(evaluation);

      // 4. Find Similar Resources if insufficient
      if (!evaluation.isSufficient && evaluation.weaknesses.length > 0) {
        toast.info("Finding similar resources to fill gaps...");
        const similar = await findSimilarResources(smartInstruction, evaluation.weaknesses);
        if (similar) {
          setSmartSimilarResources(similar);
        }
      }

      setIsSmartResultModalOpen(true);
      toast.success("Smart processing complete!");
    } catch (error: any) {
      console.error("Smart processing error:", error);
      toast.error(`Smart processing failed: ${error.message}`);
    } finally {
      setIsSmartProcessing(false);
    }
  };

  return (
    <Layout fullWidth>
      <SEO title="Admin Control Center" />
      <div className="w-full space-y-6 bg-background p-4 md:p-6">
        {/* Header Section - High-Density Utility Aesthetic */}
        <div 
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-paper p-6 rounded-2xl border border-surface-mid shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          
          <div className="relative space-y-1">
            <div className="flex items-center gap-2 text-accent">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">System Core v2.4</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-ink tracking-tight">Admin Control Center</h1>
            <p className="text-xs text-ink-muted max-w-lg">
              Centralized command for curriculum architecture, AI generation pipelines, and cloud synchronization.
            </p>
          </div>

          <div className="relative flex items-center gap-6">
            {/* Session Lock UI */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-300 ${isSessionLocked ? 'bg-accent/5 border-accent/20 shadow-sm' : 'bg-surface-low border-surface-mid'}`}>
              <div className={`w-2 h-2 rounded-full ${isSessionLocked ? 'bg-accent animate-pulse' : 'bg-ink-muted'}`} />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-ink-muted uppercase tracking-widest">Session Lock</span>
                <span className="text-[10px] font-bold text-ink-secondary truncate max-w-[150px]">
                  {isSessionLocked ? `${qgCountry} • ${qgGrade} • ${qgSubject}` : 'No Active Session'}
                </span>
              </div>
              <button
                onClick={() => setIsSessionLocked(!isSessionLocked)}
                disabled={!qgCountry || !qgGrade || !qgSubject}
                className={`ml-2 px-3 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 ${isSessionLocked ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-surface-mid text-ink-secondary hover:bg-surface-high'}`}
              >
                {isSessionLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>

            <div className="w-px h-8 bg-surface-mid" />

            <button
              onClick={() => setIsDbFixModalOpen(true)}
              className="px-4 py-2 bg-warning/10 text-warning rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-warning/20 transition-all flex items-center gap-2"
            >
              <DatabaseIcon size={14} />
              Fix DB Schema
            </button>

            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">Supabase Status</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-success shadow-[0_0_8px_rgba(45,122,79,0.3)]' : 'bg-error shadow-[0_0_8px_rgba(192,57,43,0.3)]'}`} />
                <span className="text-[12px] font-semibold text-ink">{dbConnected ? 'Operational' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Compact Pill Aesthetic */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-surface-low border border-surface-mid rounded-xl w-fit">
          {[
            { id: 'ai', label: 'AI Intelligence', icon: <Sparkles size={14} /> },
            { id: 'creation', label: 'Data Pipeline', icon: <Activity size={14} /> },
            { id: 'curriculum', label: 'Taxonomy', icon: <Layers size={14} /> },
            { id: 'resources', label: 'Resource Library', icon: <Library size={14} /> },
            { id: 'system', label: 'System Config', icon: <Terminal size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-ink text-paper shadow-md shadow-ink/10' 
                  : 'text-ink-muted hover:text-ink hover:bg-surface-mid'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {isDummyUser && (
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-3 bg-paper shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <AlertCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Auth Bypass Active</h4>
                <p className="text-[11px] text-amber-700/80 leading-relaxed">
                  You are currently using a bypassed test account. To save content to Supabase, you must disable the bypass and log in with a real account.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-2 text-rose-500 text-xs font-medium shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} />
                <span className="break-words">{error}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(error);
                  toast.success("Error message copied!");
                }}
                className="p-1 hover:bg-rose-500/10 rounded transition-all shrink-0"
                title="Copy Error"
              >
                <Copy size={12} />
              </button>
            </div>
          )}

        {activeTab === 'creation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-background p-6 rounded-2xl border border-surface-mid shadow-sm">
            {/* Generation Controls - High-Density Utility Aesthetic */}
            <div className="lg:col-span-1 space-y-6 bg-paper p-6 rounded-2xl border border-surface-mid shadow-sm">
              <div className="bg-paper border border-surface-mid rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                
                <div className="relative space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                      <Zap size={20} />
                    </div>
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink">Quick Generate</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Country</label>
                        <select
                          value={qgCountry}
                          onChange={(e) => setQgCountry(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all appearance-none"
                        >
                          <option value="">Select Country</option>
                          {availableCountries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Grade</label>
                        <select
                          value={qgGrade}
                          onChange={(e) => setQgGrade(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all appearance-none"
                          disabled={!qgCountry}
                        >
                          <option value="">Select Grade</option>
                          {availableGrades.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {qgCountry === 'Morocco' && (qgGrade.includes('Bac') || qgGrade.includes('Tronc Commun')) && (
                      <div className="space-y-3 p-3 bg-surface-low rounded-xl border border-surface-mid">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Section</label>
                          <select
                            value={qgBacSection}
                            onChange={(e) => {
                              setQgBacSection(e.target.value);
                              setQgBacTrack("");
                              setQgBacIntOption("");
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-paper text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all appearance-none"
                          >
                            <option value="">Select Section</option>
                            {dbBacSections.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {qgBacSection && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Track</label>
                            <select
                              value={qgBacTrack}
                              onChange={(e) => {
                                setQgBacTrack(e.target.value);
                                setQgBacIntOption("");
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-paper text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all appearance-none"
                            >
                              <option value="">Select Track</option>
                              {dbBacTracks.filter(t => t.section_id === qgBacSection).map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {qgBacTrack && dbBacTrackIntOptions.some(tio => tio.track_id === qgBacTrack) && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">International Option</label>
                            <select
                              value={qgBacIntOption}
                              onChange={(e) => setQgBacIntOption(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-paper text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all appearance-none"
                            >
                              <option value="">Select Option</option>
                              {dbBacIntOptions.filter(io => 
                                dbBacTrackIntOptions.some(tio => tio.track_id === qgBacTrack && tio.international_option_id === io.id)
                              ).map((io) => (
                                <option key={io.id} value={io.id}>{io.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">Subject</label>
                        <button
                          onClick={handleAuditConfig}
                          disabled={isAuditingConfig || !qgCountry || !qgGrade || !qgSubject}
                          className="text-[9px] font-bold text-accent hover:text-accent-hover flex items-center gap-1 uppercase tracking-widest disabled:opacity-50"
                        >
                          {isAuditingConfig ? <Loader2 size={10} className="animate-spin" /> : <Activity size={10} />}
                          Audit Config
                        </button>
                      </div>
                      <select
                        value={qgSubject}
                        onChange={(e) => setQgSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all appearance-none"
                        disabled={!qgGrade}
                      >
                        <option value="">Select Subject</option>
                        {(() => {
                          let subjectsToDisplay = qgGrade && dbSubjects[qgGrade] ? dbSubjects[qgGrade] : availableSubjects;
                          
                          // Filter by track if track is selected and we have track_subjects mapping
                          if (qgBacTrack && dbBacTrackSubjects.length > 0) {
                            const trackSubjectNames = dbBacTrackSubjects
                              .filter(ts => ts.track_id === qgBacTrack && ts.subjects)
                              .map(ts => ts.subjects.name);
                            
                            if (trackSubjectNames.length > 0) {
                              subjectsToDisplay = subjectsToDisplay.filter(s => trackSubjectNames.includes(s));
                            }
                          }
                          
                          return subjectsToDisplay.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">Topic</label>
                        <button
                          onClick={handleGenerateSyllabus}
                          disabled={isGeneratingSyllabus || !qgCountry || !qgGrade || !qgSubject}
                          className="text-[9px] font-bold text-accent hover:text-accent-hover flex items-center gap-1 uppercase tracking-widest disabled:opacity-50"
                        >
                          {isGeneratingSyllabus ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                          AI Generate Topics
                        </button>
                      </div>
                      <input
                        type="text"
                        value={qgTopic}
                        onChange={(e) => setQgTopic(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        placeholder="e.g., Cellular Respiration"
                        list="topics-list"
                      />
                      <datalist id="topics-list">
                        <option value="All Topics" />
                        {((qgGrade && qgSubject && dbTopics[`${qgGrade}|${qgSubject}`]) ? dbTopics[`${qgGrade}|${qgSubject}`] : []).map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">Reference URLs</label>
                        <button
                          onClick={() => {
                            setPickerTarget('quick');
                            setIsResourcePickerOpen(true);
                          }}
                          className="text-[9px] font-bold text-accent hover:text-accent-hover flex items-center gap-1 uppercase tracking-widest"
                        >
                          <Library size={10} />
                          Pick from Library
                        </button>
                      </div>
                      <textarea
                        value={qgUrls}
                        onChange={(e) => setQgUrls(e.target.value)}
                        className="w-full h-20 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                        placeholder="Comma-separated URLs..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleQuickGenerate}
                      disabled={isQuickGenerating || isDummyUser}
                      className="flex-1 py-3 bg-accent text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-accent-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20 active:scale-[0.98]"
                    >
                      {isQuickGenerating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap size={16} />
                          Execute Generation
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCopyPrompt}
                      className="px-4 py-3 bg-surface-mid text-ink-secondary rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-surface-high transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                      title="Copy prompt to generate outside the app"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => {
                        const referenceUrls = qgUrls.split(',').map(u => u.trim()).filter(u => u.length > 0);
                        delegateToCrew('lesson_generation', {
                          topic: qgTopic,
                          country: qgCountry,
                          grade: qgGrade,
                          subject: qgSubject,
                          moduleName: "AI Generated Module",
                          referenceUrls,
                          isAdmin: true
                        });
                      }}
                      disabled={!qgCountry || !qgGrade || !qgSubject || !qgTopic}
                      className="px-4 py-3 bg-accent/10 text-accent rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-accent/20 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] border border-accent/20"
                      title="Delegate this generation to the AI Crew"
                    >
                      <Users size={16} />
                    </button>
                    <button
                      onClick={() => {
                        const referenceUrls = qgUrls.split(',').map(u => u.trim()).filter(u => u.length > 0);
                        const prompt = getLessonPrompt(qgTopic, qgCountry, qgGrade, qgSubject, "AI Generated Module", referenceUrls, undefined, true);
                        setGeneratedPrompt(prompt);
                        setIsPromptModalOpen(true);
                      }}
                      className="px-4 py-3 bg-surface-mid text-ink-secondary rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-surface-high transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                      title="View prompt"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-ink text-paper rounded-2xl shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
                
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-accent">
                    <Database size={20} />
                  </div>
                  <div>
                    <h2 className="text-[12px] font-bold uppercase tracking-widest">Bulk Pipeline</h2>
                    <p className="text-[9px] text-paper/40 uppercase tracking-wider">Dataset Generator</p>
                  </div>
                </div>

                <div className="relative space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-bold text-paper/40 uppercase tracking-widest">Syllabus Input</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveSyllabusToCurriculum}
                        disabled={isBulkGenerating || !bgSyllabus || !qgGrade || !qgSubject}
                        className="text-[9px] font-bold text-success hover:text-success/80 flex items-center gap-1 transition-colors disabled:opacity-30"
                        title="Save these topics to the global curriculum taxonomy"
                      >
                        <Database size={10} />
                        Save to Taxonomy
                      </button>
                      <button
                        onClick={handleSelectAllTopics}
                        disabled={!qgCountry || !qgGrade || !qgSubject}
                        className="text-[9px] font-bold text-paper/40 hover:text-paper/60 flex items-center gap-1 transition-colors disabled:opacity-30"
                        title="Select all topics for this subject"
                      >
                        <ListChecks size={10} />
                        Select All
                      </button>
                      <button
                        onClick={handleCopySyllabusPrompt}
                        disabled={!qgCountry || !qgGrade || !qgSubject}
                        className="text-[9px] font-bold text-paper/40 hover:text-paper/60 flex items-center gap-1 transition-colors disabled:opacity-30"
                        title="Copy syllabus prompt"
                      >
                        <Copy size={10} />
                        Prompt
                      </button>
                      <button
                        onClick={handleCopyBulkTopicJsonPrompt}
                        disabled={!qgCountry || !qgGrade || !qgSubject}
                        className="text-[9px] font-bold text-paper/40 hover:text-paper/60 flex items-center gap-1 transition-colors disabled:opacity-30"
                        title="Copy JSON syllabus prompt"
                      >
                        <Braces size={10} />
                        JSON Prompt
                      </button>
                      <button
                        onClick={handleCopySubjectLessonsPrompt}
                        disabled={!qgCountry || !qgGrade || !qgSubject || !bgSyllabus}
                        className="text-[9px] font-bold text-paper/40 hover:text-paper/60 flex items-center gap-1 transition-colors disabled:opacity-30"
                        title="Copy subject lessons prompt"
                      >
                        <FileJson size={10} />
                        Lessons Prompt
                      </button>
                      <button
                        onClick={() => {
                          const referenceUrls = qgUrls.split(',').map(u => u.trim()).filter(u => u.length > 0);
                          delegateToCrew('syllabus_generation', {
                            country: qgCountry,
                            grade: qgGrade,
                            subject: qgSubject,
                            referenceUrls
                          });
                        }}
                        disabled={!qgCountry || !qgGrade || !qgSubject}
                        className="text-[9px] font-bold text-accent hover:text-accent/80 flex items-center gap-1 transition-colors disabled:opacity-30"
                        title="Delegate syllabus generation to AI Crew"
                      >
                        <Users size={10} />
                        Crew
                      </button>
                      <button
                        onClick={handleGenerateSyllabus}
                        disabled={isGeneratingSyllabus || !qgCountry || !qgGrade || !qgSubject}
                        className="text-[9px] font-bold text-accent hover:text-accent/80 flex items-center gap-2 transition-colors disabled:opacity-30"
                      >
                        {isGeneratingSyllabus ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        Auto-Draft
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={bgSyllabus}
                    onChange={(e) => setBgSyllabus(e.target.value)}
                    className="w-full h-32 px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-paper font-mono text-[11px] leading-relaxed focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                    placeholder="Topic 01&#10;Topic 02&#10;Topic 03..."
                  />
                </div>

                {isBulkGenerating && bulkProgress.total > 0 && (
                  <div className="relative p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                      <span className="text-paper/60">Progress: {bulkProgress.current} / {bulkProgress.total}</span>
                      <span className="text-accent">{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-accent h-full transition-all duration-500 shadow-[0_0_8px_rgba(18,70,255,0.4)]" 
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-paper/40 truncate font-mono">Current: {bulkProgress.currentTopic}</p>
                  </div>
                )}

                <button
                  onClick={handleBulkGenerate}
                  disabled={isBulkGenerating || isDummyUser || !bgSyllabus.trim()}
                  className="relative w-full py-3 bg-white/10 text-paper rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.98]"
                >
                  {isBulkGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Streaming...
                    </>
                  ) : (
                    <>
                      <Activity size={16} />
                      Start Pipeline
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RAG Database Viewer - High-Density Grid Aesthetic */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-paper border border-surface-mid rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                <div className="p-6 border-b border-surface-mid flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-accent">
                      <Globe size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Global Registry</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-ink">RAG Knowledge Base</h2>
                    <p className="text-xs text-ink-muted">Viewing indexed nodes for current context filters.</p>
                  </div>
                  
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleFetchRag}
                        className="p-2.5 bg-surface-mid text-ink-secondary rounded-xl hover:bg-surface-high transition-all active:scale-95"
                        title="Refresh Registry"
                      >
                        <Activity size={16} />
                      </button>
                      <button
                        onClick={handleDropSession}
                        disabled={!isSessionLocked || isDropping}
                        className="px-4 py-2.5 bg-error/10 text-error rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-error/20 transition-all flex items-center gap-2 disabled:opacity-30 active:scale-95"
                        title="Drop all content in current session"
                      >
                        {isDropping ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Drop Session
                      </button>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                        <input
                          type="text"
                          placeholder="Filter by title..."
                          value={ragSearchTerm}
                          onChange={(e) => setRagSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        />
                      </div>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-low/50 border-b border-surface-mid">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-bold text-ink-muted uppercase tracking-widest">Lesson Node</th>
                        <th className="px-4 py-4 text-[9px] font-bold text-ink-muted uppercase tracking-widest">Context</th>
                        <th className="px-4 py-4 text-[9px] font-bold text-ink-muted uppercase tracking-widest">Origin</th>
                        <th className="px-6 py-4 text-[9px] font-bold text-ink-muted uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-mid">
                      {isFetchingRag ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-50">
                              <Loader2 size={32} className="animate-spin text-accent" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">Syncing with Cloud...</p>
                            </div>
                          </td>
                        </tr>
                      ) : ragLessons.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-20">
                              <Database size={48} className="text-ink-muted" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">No nodes found in current scope</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        ragLessons.map((lesson) => (
                          <tr key={lesson.id} className="group hover:bg-surface-low/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <p className="text-[13px] font-semibold text-ink group-hover:text-accent transition-colors">{lesson.lesson_title}</p>
                                <p className="text-[9px] text-ink-muted font-mono uppercase tracking-tight">{lesson.id.slice(0, 12)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-surface-mid text-[9px] font-bold text-ink-secondary uppercase tracking-tight">{lesson.country}</span>
                                <span className="px-2 py-0.5 rounded-md bg-surface-mid text-[9px] font-bold text-ink-secondary uppercase tracking-tight">{lesson.grade}</span>
                                <span className="px-2 py-0.5 rounded-md bg-surface-mid text-[9px] font-bold text-ink-secondary uppercase tracking-tight">{lesson.subject}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {lesson.is_ai_generated ? (
                                <div className="flex items-center gap-1.5 text-accent">
                                  <Sparkles size={12} />
                                  <span className="text-[9px] font-bold uppercase tracking-widest">Synthetic</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-success">
                                  <CheckCircle2 size={12} />
                                  <span className="text-[9px] font-bold uppercase tracking-widest">Verified</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleTestLesson(lesson)}
                                  className="p-2 text-ink-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                                  title="Test View (User View)"
                                >
                                  <Globe size={14} />
                                </button>
                                <button
                                  onClick={() => handleEditLesson(lesson)}
                                  className="p-2 text-ink-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                                  title="Surgical Edit"
                                >
                                  <Settings size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  className="p-2 text-ink-muted hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                  title="Delete Node"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-6 bg-surface-low/50 border-t border-surface-mid flex items-center justify-between">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">Total Nodes: {ragLessons.length}</p>
                  <button
                    onClick={() => setIsRagModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.98]"
                  >
                    <Plus size={14} />
                    Insert Manual Node
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metadata Controls - High-Density Utility Aesthetic */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-paper border border-surface-mid rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                
                <div className="relative space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                      <Layers size={20} />
                    </div>
                    <div>
                      <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink">Global Taxonomy</h2>
                      <p className="text-[9px] text-ink-muted uppercase tracking-wider">Curriculum Definition</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Countries */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Add Country</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCountry}
                          onChange={(e) => setNewCountry(e.target.value)}
                          placeholder="e.g., France"
                          className="flex-1 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        />
                        <button
                          onClick={() => { addMetadata('country', newCountry); setNewCountry(""); }}
                          className="p-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95]"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Grades */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Add Grade</label>
                      <div className="space-y-2">
                        <select
                          value={newGradeCountry}
                          onChange={(e) => setNewGradeCountry(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        >
                          <option value="">Select Country...</option>
                          {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newGrade}
                            onChange={(e) => setNewGrade(e.target.value)}
                            placeholder="e.g., Grade 12"
                            className="flex-1 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          />
                          <button
                            onClick={() => { addMetadata('grade', newGrade, newGradeCountry); setNewGrade(""); }}
                            disabled={!newGradeCountry}
                            className="p-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95] disabled:opacity-50"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Subjects */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Add Subject</label>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={newSubjectCountry}
                            onChange={(e) => setNewSubjectCountry(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          >
                            <option value="">Country...</option>
                            {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select
                            value={newSubjectGrade}
                            onChange={(e) => setNewSubjectGrade(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          >
                            <option value="">Grade...</option>
                            {(newSubjectCountry ? (dbGrades[newSubjectCountry] || []) : []).map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="e.g., Physics"
                            className="flex-1 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          />
                          <button
                            onClick={() => { addMetadata('subject', newSubject, newSubjectGrade); setNewSubject(""); }}
                            disabled={!newSubjectCountry || !newSubjectGrade}
                            className="p-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95] disabled:opacity-50"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Topics */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Add Topic</label>
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={newTopicCountry}
                            onChange={(e) => setNewTopicCountry(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          >
                            <option value="">Country...</option>
                            {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={newTopicGrade}
                              onChange={(e) => setNewTopicGrade(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                            >
                              <option value="">Grade...</option>
                              {(newTopicCountry ? (dbGrades[newTopicCountry] || []) : []).map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                            <select
                              value={newTopicSubject}
                              onChange={(e) => setNewTopicSubject(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                            >
                              <option value="">Subject...</option>
                              {(newTopicGrade ? (dbSubjects[newTopicGrade] || []) : []).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTopic}
                            onChange={(e) => setNewTopic(e.target.value)}
                            placeholder="e.g., Cellular Respiration"
                            className="flex-1 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          />
                          <button
                            onClick={() => { addMetadata('topic', newTopic, newTopicGrade, newTopicSubject); setNewTopic(""); }}
                            disabled={!newTopicCountry || !newTopicGrade || !newTopicSubject}
                            className="p-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95] disabled:opacity-50"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-px bg-surface-mid my-4" />
                    <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em] mb-2">Baccalaureate Architecture</h3>

                    {/* Bac Sections */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Add Bac Section</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newBacSection}
                          onChange={(e) => setNewBacSection(e.target.value)}
                          placeholder="e.g., Scientifique"
                          className="flex-1 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        />
                        <button
                          onClick={() => { addMetadata('bac_section', newBacSection); setNewBacSection(""); }}
                          className="p-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95]"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Bac Tracks */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Add Bac Track</label>
                      <div className="space-y-2">
                        <select
                          value={newBacTrackSection}
                          onChange={(e) => setNewBacTrackSection(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        >
                          <option value="">Select Section...</option>
                          {dbBacSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newBacTrack}
                            onChange={(e) => setNewBacTrack(e.target.value)}
                            placeholder="e.g., Sciences Mathématiques A"
                            className="flex-1 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          />
                          <button
                            onClick={() => { addMetadata('bac_track', newBacTrack, newBacTrackSection); setNewBacTrack(""); }}
                            disabled={!newBacTrackSection}
                            className="p-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95] disabled:opacity-50"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Track Subject Mapping */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Map Subject to Track</label>
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={newTrackSubjectTrack}
                            onChange={(e) => setNewTrackSubjectTrack(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          >
                            <option value="">Select Track...</option>
                            {dbBacTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <select
                            value={newTrackSubjectSubject}
                            onChange={(e) => setNewTrackSubjectSubject(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                          >
                            <option value="">Select Subject...</option>
                            {availableSubjects.map(s => {
                              const sub = Object.values(dbSubjects).flat().find(sub => sub === s);
                              // This is a bit tricky because dbSubjects is Record<string, string[]>
                              // Let's just use the flat list of unique names
                              return <option key={s} value={s}>{s}</option>;
                            })}
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            // Need to find subject ID by name
                            const { data: subData } = await supabase.from('subjects').select('id').eq('name', newTrackSubjectSubject).limit(1);
                            if (subData && subData.length > 0) {
                              addMetadata('track_subject', '', newTrackSubjectTrack, subData[0].id);
                            } else {
                              toast.error("Subject not found in database.");
                            }
                          }}
                          disabled={!newTrackSubjectTrack || !newTrackSubjectSubject}
                          className="w-full py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.95] disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest"
                        >
                          Link Subject to Track
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Connection Status Card */}
              <div className="p-6 bg-paper border border-surface-mid rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${aiStatus.lastError ? 'bg-error-soft text-error' : 'bg-success-soft text-success'}`}>
                      {aiStatus.isLocal ? <Cpu size={20} /> : <Cloud size={20} />}
                    </div>
                    <div>
                      <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink">AI Pipeline</h2>
                      <p className="text-[9px] text-ink-muted uppercase tracking-wider">
                        {aiStatus.isLocal ? 'Local Mode (Ollama)' : 'Cloud Mode (Gemini)'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${aiStatus.lastError ? 'bg-error-soft text-error' : 'bg-success-soft text-success'}`}>
                    {aiStatus.lastError ? 'Error' : 'Healthy'}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-ink-muted uppercase tracking-widest font-bold">Active Model</span>
                    <span className="text-ink font-mono bg-surface-low px-2 py-0.5 rounded border border-surface-mid">
                      {aiStatus.lastModel}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-ink-muted uppercase tracking-widest font-bold">Last Sync</span>
                    <span className="text-ink-muted">
                      {new Date(aiStatus.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {aiStatus.lastError && (
                    <div className="p-3 bg-error-soft border border-error/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-error text-[9px] font-bold uppercase tracking-widest">
                          <AlertCircle size={12} />
                          Pipeline Error
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(aiStatus.lastError || "");
                            toast.success("Error message copied!");
                          }}
                          className="p-1 hover:bg-error/10 rounded transition-all text-error"
                          title="Copy Error"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <p className="text-[10px] text-error/80 leading-relaxed font-medium break-words">
                        {aiStatus.lastError}
                      </p>
                    </div>
                  )}

                  {!aiStatus.lastError && !aiStatus.isLocal && (
                    <div className="p-3 bg-success-soft border border-success/10 rounded-xl flex items-center gap-2">
                      <Zap size={12} className="text-success" />
                      <span className="text-[9px] text-success font-bold uppercase tracking-widest">Online & Ready</span>
                    </div>
                  )}

                  {aiStatus.isLocal && (
                    <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl flex items-center gap-2">
                      <Cpu size={12} className="text-accent" />
                      <span className="text-[9px] text-accent font-bold uppercase tracking-widest">Local Fallback Active</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-ink text-paper rounded-2xl shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 -translate-x-1/2 blur-3xl" />
                
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-accent">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <h2 className="text-[12px] font-bold uppercase tracking-widest">System Sync</h2>
                    <p className="text-[9px] text-paper/40 uppercase tracking-wider">Database Utilities</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-paper hover:bg-white/10 transition-all text-left flex items-center justify-between group">
                    Validate Taxonomy
                    <Activity size={14} className="opacity-0 group-hover:opacity-100 transition-all text-accent" />
                  </button>
                  <button className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-paper hover:bg-white/10 transition-all text-left flex items-center justify-between group">
                    Export Schema
                    <Layers size={14} className="opacity-0 group-hover:opacity-100 transition-all text-accent" />
                  </button>
                  <button 
                    onClick={handleSeedMorocco}
                    disabled={isFetchingMetadata}
                    className="w-full py-3 px-4 bg-accent/20 border border-accent/30 rounded-xl text-[10px] font-bold uppercase tracking-widest text-accent hover:bg-accent/30 transition-all text-left flex items-center justify-between group disabled:opacity-50"
                  >
                    Seed Moroccan Curriculum
                    {isFetchingMetadata ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} className="opacity-0 group-hover:opacity-100 transition-all" />}
                  </button>
                </div>
              </div>

              {/* Prompt Builder Card */}
              <div className="p-6 bg-paper border border-surface-mid rounded-2xl shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center text-accent">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink">Prompt Builder</h2>
                    <p className="text-[9px] text-ink-muted uppercase tracking-wider">Advanced Generation</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Search Keys (Optional)</label>
                    <div className="grid grid-cols-1 gap-2">
                      <select
                        value={pbCountry}
                        onChange={(e) => setPbCountry(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                      >
                        <option value="">Any Country</option>
                        {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={pbGrade}
                        onChange={(e) => setPbGrade(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                      >
                        <option value="">Any Grade</option>
                        {(pbCountry ? (dbGrades[pbCountry] || []) : Object.values(dbGrades).flat()).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <select
                        value={pbSubject}
                        onChange={(e) => setPbSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                      >
                        <option value="">Any Subject</option>
                        {(pbGrade && dbSubjects[pbGrade] ? dbSubjects[pbGrade] : availableSubjects).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <select
                        value={pbTopic}
                        onChange={(e) => setPbTopic(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                        disabled={!pbGrade || !pbSubject}
                      >
                        <option value="">Any Topic</option>
                        <option value="All Topics">All Topics</option>
                        {(pbGrade && pbSubject && dbTopics[`${pbGrade}|${pbSubject}`] ? dbTopics[`${pbGrade}|${pbSubject}`] : []).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Instruction for AI</label>
                    <textarea
                      value={pbInstruction}
                      onChange={(e) => setPbInstruction(e.target.value)}
                      className="w-full h-20 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                      placeholder="e.g., Generate a lesson about..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">Sources (Optional)</label>
                      <button
                        onClick={() => {
                          setPickerTarget('builder');
                          setIsResourcePickerOpen(true);
                        }}
                        className="text-[9px] font-bold text-accent hover:text-accent-hover flex items-center gap-1 uppercase tracking-widest"
                      >
                        <Library size={10} />
                        Pick from Library
                      </button>
                    </div>
                    <textarea
                      value={pbSources}
                      onChange={(e) => setPbSources(e.target.value)}
                      className="w-full h-16 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                      placeholder="Paste URLs or text..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Output Format</label>
                    <input
                      type="text"
                      value={pbFormat}
                      onChange={(e) => setPbFormat(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink-secondary focus:outline-none focus:border-accent/50 transition-all"
                      placeholder="e.g., JSON Schema, Markdown..."
                    />
                  </div>

                  <button
                    onClick={handleBuildPrompt}
                    disabled={isBuildingPrompt}
                    className="w-full py-3 bg-accent text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-accent-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20 active:scale-[0.98]"
                  >
                    {isBuildingPrompt ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Terminal size={16} />
                        Generate Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Taxonomy Registry - High-Density Grid Aesthetic */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-paper border border-surface-mid rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                <div className="p-6 border-b border-surface-mid flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-accent">
                      <Globe size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Taxonomy Registry</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-ink">Curriculum Architecture</h2>
                    <p className="text-xs text-ink-muted">Managing global taxonomy for lesson categorization.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 rounded-xl bg-surface-low border border-surface-mid text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                      Live Sync Active
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Countries List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-surface-mid pb-2">
                        <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Countries</h3>
                        <span className="text-[10px] font-mono font-bold text-accent">{dbCountries.length}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {dbCountries.map(c => (
                          <div key={c} className="group flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 transition-all">
                            <span className="text-[12px] font-semibold text-ink">{c}</span>
                            <button
                              onClick={() => deleteMetadata(c, 'country')}
                              className="p-1.5 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Grades List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-surface-mid pb-2">
                        <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Grades</h3>
                        <span className="text-[10px] font-mono font-bold text-accent">{Object.values(dbGrades).flat().length}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(dbGrades).map(([country, grades]) => (
                          <div key={country} className="space-y-2">
                            <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest px-2">{country}</span>
                            <div className="space-y-1.5">
                              {grades.map(g => (
                                <div key={g} className="group flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 transition-all">
                                  <span className="text-[12px] font-semibold text-ink">{g}</span>
                                  <button
                                    onClick={() => deleteMetadata(g, 'grade', country)}
                                    className="p-1.5 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subjects List */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center justify-between border-b border-surface-mid pb-2">
                        <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Subjects</h3>
                        <span className="text-[10px] font-mono font-bold text-accent">{Object.values(dbSubjects).flat().length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(dbSubjects).map(([parent, subjects]) => (
                          <div key={parent} className="space-y-3">
                            <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest px-2">{parent}</span>
                            <div className="grid grid-cols-1 gap-1.5">
                              {subjects.map(s => (
                                <div key={s} className="group flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 transition-all">
                                  <span className="text-[12px] font-semibold text-ink">{s}</span>
                                  <button
                                    onClick={() => deleteMetadata(s, 'subject', parent)}
                                    className="p-1.5 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Baccalaureate Registry */}
                    <div className="md:col-span-2 space-y-6 pt-6 border-t border-surface-mid">
                      <div className="flex items-center gap-2 text-accent">
                        <BookOpen size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Baccalaureate Registry</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sections */}
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest border-b border-surface-mid pb-2">Sections</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {dbBacSections.map(s => (
                              <div key={s.id} className="group flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 transition-all">
                                <span className="text-[12px] font-semibold text-ink">{s.name}</span>
                                <button
                                  onClick={() => deleteMetadata(s.id, 'bac_section')}
                                  className="p-1.5 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tracks */}
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest border-b border-surface-mid pb-2">Tracks</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {dbBacTracks.map(t => {
                              const section = dbBacSections.find(s => s.id === t.section_id)?.name;
                              return (
                                <div key={t.id} className="group flex flex-col p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 transition-all">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-semibold text-ink">{t.name}</span>
                                    <button
                                      onClick={() => deleteMetadata(t.id, 'bac_track')}
                                      className="p-1.5 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <span className="text-[9px] font-bold text-accent uppercase tracking-widest">{section || 'No Section'}</span>
                                  
                                  {/* Track Subjects */}
                                  <div className="mt-2 pt-2 border-t border-surface-mid/50 flex flex-wrap gap-1">
                                    {dbBacTrackSubjects.filter(ts => ts.track_id === t.id).map((ts, idx) => (
                                      <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-accent/5 rounded-md text-[9px] text-accent font-medium group/sub">
                                        {ts.subjects?.name || 'Unknown'}
                                        <button 
                                          onClick={() => deleteMetadata('', 'track_subject', t.id, ts.subject_id)}
                                          className="hover:text-error transition-colors"
                                        >
                                          <X size={8} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Topics List */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center justify-between border-b border-surface-mid pb-2">
                        <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Topics</h3>
                        <span className="text-[10px] font-mono font-bold text-accent">{Object.values(dbTopics).flat().length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(dbTopics).map(([key, topics]) => {
                          const [grade, subject] = key.split('|');
                          return (
                            <div key={key} className="space-y-3">
                              <div className="flex flex-col px-2">
                                <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">{grade}</span>
                                <span className="text-[8px] font-bold text-accent uppercase tracking-widest">{subject}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                {topics.map(t => (
                                  <div key={t} className="group flex items-center justify-between p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 transition-all">
                                    <span className="text-[12px] font-semibold text-ink">{t}</span>
                                    <button
                                      onClick={() => deleteMetadata(t, 'topic', grade, subject)}
                                      className="p-1.5 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 bg-surface-low/50 border-t border-surface-mid flex items-center justify-between">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em]">Live Taxonomy Nodes Active</p>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-ink-muted hover:text-ink transition-colors bg-paper border border-surface-mid rounded-lg shadow-sm">
                      <Activity size={16} />
                    </button>
                    <button className="p-2 text-ink-muted hover:text-ink transition-colors bg-paper border border-surface-mid rounded-lg shadow-sm">
                      <Globe size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Context Fingerprint - Technical Aesthetic */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-ink text-paper border border-white/10 rounded-xl p-4 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-accent/20 transition-colors" />
                
                <div className="relative space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-accent">
                      <Terminal size={16} />
                    </div>
                    <div>
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-paper">Context Fingerprint</h2>
                      <p className="text-[8px] text-paper/40 uppercase tracking-wider">Active Session Metadata</p>
                    </div>
                  </div>

                  <div className="space-y-2 font-mono text-[10px]">
                    {[
                      { label: 'Region', value: qgCountry || 'NULL' },
                      { label: 'Grade', value: qgGrade || 'NULL' },
                      { label: 'Subject', value: qgSubject || 'NULL' },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-paper/40 uppercase tracking-widest text-[8px]">{item.label}</span>
                        <span className="text-accent font-bold">{item.value}</span>
                      </div>
                    ))}
                    
                    <div className="h-px bg-white/10 my-2" />
                    
                    {[
                      { label: 'Local Modules', value: modules?.length || 0 },
                      { label: 'Local Lessons', value: lessons?.length || 0 },
                      { label: 'RAG Nodes', value: ragLessons.length },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-1">
                        <span className="text-paper/40 uppercase tracking-widest text-[8px]">{item.label}</span>
                        <span className="text-paper font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                    <p className="text-[9px] text-paper/60 leading-relaxed italic">
                      "The AI engine utilizes this fingerprint to ground responses in verified curriculum data and local context."
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-paper border border-surface-mid rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-ink">
                  <Info size={14} className="text-accent" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest">System Intelligence</h3>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Consult AI searches the RAG database and analyzes local content to provide accurate reports and generation assistance.
                </p>
              </div>

              {/* AI Crew - Multi-Agent Task Management */}
              <div className="bg-paper border border-surface-mid rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-surface-mid bg-surface-low/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                      <Users size={16} />
                    </div>
                    <div>
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-ink">AI Crew</h2>
                      <p className="text-[8px] text-ink-muted uppercase tracking-wider">Multi-Agent Task Queue</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => aiCrew.clearCompleted()}
                      className="text-[8px] font-bold text-ink-muted hover:text-error uppercase tracking-widest transition-colors"
                    >
                      Clear Completed
                    </button>
                    <button 
                      onClick={() => aiCrew.clearAll()}
                      className="text-[8px] font-bold text-ink-muted hover:text-error uppercase tracking-widest transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">
                  {crewTasks.length === 0 ? (
                    <div className="py-8 text-center space-y-2 opacity-30">
                      <Clock size={24} className="mx-auto text-ink-muted" />
                      <p className="text-[9px] font-bold uppercase tracking-widest">No active tasks</p>
                    </div>
                  ) : (
                    crewTasks.slice().reverse().map((task) => (
                      <div key={task.id} className="p-3 bg-surface-low rounded-xl border border-surface-mid space-y-2 group transition-all hover:border-accent/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {task.status === 'running' ? (
                              <Loader2 size={12} className="animate-spin text-accent" />
                            ) : task.status === 'completed' ? (
                              <CheckCircle size={12} className="text-success" />
                            ) : task.status === 'failed' ? (
                              <AlertTriangle size={12} className="text-error" />
                            ) : (
                              <Clock size={12} className="text-ink-muted" />
                            )}
                            <span className="text-[10px] font-bold text-ink uppercase tracking-wider">
                              {task.type.replace('_', ' ')}
                            </span>
                          </div>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                            task.status === 'completed' ? 'bg-success/10 text-success' :
                            task.status === 'failed' ? 'bg-error/10 text-error' :
                            task.status === 'running' ? 'bg-accent/10 text-accent' :
                            'bg-ink/5 text-ink-muted'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[8px] font-mono text-ink-muted">
                          <span>ID: {task.id.substring(0, 8)}</span>
                          <span>{new Date(task.updatedAt).toLocaleTimeString()}</span>
                        </div>

                        {task.error && (
                          <p className="text-[9px] text-error bg-error/5 p-2 rounded-lg border border-error/10 font-mono italic">
                            Error: {task.error}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Chat Interface - Modern Assistant Aesthetic */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-paper border border-surface-mid rounded-xl shadow-sm flex flex-col h-[500px] overflow-hidden">
                <div className="p-4 border-b border-surface-mid bg-surface-low/50 backdrop-blur-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center text-accent">
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <h2 className="text-[11px] font-bold text-ink uppercase tracking-widest">Consult AI & RAG</h2>
                      <p className="text-[8px] text-ink-muted uppercase tracking-wider">Real-time Intelligence Interface</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest">Engine Active</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-surface-low/10">
                  {!askAiResponse && !isAskingAi && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                      <Sparkles size={48} className="text-accent" />
                      <div className="space-y-1">
                        <p className="text-lg font-display font-bold text-ink">Intelligence Ready</p>
                        <p className="text-[10px] text-ink-muted max-w-sm mx-auto">Ask for reports, search the database, or get help with curriculum planning.</p>
                      </div>
                    </div>
                  )}

                  {isAskingAi && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center text-accent shrink-0">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                      <div className="bg-paper p-4 rounded-xl rounded-tl-sm border border-surface-mid shadow-sm">
                        <p className="text-[11px] text-ink-muted italic flex items-center gap-2">
                          <Activity size={12} className="animate-pulse text-accent" />
                          Analyzing database and generating response...
                        </p>
                      </div>
                    </div>
                  )}

                  {askAiResponse && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                        <Sparkles size={14} />
                      </div>
                      <div className="bg-paper p-4 rounded-xl rounded-tl-sm border border-ink/5 shadow-sm prose prose-sm prose-custom max-w-none text-[11px]">
                        <ReactMarkdown>{askAiResponse}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-ink/5 bg-paper">
                  <div className="relative flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        value={askAiInput}
                        onChange={(e) => setAskAiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAskAi();
                          }
                        }}
                        placeholder="Ask for a report or search the RAG database..."
                        className="w-full max-h-20 min-h-[38px] p-2 bg-surface-low border border-ink/10 rounded-lg text-[11px] focus:outline-none focus:border-accent/50 resize-none custom-scrollbar transition-all"
                        rows={1}
                      />
                    </div>
                    <button
                      onClick={handleAskAi}
                      disabled={!askAiInput.trim() || isAskingAi}
                      className="w-9 h-9 shrink-0 bg-ink text-paper rounded-lg flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-ink/20"
                    >
                      {isAskingAi ? <Loader2 size={16} className="animate-spin" /> : <Plus size={20} className="rotate-45" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add Resource Form */}
              <div className="lg:col-span-1">
                <div className="bg-paper border border-surface-mid rounded-2xl p-6 shadow-sm space-y-6 sticky top-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-accent">
                      <Plus size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Add Resource</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-ink tracking-tight">Save New Resource</h2>
                    <p className="text-xs text-ink-muted">Store URLs and references for future AI generation.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">URL / Reference</label>
                      <input
                        type="url"
                        value={newResourceUrl}
                        onChange={(e) => setNewResourceUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink focus:outline-none focus:border-accent/50 transition-all"
                        placeholder="https://example.com/resource"
                      />
                    </div>

                    <button
                      onClick={handleAddResource}
                      className="w-full py-3 bg-accent text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-accent-hover transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 active:scale-[0.98]"
                    >
                      <CheckCircle2 size={16} />
                      Save to Library
                    </button>
                  </div>
                </div>

                {/* Smart Resource Processor */}
                <div className="bg-paper border border-surface-mid rounded-2xl p-6 shadow-sm space-y-6 mt-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-accent">
                      <Sparkles size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Smart Processor</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-ink tracking-tight">Extract & Evaluate</h2>
                    <p className="text-xs text-ink-muted">Upload a PDF or image to intelligently extract data, evaluate weaknesses, and find similar resources.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Upload File (PDF/Image)</label>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setSmartFile(e.target.files?.[0] || null)}
                        className="w-full px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink focus:outline-none focus:border-accent/50 transition-all file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-accent/10 file:text-accent hover:file:bg-accent/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-ink-muted uppercase tracking-widest ml-1">Extraction Instruction</label>
                      <textarea
                        value={smartInstruction}
                        onChange={(e) => setSmartInstruction(e.target.value)}
                        className="w-full h-24 px-3 py-2 rounded-lg border border-surface-mid bg-surface-low text-[12px] text-ink focus:outline-none focus:border-accent/50 transition-all resize-none"
                        placeholder="e.g., Extract all dates, historical events, and key figures from this document."
                      />
                    </div>

                    <button
                      onClick={handleSmartProcess}
                      disabled={isSmartProcessing || !smartFile || !smartInstruction.trim()}
                      className="w-full py-3 bg-ink text-paper rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-ink/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-ink/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSmartProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isSmartProcessing ? 'Processing...' : 'Process Resource'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Resources List */}
              <div className="lg:col-span-2">
                <div className="bg-paper border border-surface-mid rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                  <div className="p-6 border-b border-surface-mid flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-accent">
                        <Library size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Resource Library</span>
                      </div>
                      <h2 className="text-xl font-display font-bold text-ink">Saved Resources</h2>
                      <p className="text-xs text-ink-muted">Manage your collection of reference materials.</p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-surface-low border border-surface-mid text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                      {resources.length} Resources
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {resources.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-ink-muted space-y-4">
                        <div className="w-16 h-16 rounded-full bg-surface-low flex items-center justify-center">
                          <Library size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">No resources saved yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {resources.map((resource) => (
                          <div key={resource.id} className="group p-4 rounded-2xl bg-surface-low border border-surface-mid hover:border-accent/30 hover:shadow-md transition-all relative">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-paper border border-surface-mid flex items-center justify-center text-accent shadow-sm">
                                  {resource.type === 'url' ? <Link size={18} /> : <FileText size={18} />}
                                </div>
                                <div className="space-y-1">
                                  <h3 className="text-sm font-bold text-ink leading-tight">{resource.title}</h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest px-1.5 py-0.5 bg-surface-mid rounded">
                                      {resource.type}
                                    </span>
                                    {resource.category && (
                                      <span className="text-[9px] font-bold text-accent uppercase tracking-widest px-1.5 py-0.5 bg-accent-soft rounded">
                                        {resource.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteResource(resource.id)}
                                className="p-2 text-ink-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                              <p className="text-[10px] text-ink-muted font-mono truncate max-w-[200px]">{resource.url}</p>
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-paper border border-surface-mid rounded-lg text-accent hover:bg-accent hover:text-white transition-all shadow-sm"
                              >
                                <Globe size={14} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            {/* App Settings Section */}
            <div className="bg-paper border border-surface-mid rounded-2xl overflow-hidden shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-ink">App Configuration</h2>
                  <p className="text-xs text-ink-muted">Global system parameters and access controls.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface-low rounded-xl border border-surface-mid">
                <div className="space-y-0.5">
                  <h3 className="text-[13px] font-bold text-ink">Consult AI Access</h3>
                  <p className="text-[11px] text-ink-muted">Control who can access the "Consult AI" feature.</p>
                </div>
                <div className="flex bg-paper border border-surface-mid rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => updateAskAiAccess('all')}
                    disabled={isUpdatingSettings}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${askAiAccess === 'all' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink-muted hover:text-ink hover:bg-surface-low'}`}
                  >
                    All Users
                  </button>
                  <button
                    onClick={() => updateAskAiAccess('admin')}
                    disabled={isUpdatingSettings}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${askAiAccess === 'admin' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink-muted hover:text-ink hover:bg-surface-low'}`}
                  >
                    Admin Only
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface-low rounded-xl border border-surface-mid mt-4">
                <div className="space-y-0.5">
                  <h3 className="text-[13px] font-bold text-ink">Topic Generation Access</h3>
                  <p className="text-[11px] text-ink-muted">Control who can use AI to generate curriculum topics.</p>
                </div>
                <div className="flex bg-paper border border-surface-mid rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => updateTopicGenerationAccess('all')}
                    disabled={isUpdatingSettings}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${topicGenerationAccess === 'all' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink-muted hover:text-ink hover:bg-surface-low'}`}
                  >
                    All Users
                  </button>
                  <button
                    onClick={() => updateTopicGenerationAccess('admin')}
                    disabled={isUpdatingSettings}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${topicGenerationAccess === 'admin' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink-muted hover:text-ink hover:bg-surface-low'}`}
                  >
                    Admin Only
                  </button>
                </div>
              </div>
            </div>

            {/* Cloud Sync Section */}
            <div className="bg-paper border border-surface-mid rounded-2xl overflow-hidden shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dbConnected ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
                    {dbConnected ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-display font-bold text-ink leading-tight">Cloud Synchronization</h2>
                    <p className="text-xs text-ink-muted">Backup your academic repository to the cloud.</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl border ${dbConnected ? 'bg-success-soft border-success/20 text-success' : 'bg-warning-soft border-warning/20 text-warning'} text-[9px] font-bold uppercase tracking-[0.2em]`}>
                  {dbConnected ? 'Operational' : 'Local Only'}
                </div>
              </div>

              {!dbConnected && (
                <div className="p-4 bg-warning-soft border border-warning/10 rounded-xl flex gap-4 mb-6">
                  <AlertCircle className="w-5 h-5 text-warning shrink-0" />
                  <div className="space-y-2">
                    <p className="text-[13px] font-bold text-ink">Cloud Sync is not configured</p>
                    <p className="text-[12px] text-ink-muted leading-relaxed">
                      To enable cloud sync, you need to provide your Supabase credentials in the <strong>Secrets</strong> panel of the AI Studio UI.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <code className="text-[10px] font-mono bg-paper/50 px-2 py-1 rounded-md text-ink border border-warning/10">VITE_SUPABASE_URL</code>
                      <code className="text-[10px] font-mono bg-paper/50 px-2 py-1 rounded-md text-ink border border-warning/10">VITE_SUPABASE_ANON_KEY</code>
                    </div>
                  </div>
                </div>
              )}

              {dbConnected && (
                <div className="p-4 bg-success-soft border border-success/10 rounded-xl flex gap-4 mb-6">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-bold text-ink">Connected to Supabase</p>
                    <p className="text-[12px] text-ink-muted leading-relaxed">
                      Your data is being automatically backed up to your Supabase instance.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-surface-mid">
                <div className="flex items-center gap-3 text-ink-muted">
                  <DatabaseIcon className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Local Storage: Dexie DB (IndexedDB)</span>
                </div>
              </div>
            </div>

            <div className="bg-paper border border-surface-mid rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-surface-mid bg-surface-low/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layers size={18} className="text-accent" />
                  <div>
                    <h2 className="text-[13px] font-bold text-ink uppercase tracking-widest">Local Modules Sync</h2>
                    <p className="text-[9px] text-ink-muted uppercase tracking-widest mt-0.5">
                      Target Session: <span className="text-accent font-bold">{qgCountry}</span> / <span className="text-accent font-bold">{qgGrade}</span> / <span className="text-accent font-bold">{qgSubject || 'ALL'}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSyncAll}
                    disabled={isSyncingAll || modules?.length === 0 || isDummyUser}
                    className="px-4 py-1.5 bg-ink text-paper rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-ink/90 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSyncingAll ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                    Sync All
                  </button>
                  <span className="text-[10px] font-bold px-3 py-1 bg-accent-soft text-accent rounded-full uppercase tracking-widest">
                    {modules?.length || 0} Modules
                  </span>
                </div>
              </div>
              <div className="divide-y divide-surface-mid">
                {modules?.length === 0 && (
                  <div className="p-8 text-center text-ink-muted text-xs italic">
                    No local modules found. Create some in the Classrooms tab first.
                  </div>
                )}
                {modules?.map((module) => {
                  const moduleLessons =
                    lessons?.filter((l) => l.moduleId === module.id) || [];
                  const isSyncing = syncing === module.id;
                  const isSynced = synced[module.id];

                  return (
                    <div
                      key={module.id}
                      className="p-6 flex items-center justify-between hover:bg-surface-low/50 transition-colors group"
                    >
                      <div className="space-y-1">
                        <h3 className="text-[14px] font-bold text-ink group-hover:text-accent transition-colors">{module.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-ink-muted uppercase tracking-tight">
                          <span>{module.code}</span>
                          <span className="w-1 h-1 rounded-full bg-surface-mid" />
                          <span>{moduleLessons.length} lessons</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSyncToSupabase(module.id)}
                        disabled={isSyncing || isSynced || isDummyUser}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          isSynced
                            ? "bg-success-soft text-success border border-success/10"
                            : "bg-accent text-paper hover:bg-accent-hover shadow-xl shadow-accent/20"
                        } disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]`}
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
                          </>
                        ) : isSynced ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Synced
                          </>
                        ) : (
                          <>
                            <Cloud className="w-3 h-3" /> Sync to Cloud
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
    </div>

      </div>

      {/* Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm">
          <div className="bg-paper rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-ink/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Bulk Import Data</h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 hover:bg-surface-low rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs text-muted mb-3">
                Paste your JSON data below. It should contain{" "}
                <code>modules</code> and/or <code>lessons</code> arrays.
              </p>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full h-48 p-3 rounded-xl bg-surface-low border border-ink/10 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                placeholder={`{\n  "modules": [...],\n  "lessons": [...]\n}`}
              />
              {importError && (
                <div className="mt-3 p-2.5 bg-error-soft text-error rounded-xl text-[11px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="break-words">{importError}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(importError);
                      toast.success("Error message copied!");
                    }}
                    className="p-1 hover:bg-error/10 rounded transition-all shrink-0"
                    title="Copy Error"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
              {importSuccess && (
                <div className="mt-3 p-2.5 bg-success-soft text-success rounded-xl text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Data imported successfully!
                </div>
              )}
            </div>
            <div className="p-4 border-t border-ink/5 bg-surface-low flex justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-lg font-bold text-ink text-xs hover:bg-surface-mid transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importData.trim()}
                className="px-4 py-2 rounded-lg font-bold bg-accent text-paper text-xs hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validate & Import
              </button>
            </div>
          </div>
        </div>
      )}
      {/* RAG Lesson Insert Modal */}
      {isRagModalOpen && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-3 border-b border-ink/10 flex items-center justify-between bg-surface-low">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Plus className="text-accent" size={16} />
                Insert Lesson into RAG Database
              </h3>
              <button
                onClick={() => setIsRagModalOpen(false)}
                className="p-1.5 hover:bg-ink/5 rounded-full transition-colors text-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-muted">
                  Paste a JSON object matching the <code>LessonTemplate</code>{" "}
                  schema to insert it directly into the Supabase RAG database.
                </p>
                <button
                  onClick={() => {
                    const template = {
                      country: "USA",
                      grade: "Grade 10",
                      subject: "Biology",
                      lesson_title: "Photosynthesis",
                      content: "Lesson content here...",
                      mod: "Cellular Processes",
                      exercises: [],
                      quizzes: [],
                      exam: {}
                    };
                    setRagLessonData(JSON.stringify(template, null, 2));
                    toast.success("Example template loaded!");
                  }}
                  className="text-[10px] font-bold text-accent hover:text-accent/80 flex items-center gap-1"
                >
                  <Copy size={10} />
                  Load Example
                </button>
              </div>

              <textarea
                value={ragLessonData}
                onChange={(e) => setRagLessonData(e.target.value)}
                placeholder='{\n  "country": "USA",\n  "grade": "Grade 10",\n  "subject": "Biology",\n  "lesson_title": "Photosynthesis",\n  "content": "...",\n  "mod": "Cellular Processes",\n  "exercises": [],\n  "quizzes": [],\n  "exam": {}\n}'
                className="w-full h-48 p-3 bg-surface-low border border-ink/10 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
              />
            </div>

            <div className="p-3 border-t border-ink/10 bg-surface-low flex justify-end gap-2">
              <button
                onClick={() => setIsRagModalOpen(false)}
                className="px-3 py-1.5 text-muted hover:text-ink font-medium text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertRagLesson}
                disabled={!ragLessonData.trim() || isSavingRag}
                className="bg-accent hover:bg-accent/90 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingRag ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {isSavingRag ? "Saving..." : "Insert Lesson"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Builder Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-3 border-b border-ink/10 flex items-center justify-between bg-surface-low">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Terminal className="text-accent" size={16} />
                Generated Prompt
              </h3>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="p-1.5 hover:bg-ink/5 rounded-full transition-colors text-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-muted">
                  Copy this prompt to use in external AI tools.
                </p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedPrompt);
                    toast.success("Prompt copied to clipboard!");
                  }}
                  className="text-[10px] font-bold text-accent hover:text-accent/80 flex items-center gap-1"
                >
                  <Copy size={10} />
                  Copy Prompt
                </button>
              </div>

              <textarea
                value={generatedPrompt}
                readOnly
                className="w-full h-96 p-3 bg-surface-low border border-ink/10 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y custom-scrollbar"
              />
            </div>

            <div className="p-3 border-t border-ink/10 bg-surface-low flex justify-end gap-2">
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="px-3 py-1.5 text-muted hover:text-ink font-medium text-xs"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(generatedPrompt);
                  toast.success("Prompt copied to clipboard!");
                  setIsPromptModalOpen(false);
                }}
                className="bg-accent hover:bg-accent/90 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-2"
              >
                <Copy size={14} />
                Copy & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resource Picker Modal */}
      {isResourcePickerOpen && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-paper rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-3 border-b border-ink/10 flex items-center justify-between bg-surface-low">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Library className="text-accent" size={16} />
                Select Resource from Library
              </h3>
              <button
                onClick={() => setIsResourcePickerOpen(false)}
                className="p-1.5 hover:bg-ink/5 rounded-full transition-colors text-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {resources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-ink-muted space-y-3">
                  <Library size={24} className="opacity-20" />
                  <p className="text-xs font-medium">Your library is empty.</p>
                  <button
                    onClick={() => {
                      setIsResourcePickerOpen(false);
                      setActiveTab('resources');
                    }}
                    className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
                  >
                    Go to Library to add resources
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {resources.map((resource) => (
                    <button
                      key={resource.id}
                      onClick={() => handlePickResource(resource.url)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-low border border-surface-mid hover:border-accent/30 hover:bg-accent-soft transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-paper border border-surface-mid flex items-center justify-center text-accent shadow-sm group-hover:bg-accent group-hover:text-white transition-all">
                        {resource.type === 'url' ? <Link size={14} /> : <FileText size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-ink truncate">{resource.title}</h4>
                        <p className="text-[9px] text-ink-muted font-mono truncate">{resource.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {resource.category && (
                          <span className="text-[8px] font-bold text-accent uppercase tracking-widest px-1.5 py-0.5 bg-accent-soft rounded">
                            {resource.category}
                          </span>
                        )}
                        <Plus size={14} className="text-accent opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-ink/10 bg-surface-low flex justify-end">
              <button
                onClick={() => setIsResourcePickerOpen(false)}
                className="px-4 py-1.5 text-muted hover:text-ink font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Database Fixer Modal */}
      <DatabaseFixerModal 
        isOpen={isDbFixModalOpen} 
        onClose={() => setIsDbFixModalOpen(false)} 
      />

      {/* Audit Result Modal */}
      {isAuditModalOpen && auditConfigResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-ink/60 backdrop-blur-md">
          <div className="bg-paper w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surface-mid">
            <div className="px-6 py-4 border-b border-surface-mid flex items-center justify-between bg-surface-low/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${auditConfigResult.isValid ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {auditConfigResult.isValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Curriculum Audit Result</h3>
                  <p className="text-[10px] text-ink-muted font-mono">
                    {qgCountry} &gt; {qgGrade} &gt; {dbBacTracks.find(t => t.id === qgBacTrack)?.name || 'N/A'} &gt; {qgSubject}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-2 hover:bg-surface-mid rounded-xl transition-colors text-ink-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className={`p-4 rounded-xl border ${auditConfigResult.isValid ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'}`}>
                <h4 className={`text-xs font-bold uppercase tracking-widest mb-2 ${auditConfigResult.isValid ? 'text-success' : 'text-error'}`}>
                  {auditConfigResult.isValid ? 'Valid Configuration' : 'Configuration Mismatch Detected'}
                </h4>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {auditConfigResult.explanation}
                </p>
              </div>

              {!auditConfigResult.isValid && auditConfigResult.suggestedSubjects && auditConfigResult.suggestedSubjects.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Suggested Subjects for this Track</h4>
                  <div className="flex flex-wrap gap-2">
                    {auditConfigResult.suggestedSubjects.map((sub, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-surface-low border border-surface-mid rounded-lg text-xs font-medium text-ink-secondary">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-surface-mid bg-surface-low/50 flex justify-end">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-6 py-2 bg-ink text-paper rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-ink/90 transition-all shadow-lg active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Result Modal */}
      {isSmartResultModalOpen && smartExtractedContent && smartEvaluation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-ink/60 backdrop-blur-md">
          <div className="bg-paper w-full max-w-4xl h-full max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surface-mid">
            <div className="px-6 py-4 border-b border-surface-mid flex items-center justify-between bg-surface-low/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Smart Extraction Results</h3>
                  <p className="text-[10px] text-ink-muted font-mono">Evaluation & Extracted Content</p>
                </div>
              </div>
              <button
                onClick={() => setIsSmartResultModalOpen(false)}
                className="p-2 hover:bg-surface-mid rounded-xl transition-colors text-ink-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Evaluation Section */}
              <div className={`p-4 rounded-xl border ${smartEvaluation.isSufficient ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {smartEvaluation.isSufficient ? <CheckCircle2 className="text-success w-5 h-5" /> : <AlertCircle className="text-warning w-5 h-5" />}
                  <h4 className={`text-xs font-bold uppercase tracking-widest ${smartEvaluation.isSufficient ? 'text-success' : 'text-warning'}`}>
                    {smartEvaluation.isSufficient ? 'Sufficient Extraction' : 'Weaknesses Detected'}
                  </h4>
                </div>
                <p className="text-sm text-ink-secondary leading-relaxed mb-4">
                  {smartEvaluation.extractedSummary}
                </p>
                
                {!smartEvaluation.isSufficient && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-warning/10">
                    <div>
                      <h5 className="text-[10px] font-bold text-warning uppercase tracking-widest mb-2">Identified Weaknesses</h5>
                      <ul className="list-disc pl-4 text-xs text-ink-secondary space-y-1">
                        {smartEvaluation.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-[10px] font-bold text-warning uppercase tracking-widest mb-2">Missing Information</h5>
                      <ul className="list-disc pl-4 text-xs text-ink-secondary space-y-1">
                        {smartEvaluation.missingInformation.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Similar Resources Section */}
              {smartSimilarResources && (
                <div className="p-4 rounded-xl border border-accent/20 bg-accent/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="text-accent w-5 h-5" />
                    <h4 className="text-xs font-bold text-accent uppercase tracking-widest">AI Crew: Suggested Resources</h4>
                  </div>
                  <div className="prose prose-sm prose-custom max-w-none text-xs text-ink-secondary">
                    <ReactMarkdown>{smartSimilarResources}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Extracted Content Section */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-ink uppercase tracking-[0.2em] border-b border-surface-mid pb-2">Extracted Content</h4>
                <textarea
                  value={smartExtractedContent}
                  readOnly
                  className="w-full h-64 px-4 py-4 rounded-xl border border-surface-mid bg-surface-low text-xs text-ink font-mono leading-relaxed focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                />
              </div>

            </div>
            <div className="px-6 py-4 border-t border-surface-mid bg-surface-low/50 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(smartExtractedContent);
                  toast.success("Extracted content copied!");
                }}
                className="px-4 py-2 bg-surface-mid text-ink rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-surface-high transition-all active:scale-95 flex items-center gap-2"
              >
                <Copy size={14} />
                Copy Content
              </button>
              <button
                onClick={() => setIsSmartResultModalOpen(false)}
                className="px-6 py-2 bg-ink text-paper rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-ink/90 transition-all shadow-lg active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Surgical Edit Modal */}
      {isEditModalOpen && editingLesson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-ink/60 backdrop-blur-md">
          <div className="bg-paper w-full max-w-4xl h-full max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surface-mid">
            <div className="px-6 py-4 border-b border-surface-mid flex items-center justify-between bg-surface-low/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Settings size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Surgical Node Editor</h3>
                  <p className="text-[10px] text-ink-muted font-mono">Editing: {editingLesson.lesson_title}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-surface-mid rounded-xl transition-colors text-ink-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-ink-muted uppercase tracking-widest ml-1">Lesson Title</label>
                  <input
                    type="text"
                    value={editingLesson.lesson_title}
                    onChange={(e) => setEditingLesson({ ...editingLesson, lesson_title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-mid bg-surface-low text-sm text-ink focus:outline-none focus:border-accent/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-ink-muted uppercase tracking-widest ml-1">Subject</label>
                  <input
                    type="text"
                    value={editingLesson.subject}
                    onChange={(e) => setEditingLesson({ ...editingLesson, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-mid bg-surface-low text-sm text-ink focus:outline-none focus:border-accent/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-ink-muted uppercase tracking-widest ml-1">Lesson Content (Markdown)</label>
                <textarea
                  value={editingLesson.content}
                  onChange={(e) => setEditingLesson({ ...editingLesson, content: e.target.value })}
                  className="w-full h-96 px-4 py-4 rounded-xl border border-surface-mid bg-surface-low text-sm text-ink font-mono leading-relaxed focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-ink uppercase tracking-[0.2em] border-b border-surface-mid pb-2">Quizzes (JSON)</h4>
                  <textarea
                    value={JSON.stringify(editingLesson.quizzes, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setEditingLesson({ ...editingLesson, quizzes: parsed });
                      } catch (err) {}
                    }}
                    className="w-full h-64 px-4 py-4 rounded-xl border border-surface-mid bg-surface-low text-[11px] text-ink font-mono focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                  />
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-ink uppercase tracking-[0.2em] border-b border-surface-mid pb-2">Exercises (JSON)</h4>
                  <textarea
                    value={JSON.stringify(editingLesson.exercises, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setEditingLesson({ ...editingLesson, exercises: parsed });
                      } catch (err) {}
                    }}
                    className="w-full h-64 px-4 py-4 rounded-xl border border-surface-mid bg-surface-low text-[11px] text-ink font-mono focus:outline-none focus:border-accent/50 transition-all resize-none custom-scrollbar"
                  />
                </div>
              </div>
            </div>
            <div className="px-8 py-6 border-t border-surface-mid bg-surface-low/50 flex items-center justify-between">
              <p className="text-[10px] text-ink-muted italic">Updating this node will re-generate its vector embedding for RAG accuracy.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:bg-surface-mid transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateLesson}
                  className="px-8 py-2.5 bg-accent text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-95"
                >
                  Commit Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Test View Modal (User View) */}
      {isTestModalOpen && testLesson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-paper w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-surface-mid">
            <div className="px-8 py-6 border-b border-surface-mid flex items-center justify-between bg-surface-low/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-ink tracking-tight">Test View: {testLesson.lesson_title}</h3>
                  <p className="text-[10px] text-ink-muted uppercase tracking-[0.2em] font-bold">Validating Student Experience</p>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-2 hover:bg-surface-mid rounded-full transition-all text-ink-muted hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-low p-8">
              <div className="max-w-4xl mx-auto">
                <LessonView lesson={testLesson} />
              </div>
            </div>
            <div className="px-8 py-6 border-t border-surface-mid bg-surface-low/50 flex items-center justify-between">
              <p className="text-[10px] text-ink-muted italic">This is exactly how the student will see the content in the classroom.</p>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="px-8 py-2.5 bg-ink text-paper rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-ink/90 transition-all shadow-lg active:scale-95"
              >
                Close Test View
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
