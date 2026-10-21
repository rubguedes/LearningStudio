import { addDays, weekRange } from "./progress";
import { dateKey } from "./rules";
export interface Recurrence {
  id: string;
  title: string;
  notes: string;
  weekdays: number;
  localTime: string;
  timezone: string;
  startDate: string;
  endDate: string | null;
  enabled: boolean;
}
export interface ImportedTaskInput {
  externalId: string;
  title: string;
  instructions: string;
  schedule: string;
  url: string;
  notes: string;
}
export interface ImportedTask extends ImportedTaskInput {
  id: string;
  updatedAt: string;
  localTaskId: string | null;
  convertedAt: string | null;
}
export interface Occurrence {
  recurrenceId: string;
  date: string;
  startsAt: string | null;
  taskId: string | null;
  materialized: boolean;
  warning: string | null;
}
export interface AgendaSnapshot {
  recurrences: Recurrence[];
  imported: ImportedTask[];
  occurrences: Occurrence[];
}
export type AgendaAction =
  | { kind: "saveRecurrence"; input: Recurrence }
  | { kind: "deleteRecurrence"; id: string }
  | { kind: "materialize"; from: string; to: string }
  | { kind: "import"; format: "json" | "csv"; content: string }
  | { kind: "convert"; id: string; dueDate: string | null }
  | { kind: "deleteImport"; id: string };
export interface AgendaApi {
  snapshot(from: string, to: string): Promise<AgendaSnapshot>;
  action(action: AgendaAction): Promise<void>;
  preview(
    format: "json" | "csv",
    content: string,
  ): Promise<ImportedTaskInput[]>;
}
export interface ScheduledTaskProvider {
  readonly enabled: false;
  readonly mode: "manual";
}
export const scheduledTaskProvider: ScheduledTaskProvider = {
  enabled: false,
  mode: "manual",
};
export function calendarRange(day: string, mode: "week" | "month") {
  if (mode === "week") return weekRange(day);
  const start = `${day.slice(0, 7)}-01`;
  const d = new Date(`${start}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return { start, end: dateKey(d) };
}
export function calendarDays(start: string, end: string) {
  const days: string[] = [];
  for (let key = start; key <= end && days.length < 62; key = addDays(key, 1))
    days.push(key);
  return days;
}
