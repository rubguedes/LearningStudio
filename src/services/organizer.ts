import { command } from "./tauri";
import type { OrganizerApi } from "../domain/organizer";
export const organizerApi: OrganizerApi = {
  snapshot: () => command("organizer_snapshot"),
  action: (action) => command("organizer_action", { action }),
};
