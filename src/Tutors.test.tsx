import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TutorPage } from "./components/TutorPage";
import { monthlySpend } from "./domain/tutors";
import type {
  TutorApi,
  TutorSnapshot,
  TutorAction,
  GeneratedChallenge,
  AIUsageRecord,
} from "./domain/tutors";
import type { LearningApi } from "./domain/library";
import type { Page } from "./domain/types";
import coding from "../src-tauri/content/coding.json";
function fixture(page: Page = "coding") {
  const data: TutorSnapshot = {
    settings: {
      provider: "disabled",
      openaiModel: "",
      ollamaModel: "",
      monthlyLimitMicros: 0,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      currency: "USD",
      pricesUpdatedAt: "",
      maxOutputTokens: 4096,
    },
    hasKey: false,
    challenges: (coding as GeneratedChallenge[]).map((c) => c.challenge),
    submissions: [],
    evaluations: [],
    usage: [],
    executionAvailable: false,
  };
  const service: TutorApi = {
    snapshot: async () => structuredClone(data),
    solution: vi.fn(async () => coding[0].reference),
    action: vi.fn(async (a: TutorAction) => {
      if (a.kind === "saveCode") {
        data.submissions = data.submissions.filter((s) => s.id !== a.id);
        data.submissions.push({
          id: a.id,
          challengeId: a.challengeId,
          code: a.code,
          submittedAt: a.submit ? "2026-10-19T18:00:00Z" : null,
          updatedAt: "2026-10-19T18:00:00Z",
        });
      }
      if (a.kind === "staticReview")
        data.evaluations.push({
          id: "e",
          englishSubmissionId: null,
          codeSubmissionId: a.submissionId,
          source: "static",
          createdAt: "2026-10-19T18:00:00Z",
          feedback: {
            summary: "Leitura estática limitada, sem execução.",
            findings: [],
            revised: "",
            followUp: "Revise os critérios.",
            uncertainties: ["Não foram executados testes."],
          },
        });
    }),
  };
  const library: LearningApi = {
    snapshot: async () => ({
      roadmaps: [],
      lessons: [],
      submissions: [],
      reviews: [],
      vocabulary: [],
    }),
    action: async () => {},
  };
  render(
    <TutorPage
      page={page}
      busy={false}
      setPage={vi.fn()}
      service={service}
      library={library}
      run={async (fn) => {
        await fn();
        return true;
      }}
    />,
  );
  return { service, data, user: userEvent.setup() };
}
describe("Tutores seguros e opcionais", () => {
  it("contabiliza reserva desconhecida sem inventar consumo ou misturar meses", () => {
    const base = {
      id: "x",
      provider: "openai",
      model: "configured",
      task: "test",
      inputTokens: null,
      outputTokens: null,
      costMicros: null,
      reservedMicros: 5000,
      currency: "USD",
      state: "unknown",
      createdAt: "2026-10-19T18:00:00Z",
    } satisfies AIUsageRecord;
    expect(
      monthlySpend(
        [
          base,
          { ...base, id: "y", costMicros: 700 },
          { ...base, id: "z", createdAt: "2026-09-01T00:00:00Z" },
        ],
        "2026-10",
      ),
    ).toBe(5700);
  });
  it("preserva código finalizado, bloqueia execução e revela referência só após entrega", async () => {
    const { user, service } = fixture();
    await user.click(
      (await screen.findAllByRole("button", { name: "Abrir desafio" }))[0],
    );
    expect(
      screen.getByRole("button", { name: "Executar testes · indisponível" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: "Revelar solução de referência após a tentativa",
      }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Seu código original"),
      "def total_minutes(values):\n    return sum(values)",
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar rascunho de código" }),
    );
    await waitFor(() =>
      expect(service.action).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "saveCode", submit: false }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Finalizar código" }));
    await screen.findByRole("button", { name: "Leitura estática limitada" });
    expect(screen.getByLabelText("Seu código original")).toBeDisabled();
    expect(service.solution).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole("button", {
        name: "Revelar solução de referência após a tentativa",
      }),
    );
    await screen.findByText(/Expected non-negative integers/, {
      selector: "pre",
    });
    expect(service.solution).toHaveBeenCalledWith(coding[0].challenge.id);
    await user.click(
      screen.getByRole("button", { name: "Leitura estática limitada" }),
    );
    await screen.findByText("Leitura estática limitada, sem execução.");
  });
  it("mantém geração desativada sem provedor e permite criar exercício manual", async () => {
    const { user, service } = fixture();
    await screen.findByText(
      "Provedor: desativado. A IA fornece sugestões, sem certificar nível ou comprovar execução de testes.",
    );
    expect(
      screen.getByRole("button", { name: "Revisar pedido de geração" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Novo desafio manual" }),
    );
    await user.type(screen.getByLabelText("Título do desafio"), "Meu desafio");
    await user.type(
      screen.getByLabelText("Enunciado"),
      "Calcule o total de uma lista de valores inteiros.",
    );
    await user.type(screen.getByLabelText("Exemplo de entrada"), "1,2");
    await user.type(screen.getByLabelText("Exemplo de saída"), "3");
    await user.type(
      screen.getByLabelText("Critérios, um por linha"),
      "Preservar a entrada",
    );
    await user.type(
      screen.getByLabelText("Caso de teste para estudar (texto)"),
      "Lista vazia retorna zero",
    );
    await user.type(
      screen.getByLabelText("Referência guardada para depois da tentativa"),
      "Uma referência manual.",
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar desafio manual" }),
    );
    await waitFor(() =>
      expect(service.action).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "saveChallenge",
          input: expect.objectContaining({
            challenge: expect.objectContaining({ title: "Meu desafio" }),
          }),
        }),
      ),
    );
  });
});
