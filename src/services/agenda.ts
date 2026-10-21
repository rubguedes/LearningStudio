import { command } from "./tauri";
import type { AgendaApi } from "../domain/agenda";
export const agendaApi: AgendaApi = {
  snapshot: (from, to) => command("agenda_snapshot", { from, to }),
  action: (action) => command("agenda_action", { action }),
  preview: (format, content) => command("preview_import", { format, content }),
};
