import { supabase } from "../db/supabase";

export type CurriculumReviewContentType = "lesson" | "topic" | "rag_chunk" | "rag_question";
export type CurriculumReviewAction =
  | "teacher_reviewed"
  | "official_validated"
  | "reject"
  | "request_regeneration"
  | "save_manual_edits";

export interface CurriculumReviewItem {
  id: string;
  content_type: CurriculumReviewContentType;
  title: string;
  preview: string;
  grade: string | null;
  subject: string | null;
  topic: string | null;
  country: string | null;
  track: string | null;
  validation_status: string;
  source_confidence: number;
  source_name: string | null;
  source_url: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface CurriculumSourceRefRecord {
  id: string;
  country: string | null;
  cycle: string | null;
  grade: string | null;
  track: string | null;
  subject: string | null;
  topic_title: string | null;
  source_name: string | null;
  source_url: string | null;
  source_type: string | null;
  confidence_weight: number;
  created_at: string | null;
}

export interface CurriculumReviewAudit {
  id: string;
  content_id: string;
  content_type: CurriculumReviewContentType;
  validation_result: string;
  mismatches: Record<string, unknown>;
  recommendation: string | null;
  created_at: string | null;
}

export interface CurriculumReviewDetail {
  item: CurriculumReviewItem;
  raw: Record<string, any>;
  linked_source_ref: CurriculumSourceRefRecord | null;
  latest_audit: CurriculumReviewAudit | null;
  preview_blocks: Array<Record<string, any>>;
}

async function getAdminApiHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Demo admin check MUST come first — a stale non-admin session token
  // in the browser will otherwise override the bypass header and cause 403s.
  if (typeof localStorage !== "undefined" && localStorage.getItem("demo_admin_logged_in") === "true") {
    headers["x-levelspace-demo-admin"] = "true";
    return headers;
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function parseError(response: Response) {
  try {
    const payload = await response.json();
    return payload.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function getJson<T>(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: await getAdminApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: await getAdminApiHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
}

export async function getCurriculumReviewItems(filters: {
  content_type?: CurriculumReviewContentType | "all";
  grade?: string;
  subject?: string;
  topic?: string;
  validation_status?: string;
  source_confidence?: string;
} = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  });

  const payload = await getJson<{ items: CurriculumReviewItem[] }>(
    `/api/admin/curriculum-review${params.toString() ? `?${params.toString()}` : ""}`,
  );
  return payload.items || [];
}

export async function getCurriculumReviewDetail(
  contentType: CurriculumReviewContentType,
  contentId: string,
) {
  const params = new URLSearchParams({
    content_type: contentType,
    content_id: contentId,
  });

  const payload = await getJson<{ detail: CurriculumReviewDetail }>(
    `/api/admin/curriculum-review-detail?${params.toString()}`,
  );
  return payload.detail;
}

export async function applyCurriculumReview(
  payload: {
    content_type: CurriculumReviewContentType;
    content_id: string;
    action: CurriculumReviewAction;
    review_notes?: string;
    title?: string;
    content?: string;
    answer?: string;
    source_ref_id?: string;
    source_name?: string;
    source_url?: string;
  },
) {
  const response = await postJson<{ detail: CurriculumReviewDetail }>(
    "/api/admin/curriculum-review-action",
    payload,
  );

  return response.detail;
}
