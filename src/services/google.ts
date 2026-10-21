import { command } from "./tauri";
import type { GoogleApi } from "../domain/google";
export const googleApi: GoogleApi = {
  status: () => command("google_status"),
  begin: (input) => command("google_begin", { input }),
  action: (action) => command("google_action", { action }),
};
