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
    .replace(/[^a-z0-9\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+/g, " ")
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
  arabic: ["Langue Arabe", "Arabe", "Arabic Language", "اللغة العربية", "اللغه العربيه", "العربية"],
  arabe: ["Langue Arabe", "Arabic", "Arabic Language", "اللغة العربية", "اللغه العربيه", "العربية"],
  "arabic language": ["Arabic", "Langue Arabe", "Arabe", "اللغة العربية", "اللغه العربيه", "العربية"],
  "اللغة العربية": ["Arabic", "Arabic Language", "Langue Arabe", "Arabe", "العربية"],
  "اللغه العربيه": ["Arabic", "Arabic Language", "Langue Arabe", "Arabe", "العربية"],
  "العربية": ["Arabic", "Arabic Language", "Langue Arabe", "Arabe", "اللغة العربية"],
  "islamic education": ["Islamic Studies", "Education Islamique", "التربية الإسلامية", "التربيه الاسلاميه", "التربية الاسلامية"],
  "education islamique": ["Islamic Education", "Islamic Studies", "التربية الإسلامية", "التربيه الاسلاميه", "التربية الاسلامية"],
  "التربية الاسلامية": ["Islamic Education", "Islamic Studies", "Education Islamique", "التربية الإسلامية"],
  "التربيه الاسلاميه": ["Islamic Education", "Islamic Studies", "Education Islamique", "التربية الإسلامية"],
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
  // Primary school grades
  "1 primary": ["1ère année primaire", "1ere annee primaire", "1 Primary", "1ère primaire", "1ere primaire", "1 A.P.", "1AP", "Grade 1"],
  "1ere annee primaire": ["1ère année primaire", "1ere annee primaire", "1 Primary", "1ère primaire", "1ere primaire", "1 A.P.", "1AP", "Grade 1"],
  "grade 1": ["1ère année primaire", "1ere annee primaire", "1 Primary", "1ère primaire", "1ere primaire", "1 A.P.", "1AP", "Grade 1"],
  
  "2 primary": ["2ème année primaire", "2eme annee primaire", "2 Primary", "2ème primaire", "2eme primaire", "2 A.P.", "2AP", "Grade 2"],
  "2eme annee primaire": ["2ème année primaire", "2eme annee primaire", "2 Primary", "2ème primaire", "2eme primaire", "2 A.P.", "2AP", "Grade 2"],
  "grade 2": ["2ème année primaire", "2eme annee primaire", "2 Primary", "2ème primaire", "2eme primaire", "2 A.P.", "2AP", "Grade 2"],
  
  "3 primary": ["3ème année primaire", "3eme annee primaire", "3 Primary", "3ème primaire", "3eme primaire", "3 A.P.", "3AP", "Grade 3"],
  "3eme annee primaire": ["3ème année primaire", "3eme annee primaire", "3 Primary", "3ème primaire", "3eme primaire", "3 A.P.", "3AP", "Grade 3"],
  "grade 3": ["3ème année primaire", "3eme annee primaire", "3 Primary", "3ème primaire", "3eme primaire", "3 A.P.", "3AP", "Grade 3"],
  
  "4 primary": ["4ème année primaire", "4eme annee primaire", "4 Primary", "4ème primaire", "4eme primaire", "4 A.P.", "4AP", "Grade 4"],
  "4eme annee primaire": ["4ème année primaire", "4eme annee primaire", "4 Primary", "4ème primaire", "4eme primaire", "4 A.P.", "4AP", "Grade 4"],
  "grade 4": ["4ème année primaire", "4eme annee primaire", "4 Primary", "4ème primaire", "4eme primaire", "4 A.P.", "4AP", "Grade 4"],
  
  "5 primary": ["5ème année primaire", "5eme annee primaire", "5 Primary", "5ème primaire", "5eme primaire", "5 A.P.", "5AP", "Grade 5"],
  "5eme annee primaire": ["5ème année primaire", "5eme annee primaire", "5 Primary", "5ème primaire", "5eme primaire", "5 A.P.", "5AP", "Grade 5"],
  "grade 5": ["5ème année primaire", "5eme annee primaire", "5 Primary", "5ème primaire", "5eme primaire", "5 A.P.", "5AP", "Grade 5"],
  
  "6 primary": ["6ème année primaire", "6eme annee primaire", "6 Primary", "6ème primaire", "6eme primaire", "6 A.P.", "6AP", "Grade 6"],
  "6eme annee primaire": ["6ème année primaire", "6eme annee primaire", "6 Primary", "6ème primaire", "6eme primaire", "6 A.P.", "6AP", "Grade 6"],
  "grade 6": ["6ème année primaire", "6eme annee primaire", "6 Primary", "6ème primaire", "6eme primaire", "6 A.P.", "6AP", "Grade 6"],

  // Middle school (Collège) grades
  "1 college": ["1ère année collège", "1ere annee college", "1 College", "1ère collège", "1ere college", "1 A.C.", "1AC", "Grade 7", "7th Grade"],
  "1ere annee college": ["1ère année collège", "1ere annee college", "1 College", "1ère collège", "1ere college", "1 A.C.", "1AC", "Grade 7", "7th Grade"],
  "grade 7": ["1ère année collège", "1ere annee college", "1 College", "1ère collège", "1ere college", "1 A.C.", "1AC", "Grade 7", "7th Grade"],
  
  "2 college": ["2ème année collège", "2eme annee college", "2 College", "2ème collège", "2eme college", "2 A.C.", "2AC", "Grade 8", "8th Grade"],
  "2eme annee college": ["2ème année collège", "2eme annee college", "2 College", "2ème collège", "2eme college", "2 A.C.", "2AC", "Grade 8", "8th Grade"],
  "grade 8": ["2ème année collège", "2eme annee college", "2 College", "2ème collège", "2eme college", "2 A.C.", "2AC", "Grade 8", "8th Grade"],
  
  "3 college": ["3ème année collège", "3eme annee college", "3 College", "3ème collège", "3eme college", "3 A.C.", "3AC", "Grade 9", "9th Grade"],
  "3eme annee college": ["3ème année collège", "3eme annee college", "3 College", "3ème collège", "3eme college", "3 A.C.", "3AC", "Grade 9", "9th Grade"],
  "grade 9": ["3ème année collège", "3eme annee college", "3 College", "3ème collège", "3eme college", "3 A.C.", "3AC", "Grade 9", "9th Grade"],

  // High school grades
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
  "tronc commun scientifique": ["Tronc Commun", "Tronc Commun Scientifique", "Seconde", "TC", "Grade 10"],
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
      : normalizedName.includes("arab") || normalizedCategory.includes("arab") || normalizedName.includes("العربية") || normalizedCategory.includes("العربية")
      ? SUBJECT_EQUIVALENTS.arabic || []
      : normalizedName.includes("islam") || normalizedCategory.includes("islam") || normalizedName.includes("التربية الاسلامية") || normalizedCategory.includes("التربية الاسلامية")
      ? SUBJECT_EQUIVALENTS["islamic education"] || []
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
  const inferredCandidates = normalizedGrade.includes("tronc commun")
    ? GRADE_EQUIVALENTS["tronc commun"] || []
    : [];
  return uniqueValues([
    grade,
    ...((GRADE_EQUIVALENTS[normalizedGrade] || []) as string[]),
    ...inferredCandidates,
  ]);
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
