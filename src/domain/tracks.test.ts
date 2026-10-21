import { describe, it, expect } from "vitest";
import {
  pathSteps,
  rankErrors,
  jobMatch,
  marketSkills,
  marketRanking,
} from "./tracks";
import type { PracticeError, JobRecord } from "./tracks";
import type { Checkpoint } from "./types";
const job: JobRecord = {
  title: "Engenharia",
  url: "https://example.com/job",
  date: "2026-10-21",
  location: "Brasil",
  modality: "Remoto",
  seniority: "Pleno",
  requirements: ["Python", "SQL", "SQL"],
  evidence: "Requisitos copiados da fonte",
};
const error = (
  id: string,
  overrides: Partial<PracticeError> = {},
): PracticeError => ({
  id,
  topic: "Tempos verbais",
  category: "Gramática",
  excerpt: "I has",
  correction: "I have",
  explanation: "Concordância",
  severity: 2,
  classification: "error",
  repetitions: 1,
  reviews: 0,
  successes: 0,
  nextReview: "2026-10-21",
  ...overrides,
});
describe("Trilhas com evidências", () => {
  it("ranking separa frequência, cargo, atualidade e lacuna com pesos explícitos", () => {
    const result = marketRanking(
      [
        {
          ...job,
          title: "AI Engineer",
          requirements: ["Python"],
          date: "2026-10-21",
        },
      ],
      [],
      "AI Engineer",
      "2026-10-21",
    );
    expect(result[0]).toMatchObject({
      percent: 100,
      relevance: 100,
      recency: 100,
      gap: true,
      score: 100,
    });
    const old = marketRanking(
      [{ ...job, requirements: ["Python"], date: "2025-01-01" }],
      ["Python"],
      "AI Engineer",
      "2026-10-21",
    );
    expect(old[0]).toMatchObject({
      percent: 100,
      relevance: 0,
      recency: 0,
      gap: false,
      score: 50,
    });
  });
  it("libera apenas a primeira etapa incompleta sem inventar conclusão", () => {
    const checkpoints = [
      { id: "a", completedAt: "2026-10-21" },
      { id: "b", completedAt: null },
      { id: "c", completedAt: null },
    ] as Checkpoint[];
    const result = pathSteps(
      { id: "r", title: "Inglês", description: "", items: ["a", "b", "c"] },
      checkpoints,
    );
    expect(result.map((s) => s.state)).toEqual([
      "completed",
      "available",
      "locked",
    ]);
  });
  it("não conta vínculos ausentes como progresso", () =>
    expect(
      pathSteps(
        { id: "r", title: "", description: "", items: ["missing"] },
        [],
      ),
    ).toEqual([]));
  it("reforço exclui estilo e confirmações pendentes", () =>
    expect(
      rankErrors([
        error("a", { classification: "style" }),
        error("b", { classification: "unconfirmed" }),
        error("c"),
      ]).map((e) => e.id),
    ).toEqual(["c"]));
  it("prioriza recorrência, gravidade e desempenho posterior", () =>
    expect(
      rankErrors([
        error("old", { successes: 10 }),
        error("frequent", { repetitions: 4 }),
        error("severe", { severity: 3 }),
      ]).map((e) => e.id),
    ).toEqual(["frequent", "severe", "old"]));
  it("comparação de vagas normaliza e deduplica requisitos sem inferir experiência", () =>
    expect(jobMatch(job, [" python "])).toEqual({
      percent: 50,
      matched: ["python"],
      missing: ["sql"],
    }));
  it("não apresenta porcentagem sem requisitos", () =>
    expect(jobMatch({ ...job, requirements: [] }, []).percent).toBe(0));
  it("frequência conta vagas e não repetições dentro de uma vaga", () => {
    const result = marketSkills(
      [job, { ...job, requirements: ["SQL"] }],
      ["Python"],
    );
    expect(result[0]).toEqual({
      skill: "sql",
      count: 2,
      percent: 100,
      gap: true,
    });
  });
  it("amostra vazia não produz estatísticas", () =>
    expect(marketSkills([], [])).toEqual([]));
});
