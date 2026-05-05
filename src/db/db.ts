import Dexie, { Table } from 'dexie';

export interface Module {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  progress: number;
  selected: boolean;
  createdAt: number;
  tags?: string[];
  strictRAG?: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  dueDate?: string;
  type: 'assignment' | 'reading' | 'quiz' | 'general' | 'exam' | 'controle';
  tags?: string[];
}

export interface ScheduleEvent {
  id: string;
  date: string;
  month: string;
  title: string;
  time: string;
  location: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  status: 'suggested' | 'pending' | 'active' | 'done';
  createdAt: number;
  blocks?: any[];
  subtitle?: string;
  tags?: string[];
  teaching_contract?: unknown;
}

export interface Note {
  id: string;
  lessonId: string;
  content: string;
  createdAt: number;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'url' | 'document' | 'other';
  category?: string;
  tags?: string[];
  createdAt: number;
}

export interface AICache {
  key: string;
  response: any;
  createdAt: number;
}

export class AppDatabase extends Dexie {
  modules!: Table<Module>;
  tasks!: Table<Task>;
  schedule!: Table<ScheduleEvent>;
  lessons!: Table<Lesson>;
  notes!: Table<Note>;
  resources!: Table<Resource>;
  settings!: Table<{ key: string, value: any }>;
  aiCache!: Table<AICache>;

  constructor() {
    super('LevelSpaceDB');
    this.version(6).stores({
      modules: 'id, category, selected, createdAt',
      tasks: 'id, completed, createdAt, dueDate',
      schedule: 'id, date, month',
      lessons: 'id, moduleId, status, createdAt',
      notes: 'id, lessonId, createdAt',
      resources: 'id, type, category, createdAt',
      settings: 'key',
      aiCache: 'key, createdAt'
    });
  }
}

export const db = new AppDatabase();
