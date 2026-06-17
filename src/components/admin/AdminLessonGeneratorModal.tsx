import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "../Modal";
import { generateFullLesson, extractChunkMetadata, LessonTemplate, checkAIProvider } from "../../services/geminiService";
import { saveLesson } from "../../services/ragService";
import { supabase } from "../../db/supabase";
import { toast } from "sonner";
import { 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Save, 
  ShieldAlert, 
  Check, 
  Plus, 
  BookOpen,
  Activity
} from "lucide-react";

export interface AdminLessonGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chunk: any | null; // The RAG chunk
  initialGrade?: string;
}

interface QualityCheckResult {
  passed: boolean;
  reason?: string;
  isWarning?: boolean;
}

export const AdminLessonGeneratorModal: React.FC<AdminLessonGeneratorModalProps> = ({
  isOpen,
  onClose,
  chunk,
  initialGrade,
}) => {
  const [step, setStep] = useState<"config" | "generating" | "preview" | "saving">("config");
  
  // Supabase Data Lists
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [relatedChunks, setRelatedChunks] = useState<any[]>([]);
  
  // Loading States for lists
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingRelatedChunks, setLoadingRelatedChunks] = useState(false);

  // Form State
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  
  const [country, setCountry] = useState("Morocco");
  const [moduleName, setModuleName] = useState("");
  const [language, setLanguage] = useState("fr"); // Detected/admin-confirmed language
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Auto-detection Confidence & Reason Log
  const [confidence, setConfidence] = useState<{ score: number; label: string; reasons: string[] }>({
    score: 0,
    label: "None",
    reasons: [],
  });

  // Generated Data & Error
  const [lessonData, setLessonData] = useState<LessonTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch grades on mount/open
  useEffect(() => {
    if (isOpen) {
      const fetchGrades = async () => {
        setLoadingGrades(true);
        try {
          const { data, error: gradesErr } = await supabase
            .from("grades")
            .select("id, name")
            .order("name");
          if (gradesErr) throw gradesErr;
          setGrades(data || []);
        } catch (err: any) {
          console.error("Error fetching grades:", err);
          toast.error("Failed to load grades from Supabase.");
        } finally {
          setLoadingGrades(false);
        }
      };
      fetchGrades();
    }
  }, [isOpen]);

  // 2. Fetch subjects when grade changes
  useEffect(() => {
    if (selectedGradeId) {
      const fetchSubjects = async () => {
        setLoadingSubjects(true);
        setSubjects([]);
        setSelectedSubjectId("");
        try {
          const { data, error: subjectsErr } = await supabase
            .from("grade_subjects")
            .select("subjects(id, name)")
            .eq("grade_id", selectedGradeId);
          if (subjectsErr) throw subjectsErr;
          
          const mapped = (data || [])
            .map((row: any) => {
              const s = row.subjects;
              return Array.isArray(s) ? s[0] : s;
            })
            .filter(Boolean);
            
          setSubjects(mapped);
        } catch (err: any) {
          console.error("Error fetching subjects:", err);
          toast.error("Failed to load subjects for selected grade.");
        } finally {
          setLoadingSubjects(false);
        }
      };
      fetchSubjects();
    } else {
      setSubjects([]);
      setSelectedSubjectId("");
    }
  }, [selectedGradeId]);

  // 3. Fetch topics when grade and subject change
  useEffect(() => {
    if (selectedGradeId && selectedSubjectId) {
      const fetchTopics = async () => {
        setLoadingTopics(true);
        setTopics([]);
        setSelectedTopicId("");
        setIsCreatingNewTopic(false);
        try {
          const { data, error: topicsErr } = await supabase
            .from("topics")
            .select("id, title")
            .eq("grade_id", selectedGradeId)
            .eq("subject_id", selectedSubjectId)
            .order("title");
          if (topicsErr) throw topicsErr;
          setTopics(data || []);
        } catch (err: any) {
          console.error("Error fetching topics:", err);
          toast.error("Failed to load topics.");
        } finally {
          setLoadingTopics(false);
        }
      };
      fetchTopics();
    } else {
      setTopics([]);
      setSelectedTopicId("");
    }
  }, [selectedGradeId, selectedSubjectId]);

  // 4. Fetch related chunks for selectedTopicId
  useEffect(() => {
    if (selectedTopicId) {
      const fetchRelatedChunks = async () => {
        setLoadingRelatedChunks(true);
        try {
          const { data, error: chunksErr } = await supabase
            .from("rag_chunks")
            .select("id, content, metadata, embedding_status, source_url")
            .eq("topic_id", selectedTopicId)
            .limit(10);
          if (chunksErr) throw chunksErr;
          setRelatedChunks(data || []);
        } catch (err) {
          console.error("Error fetching related chunks by topic_id:", err);
        } finally {
          setLoadingRelatedChunks(false);
        }
      };
      fetchRelatedChunks();
    } else {
      setRelatedChunks([]);
    }
  }, [selectedTopicId]);

  // 5. Search related chunks when isCreatingNewTopic is active (and title is typed)
  useEffect(() => {
    if (isCreatingNewTopic && newTopicTitle.trim() && selectedGradeId) {
      const searchRelatedChunks = async () => {
        setLoadingRelatedChunks(true);
        try {
          const words = newTopicTitle.trim().split(/\s+/).filter(w => w.length > 3);
          let query = supabase
            .from("rag_chunks")
            .select("id, content, metadata, embedding_status, source_url")
            .eq("grade_id", selectedGradeId);
            
          if (words.length > 0) {
            query = query.ilike("content", `%${words[0]}%`);
          }
          
          const { data, error: searchErr } = await query.limit(5);
          if (searchErr) throw searchErr;
          setRelatedChunks(data || []);
        } catch (err) {
          console.error("Error searching related chunks by title:", err);
        } finally {
          setLoadingRelatedChunks(false);
        }
      };
      
      const delayDebounceFn = setTimeout(() => {
        searchRelatedChunks();
      }, 600);
      
      return () => clearTimeout(delayDebounceFn);
    }
  }, [isCreatingNewTopic, newTopicTitle, selectedGradeId]);

  // Deduplicate and combine source chunk and related chunks
  const allContextChunks = useMemo(() => {
    const list = [...relatedChunks];
    if (chunk && !list.some(c => c.id === chunk.id)) {
      list.unshift(chunk);
    }
    return list;
  }, [chunk, relatedChunks]);

  // 6. Content Quality Check (Short, Garbage, Symbols, Language, Educational Value)
  const qualityCheck = useMemo((): QualityCheckResult => {
    if (!chunk?.content) return { passed: false, reason: "No chunk content available." };
    const content = chunk.content;
    const trimmed = content.trim();
    
    // Check too short
    if (trimmed.length < 100) {
      return { passed: false, reason: "Content is too short (minimum 100 characters required)." };
    }

    // Check placeholders or server error garbage
    const garbagePatterns = [
      /internal server error/i,
      /failed to fetch/i,
      /lorem ipsum/i,
      /placeholder/i,
      /test test/i,
      /insert content here/i,
      /todo:?/i,
    ];
    for (const pattern of garbagePatterns) {
      if (pattern.test(trimmed)) {
        return { passed: false, reason: `Content contains placeholder/server garbage: "${pattern.source}"` };
      }
    }

    // Check if mostly symbols/whitespace (non-alphanumeric ratio < 40%)
    const alphanumericCount = (trimmed.match(/[a-zA-Z0-9\u0600-\u06FF\u00C0-\u017F]/g) || []).length;
    const totalCount = trimmed.length;
    if (totalCount > 0 && (alphanumericCount / totalCount) < 0.4) {
      return { passed: false, reason: "Content contains too many symbols (ratio of letters/digits is below 40%)." };
    }

    // Check language cannot be detected
    const arabicRegex = /[\u0600-\u06FF]/;
    const latinRegex = /[a-zA-Z\u00C0-\u017F]/;
    if (!arabicRegex.test(trimmed) && !latinRegex.test(trimmed)) {
      return { passed: false, reason: "Content language cannot be detected (lacks Arabic and Latin alphabets)." };
    }

    // Check educational value keywords/stop words
    const lowerContent = trimmed.toLowerCase();
    const eduKeywords = [
      "le", "la", "les", "un", "une", "des", "dans", "sur", "pour", "avec", "est", "sont",
      "the", "and", "of", "to", "in", "is", "that", "it",
      "من", "في", "على", "إلى", "أن", "كان", "هو", "هي",
      "cours", "leçon", "lesson", "chapitre", "chapter", "sujet", "topic",
      "math", "science", "physique", "chimie", "histoire", "géographie",
      "definition", "définition", "exemple", "example", "exercice", "exercise",
      "question", "réponse", "answer", "solution"
    ];
    const hasEduKeywords = eduKeywords.some(keyword => {
      if (/[\u0600-\u06FF]/.test(keyword)) {
        return lowerContent.includes(keyword);
      }
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerContent);
    });

    if (!hasEduKeywords) {
      return { 
        passed: true, 
        isWarning: true, 
        reason: "Content has low educational value markers (no common academic terms or helper words found)." 
      };
    }

    return { passed: true };
  }, [chunk?.content]);

  // 7. Validation helper to enable/disable generate button
  const isValid = useMemo(() => {
    if (!chunk?.id || !chunk?.content) return false;
    if (!selectedGradeId) return false;
    if (!selectedSubjectId) return false;
    if (!selectedTopicId && (!isCreatingNewTopic || !newTopicTitle.trim())) return false;
    if (!country.trim()) return false;
    if (!qualityCheck.passed) return false;
    return true;
  }, [chunk?.id, chunk?.content, selectedGradeId, selectedSubjectId, selectedTopicId, isCreatingNewTopic, newTopicTitle, country, qualityCheck.passed]);

  // 8. Handle Auto-Detection and Mapping when chunk & grades are loaded
  useEffect(() => {
    let isMounted = true;
    if (isOpen && chunk && grades.length > 0) {
      const performAutoDetection = async () => {
        setIsExtracting(true);
        setError(null);
        setStep("config");
        setLessonData(null);
        
        let detectedGradeId = "";
        let detectedSubjectId = "";
        let detectedTopicId = "";
        let detectedModuleName = "";
        let detectedLanguage = "fr";
        
        const reasons: string[] = [];
        
        // Grade Detection
        if (chunk.grade_id) {
          const found = grades.find(g => g.id === chunk.grade_id);
          if (found) {
            detectedGradeId = found.id;
            reasons.push(`Matched Grade by DB constraint: "${found.name}"`);
          }
        }
        
        if (!detectedGradeId && chunk.metadata?.grade_id) {
          const found = grades.find(g => g.id === chunk.metadata.grade_id);
          if (found) {
            detectedGradeId = found.id;
            reasons.push(`Matched Grade by metadata grade_id: "${found.name}"`);
          }
        }
        
        if (!detectedGradeId && chunk.metadata?.grade) {
          const gradeStr = String(chunk.metadata.grade).toLowerCase().trim();
          const found = grades.find(g => 
            g.name.toLowerCase().includes(gradeStr) || gradeStr.includes(g.name.toLowerCase())
          );
          if (found) {
            detectedGradeId = found.id;
            reasons.push(`Matched Grade from metadata name: "${found.name}"`);
          }
        }
        
        if (!detectedGradeId && initialGrade) {
          const found = grades.find(g => 
            g.name.toLowerCase().includes(initialGrade.toLowerCase()) || 
            initialGrade.toLowerCase().includes(g.name.toLowerCase())
          );
          if (found) {
            detectedGradeId = found.id;
            reasons.push(`Fallback to page scope grade: "${found.name}"`);
          }
        }
        
        if (detectedGradeId) {
          if (isMounted) setSelectedGradeId(detectedGradeId);
          
          // Load subjects for detected grade to check Subject Match
          try {
            const { data: gsData } = await supabase
              .from("grade_subjects")
              .select("subjects(id, name)")
              .eq("grade_id", detectedGradeId);
            
            const mappedSubjects = (gsData || [])
              .map((row: any) => {
                const s = row.subjects;
                return Array.isArray(s) ? s[0] : s;
              })
              .filter(Boolean);
            
            if (isMounted) setSubjects(mappedSubjects);
            
            // Match Subject
            if (chunk.metadata?.subject_id) {
              const foundSub = mappedSubjects.find((s: any) => s.id === chunk.metadata.subject_id);
              if (foundSub) {
                detectedSubjectId = foundSub.id;
                reasons.push(`Matched Subject by metadata subject_id: "${foundSub.name}"`);
              }
            }
            
            if (!detectedSubjectId && chunk.metadata?.subject) {
              const subStr = String(chunk.metadata.subject).toLowerCase().trim();
              const foundSub = mappedSubjects.find((s: any) => 
                s.name.toLowerCase().includes(subStr) || subStr.includes(s.name.toLowerCase())
              );
              if (foundSub) {
                detectedSubjectId = foundSub.id;
                reasons.push(`Matched Subject from metadata name: "${foundSub.name}"`);
              }
            }
            
            if (detectedSubjectId) {
              if (isMounted) setSelectedSubjectId(detectedSubjectId);
              
              // Load topics for detected grade & subject to check Topic Match
              const { data: topicsData } = await supabase
                .from("topics")
                .select("id, title")
                .eq("grade_id", detectedGradeId)
                .eq("subject_id", detectedSubjectId)
                .order("title");
                
              if (isMounted) setTopics(topicsData || []);
              
              // Match Topic
              if (chunk.topic_id) {
                const foundTopic = (topicsData || []).find((t: any) => t.id === chunk.topic_id);
                if (foundTopic) {
                  detectedTopicId = foundTopic.id;
                  reasons.push(`Matched Topic by DB constraint: "${foundTopic.title}"`);
                }
              }
              
              if (!detectedTopicId && chunk.metadata?.topic_id) {
                const foundTopic = (topicsData || []).find((t: any) => t.id === chunk.metadata.topic_id);
                if (foundTopic) {
                  detectedTopicId = foundTopic.id;
                  reasons.push(`Matched Topic by metadata topic_id: "${foundTopic.title}"`);
                }
              }
              
              if (!detectedTopicId && (chunk.metadata?.topic || chunk.metadata?.topic_title)) {
                const topicStr = String(chunk.metadata.topic || chunk.metadata.topic_title).toLowerCase().trim();
                const foundTopic = (topicsData || []).find((t: any) => 
                  t.title.toLowerCase().includes(topicStr) || topicStr.includes(t.title.toLowerCase())
                );
                if (foundTopic) {
                  detectedTopicId = foundTopic.id;
                  reasons.push(`Matched Topic from metadata title: "${foundTopic.title}"`);
                }
              }
              
              if (detectedTopicId) {
                if (isMounted) setSelectedTopicId(detectedTopicId);
              }
            }
          } catch (e) {
            console.error("Error in auto-detection subjects/topics load:", e);
          }
        }
        
        // Module & Language detection
        if (chunk.metadata?.moduleName || chunk.metadata?.module) {
          detectedModuleName = chunk.metadata.moduleName || chunk.metadata.module;
          if (isMounted) setModuleName(detectedModuleName);
        }
        
        if (chunk.metadata?.language) {
          const lang = String(chunk.metadata.language).toLowerCase().substring(0, 2);
          if (["ar", "fr", "en"].includes(lang)) {
            detectedLanguage = lang;
            if (isMounted) setLanguage(lang);
          }
        } else {
          // Fallback regex detect
          const arabicRegex = /[\u0600-\u06FF]/;
          if (arabicRegex.test(chunk.content)) {
            detectedLanguage = "ar";
            if (isMounted) setLanguage("ar");
          }
        }
        
        // AI Extraction fallback if missing critical metadata mapping
        if ((!detectedSubjectId || !detectedTopicId) && checkAIProvider()) {
          reasons.push("Metadata incomplete. Querying AI model to extract suggestions...");
          try {
            const extracted = await extractChunkMetadata(chunk.content);
            if (extracted && isMounted) {
              if (!detectedModuleName && extracted.moduleName) {
                setModuleName(extracted.moduleName);
              }
              
              // Match AI extracted subject to loaded grade subjects
              if (!detectedSubjectId && extracted.subject) {
                const subStr = extracted.subject.toLowerCase().trim();
                const foundSub = subjects.find((s: any) => 
                  s.name.toLowerCase().includes(subStr) || subStr.includes(s.name.toLowerCase())
                );
                if (foundSub) {
                  setSelectedSubjectId(foundSub.id);
                  detectedSubjectId = foundSub.id;
                  reasons.push(`AI Extracted Subject: matched to "${foundSub.name}"`);
                  
                  // Query topics for this AI resolved subject
                  const { data: topicsData } = await supabase
                    .from("topics")
                    .select("id, title")
                    .eq("grade_id", detectedGradeId || selectedGradeId)
                    .eq("subject_id", foundSub.id)
                    .order("title");
                  setTopics(topicsData || []);
                  
                  if (!detectedTopicId && extracted.topic) {
                    const topicStr = extracted.topic.toLowerCase().trim();
                    const foundTopic = (topicsData || []).find((t: any) => 
                      t.title.toLowerCase().includes(topicStr) || topicStr.includes(t.title.toLowerCase())
                    );
                    if (foundTopic) {
                      setSelectedTopicId(foundTopic.id);
                      detectedTopicId = foundTopic.id;
                      reasons.push(`AI Extracted Topic: matched to "${foundTopic.title}"`);
                    } else {
                      setIsCreatingNewTopic(true);
                      setNewTopicTitle(extracted.topic);
                      reasons.push(`AI Extracted Topic: "${extracted.topic}" (no match, suggesting creation)`);
                    }
                  }
                } else {
                  reasons.push(`AI Extracted Subject "${extracted.subject}" did not match grade curriculum.`);
                }
              }
            }
          } catch (aiErr) {
            console.error("AI extraction error:", aiErr);
          }
        }
        
        // Confidence Calculations
        let score = 0;
        let label = "Low";
        if (detectedGradeId) score += 30;
        if (detectedSubjectId) score += 30;
        if (detectedTopicId) score += 40;
        else if (isCreatingNewTopic && newTopicTitle) score += 20;
        
        if (score >= 90) label = "High";
        else if (score >= 60) label = "Medium";
        else label = "Low";
        
        if (isMounted) {
          setConfidence({
            score,
            label,
            reasons: reasons.filter(Boolean),
          });
        }
        
        if (isMounted) setIsExtracting(false);
      };
      
      performAutoDetection();
    }
    return () => { isMounted = false; };
  }, [isOpen, chunk, grades, initialGrade]);

  const handleGenerate = async () => {
    if (!isValid) {
      toast.error("Please ensure all requirements and quality checks are satisfied.");
      return;
    }

    setStep("generating");
    setError(null);
    
    try {
      const gradeName = grades.find(g => g.id === selectedGradeId)?.name || "";
      const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name || "";
      const topicName = isCreatingNewTopic 
        ? newTopicTitle.trim() 
        : topics.find(t => t.id === selectedTopicId)?.title || "";

      // Combine contents of all context chunks to compose the full lesson
      const combinedContext = allContextChunks
        .map((c, i) => `--- RAG Reference Chunk ${i + 1} ---\n${c.content}`)
        .join("\n\n");
      
      const generated = await generateFullLesson(
        topicName,
        country,
        gradeName,
        subjectName,
        moduleName,
        2, // retries
        undefined, // referenceUrls
        combinedContext, // Combined RAG context
        true // isAdmin
      );

      if (!generated) {
        throw new Error("Failed to generate lesson. Model execution returned null.");
      }

      setLessonData(generated);
      setStep("preview");
      toast.success("Lesson generated! Review structure before publishing.");
    } catch (err: any) {
      setError(err.message || "An error occurred during lesson drafting.");
      setStep("config");
    }
  };

  const handleApproveAndSave = async () => {
    if (!lessonData) return;
    
    setStep("saving");
    setError(null);
    
    try {
      let finalTopicId = selectedTopicId;
      
      // If creating a new topic, save it first
      if (isCreatingNewTopic) {
        const { data: newTopic, error: topicError } = await supabase
          .from("topics")
          .insert({
            grade_id: selectedGradeId,
            subject_id: selectedSubjectId,
            title: newTopicTitle.trim(),
            validation_status: "ai_generated",
            source_confidence: 0.5,
            source_name: "RAG Chunk Generator",
          })
          .select("id")
          .single();
          
        if (topicError) throw new Error(`Failed to create new topic: ${topicError.message}`);
        if (!newTopic) throw new Error("Failed to create new topic.");
        
        finalTopicId = newTopic.id;
      }
      
      const gradeName = grades.find(g => g.id === selectedGradeId)?.name || "";
      const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name || "";
      const topicName = isCreatingNewTopic 
        ? newTopicTitle.trim() 
        : topics.find(t => t.id === selectedTopicId)?.title || "";

      const finalLessonData: LessonTemplate = {
        ...lessonData,
        topic_id: finalTopicId,
        country: country,
        grade: gradeName,
        subject: subjectName,
        lesson_title: topicName,
        mod: moduleName,
      };
      
      // Save lesson using the updated saveLesson that returns the UUID
      const savedLessonId = await saveLesson(finalLessonData, "system", true);
      
      if (!savedLessonId || typeof savedLessonId !== "string") {
        throw new Error("Failed to save the lesson to Supabase.");
      }
      
      // Update all related RAG chunks to link them to this lesson
      const updatedMetadata = {
        ...(chunk.metadata || {}),
        is_processed: true,
        processed_at: new Date().toISOString(),
      };
      
      // Update the clicked source chunk
      await supabase
        .from("rag_chunks")
        .update({
          lesson_id: savedLessonId,
          topic_id: finalTopicId,
          processed_at: new Date().toISOString(),
          metadata: updatedMetadata,
        })
        .eq("id", chunk.id);

      // Optionally update all other chunks belonging to this topic
      if (finalTopicId) {
        await supabase
          .from("rag_chunks")
          .update({
            lesson_id: savedLessonId,
            processed_at: new Date().toISOString(),
          })
          .eq("topic_id", finalTopicId);
      }
        
      toast.success("Lesson saved and linked to curriculum successfully!");
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while writing to Supabase.");
      setStep("preview");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Lesson from RAG Chunk" maxWidth="2xl">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {step === "config" && (
          <div className="space-y-4">
            {/* Context Chunks List */}
            <div className="bg-surface-low p-4 rounded-xl border border-surface-mid space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-ink-muted uppercase flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  Topic Context Chunks ({allContextChunks.length})
                </h4>
                {loadingRelatedChunks && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-ink-muted" />
                )}
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto bg-paper p-2.5 rounded-lg border border-surface-mid/40">
                {allContextChunks.map((c, idx) => {
                  const isPrimary = c.id === chunk?.id;
                  return (
                    <div 
                      key={c.id} 
                      className={`p-2 rounded-md border text-xs bg-paper mb-2 last:mb-0 ${
                        isPrimary 
                          ? "border-emerald-200 bg-emerald-50/20" 
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          isPrimary 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {isPrimary ? "Primary Source Chunk" : `Related Topic Chunk ${idx}`}
                        </span>
                        {c.source_url && (
                          <span className="text-[10px] text-ink-muted truncate max-w-[200px]">
                            {c.source_url}
                          </span>
                        )}
                      </div>
                      <p className="text-ink-secondary leading-relaxed line-clamp-2 italic font-mono text-[11px]">
                        {c.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Auto-detection & Quality Check Summary */}
            <div className="bg-surface-low p-4 rounded-xl border border-surface-mid space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Auto-Detection Details
                </h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  confidence.label === "High" ? "bg-emerald-100 text-emerald-800" :
                  confidence.label === "Medium" ? "bg-amber-100 text-amber-800" :
                  "bg-slate-200 text-slate-800"
                }`}>
                  Confidence: {confidence.label} ({confidence.score}%)
                </span>
              </div>
              
              {confidence.reasons.length > 0 ? (
                <ul className="text-xs text-ink-secondary list-disc pl-4 space-y-1">
                  {confidence.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted italic">Running detection checks...</p>
              )}

              {/* Quality Check Alert */}
              <div className="pt-2 border-t border-surface-mid/60 flex items-start gap-2 text-xs">
                {qualityCheck.passed ? (
                  qualityCheck.isWarning ? (
                    <div className="bg-amber-50 text-amber-800 border border-amber-200 p-2.5 rounded-lg flex items-start gap-1.5 w-full">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="font-bold">Quality Check Warning:</span> {qualityCheck.reason}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2.5 rounded-lg flex items-start gap-1.5 w-full">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                      <div>
                        <span className="font-bold">Quality Check:</span> Passed all criteria. Content is valid.
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-red-50 text-red-800 border border-red-200 p-2.5 rounded-lg flex items-start gap-1.5 w-full">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <span className="font-bold">Quality Check Failed:</span> {qualityCheck.reason}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* Grade Selector */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">
                  Grade <span className="text-red-500">*</span>
                </label>
                {loadingGrades ? (
                  <div className="h-9 border border-surface-mid rounded-lg px-3 flex items-center bg-surface-low text-xs text-ink-muted">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> Loading grades...
                  </div>
                ) : (
                  <select
                    value={selectedGradeId}
                    onChange={(e) => setSelectedGradeId(e.target.value)}
                    className="w-full border border-surface-mid rounded-lg px-3 py-2 text-sm bg-paper text-ink"
                  >
                    <option value="">Auto-detected from chunk metadata</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Subject Selector */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  disabled={!selectedGradeId || loadingSubjects}
                  className="w-full border border-surface-mid rounded-lg px-3 py-2 text-sm bg-paper text-ink disabled:opacity-50"
                >
                  <option value="">
                    {loadingSubjects ? "Loading subjects..." : "Choose subject from selected grade"}
                  </option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Topic Selector / Create Flow */}
              <div className="space-y-1 col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-ink">
                    Topic / Title <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewTopic(!isCreatingNewTopic);
                      if (!isCreatingNewTopic) setSelectedTopicId("");
                    }}
                    disabled={!selectedGradeId || !selectedSubjectId}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    {isCreatingNewTopic ? (
                      <>Select existing topic</>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Create new topic
                      </>
                    )}
                  </button>
                </div>
                
                {isCreatingNewTopic ? (
                  <input
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder="Type a new topic title for the curriculum..."
                    className="w-full border border-surface-mid rounded-lg px-3 py-2 text-sm bg-paper text-ink focus:ring-1 focus:ring-emerald-500"
                  />
                ) : (
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    disabled={!selectedGradeId || !selectedSubjectId || loadingTopics}
                    className="w-full border border-surface-mid rounded-lg px-3 py-2 text-sm bg-paper text-ink disabled:opacity-50"
                  >
                    <option value="">
                      {loadingTopics ? "Loading topics..." : "Select or match a curriculum topic"}
                    </option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Module Name */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">Module Name</label>
                <input
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. Module 1: Mechanics"
                  className="w-full border border-surface-mid rounded-lg px-3 py-2 text-sm bg-paper text-ink"
                />
              </div>

              {/* Country */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-ink">Country</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full border border-surface-mid rounded-lg px-3 py-2 text-sm bg-paper text-ink"
                />
              </div>

              {/* Detected Language Indicator */}
              <div className="space-y-1 col-span-2 bg-slate-50 border border-slate-200/60 p-2.5 rounded-lg flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  Primary Instruction Language
                </span>
                <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase">
                  {language === "ar" ? "Arabic (العربية)" : language === "fr" ? "French (Français)" : "English"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 gap-3 border-t border-surface-mid">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-secondary hover:bg-surface-mid transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!isValid || isExtracting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm"
              >
                {isExtracting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isExtracting ? "Extracting..." : "Generate Lesson"}
              </button>
            </div>
          </div>
        )}

        {(step === "generating" || step === "saving") && (
          <div className="py-16 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-ink">
                {step === "generating" ? "Generating Lesson Plan..." : "Saving official lesson..."}
              </p>
              <p className="text-sm text-ink-muted mt-1">
                {step === "generating"
                  ? "Gemini is building the lesson outline, quizzes, and exercises based on all topic chunks."
                  : "Writing to lessons schema and linking RAG references..."}
              </p>
            </div>
          </div>
        )}

        {step === "preview" && lessonData && (
          <div className="space-y-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <h4 className="font-bold text-emerald-800 text-lg">{lessonData.lesson_title}</h4>
              <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-emerald-700">
                <span className="px-2 py-1 bg-white/60 rounded-md">Grade: {lessonData.grade}</span>
                <span className="px-2 py-1 bg-white/60 rounded-md">Subject: {lessonData.subject}</span>
                {lessonData.mod && <span className="px-2 py-1 bg-white/60 rounded-md">{lessonData.mod}</span>}
              </div>
            </div>

            <div className="border border-surface-mid rounded-xl overflow-hidden bg-paper">
              <div className="bg-surface-low px-4 py-2 border-b border-surface-mid text-xs font-bold uppercase tracking-wide text-ink-muted">
                Structured Blocks
              </div>
              <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
                {lessonData.blocks?.map((b: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono shrink-0 uppercase">
                      {b.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink font-semibold truncate">
                        {b.title || b.label || b.question || "Untitled Block"}
                      </p>
                      {b.content && <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">{b.content}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center text-sm font-semibold">
              <div className="p-3 bg-surface-low rounded-xl border border-surface-mid">
                {lessonData.exercises?.length || 0} Exercises
              </div>
              <div className="p-3 bg-surface-low rounded-xl border border-surface-mid">
                {lessonData.quizzes?.length || 0} Quizzes
              </div>
              <div className="p-3 bg-surface-low rounded-xl border border-surface-mid">
                {lessonData.exam ? "1 Exam" : "0 Exams"}
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3 border-t border-surface-mid">
              <button
                onClick={() => setStep("config")}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-secondary hover:bg-surface-mid transition-colors"
              >
                Back to Edit
              </button>
              <button
                onClick={handleApproveAndSave}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-black text-white font-semibold transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                Approve & Save Lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
