export type Grade = string;

export interface Module {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  selected: boolean;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  readTime: string;
  isCore: boolean;
  content: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'short-answer';
  text: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  moduleName: string;
  timeLimitMinutes: number;
  questions: Question[];
}
