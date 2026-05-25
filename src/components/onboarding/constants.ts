import { GraduationCap, BookA, BrainCircuit, LibraryBig } from 'lucide-react';

export const CYCLES = [
  { id: 'primary', name: 'Primary Education', desc: 'Enseignement Primaire', icon: BookA },
  { id: 'college', name: 'Middle School', desc: 'Collège', icon: LibraryBig },
  { id: 'lycee', name: 'High School', desc: 'Lycée', icon: GraduationCap },
  { id: 'higher', name: 'Higher Education', desc: 'Classes Préparatoires / Univ', icon: BrainCircuit },
];

export const GRADES_MAP: Record<string, string[]> = {
  primary: [
    '1ère année primaire', '2ème année primaire', '3ème année primaire',
    '4ème année primaire', '5ème année primaire', '6ème année primaire'
  ],
  college: [
    '1ère année collège', '2ème année collège', '3ème année collège'
  ],
  lycee: [
    'Tronc Commun', '1ère année Bac', '2ème année Bac'
  ],
  higher: [
    'CPGE (1ère année)', 'CPGE (2ème année)'
  ]
};

export const TRACKS_MAP: Record<string, string[]> = {
  'Tronc Commun': ['Tronc Commun Scientifique', 'Tronc Commun Littéraire', 'Tronc Commun Technologique'],
  '1ère année Bac': ['Sciences Mathématiques', 'Sciences Expérimentales', 'Sciences et Technologies', 'Lettres et Sciences Humaines', 'Sciences Économiques et Gestion'],
  '2ème année Bac': ['Sciences Mathématiques A', 'Sciences Mathématiques B', 'Sciences Physiques', 'SVT', 'Sciences Agronomiques', 'Lettres', 'Sciences Humaines', 'Sciences Économiques', 'Techniques de Gestion Comptable']
};
