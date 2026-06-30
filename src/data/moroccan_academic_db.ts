export const moroccanAcademicDb = {
  "moroccan_academic_structure": {
    "primary_education": {
      "official_name": "التعليم الإبتدائي (Enseignement Primaire)",
      "grades": [
        { "id": 1, "name_ar": "المستوى الأول", "name_fr": "1ère année primaire" },
        { "id": 6, "name_ar": "المستوى السادس", "name_fr": "6ème année primaire" }
      ],
      "study_modules": [
        { "name": "Mathematics", "lessons": ["Arithmétique", "Géométrie", "Mesure", "Organisation des données", "Calcul Mental"] },
        { "name": "Arabic Language", "lessons": ["القراءة", "التراكيب", "الصرف والتحويل", "الإملاء", "الشكل والتطبيقات"] },
        { "name": "French Language", "lessons": ["Lexique", "Grammaire", "Conjugaison", "Orthographe", "Production de l'écrit"] }
      ],
      "resources": ["Textbooks", "TelmidTICE"]
    },
    "lower_secondary_education": {
      "official_name": "التعليم الثانوي الإعدادي (Collège)",
      "study_modules": [
        { "name": "Physics-Chemistry", "lessons": ["Propriétés physiques de la matière", "Mélanges et corps purs", "Le circuit électrique simple", "Combustions", "Lois du courant continu"] },
        { "name": "Life and Earth Sciences (SVT)", "lessons": ["Théorie de la tectonique des plaques", "Séismes et relation avec la tectonique", "Volcanisme", "Formation des roches sédimentaires", "Équilibres naturels"] }
      ],
      "resources": ["Regional Exam Archives"]
    },
    "upper_secondary_education": {
      "official_name": "التعليم الثانوي التأهيلي (Lycée)",
      "levels": [
        {
          "name_fr": "Tronc Commun",
          "sections": [
            { "name": "Tronc Commun Scientifique", "subjects": ["Mathématiques", "Physique-Chimie", "SVT", "Français", "Informatique", "Arabe", "Education Islamique", "Histoire-Géo"] },
            { "name": "Tronc Commun Littéraire", "subjects": ["Arabe", "Français", "Histoire-Géo", "Education Islamique", "Mathématiques", "Informatique"] },
            { "name": "Tronc Commun Technologique", "subjects": ["Mathématiques", "Physique-Chimie", "Sciences de l'Ingénieur", "Français", "Informatique"] }
          ]
        },
        {
          "name_fr": "1ère année Bac",
          "tracks": [
            { 
              "name": "Sciences Mathématiques A/B", 
              "subjects": ["Mathématiques", "Physique-Chimie", "Sciences de la Vie et de la Terre (SVT)", "Français", "Informatique"],
              "description": "Filière d'excellence axée sur les mathématiques et les sciences physiques."
            },
            { "name": "Sciences Expérimentales", "subjects": ["SVT", "Physique-Chimie", "Mathématiques", "Français"] },
            { "name": "Sciences et Technologies", "subjects": ["Sciences de l'Ingénieur", "Mathématiques", "Physique-Chimie", "Français"] }
          ]
        },
        {
          "name_fr": "2ème année Bac",
          "tracks": [
            { "name": "Sciences Mathématiques A", "subjects": ["Mathématiques", "Physique-Chimie", "SVT", "Philosophie", "Anglais"] },
            { "name": "Sciences Mathématiques B", "subjects": ["Mathématiques", "Physique-Chimie", "Sciences de l'Ingénieur", "Philosophie", "Anglais"] },
            { "name": "Sciences Physiques", "subjects": ["Physique-Chimie", "Mathématiques", "SVT", "Philosophie", "Anglais"] },
            { "name": "SVT", "subjects": ["SVT", "Physique-Chimie", "Mathématiques", "Philosophie", "Anglais"] }
          ]
        }
      ]
    },
    "higher_education_and_vocational": {
      "sectors": [
        { "name": "Engineering (CPGE)", "modules": [{ "name": "Analysis", "lessons": ["Suites numériques", "Continuité et dérivabilité", "Séries numériques", "Intégration de Riemann", "Séries de fonctions"] }] }
      ]
    }
  }
};
