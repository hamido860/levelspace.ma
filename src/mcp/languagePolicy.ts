export type LangCode = "ar" | "fr" | "en" | "de" | "es" | "ja";

export interface LangPolicy {
  lang: LangCode;
  label: string;
  // Keywords that if found in the wrong language, flag a violation
  forbiddenMixMarkers?: string[];
}

// ---------------------------------------------------------------------------
// Per-subject language policy per country
// Key format: "<country_code>|<subject_keyword_lowercase>"
// The subject keyword is matched with .includes() so partial matches work
// ---------------------------------------------------------------------------

export const SUBJECT_LANG_POLICY: Record<string, LangCode> = {

  // ─── MOROCCO (MEN — Ministère de l'Éducation Nationale) ─────────────────
  // Arabic-only subjects
  "ma|arabic": "ar",
  "ma|arabe": "ar",
  "ma|اللغة العربية": "ar",
  "ma|islamic": "ar",
  "ma|islamique": "ar",
  "ma|تربية إسلامية": "ar",
  "ma|التربية الإسلامية": "ar",
  "ma|histoire": "ar",           // Histoire-Géo taught in Arabic
  "ma|geography": "ar",
  "ma|géographie": "ar",
  "ma|التاريخ": "ar",
  "ma|الجغرافيا": "ar",
  "ma|philosophie": "ar",        // Philosophy at BAC level → Arabic
  "ma|philosophy": "ar",
  "ma|الفلسفة": "ar",
  "ma|civic": "ar",
  "ma|التربية الوطنية": "ar",
  "ma|التربية البدنية": "ar",

  // French-only subjects
  "ma|math": "fr",
  "ma|physique": "fr",
  "ma|physics": "fr",
  "ma|chimie": "fr",
  "ma|chemistry": "fr",
  "ma|svt": "fr",
  "ma|science de la vie": "fr",
  "ma|life and earth": "fr",
  "ma|sciences de l'ingénieur": "fr",
  "ma|ingénieur": "fr",
  "ma|informatique": "fr",
  "ma|computer": "fr",
  "ma|économie": "fr",
  "ma|economics": "fr",
  "ma|gestion": "fr",
  "ma|technologie": "fr",
  "ma|français": "fr",
  "ma|french language": "fr",

  // English
  "ma|english": "en",
  "ma|anglais": "en",

  // ─── FRANCE ─────────────────────────────────────────────────────────────
  "fr|": "fr",   // All subjects in France → French

  // ─── USA ────────────────────────────────────────────────────────────────
  "us|": "en",
  "usa|": "en",

  // ─── UK ─────────────────────────────────────────────────────────────────
  "uk|": "en",

  // ─── GERMANY ─────────────────────────────────────────────────────────────
  "de|": "de",
  "germany|": "de",

  // ─── SPAIN ──────────────────────────────────────────────────────────────
  "es|": "es",
  "spain|": "es",

  // ─── JAPAN ──────────────────────────────────────────────────────────────
  "jp|": "ja",
  "japan|": "ja",

  // ─── INTERNATIONAL BACCALAUREATE ─────────────────────────────────────────
  "ib|": "en",
  "international baccalaureate|": "en",

  // ─── CAMBRIDGE IGCSE ────────────────────────────────────────────────────
  "cambridge|": "en",
};

export const LANG_LABELS: Record<LangCode, string> = {
  ar: "Arabic (العربية)",
  fr: "French (Français)",
  en: "English",
  de: "German (Deutsch)",
  es: "Spanish (Español)",
  ja: "Japanese (日本語)",
};

// ---------------------------------------------------------------------------
// Language detector — pure heuristic, no API needed
// ---------------------------------------------------------------------------

export interface DetectionResult {
  dominant: LangCode | "unknown";
  arabicRatio: number;
  latinRatio: number;
  isMixed: boolean;   // true if significant presence of a second language
  details: string;
}

const FRENCH_MARKERS = [
  "le ", "la ", "les ", "de ", "du ", "des ", "un ", "une ",
  "est ", "sont ", "avec ", "pour ", "dans ", "qui ", "que ",
  "comme ", "mais ", "ou ", "et ", "donc ", "car ",
];

const ARABIC_MARKERS = [
  "في ", "من ", "على ", "إلى ", "هذا ", "هذه ", "التي ", "الذي ",
  "مع ", "كان ", "يكون ", "أن ", "لأن ", "لكن ", "أو ", "و ",
];

export function detectLanguage(text: string): DetectionResult {
  if (!text || text.trim().length < 20) {
    return { dominant: "unknown", arabicRatio: 0, latinRatio: 0, isMixed: false, details: "Text too short" };
  }

  const total = text.length;
  const arabicChars = (text.match(/[؀-ۿ]/g) || []).length;
  const latinChars  = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;

  const arabicRatio = arabicChars / total;
  const latinRatio  = latinChars  / total;

  // Detect French vs English from Latin text
  const lower = text.toLowerCase();
  const frenchHits = FRENCH_MARKERS.filter(m => lower.includes(m)).length;
  const isFrench   = frenchHits >= 3;

  let dominant: LangCode | "unknown" = "unknown";

  if (arabicRatio > 0.25) {
    dominant = "ar";
  } else if (latinRatio > 0.35) {
    dominant = isFrench ? "fr" : "en";
  }

  // Mixed: meaningful presence of a second script alongside dominant
  const isMixed =
    (dominant === "ar" && latinRatio > 0.15) ||
    (dominant !== "ar" && arabicRatio > 0.10);

  const details = `Arabic ${(arabicRatio * 100).toFixed(1)}% | Latin ${(latinRatio * 100).toFixed(1)}% | French markers: ${frenchHits}`;

  return { dominant, arabicRatio, latinRatio, isMixed, details };
}

// ---------------------------------------------------------------------------
// Policy resolver — given country + subject → expected language
// ---------------------------------------------------------------------------

export function resolveExpectedLanguage(
  country: string,
  subject: string,
): LangCode | null {
  const c = country.toLowerCase().trim();
  const s = subject.toLowerCase().trim();

  // Try specific subject match first
  for (const [key, lang] of Object.entries(SUBJECT_LANG_POLICY)) {
    const [keyCountry, keySubject] = key.split("|");
    const countryMatch =
      c === keyCountry ||
      c.includes(keyCountry) ||
      keyCountry === "";
    const subjectMatch =
      keySubject === "" ||
      s.includes(keySubject) ||
      keySubject.includes(s);

    if (countryMatch && subjectMatch && keySubject !== "") {
      return lang;
    }
  }

  // Fall back to country-wide default (empty subject key)
  for (const [key, lang] of Object.entries(SUBJECT_LANG_POLICY)) {
    const [keyCountry, keySubject] = key.split("|");
    if (keySubject === "" && (c === keyCountry || c.includes(keyCountry))) {
      return lang;
    }
  }

  return null; // unknown
}
