import type { AreaInput, Priority, Task, TaskInput } from "./types";

export const priorityLabels = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
} as const;
export const statusLabels = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluída",
} as const;
export const colors = {
  forest: "Verde",
  blue: "Azul",
  violet: "Violeta",
  amber: "Âmbar",
  rose: "Rosa",
} as const;

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function passwordError(
  password: string,
  confirmation: string,
): string | null {
  if (
    [...password].length < 12 ||
    [...password].length > 128 ||
    [...password.trim()].length < 12
  )
    return "Use uma senha de 12 a 128 caracteres.";
  if (password.includes("\0")) return "A senha contém um caractere inválido.";
  if (password !== confirmation) return "As senhas não coincidem.";
  return null;
}

export function areaError(input: AreaInput): string | null {
  if (!input.name.trim() || [...input.name.trim()].length > 80)
    return "O nome deve ter entre 1 e 80 caracteres.";
  if ([...input.description.trim()].length > 1000)
    return "A descrição deve ter até 1000 caracteres.";
  if (!(input.color in colors)) return "Escolha uma cor válida.";
  if ((input.name + input.description).includes("\0"))
    return "O texto contém um caractere inválido.";
  return null;
}

export function taskError(input: TaskInput): string | null {
  if (!input.title.trim() || [...input.title.trim()].length > 160)
    return "O título deve ter entre 1 e 160 caracteres.";
  if ([...input.notes.trim()].length > 5000)
    return "As notas devem ter até 5000 caracteres.";
  if (!(input.priority in priorityLabels) || !(input.status in statusLabels))
    return "Escolha uma prioridade e um status válidos.";
  if (input.dueDate && !validDate(input.dueDate))
    return "Informe uma data válida.";
  if (
    input.estimateMinutes !== null &&
    (!Number.isInteger(input.estimateMinutes) ||
      input.estimateMinutes < 1 ||
      input.estimateMinutes > 1440)
  )
    return "A estimativa deve ser de 1 a 1440 minutos.";
  if ((input.title + input.notes).includes("\0"))
    return "O texto contém um caractere inválido.";
  return null;
}

export function isOverdue(task: Task, today = dateKey()): boolean {
  return (
    task.status !== "done" && task.dueDate !== null && task.dueDate < today
  );
}

export function taskToInput(task: Task): TaskInput {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    areaId: task.areaId,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    estimateMinutes: task.estimateMinutes,
    checkpointId: task.checkpointId ?? null,
  };
}

export function selectTasks(
  tasks: Task[],
  query = "",
  status = "all",
  area = "",
  today = dateKey(),
): Task[] {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const weights: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return tasks
    .filter(
      (task) =>
        (!needle ||
          `${task.title} ${task.notes}`
            .toLocaleLowerCase("pt-BR")
            .includes(needle)) &&
        (!area || task.areaId === area) &&
        (status === "all" ||
          (status === "open"
            ? task.status !== "done"
            : status === "overdue"
              ? isOverdue(task, today)
              : task.status === status)),
    )
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
        weights[a.priority] - weights[b.priority] ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

export function formatDate(value: string | null): string {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}
