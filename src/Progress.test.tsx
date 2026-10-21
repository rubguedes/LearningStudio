import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { fakeApi } from "./test/fakeApi";
import { ApiError } from "./services/tauri";

async function onboard() {
  const fixture = fakeApi();
  const user = userEvent.setup();
  render(<App api={fixture.api} />);
  await user.type(
    await screen.findByLabelText("Nova senha"),
    "uma frase longa segura",
  );
  await user.type(
    screen.getByLabelText("Confirmar senha"),
    "uma frase longa segura",
  );
  await user.click(screen.getByRole("button", { name: "Criar meu espaço" }));
  await screen.findByRole("navigation");
  return { ...fixture, user };
}

describe("EPIC 2 na interface", () => {
  it("registra sessão manual, exibe histórico e exige confirmação para excluir", async () => {
    const { api, user } = await onboard();
    await user.click(screen.getByRole("button", { name: "Sessões de estudo" }));
    await user.click(screen.getByRole("button", { name: "Nova sessão" }));
    await user.type(
      screen.getByLabelText("O que você estudou ou vai estudar?"),
      "Testes de integração",
    );
    await user.clear(screen.getByLabelText("Minutos estudados"));
    await user.type(screen.getByLabelText("Minutos estudados"), "45");
    await user.click(screen.getByRole("button", { name: "Salvar sessão" }));
    await screen.findByRole("heading", { name: "Testes de integração" });
    expect(api.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Testes de integração",
        durationSeconds: 2700,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Excluir sessão Testes de integração",
      }),
    );
    expect(api.deleteProgress).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    expect(api.deleteProgress).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", {
        name: "Excluir sessão Testes de integração",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );
    await screen.findByRole("heading", { name: "Nenhum estudo registrado" });
    expect(api.deleteProgress).toHaveBeenCalledTimes(1);
  });
  it("inicia e pausa um cronômetro sem inventar progresso", async () => {
    const { api, user } = await onboard();
    await user.click(screen.getByRole("button", { name: "Iniciar sessão" }));
    await user.click(screen.getByRole("button", { name: "Nova sessão" }));
    await user.selectOptions(screen.getByLabelText("Como registrar"), "timer");
    await user.type(
      screen.getByLabelText("O que você estudou ou vai estudar?"),
      "Prática cronometrada",
    );
    await user.click(
      screen.getByRole("button", { name: "Iniciar cronômetro" }),
    );
    await screen.findByRole("heading", { name: "Prática cronometrada" });
    expect(api.startSession).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 0 }),
    );
    await user.click(screen.getByRole("button", { name: "Pausar" }));
    await screen.findByRole("button", { name: "Retomar" });
    expect(api.controlSession).toHaveBeenCalledWith(
      expect.any(String),
      "pause",
    );
    await user.click(screen.getByRole("button", { name: "Relatórios" }));
    expect(screen.getByText("0 sessões finalizadas")).toBeInTheDocument();
  });
  it("cria meta manual e preserva campos quando a persistência falha", async () => {
    const { api, user } = await onboard();
    await user.click(screen.getByRole("button", { name: "Metas" }));
    await user.click(screen.getByRole("button", { name: "Nova meta" }));
    await user.type(screen.getByLabelText("Nome da meta"), "Ler capítulos");
    await user.selectOptions(
      screen.getByLabelText("Como medir o progresso"),
      "manual",
    );
    await user.clear(screen.getByLabelText("Alvo"));
    await user.type(screen.getByLabelText("Alvo"), "10");
    await user.clear(screen.getByLabelText("Progresso registrado"));
    await user.type(screen.getByLabelText("Progresso registrado"), "3");
    api.saveGoal.mockRejectedValueOnce(
      new ApiError("DATABASE", "Banco temporariamente indisponível."),
    );
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(
      await within(screen.getByRole("dialog")).findByRole("alert"),
    ).toHaveTextContent("Banco temporariamente");
    expect(screen.getByLabelText("Nome da meta")).toHaveValue("Ler capítulos");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    await screen.findByRole("heading", { name: "Ler capítulos" });
    expect(
      screen.getByRole("progressbar", { name: "Progresso de Ler capítulos" }),
    ).toHaveAttribute("value", "30");
  });
  it("conclui checkpoint com evidência e preserva histórico ao reabrir", async () => {
    const { api, user, data } = await onboard();
    await user.click(screen.getByRole("button", { name: "Checkpoints" }));
    await user.click(screen.getByRole("button", { name: "Novo checkpoint" }));
    await user.type(
      screen.getByLabelText("Título do checkpoint"),
      "API com testes",
    );
    await user.type(
      screen.getByLabelText("Atividade prática"),
      "Criar endpoint de estudo",
    );
    await user.type(
      screen.getByLabelText("Critérios de conclusão"),
      "Testes locais aprovados",
    );
    await user.click(screen.getByRole("button", { name: "Salvar checkpoint" }));
    await screen.findByRole("heading", { name: "API com testes" });
    await user.click(
      screen.getByRole("button", { name: "Concluir com evidência" }),
    );
    await user.type(
      screen.getByLabelText("Evidência da atividade"),
      "Projeto local: endpoint implementado e testes revisados.",
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar evidência e concluir" }),
    );
    await screen.findByRole("button", { name: "Reabrir checkpoint" });
    expect(api.completeCheckpoint).toHaveBeenCalledTimes(1);
    expect(data.checkpointEvidence).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Reabrir checkpoint" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Concluir com evidência" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        "Projeto local: endpoint implementado e testes revisados.",
      ),
    ).toBeInTheDocument();
    expect(data.checkpointEvidence).toHaveLength(1);
  });
});
