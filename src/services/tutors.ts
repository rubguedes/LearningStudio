import { command } from "./tauri";
import type { TutorApi } from "../domain/tutors";
export const tutorApi: TutorApi = {
  snapshot: () => command("tutor_snapshot"),
  action: (action) => command("tutor_action", { action }),
  solution: (id) => command("challenge_solution", { id }),
};
