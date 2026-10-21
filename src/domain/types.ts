export type Color = "forest" | "blue" | "violet" | "amber" | "rose";
export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "doing" | "done";
export interface StudyArea {
  id: string;
  name: string;
  description: string;
  color: Color;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Task {
  checkpointId?: string | null;
  id: string;
  title: string;
  notes: string;
  areaId: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  estimateMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export type AreaInput = Pick<StudyArea, "name" | "description" | "color"> & {
  id: string | null;
};
export type TaskInput = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "completedAt"
> & { id: string | null };
export interface Snapshot {
  roadmaps?: import("./library").Roadmap[];
  areas: StudyArea[];
  tasks: Task[];
  sessions: StudySession[];
  goals: Goal[];
  checkpoints: Checkpoint[];
  checkpointEvidence: CheckpointEvidence[];
}
export interface AuthStatus {
  configured: boolean;
  unlocked: boolean;
}
export type Page =
  | "dashboard"
  | "tasks"
  | "areas"
  | "study"
  | "goals"
  | "checkpoints"
  | "reports"
  | "roadmaps"
  | "english"
  | "vocabulary"
  | "agenda"
  | "chatgpt"
  | "google"
  | "coding"
  | "tutors"
  | "settings"
  | "backup"
  | "resources";
// Biblioteca offline possui carregamento separado do painel de tarefas.
export interface StudyApi {
  authStatus(): Promise<AuthStatus>;
  setupPassword(password: string): Promise<AuthStatus>;
  unlock(password: string): Promise<AuthStatus>;
  lock(): Promise<void>;
  userActivity(): Promise<void>;
  snapshot(): Promise<Snapshot>;
  saveArea(input: AreaInput): Promise<void>;
  archiveArea(id: string, archived: boolean): Promise<void>;
  deleteArea(id: string): Promise<void>;
  saveTask(input: TaskInput): Promise<void>;
  deleteTask(id: string): Promise<void>;
  saveSession(input: SessionInput): Promise<void>;
  startSession(input: SessionInput): Promise<void>;
  pulseSession(id: string): Promise<StudySession>;
  controlSession(
    id: string,
    action: "pause" | "resume" | "finish",
  ): Promise<void>;
  saveGoal(input: GoalInput): Promise<void>;
  archiveGoal(id: string, archived: boolean): Promise<void>;
  saveCheckpoint(input: CheckpointInput): Promise<void>;
  completeCheckpoint(id: string, evidence: string): Promise<void>;
  reopenCheckpoint(id: string): Promise<void>;
  deleteProgress(
    kind: "session" | "goal" | "checkpoint",
    id: string,
  ): Promise<void>;
}

export interface StudySession {
  id: string;
  title: string;
  notes: string;
  areaId: string | null;
  studyDate: string;
  mode: "manual" | "timer";
  status: "running" | "paused" | "completed";
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export type SessionInput = Pick<
  StudySession,
  "id" | "title" | "notes" | "areaId" | "studyDate" | "durationSeconds"
>;
export type GoalMode = "manual" | "study_minutes" | "task_count";
export interface Goal {
  id: string;
  title: string;
  areaId: string | null;
  mode: GoalMode;
  unit: string;
  target: number;
  manualValue: number;
  startDate: string;
  dueDate: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export type GoalInput = Omit<Goal, "archived" | "createdAt" | "updatedAt">;
export interface Checkpoint {
  id: string;
  title: string;
  description: string;
  activity: string;
  criteria: string;
  areaId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type CheckpointInput = Omit<
  Checkpoint,
  "completedAt" | "createdAt" | "updatedAt"
>;
export interface CheckpointEvidence {
  id: string;
  checkpointId: string;
  content: string;
  createdAt: string;
}
