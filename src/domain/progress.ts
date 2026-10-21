import { dateKey, validDate } from "./rules";
import type {
  CheckpointInput,
  Goal,
  GoalInput,
  SessionInput,
  Snapshot,
  StudySession,
} from "./types";

export const goalModes = {
  manual: "Progresso manual",
  study_minutes: "Minutos estudados",
  task_count: "Tarefas concluídas",
} as const;
export const sessionStates = {
  running: "Em andamento",
  paused: "Pausada",
  completed: "Finalizada",
} as const;

export function sessionError(
  input: SessionInput,
  timer = false,
  today = dateKey(),
): string | null {
  if (
    !input.title.trim() ||
    [...input.title.trim()].length > 160 ||
    [...input.notes.trim()].length > 5000 ||
    (input.title + input.notes).includes("\0")
  )
    return "Informe um título de até 160 caracteres e notas de até 5000.";
  if (!validDate(input.studyDate) || input.studyDate > today)
    return "Registre apenas estudos já realizados, com data válida.";
  if (
    !Number.isInteger(input.durationSeconds) ||
    (timer
      ? input.durationSeconds !== 0
      : input.durationSeconds < 1 || input.durationSeconds > 86400)
  )
    return "Informe uma duração de 1 segundo a 24 horas.";
  return null;
}

export function goalError(input: GoalInput): string | null {
  if (
    !input.title.trim() ||
    [...input.title.trim()].length > 160 ||
    !input.unit.trim() ||
    [...input.unit.trim()].length > 40 ||
    (input.title + input.unit).includes("\0")
  )
    return "Informe um título e uma unidade de medida válidos.";
  if (
    !Object.hasOwn(goalModes, input.mode) ||
    !Number.isInteger(input.target) ||
    input.target < 1 ||
    input.target > 1000000 ||
    !Number.isInteger(input.manualValue) ||
    input.manualValue < 0 ||
    input.manualValue > 1000000000 ||
    (input.mode !== "manual" && input.manualValue !== 0)
  )
    return "Confira o tipo, o alvo e o progresso da meta.";
  if (
    !validDate(input.startDate) ||
    !validDate(input.dueDate) ||
    input.dueDate < input.startDate
  )
    return "O prazo deve ser igual ou posterior à data inicial.";
  return null;
}

export function checkpointError(input: CheckpointInput): string | null {
  for (const [value, min, max] of [
    [input.title, 1, 160],
    [input.description, 0, 2000],
    [input.activity, 1, 2000],
    [input.criteria, 1, 2000],
  ] as const) {
    if (
      [...value.trim()].length < min ||
      [...value.trim()].length > max ||
      value.includes("\0")
    )
      return "Preencha título, atividade e critérios; respeite os limites de cada campo.";
  }
  return null;
}

export function localDay(timestamp: string): string {
  const value = new Date(timestamp);
  return Number.isFinite(value.getTime()) ? dateKey(value) : "";
}

export function goalValue(goal: Goal, snapshot: Snapshot): number {
  if (goal.mode === "manual") return goal.manualValue;
  const inScope = (area: string | null, date: string) =>
    (!goal.areaId || area === goal.areaId) &&
    date >= goal.startDate &&
    date <= goal.dueDate;
  if (goal.mode === "study_minutes")
    return (
      snapshot.sessions
        .filter(
          (s) => s.status === "completed" && inScope(s.areaId, s.studyDate),
        )
        .reduce((total, s) => total + s.durationSeconds, 0) / 60
    );
  return snapshot.tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      inScope(t.areaId, localDay(t.completedAt)),
  ).length;
}

export function goalPercent(goal: Goal, snapshot: Snapshot): number {
  return Math.min(
    100,
    Math.max(0, Math.floor((goalValue(goal, snapshot) / goal.target) * 100)),
  );
}

export function addDays(day: string, offset: number): string {
  if (!validDate(day)) throw new Error("Data inválida.");
  const value = new Date(`${day}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return dateKey(value);
}

export function weekRange(anchor = dateKey()): { start: string; end: string } {
  if (!validDate(anchor)) throw new Error("Data inválida.");
  const value = new Date(`${anchor}T12:00:00`);
  const start = addDays(anchor, -((value.getDay() + 6) % 7));
  return { start, end: addDays(start, 6) };
}

export function studyStreak(
  sessions: StudySession[],
  today = dateKey(),
): number {
  const days = new Set(
    sessions
      .filter(
        (s) =>
          s.status === "completed" &&
          s.durationSeconds > 0 &&
          s.studyDate <= today,
      )
      .map((s) => s.studyDate),
  );
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function weeklyReport(snapshot: Snapshot, anchor = dateKey()) {
  const { start, end } = weekRange(anchor);
  const sessions = snapshot.sessions.filter(
    (s) =>
      s.status === "completed" && s.studyDate >= start && s.studyDate <= end,
  );
  const days = new Set(sessions.map((s) => s.studyDate));
  const seconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const tasks = snapshot.tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      localDay(t.completedAt) >= start &&
      localDay(t.completedAt) <= end,
  ).length;
  const checkpoints = snapshot.checkpoints.filter(
    (c) =>
      c.completedAt &&
      localDay(c.completedAt) >= start &&
      localDay(c.completedAt) <= end,
  ).length;
  const byArea = snapshot.areas
    .map((area) => ({
      id: area.id,
      name: area.name,
      seconds: sessions
        .filter((s) => s.areaId === area.id)
        .reduce((sum, s) => sum + s.durationSeconds, 0),
    }))
    .filter((a) => a.seconds > 0);
  const withoutArea = sessions
    .filter((s) => !s.areaId)
    .reduce((sum, s) => sum + s.durationSeconds, 0);
  if (withoutArea > 0)
    byArea.push({ id: "without-area", name: "Sem área", seconds: withoutArea });
  return {
    start,
    end,
    seconds,
    sessionCount: sessions.length,
    activeDays: days.size,
    tasks,
    checkpoints,
    byArea,
  };
}

export function durationLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60);
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}min`
    : minutes > 0
      ? `${minutes}min`
      : `${total}s`;
}

export function sessionInput(session: StudySession): SessionInput {
  return {
    id: session.id,
    title: session.title,
    notes: session.notes,
    areaId: session.areaId,
    studyDate: session.studyDate,
    durationSeconds: session.durationSeconds,
  };
}

export function goalInput(goal: Goal): GoalInput {
  return {
    id: goal.id,
    title: goal.title,
    areaId: goal.areaId,
    mode: goal.mode,
    unit: goal.unit,
    target: goal.target,
    manualValue: goal.manualValue,
    startDate: goal.startDate,
    dueDate: goal.dueDate,
  };
}
