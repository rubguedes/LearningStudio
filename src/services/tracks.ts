import { command } from "./tauri";
import type { TracksSnapshot, TracksAction } from "../domain/tracks";
export const tracksApi = {
  snapshot: () => command<TracksSnapshot>("tracks_snapshot"),
  action: (action: TracksAction) => command<void>("tracks_action", { action }),
  pdf: (lessonId: string, importFile: boolean) =>
    command<string>("lesson_pdf", { lessonId, import: importFile }),
};
