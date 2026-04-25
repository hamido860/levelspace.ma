// Official curriculum reference data per country
// Source: MEN Morocco, national curriculum frameworks

export interface CurriculumEntry {
  country: string;
  grade: string;
  subject: string;
  language: string;
  topics: string[];
  learningObjectives: string[];
  assessmentTypes: string[];
  officialRef: string;
}

export const CURRICULUM_DB: CurriculumEntry[] = [
  // ─── MOROCCO — 2ème année Bac Sciences Mathématiques ────────────────────
  {
    country: "Morocco",
    grade: "2ème année Bac",
    subject: "Mathématiques",
    language: "fr",
    topics: [
      "Suites numériques",
      "Limites et continuité",
      "Dérivabilité et étude de fonctions",
      "Calcul intégral",
      "Nombres complexes",
      "Probabilités et statistiques",
      "Géométrie dans l'espace",
      "Dénombrement",
      "Équations différentielles",
    ],
    learningObjectives: [
      "Maîtriser le raisonnement mathématique rigoureux",
      "Résoudre des problèmes d'analyse et d'algèbre",
      "Appliquer les mathématiques aux sciences physiques",
    ],
    assessmentTypes: ["Examen national", "Contrôle continu", "Devoir surveillé"],
    officialRef: "MEN Maroc — Programme officiel 2ème Bac SM",
  },
  {
    country: "Morocco",
    grade: "2ème année Bac",
    subject: "Physique-Chimie",
    language: "fr",
    topics: [
      "Ondes mécaniques et lumineuses",
      "Électricité — dipôles RC et RL",
      "Oscillations mécaniques libres",
      "Transformations nucléaires",
      "Cinétique chimique",
      "Réactions acido-basiques",
      "Réactions d'oxydoréduction",
      "Chimie organique",
    ],
    learningObjectives: [
      "Comprendre les phénomènes physiques et chimiques",
      "Conduire des expériences et analyser des résultats",
      "Résoudre des problèmes quantitatifs",
    ],
    assessmentTypes: ["Examen national", "TP noté", "Devoir surveillé"],
    officialRef: "MEN Maroc — Programme officiel 2ème Bac Physique-Chimie",
  },
  {
    country: "Morocco",
    grade: "2ème année Bac",
    subject: "Philosophie",
    language: "ar",
    topics: [
      "الوضع البشري",
      "نظرية المعرفة",
      "الفلسفة السياسية",
      "الأخلاق",
      "الوجود والزمان",
      "المنطق والاستدلال",
    ],
    learningObjectives: [
      "تحليل النصوص الفلسفية",
      "بناء حجج فلسفية متماسكة",
      "الربط بين الفلسفة والواقع",
    ],
    assessmentTypes: ["امتحان وطني", "مراقبة مستمرة"],
    officialRef: "وزارة التربية الوطنية — برنامج الفلسفة 2 بكالوريا",
  },
  {
    country: "Morocco",
    grade: "2ème année Bac",
    subject: "SVT",
    language: "fr",
    topics: [
      "Génétique et expression de l'information génétique",
      "Immunologie",
      "Neurophysiologie",
      "Géologie — Tectonique des plaques",
      "Évolution des êtres vivants",
    ],
    learningObjectives: [
      "Comprendre les mécanismes biologiques fondamentaux",
      "Analyser des données expérimentales",
      "Relier biologie et géologie",
    ],
    assessmentTypes: ["Examen national", "TP noté"],
    officialRef: "MEN Maroc — Programme SVT 2ème Bac",
  },
  {
    country: "Morocco",
    grade: "1ère année Bac",
    subject: "Mathématiques",
    language: "fr",
    topics: [
      "Logique et raisonnement",
      "Fonctions numériques",
      "Suites arithmétiques et géométriques",
      "Trigonométrie",
      "Statistiques descriptives",
      "Probabilités",
      "Géométrie analytique",
    ],
    learningObjectives: [
      "Consolider les bases mathématiques",
      "Introduire l'analyse et l'algèbre de niveau bac",
    ],
    assessmentTypes: ["Contrôle continu", "Devoir surveillé"],
    officialRef: "MEN Maroc — Programme 1ère Bac",
  },
  {
    country: "Morocco",
    grade: "Tronc Commun",
    subject: "Mathématiques",
    language: "fr",
    topics: [
      "Ensembles et raisonnement",
      "Fonctions affines et quadratiques",
      "Géométrie plane",
      "Statistiques",
      "Calcul numérique",
    ],
    learningObjectives: [
      "Développer le raisonnement logique",
      "Maîtriser les calculs fondamentaux",
    ],
    assessmentTypes: ["Contrôle continu"],
    officialRef: "MEN Maroc — Programme Tronc Commun",
  },
  {
    country: "Morocco",
    grade: "Middle 3",
    subject: "Arabic",
    language: "ar",
    topics: [
      "القراءة والفهم",
      "التعبير الكتابي",
      "النحو والصرف",
      "البلاغة",
      "الأدب العربي",
    ],
    learningObjectives: [
      "إتقان مهارات اللغة العربية الأربع",
      "تحليل النصوص الأدبية",
    ],
    assessmentTypes: ["مراقبة مستمرة", "إنشاء كتابي"],
    officialRef: "وزارة التربية الوطنية — برنامج اللغة العربية",
  },

  // ─── FRANCE ──────────────────────────────────────────────────────────────
  {
    country: "France",
    grade: "Terminale",
    subject: "Mathématiques",
    language: "fr",
    topics: [
      "Analyse — fonctions, limites, dérivées",
      "Algèbre — matrices, suites",
      "Probabilités et statistiques",
      "Géométrie dans l'espace",
    ],
    learningObjectives: [
      "Préparer aux études supérieures scientifiques",
      "Maîtriser la démonstration rigoureuse",
    ],
    assessmentTypes: ["Baccalauréat", "Contrôle continu"],
    officialRef: "Éducation nationale française — BO spécial n°8",
  },

  // ─── USA ─────────────────────────────────────────────────────────────────
  {
    country: "USA",
    grade: "Grade 12",
    subject: "Mathematics",
    language: "en",
    topics: [
      "Pre-Calculus",
      "Calculus AB/BC",
      "Statistics and Probability",
      "Linear Algebra (advanced)",
    ],
    learningObjectives: [
      "Prepare for college-level mathematics",
      "Apply mathematical reasoning to real-world problems",
    ],
    assessmentTypes: ["SAT", "AP Exam", "Standardized Tests"],
    officialRef: "Common Core State Standards — Mathematics",
  },
];

export function getCurriculumEntries(
  country: string,
  grade: string,
  subject: string,
): CurriculumEntry[] {
  const c = country.toLowerCase();
  const g = grade.toLowerCase();
  const s = subject.toLowerCase();

  return CURRICULUM_DB.filter(
    (e) =>
      e.country.toLowerCase().includes(c) ||
      c.includes(e.country.toLowerCase()),
  ).filter(
    (e) =>
      e.grade.toLowerCase().includes(g) ||
      g.includes(e.grade.toLowerCase()),
  ).filter(
    (e) =>
      e.subject.toLowerCase().includes(s) ||
      s.includes(e.subject.toLowerCase()),
  );
}
