import { describe, expect, it } from "vitest";
import {
  addDays,
  checkpointError,
  durationLabel,
  goalError,
  goalPercent,
  goalValue,
  sessionError,
  studyStreak,
  weeklyReport,
  weekRange,
} from "./progress";
import type { Goal, GoalInput, Snapshot, StudySession } from "./types";

const timestamp = new Date(2026, 9, 19, 12).toISOString();
function snapshot(): Snapshot {
  return {
    areas: [
      {
        id: "a1",
        name: "Python",
        description: "",
        color: "forest",
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    tasks: [],
    sessions: [],
    goals: [],
    checkpoints: [],
    checkpointEvidence: [],
  };
}
function session(patch: Partial<StudySession> = {}): StudySession {
  return {
    id: crypto.randomUUID(),
    title: "Estudo",
    notes: "",
    areaId: "a1",
    studyDate: "2026-10-19",
    mode: "manual",
    status: "completed",
    durationSeconds: 1800,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp,
    ...patch,
  };
}
const goal: Goal = {
  id: "g1",
  title: "Estudar Python",
  areaId: "a1",
  mode: "study_minutes",
  unit: "minutos",
  target: 60,
  manualValue: 0,
  startDate: "2026-10-19",
  dueDate: "2026-10-25",
  archived: false,
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe("progresso verificável", () => {
  it("conta apenas estudos finalizados na área e no período da meta", () => {
    const data = snapshot();
    data.sessions = [
      session(),
      session({ status: "paused", durationSeconds: 3600, completedAt: null }),
      session({ areaId: "a2" }),
      session({ studyDate: "2026-10-18" }),
      session({ studyDate: "2026-10-26" }),
    ];
    expect(goalValue(goal, data)).toBe(30);
    expect(goalPercent(goal, data)).toBe(50);
  });
  it("preserva frações de minuto sem concluir a meta antes do alvo", () => {
    const data = snapshot();
    data.sessions = [session({ durationSeconds: 59 })];
    const short = { ...goal, target: 1 };
    expect(goalValue(short, data)).toBeCloseTo(59 / 60);
    expect(goalPercent(short, data)).toBe(98);
  });
  it("limita a barra a 100% sem apagar o valor real", () => {
    const data = snapshot();
    data.sessions = [session({ durationSeconds: 7200 })];
    expect(goalValue(goal, data)).toBe(120);
    expect(goalPercent(goal, data)).toBe(100);
  });
  it("não atribui progresso automático a uma meta manual", () => {
    const data = snapshot();
    data.sessions = [session()];
    expect(goalValue({ ...goal, mode: "manual", manualValue: 3 }, data)).toBe(
      3,
    );
  });
  it("usa conclusão efetiva da tarefa, com área e período", () => {
    const data = snapshot();
    const task = {
      id: "t1",
      title: "SQL",
      notes: "",
      areaId: "a1",
      priority: "medium" as const,
      status: "done" as const,
      dueDate: null,
      estimateMinutes: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    };
    data.tasks = [
      task,
      { ...task, id: "t2", status: "todo", completedAt: null },
      { ...task, id: "t3", areaId: "a2" },
      {
        ...task,
        id: "t4",
        completedAt: new Date(2026, 9, 18, 12).toISOString(),
      },
    ];
    expect(goalValue({ ...goal, mode: "task_count" }, data)).toBe(1);
  });
  it("não aumenta progresso por abrir páginas nem por sessão em andamento", () => {
    const data = snapshot();
    data.sessions = [session({ status: "running", completedAt: null })];
    expect(goalValue(goal, data)).toBe(0);
    expect(weeklyReport(data, "2026-10-19").seconds).toBe(0);
  });
});

describe("semana e consistência", () => {
  it("usa segunda a domingo inclusive na virada do ano", () => {
    expect(weekRange("2027-01-01")).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
    });
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("rejeita âncoras inválidas", () => {
    expect(() => weekRange("2026-02-30")).toThrow("Data inválida");
  });
  it("conta dias distintos, sem sessões pausadas ou futuras", () => {
    const sessions = [
      session(),
      session(),
      session({ studyDate: "2026-10-18" }),
      session({ studyDate: "2026-10-17" }),
      session({ studyDate: "2026-10-16", status: "paused", completedAt: null }),
      session({ studyDate: "2026-10-20" }),
    ];
    expect(studyStreak(sessions, "2026-10-19")).toBe(3);
  });
  it("preserva sequência de ontem antes de estudar hoje", () => {
    expect(
      studyStreak(
        [
          session({ studyDate: "2026-10-18" }),
          session({ studyDate: "2026-10-17" }),
        ],
        "2026-10-19",
      ),
    ).toBe(2);
    expect(
      studyStreak([session({ studyDate: "2026-10-17" })], "2026-10-19"),
    ).toBe(0);
  });
  it("relatório reconcilia totais por área com registros finalizados", () => {
    const data = snapshot();
    data.sessions = [
      session(),
      session({ areaId: null, durationSeconds: 900 }),
      session({ status: "paused", completedAt: null }),
      session({ studyDate: "2026-10-18" }),
    ];
    const report = weeklyReport(data, "2026-10-19");
    expect(report.seconds).toBe(2700);
    expect(report.sessionCount).toBe(2);
    expect(report.activeDays).toBe(1);
    expect(report.byArea.reduce((sum, a) => sum + a.seconds, 0)).toBe(
      report.seconds,
    );
  });
  it("formata tempo sem arredondar segundos para minutos inexistentes", () => {
    expect(durationLabel(59)).toBe("59s");
    expect(durationLabel(3601)).toBe("1h 00min");
  });
});

describe("validação de estudos e marcos", () => {
  it("rejeita sessão futura, vazia ou sem tempo", () => {
    const input = {
      id: "s1",
      title: "Estudar",
      notes: "",
      areaId: null,
      studyDate: "2026-10-19",
      durationSeconds: 60,
    };
    expect(sessionError(input, false, "2026-10-19")).toBeNull();
    expect(
      sessionError({ ...input, studyDate: "2026-10-20" }, false, "2026-10-19"),
    ).not.toBeNull();
    expect(sessionError({ ...input, durationSeconds: 0 })).not.toBeNull();
    expect(sessionError({ ...input, title: " " })).not.toBeNull();
    expect(
      sessionError({ ...input, durationSeconds: 0 }, true, "2026-10-19"),
    ).toBeNull();
  });
  it("não aceita valor manual em meta automática nem prazo invertido", () => {
    const input: GoalInput = {
      id: goal.id,
      title: goal.title,
      areaId: goal.areaId,
      mode: goal.mode,
      unit: goal.unit,
      target: goal.target,
      manualValue: 0,
      startDate: goal.startDate,
      dueDate: goal.dueDate,
    };
    expect(goalError(input)).toBeNull();
    expect(goalError({ ...input, manualValue: 10 })).not.toBeNull();
    expect(goalError({ ...input, dueDate: "2026-10-18" })).not.toBeNull();
    expect(goalError({ ...input, target: 1.5 })).not.toBeNull();
    expect(
      goalError({ ...input, mode: "toString" as GoalInput["mode"] }),
    ).not.toBeNull();
  });
  it("exige atividade e critérios verificáveis", () => {
    const input = {
      id: "c1",
      title: "Criar uma API",
      description: "",
      activity: "Implementar endpoint",
      criteria: "Testes de integração aprovados",
      areaId: null,
    };
    expect(checkpointError(input)).toBeNull();
    expect(checkpointError({ ...input, criteria: " " })).not.toBeNull();
    expect(checkpointError({ ...input, activity: " " })).not.toBeNull();
  });
});
