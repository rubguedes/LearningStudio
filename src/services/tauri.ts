import { invoke, isTauri } from "@tauri-apps/api/core";
import type { StudyApi } from "../domain/types";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return new ApiError(error.code, error.message);
  }
  return new ApiError(
    "UNKNOWN",
    "Não foi possível concluir a operação. Tente novamente.",
  );
}

export async function command<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri())
    throw new ApiError(
      "DESKTOP_REQUIRED",
      "Abra o LearningStudio pelo aplicativo Windows. O acesso ao banco requer o ambiente desktop.",
    );
  try {
    return await invoke<T>(name, args);
  } catch (error: unknown) {
    throw normalizeError(error);
  }
}

export const tauriApi: StudyApi = {
  authStatus: () => command("auth_status"),
  setupPassword: (password) => command("setup_password", { password }),
  unlock: (password) => command("unlock", { password }),
  lock: () => command("lock"),
  userActivity: () => command("user_activity"),
  snapshot: () => command("workspace_snapshot"),
  saveArea: (input) => command("save_area", { input }),
  archiveArea: (id, archived) => command("archive_area", { id, archived }),
  deleteArea: (id) => command("delete_area", { id }),
  saveTask: (input) => command("save_task", { input }),
  deleteTask: (id) => command("delete_task", { id }),
  saveSession: (input) => command("save_session", { input }),
  startSession: (input) => command("start_session", { input }),
  pulseSession: (id) => command("pulse_session", { id }),
  controlSession: (id, action) => command("control_session", { id, action }),
  saveGoal: (input) => command("save_goal", { input }),
  archiveGoal: (id, archived) => command("archive_goal", { id, archived }),
  saveCheckpoint: (input) => command("save_checkpoint", { input }),
  completeCheckpoint: (id, evidence) =>
    command("complete_checkpoint", { id, evidence }),
  reopenCheckpoint: (id) => command("reopen_checkpoint", { id }),
  deleteProgress: (kind, id) => command("delete_progress", { kind, id }),
};
