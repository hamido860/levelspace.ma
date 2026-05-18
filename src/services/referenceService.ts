// ─── Quran ──────────────────────────────────────────────────────────────────

export interface QuranSurah {
  number: number;
  name: string;               // Arabic
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface QuranAyah {
  number: number;
  numberInSurah: number;
  text: string;
}

export interface QuranSurahFull extends QuranSurah {
  ayahs: QuranAyah[];
}

export async function fetchQuranSurahs(): Promise<QuranSurah[]> {
  const res = await fetch('https://api.alquran.cloud/v1/surah');
  const json = await res.json();
  return json.data as QuranSurah[];
}

export async function fetchQuranSurah(number: number): Promise<QuranSurahFull> {
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
  const json = await res.json();
  return json.data as QuranSurahFull;
}

// ─── Dictionary ──────────────────────────────────────────────────────────────

export interface DictPhonetic {
  text?: string;
  audio?: string;
}

export interface DictDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface DictEntry {
  word: string;
  phonetic?: string;
  phonetics: DictPhonetic[];
  meanings: DictMeaning[];
}

export async function lookupWord(word: string, lang: 'en' | 'fr'): Promise<DictEntry[]> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.trim())}`);
  if (!res.ok) throw new Error('Word not found');
  return res.json() as Promise<DictEntry[]>;
}

// ─── Wikipedia ───────────────────────────────────────────────────────────────

export interface WikiSearchResult {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description?: string;
}

export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: { source: string };
  content_urls?: { desktop: { page: string } };
}

export async function searchWikipedia(query: string, lang: 'en' | 'fr' = 'en'): Promise<WikiSearchResult[]> {
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=8`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.pages ?? []) as WikiSearchResult[];
}

export async function getWikipediaSummary(key: string, lang: 'en' | 'fr' = 'en'): Promise<WikiSummary> {
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error('Article not found');
  return res.json() as Promise<WikiSummary>;
}
