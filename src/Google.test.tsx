import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GooglePage } from "./components/GooglePage";
import type { GoogleApi } from "./domain/google";
import { fakeApi } from "./test/fakeApi";
function fixture(connected = false) {
  const service: GoogleApi = {
    status: vi.fn(async () => ({
      connected,
      email: connected ? "self@example.com" : null,
      calendar: connected,
      gmail: connected,
      authorizing: false,
      queue: [],
    })),
    begin: vi.fn(async () => {}),
    action: vi.fn(async () => {}),
  };
  render(
    <GooglePage
      snapshot={fakeApi().data}
      busy={false}
      service={service}
      run={async (fn) => {
        await fn();
        return true;
      }}
    />,
  );
  return { service, user: userEvent.setup() };
}
describe("Consentimento Google", () => {
  it("começa sem escopos selecionados e limpa segredo após iniciar autorização", async () => {
    const { service, user } = fixture();
    await screen.findByText("Nenhuma conta conectada");
    expect(
      screen.getByRole("button", { name: "Conectar no navegador" }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText("Client ID do aplicativo para computador"),
      "fixture.apps.googleusercontent.com",
    );
    await user.type(
      screen.getByLabelText("Client secret, se fornecido"),
      "fixture-secret",
    );
    await user.click(
      screen.getByLabelText("Autorizar calendário exclusivo do LearningStudio"),
    );
    await user.click(
      screen.getByRole("button", { name: "Conectar no navegador" }),
    );
    expect(service.begin).toHaveBeenCalledWith({
      clientId: "fixture.apps.googleusercontent.com",
      clientSecret: "fixture-secret",
      calendar: true,
      gmail: false,
    });
    expect(screen.getByLabelText("Client secret, se fornecido")).toHaveValue(
      "",
    );
  });
  it("exige prévia e confirmação do e-mail para o destinatário fixo autorizado", async () => {
    const { service, user } = fixture(true);
    await screen.findByText("Conta conectada: self@example.com");
    await user.type(screen.getByLabelText("Assunto"), "Lembrete de estudo");
    await user.type(
      screen.getByLabelText("Mensagem"),
      "Hora de praticar inglês.",
    );
    await user.click(screen.getByRole("button", { name: "Revisar lembrete" }));
    expect(service.action).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("self@example.com");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Hora de praticar inglês.",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar operação" }),
    );
    await waitFor(() =>
      expect(service.action).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "queueEmail",
          subject: "Lembrete de estudo",
          body: "Hora de praticar inglês.",
          consent: true,
        }),
      ),
    );
    expect(service.action).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "processQueue" }),
    );
  });
});
