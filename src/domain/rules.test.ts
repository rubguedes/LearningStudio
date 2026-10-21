import { describe, expect, it } from "vitest";
import {
  areaError,
  dateKey,
  isOverdue,
  passwordError,
  selectTasks,
  taskError,
  taskToInput,
  validDate,
} from "./rules";
import type { Task } from "./types";

const task: Task = {
  id: "t1",
  title: "Estudar SQL",
  notes: "Prática de consultas",
  areaId: "a1",
  priority: "medium",
  status: "todo",
  dueDate: "2026-10-19",
  estimateMinutes: 25,
  createdAt: "2026-10-18T12:00:00Z",
  updatedAt: "2026-10-18T12:00:00Z",
  completedAt: null,
};

describe("validação de entradas", () => {
  it("exige frase longa e confirmação sem cortar a senha", () => {
    expect(passwordError("curta", "curta")).not.toBeNull();
    expect(
      passwordError("uma frase longa segura", "outra frase"),
    ).not.toBeNull();
    expect(
      passwordError("uma frase longa segura", "uma frase longa segura"),
    ).toBeNull();
    expect(passwordError("             ", "             ")).not.toBeNull();
    expect(passwordError("x".repeat(129), "x".repeat(129))).not.toBeNull();
  });
  it("rejeita área vazia, texto excessivo e caractere nulo", () => {
    expect(
      areaError({ id: null, name: " ", description: "", color: "forest" }),
    ).not.toBeNull();
    expect(
      areaError({
        id: null,
        name: "Python",
        description: "a".repeat(1001),
        color: "forest",
      }),
    ).not.toBeNull();
    expect(
      areaError({
        id: null,
        name: "Python\0",
        description: "",
        color: "forest",
      }),
    ).not.toBeNull();
    expect(
      areaError({ id: null, name: "Python", description: "", color: "blue" }),
    ).toBeNull();
  });
  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "19/10/2026",
    "2026-1-01",
  ])("rejeita data inválida %s", (value) => {
    expect(validDate(value)).toBe(false);
    expect(taskError({ ...taskToInput(task), dueDate: value })).not.toBeNull();
  });
  it("aceita bissexto e usa a data local", () => {
    expect(validDate("2028-02-29")).toBe(true);
    expect(dateKey(new Date(2026, 9, 19, 23, 59))).toBe("2026-10-19");
  });
  it.each([0, -1, 1.5, 1441, NaN])(
    "rejeita estimativa inválida %s",
    (estimateMinutes) => {
      expect(
        taskError({ ...taskToInput(task), estimateMinutes }),
      ).not.toBeNull();
    },
  );
  it("aceita tarefa sem prazo ou estimativa", () => {
    expect(
      taskError({ ...taskToInput(task), dueDate: null, estimateMinutes: null }),
    ).toBeNull();
  });
});

describe("tarefas e progresso comprovado", () => {
  it("não classifica hoje ou uma tarefa concluída como vencida", () => {
    expect(isOverdue(task, "2026-10-19")).toBe(false);
    expect(isOverdue(task, "2026-10-20")).toBe(true);
    expect(isOverdue({ ...task, status: "done" }, "2026-10-20")).toBe(false);
    expect(isOverdue({ ...task, dueDate: null }, "2026-10-20")).toBe(false);
  });
  it("filtra texto, status e área sem alterar a lista original", () => {
    const tasks = [
      task,
      { ...task, id: "t2", status: "done" as const },
      { ...task, id: "t3", areaId: "a2", title: "Python", notes: "" },
    ];
    expect(selectTasks(tasks, "sql", "open", "a1")).toEqual([task]);
    expect(selectTasks(tasks, "CONSULTAS", "done")).toHaveLength(1);
    expect(selectTasks(tasks, "", "overdue", "", "2026-10-20")).toHaveLength(2);
    expect(tasks[0]).toBe(task);
  });
  it("ordena pendentes, prazo e prioridade de forma estável", () => {
    const high = { ...task, id: "high", priority: "high" as const };
    const undated = { ...task, id: "undated", dueDate: null };
    const completed = {
      ...task,
      id: "done",
      status: "done" as const,
      dueDate: "2026-10-01",
    };
    expect(
      selectTasks([completed, undated, task, high]).map((t) => t.id),
    ).toEqual(["high", "t1", "undated", "done"]);
  });
});
