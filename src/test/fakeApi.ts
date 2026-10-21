import { vi } from "vitest";
import type { Snapshot, StudyApi } from "../domain/types";
import { ApiError } from "../services/tauri";

// Fixture exclusiva dos testes; nunca importada pela aplicação.
export function fakeApi(configured = false) {
  let unlocked = false;
  let created = configured;
  const data: Snapshot = {
    areas: [],
    tasks: [],
    sessions: [],
    goals: [],
    checkpoints: [],
    checkpointEvidence: [],
  };
  const guard = () => {
    if (!unlocked) throw new ApiError("LOCKED", "Sessão bloqueada.");
  };
  const api = {
    authStatus: vi.fn(async () => ({ configured: created, unlocked })),
    setupPassword: vi.fn<StudyApi["setupPassword"]>(async () => {
      created = true;
      unlocked = true;
      return { configured: true, unlocked };
    }),
    unlock: vi.fn(async (password: string) => {
      if (password !== "uma frase longa segura")
        throw new ApiError("INVALID_PASSWORD", "Senha incorreta.");
      unlocked = true;
      return { configured: true, unlocked };
    }),
    lock: vi.fn(async () => {
      unlocked = false;
      data.sessions.forEach((session) => {
        if (session.status === "running") session.status = "paused";
      });
    }),
    userActivity: vi.fn<StudyApi["userActivity"]>(async () => {
      guard();
    }),
    snapshot: vi.fn(async () => {
      guard();
      return structuredClone(data);
    }),
    saveArea: vi.fn<StudyApi["saveArea"]>(async (input) => {
      guard();
      const now = new Date().toISOString();
      if (input.id) {
        const area = data.areas.find((a) => a.id === input.id);
        if (area) Object.assign(area, input, { updatedAt: now });
      } else
        data.areas.push({
          ...input,
          id: crypto.randomUUID(),
          name: input.name.trim(),
          archived: false,
          createdAt: now,
          updatedAt: now,
        });
    }),
    archiveArea: vi.fn<StudyApi["archiveArea"]>(async (id, archived) => {
      guard();
      const area = data.areas.find((a) => a.id === id);
      if (area) area.archived = archived;
    }),
    deleteArea: vi.fn<StudyApi["deleteArea"]>(async (id) => {
      guard();
      data.areas = data.areas.filter((a) => a.id !== id);
      data.tasks.forEach((t) => {
        if (t.areaId === id) t.areaId = null;
      });
    }),
    saveTask: vi.fn<StudyApi["saveTask"]>(async (input) => {
      guard();
      const now = new Date().toISOString();
      if (input.id) {
        const task = data.tasks.find((t) => t.id === input.id);
        if (task)
          Object.assign(task, input, {
            completedAt: input.status === "done" ? now : null,
            updatedAt: now,
          });
      } else
        data.tasks.push({
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          completedAt: input.status === "done" ? now : null,
        });
    }),
    deleteTask: vi.fn<StudyApi["deleteTask"]>(async (id) => {
      guard();
      data.tasks = data.tasks.filter((t) => t.id !== id);
    }),
    saveSession: vi.fn<StudyApi["saveSession"]>(async (input) => {
      guard();
      const timestamp = new Date().toISOString();
      const existing = data.sessions.find((s) => s.id === input.id);
      if (existing) Object.assign(existing, input, { updatedAt: timestamp });
      else
        data.sessions.push({
          ...input,
          mode: "manual",
          status: "completed",
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: timestamp,
        });
    }),
    startSession: vi.fn<StudyApi["startSession"]>(async (input) => {
      guard();
      if (data.sessions.some((s) => s.id === input.id)) return;
      if (data.sessions.some((s) => s.status === "running"))
        throw new ApiError(
          "ACTIVE_SESSION",
          "Já existe uma sessão em andamento.",
        );
      const timestamp = new Date().toISOString();
      data.sessions.push({
        ...input,
        mode: "timer",
        status: "running",
        durationSeconds: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
      });
    }),
    pulseSession: vi.fn<StudyApi["pulseSession"]>(async (id) => {
      guard();
      const session = data.sessions.find((s) => s.id === id);
      if (!session) throw new ApiError("NOT_FOUND", "Sessão não encontrada.");
      return structuredClone(session);
    }),
    controlSession: vi.fn<StudyApi["controlSession"]>(async (id, action) => {
      guard();
      const session = data.sessions.find((s) => s.id === id);
      if (!session) throw new ApiError("NOT_FOUND", "Sessão não encontrada.");
      if (action === "finish" && session.durationSeconds === 0)
        throw new ApiError(
          "VALIDATION",
          "A sessão ainda não possui tempo registrado.",
        );
      session.status =
        action === "pause"
          ? "paused"
          : action === "resume"
            ? "running"
            : "completed";
      if (action === "finish") session.completedAt = new Date().toISOString();
    }),
    saveGoal: vi.fn<StudyApi["saveGoal"]>(async (input) => {
      guard();
      const timestamp = new Date().toISOString();
      const goal = data.goals.find((g) => g.id === input.id);
      if (goal) Object.assign(goal, input, { updatedAt: timestamp });
      else
        data.goals.push({
          ...input,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }),
    archiveGoal: vi.fn<StudyApi["archiveGoal"]>(async (id, archived) => {
      guard();
      const goal = data.goals.find((g) => g.id === id);
      if (goal) goal.archived = archived;
    }),
    saveCheckpoint: vi.fn<StudyApi["saveCheckpoint"]>(async (input) => {
      guard();
      const timestamp = new Date().toISOString();
      const checkpoint = data.checkpoints.find((c) => c.id === input.id);
      if (checkpoint)
        Object.assign(checkpoint, input, { updatedAt: timestamp });
      else
        data.checkpoints.push({
          ...input,
          completedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }),
    completeCheckpoint: vi.fn<StudyApi["completeCheckpoint"]>(
      async (id, evidence) => {
        guard();
        const checkpoint = data.checkpoints.find((c) => c.id === id);
        if (!checkpoint || checkpoint.completedAt) return;
        const timestamp = new Date().toISOString();
        checkpoint.completedAt = timestamp;
        data.checkpointEvidence.push({
          id: crypto.randomUUID(),
          checkpointId: id,
          content: evidence,
          createdAt: timestamp,
        });
      },
    ),
    reopenCheckpoint: vi.fn<StudyApi["reopenCheckpoint"]>(async (id) => {
      guard();
      const checkpoint = data.checkpoints.find((c) => c.id === id);
      if (checkpoint) checkpoint.completedAt = null;
    }),
    deleteProgress: vi.fn<StudyApi["deleteProgress"]>(async (kind, id) => {
      guard();
      if (kind === "session")
        data.sessions = data.sessions.filter((s) => s.id !== id);
      if (kind === "goal") data.goals = data.goals.filter((g) => g.id !== id);
      if (kind === "checkpoint") {
        data.checkpoints = data.checkpoints.filter((c) => c.id !== id);
        data.checkpointEvidence = data.checkpointEvidence.filter(
          (e) => e.checkpointId !== id,
        );
      }
    }),
  } satisfies StudyApi;
  return { api, data };
}
