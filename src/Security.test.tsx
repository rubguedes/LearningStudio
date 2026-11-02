import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthScreen } from "./components/AuthScreen";
import { SecurityPage } from "./components/SecurityPage";
import { BackupPage } from "./components/BackupPage";
import { command } from "./services/tauri";
vi.mock("./services/tauri", async (original) => ({
  ...(await original<typeof import("./services/tauri")>()),
  command: vi.fn(),
}));
beforeEach(() => vi.mocked(command).mockReset());
it("recuperação exige confirmação e limpa campos antes do comando", async () => {
  const user = userEvent.setup(),
    recover = vi.fn(async () => true);
  render(
    <AuthScreen
      configured
      busy={false}
      error=""
      onSubmit={vi.fn()}
      onRecover={recover}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
  await user.type(
    screen.getByLabelText("Código de recuperação"),
    "LSR1-fixture-only",
  );
  await user.type(screen.getByLabelText("Nova senha"), "uma nova senha segura");
  await user.type(
    screen.getByLabelText("Confirmar senha"),
    "uma senha diferente",
  );
  await user.click(screen.getByRole("button", { name: "Redefinir senha" }));
  expect(recover).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeVisible();
  await user.clear(screen.getByLabelText("Confirmar senha"));
  await user.type(
    screen.getByLabelText("Confirmar senha"),
    "uma nova senha segura",
  );
  await user.click(screen.getByRole("button", { name: "Redefinir senha" }));
  expect(recover).toHaveBeenCalledWith(
    "LSR1-fixture-only",
    "uma nova senha segura",
  );
  await waitFor(() =>
    expect(screen.getByText(/Senha redefinida/)).toBeVisible(),
  );
  expect(screen.getByLabelText("Senha")).toHaveValue("");
});
it("código é exibido só depois de confirmar a senha e pode ser ocultado", async () => {
  vi.mocked(command)
    .mockResolvedValueOnce({
      configured: true,
      unlocked: true,
      encrypted: true,
      recoveryConfigured: false,
    })
    .mockResolvedValueOnce("LSR1-fixture-code");
  const user = userEvent.setup();
  render(
    <SecurityPage
      busy={false}
      run={async (fn) => {
        await fn();
        return true;
      }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Gerar novo código de recuperação" }),
  ).toBeDisabled();
  await user.type(
    screen.getByLabelText("Confirme a senha atual"),
    "uma senha atual segura",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Gerar novo código de recuperação" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Código de recuperação gerado")).toHaveValue(
      "LSR1-fixture-code",
    ),
  );
  expect(screen.getByLabelText("Confirme a senha atual")).toHaveValue("");
  await user.click(
    screen.getByRole("button", { name: "Já guardei · ocultar código" }),
  );
  expect(
    screen.queryByLabelText("Código de recuperação gerado"),
  ).not.toBeInTheDocument();
});
it("exportação de backup exige senha confirmada e a limpa após envio", async () => {
  vi.mocked(command).mockResolvedValue("Arquivo protegido de teste");
  const user = userEvent.setup();
  render(
    <BackupPage
      busy={false}
      run={async (fn) => {
        await fn();
        return true;
      }}
    />,
  );
  await user.type(
    screen.getByLabelText("Senha do novo backup"),
    "senha segura do backup",
  );
  await user.type(
    screen.getByLabelText("Confirmar senha do backup"),
    "senha diferente do backup",
  );
  await user.click(
    screen.getByRole("button", { name: "Exportar backup protegido" }),
  );
  expect(command).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Confirmar senha do backup"));
  await user.type(
    screen.getByLabelText("Confirmar senha do backup"),
    "senha segura do backup",
  );
  await user.click(
    screen.getByRole("button", { name: "Exportar backup protegido" }),
  );
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith("export_backup", {
      password: "senha segura do backup",
      allowLegacy: false,
    }),
  );
  expect(screen.getByLabelText("Senha do novo backup")).toHaveValue("");
});
