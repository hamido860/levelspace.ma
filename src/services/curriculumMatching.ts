const uniqueValues = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed) continue;

    const normalized = normalizeCurriculumValue(trimmed);
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
};

export const normalizeCurriculumValue = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const SUBJECT_EQUIVALENTS: Record<string, string[]> = {
  mathematics: ["Mathématiques", "Mathematiques", "Maths", "Math"],
  mathematiques: ["Mathématiques", "Mathematics", "Maths", "Math"],
  "physics chemistry": ["Physique-Chimie", "Physics", "Chemistry", "Physics-Chemistry"],
  "physique chimie": ["Physique-Chimie", "Physics", "Chemistry", "Physics-Chemistry"],
  biology: ["Sciences de la Vie et de la Terre (SVT)", "SVT", "Life and Earth Sciences"],
  svt: ["Sciences de la Vie et de la Terre (SVT)", "Biology", "Life and Earth Sciences"],
  "life and earth sciences": ["Sciences de la Vie et de la Terre (SVT)", "SVT", "Biology"],
  engineering: ["Sciences de l'Ingénieur", "Engineering Sciences", "Technology"],
  "engineering sciences": ["Sciences de l'Ingénieur", "Engineering", "Technology"],
  "sciences de lingenieur": ["Sciences de l'Ingénieur", "Engineering", "Engineering Sciences"],
  accounting: ["Comptabilité", "Finance", "Business"],
  comptabilite: ["Comptabilité", "Accounting", "Finance", "Business"],
  french: ["Langue Française", "Français", "French Language"],
  francais: ["Langue Française", "Français", "French", "French Language"],
  arabic: ["Langue Arabe", "Arabe", "Arabic Language"],
  arabe: ["Langue Arabe", "Arabic", "Arabic Language"],
  english: ["Anglais", "English Language"],
  anglais: ["English", "English Language"],
  philosophy: ["Philosophie"],
  philosophie: ["Philosophy"],
  history: ["Histoire-Géographie", "History-Geography", "Histoire"],
  "histoire geographie": ["Histoire-Géographie", "History-Geography", "History", "Geography"],
  geography: ["Histoire-Géographie", "Géographie", "History-Geography"],
  economics: ["Économie", "Economy"],
  economie: ["Économie", "Economics", "Economy"],
  management: ["Sciences de Gestion", "Business Studies", "Gestion"],
  "sciences de gestion": ["Sciences de Gestion", "Management", "Business Studies"],
  "computer science": ["Informatique", "IT", "Computer"],
  informatique: ["Informatique", "Computer Science", "IT"],
};

const GRADE_EQUIVALENTS: Record<string, string[]> = {
  "grade 12": ["Terminale", "2ème année Bac", "2eme annee Bac", "2ème Bac", "2eme Bac", "Bac 2", "Tle"],
  terminale: ["Terminale", "2ème année Bac", "2eme annee Bac", "2ème Bac", "2eme Bac", "Bac 2", "Tle"],
  "2eme annee bac": ["2ème année Bac", "2eme annee Bac", "Terminale", "2ème Bac", "2eme Bac", "Bac 2"],
  "2eme bac": ["2ème Bac", "2eme Bac", "2ème année Bac", "2eme annee Bac", "Terminale", "Bac 2"],
  "grade 11": ["Première", "1ère année Bac", "1ere annee Bac", "1ère Bac", "1ere Bac", "Bac 1"],
  premiere: ["Première", "1ère année Bac", "1ere annee Bac", "1ère Bac", "1ere Bac", "Bac 1"],
  "1ere annee bac": ["1ère année Bac", "1ere annee Bac", "Première", "1ère Bac", "1ere Bac", "Bac 1"],
  "1ere bac": ["1ère Bac", "1ere Bac", "1ère année Bac", "1ere annee Bac", "Première", "Bac 1"],
  "grade 10": ["Tronc Commun", "Seconde", "TC"],
  "tronc commun": ["Tronc Commun", "Seconde", "TC", "Grade 10"],
  seconde: ["Seconde", "Tronc Commun", "TC", "Grade 10"],
};

export const isGenericCurriculumCategory = (value: string | null | undefined) => {
  const normalized = normalizeCurriculumValue(String(value || ""));
  return !normalized || ["general", "subject", "classroom", "course"].includes(normalized);
};

export const getSubjectCandidates = (name: string, category?: string | null) => {
  const normalizedName = normalizeCurriculumValue(name);
  const normalizedCategory = normalizeCurriculumValue(String(category || ""));
  const inferredCandidates =
    normalizedName.includes("fran") || normalizedCategory.includes("fran")
      ? SUBJECT_EQUIVALENTS.francais || []
      : [];
  const categoryCandidates = isGenericCurriculumCategory(category)
    ? []
    : [String(category || ""), ...((SUBJECT_EQUIVALENTS[normalizedCategory] || []) as string[])];

  return uniqueValues([
    name,
    ...((SUBJECT_EQUIVALENTS[normalizedName] || []) as string[]),
    ...inferredCandidates,
    ...categoryCandidates,
  ]);
};

export const getGradeCandidates = (grade: string) => {
  const normalizedGrade = normalizeCurriculumValue(grade);
  return uniqueValues([grade, ...((GRADE_EQUIVALENTS[normalizedGrade] || []) as string[])]);
};

export const deriveCycleFromGrade = (grade: string) => {
  const normalizedGrade = normalizeCurriculumValue(grade);

  if (
    normalizedGrade.includes("primaire") ||
    normalizedGrade.startsWith("primary") ||
    normalizedGrade.includes("elementary")
  ) {
    return "primary";
  }

  if (
    normalizedGrade.includes("college") ||
    normalizedGrade.includes("collège") ||
    normalizedGrade.startsWith("middle")
  ) {
    return "college";
  }

  if (
    normalizedGrade.includes("tronc commun") ||
    normalizedGrade.includes("bac") ||
    normalizedGrade.includes("seconde") ||
    normalizedGrade.includes("premiere") ||
    normalizedGrade.includes("terminale") ||
    normalizedGrade.startsWith("grade 10") ||
    normalizedGrade.startsWith("grade 11") ||
    normalizedGrade.startsWith("grade 12")
  ) {
    return "lycee";
  }

  return "higher";
};

export const pickBestCurriculumMatch = <T extends { name?: string | null }>(
  rows: T[] | null | undefined,
  requestedCandidates: string[],
) => {
  if (!rows || rows.length === 0) return null;

  for (const candidate of requestedCandidates) {
    const exact = rows.find((row) => row.name === candidate);
    if (exact) return exact;
  }

  const normalizedCandidates = new Set(requestedCandidates.map(normalizeCurriculumValue));
  return rows.find((row) => normalizedCandidates.has(normalizeCurriculumValue(String(row.name || "")))) || null;
};
