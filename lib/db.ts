import Dexie, { type EntityTable } from "dexie";

export type MaterialType = "note" | "link" | "pdf";
export type TaskType = "read" | "flashcard" | "recall";
export type TaskStatus = "todo" | "done" | "skipped";

export interface Material {
  id: number;
  type: MaterialType;
  title: string;
  content?: string;
  url?: string;
  blob?: Blob;
  tags: string[];
  isDemo: boolean;
  createdAt: number;
}

export interface Course {
  id: number;
  title: string;
  materialIds: number[];
  wordsPerMinute?: number;
  targetDate?: string;
  createdAt: number;
}

export interface Module {
  id: number;
  courseId: number;
  title: string;
  order: number;
  reason?: string;
}

export interface Task {
  id: number;
  courseId: number;
  moduleId: number;
  order: number;
  type: TaskType;
  title: string;
  estMinutes: number;
  status: TaskStatus;
  isMilestone: boolean;
  materialId?: number;
  reason?: string;
  teaser?: string;
  body?: string;
  answer?: string;
  keywords?: string[];
  difficulty?: number;
  completedAt?: number;
  actualSeconds?: number;
  outcome?: "again" | "good";
}

export interface Session {
  id: number;
  startedAt: number;
  endedAt?: number;
  lastActiveAt?: number;
  taskCount?: number;
  activeSeconds?: number;
}

export interface AppEvent {
  id: number;
  type: string;
  ts: number;
  payload?: Record<string, unknown>;
}

// Thẻ ôn tập (SM-2): mỗi task flashcard/nhớ lại đã xong có một thẻ.
export interface Review {
  taskId: number;
  courseId: number;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: number;
  lastReviewedAt?: number;
}

const db = new Dexie("lumo") as Dexie & {
  materials: EntityTable<Material, "id">;
  courses: EntityTable<Course, "id">;
  modules: EntityTable<Module, "id">;
  tasks: EntityTable<Task, "id">;
  sessions: EntityTable<Session, "id">;
  events: EntityTable<AppEvent, "id">;
  reviews: EntityTable<Review, "taskId">;
};

db.version(1).stores({
  materials: "++id, type, createdAt",
  courses: "++id, createdAt",
  modules: "++id, courseId, order",
  tasks: "++id, courseId, moduleId, status, type",
  sessions: "++id, startedAt",
  events: "++id, type, ts",
});

db.version(2).stores({
  reviews: "taskId, courseId, dueAt",
});

export { db };