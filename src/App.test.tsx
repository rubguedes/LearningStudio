import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { fakeApi } from "./test/fakeApi";
import { ApiError } from "./services/tauri";

async function onboard() {
  const user = userEvent.setup();
  const fixture = fakeApi();
  render(<App api={fixture.api} />);
  await user.type(
    await screen.findByLabelText("Nova senha"),
    "uma frase longa segura",
  );
  await user.type(
    screen.getByLabelText("Confirmar senha"),
    "uma frase longa segura",
  );
  await user.click(screen.getByRole("button", { name: /Criar meu espaço/ }));
  await screen.findByRole("heading", {
    name: "Seu próximo passo começa aqui.",
  });
  return { ...fixture, user };
}

async function createTask(
  user: ReturnType<typeof userEvent.setup>,
  title = "Praticar SQL",
) {
  await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
  await user.type(screen.getByLabelText("O que você quer fazer?"), title);
  await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("fluxos do EPIC 1", () => {
  it("bloqueia dados antes do onboarding e valida a confirmação", async () => {
    const user = userEvent.setup();
    const { api } = fakeApi();
    render(<App api={api} />);
    await user.type(
      await screen.findByLabelText("Nova senha"),
      "uma frase longa segura",
    );
    await user.type(
      screen.getByLabelText("Confirmar senha"),
      "outra frase longa segura",
    );
    await user.click(screen.getByRole("button", { name: /Criar meu espaço/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "As senhas não coincidem",
    );
    expect(api.setupPassword).not.toHaveBeenCalled();
    expect(api.snapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("cria e edita áreas; arquiva, restaura e exige confirmação para excluir", async () => {
    const { user, api } = await onboard();
    await user.click(screen.getByRole("button", { name: "Áreas de estudo" }));
    await user.click(screen.getByRole("button", { name: "Nova área" }));
    await user.type(screen.getByLabelText("Nome da área"), "Python");
    await user.click(screen.getByRole("button", { name: "Salvar área" }));
    await screen.findByRole("heading", { name: "Python" });
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.clear(screen.getByLabelText("Nome da área"));
    await user.type(screen.getByLabelText("Nome da área"), "IA aplicada");
    await user.click(screen.getByRole("button", { name: "Salvar área" }));
    await screen.findByRole("heading", { name: "IA aplicada" });
    await user.click(
      screen.getByRole("button", { name: "Arquivar área IA aplicada" }),
    );
    await screen.findByRole("heading", { name: "O que você quer aprender?" });
    await user.click(screen.getByLabelText("Mostrar arquivadas"));
    await user.click(
      await screen.findByRole("button", { name: "Restaurar área IA aplicada" }),
    );
    await screen.findByRole("heading", { name: "Nenhuma área arquivada" });
    await user.click(screen.getByLabelText("Mostrar arquivadas"));
    await user.click(
      await screen.findByRole("button", { name: "Excluir área IA aplicada" }),
    );
    expect(api.deleteArea).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(api.deleteArea).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Excluir área IA aplicada" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );
    await waitFor(() => expect(api.deleteArea).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "IA aplicada" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("cria, edita, conclui, filtra e exclui tarefa", async () => {
    const { user, api } = await onboard();
    await createTask(user);
    expect(api.saveTask).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Editar tarefa Praticar SQL" }),
    );
    await user.clear(screen.getByLabelText("O que você quer fazer?"));
    await user.type(
      screen.getByLabelText("O que você quer fazer?"),
      "Revisar joins",
    );
    await user.selectOptions(screen.getByLabelText("Prioridade"), "high");
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Concluir tarefa Revisar joins",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Concluir tarefa Revisar joins" }),
      ).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Minhas tarefas/ }));
    await user.selectOptions(
      screen.getByLabelText("Filtrar por status"),
      "done",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Pesquisar tarefas" }),
      "joins",
    );
    expect(
      await screen.findByRole("button", {
        name: "Reabrir tarefa Revisar joins",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Excluir tarefa Revisar joins" }),
    );
    expect(api.deleteTask).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar exclusão",
      }),
    );
    await screen.findByRole("heading", { name: "Nenhuma tarefa por aqui" });
    expect(api.deleteTask).toHaveBeenCalledTimes(1);
  });

  it("preserva formulário quando salvar falha e bloqueia comandos da interface após lock", async () => {
    const { user, api } = await onboard();
    api.saveTask.mockRejectedValueOnce(
      new ApiError("DATABASE", "Banco indisponível."),
    );
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.type(
      screen.getByLabelText("O que você quer fazer?"),
      "Uma resposta importante",
    );
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Banco indisponível",
    );
    expect(screen.getByLabelText("O que você quer fazer?")).toHaveValue(
      "Uma resposta importante",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Bloquear espaço" }));
    expect(
      await screen.findByRole("heading", { name: "Seu espaço está protegido" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(api.lock).toHaveBeenCalledOnce();
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: /Desbloquear/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Senha incorreta",
    );
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("bloqueia por inatividade", async () => {
    const { api } = await onboard();
    vi.spyOn(performance, "now").mockReturnValue(
      performance.now() + 15 * 60 * 1000 + 2000,
    );
    await waitFor(() => expect(api.lock).toHaveBeenCalled(), { timeout: 2500 });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("não repete uma criação confirmada se a atualização da lista falhar", async () => {
    const { api, user } = await onboard();
    api.snapshot.mockRejectedValueOnce(new ApiError("DATABASE", "Falhou"));
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.type(
      screen.getByLabelText("O que você quer fazer?"),
      "Evitar duplicata",
    );
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A alteração foi salva",
    );
    expect(api.saveTask).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Recarregar dados" }));
    expect(
      await screen.findByRole("button", { name: "Evitar duplicata" }),
    ).toBeInTheDocument();
    expect(api.saveTask).toHaveBeenCalledTimes(1);
  });
});
