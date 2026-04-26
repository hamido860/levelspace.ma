export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: {
    text?: string;
    audio?: string;
  }[];
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
    }[];
  }[];
}

export async function fetchDefinition(word: string): Promise<DictionaryEntry | null> {
  const cleanWord = word.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

  // Only attempt for single words
  if (cleanWord.split(/\s+/).length > 1) return null;

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data[0] as DictionaryEntry;
  } catch (error) {
    console.error("Error fetching definition:", error);
    return null;
  }
}
