import { command } from "./tauri";
import type { LearningApi } from "../domain/library";
export const learningApi: LearningApi = {
  snapshot: () => command("library_snapshot"),
  action: (action) => command("library_action", { action }),
};
