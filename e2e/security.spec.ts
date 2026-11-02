import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";
test("recupera com código único, preserva tarefa e alterna tela cheia com IPC simulado", async ({
  page,
}) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page
    .getByLabel("O que você quer fazer?", { exact: true })
    .fill("Dados preservados após recuperar");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await page.getByRole("button", { name: "Segurança", exact: true }).click();
  await expect(
    page.getByText(/Banco criptografado com SQLCipher/),
  ).toBeVisible();
  await page
    .getByLabel("Confirme a senha atual")
    .fill("uma frase longa segura");
  await page
    .getByRole("checkbox", { name: /Entendo que o código anterior/ })
    .check();
  await page
    .getByRole("button", { name: "Gerar novo código de recuperação" })
    .click();
  const code = await page
    .getByLabel("Código de recuperação gerado")
    .inputValue();
  expect(code).toMatch(/^LSR1-/);
  await page.getByRole("button", { name: "Bloquear espaço" }).click();
  await expect(page.getByLabel("Código de recuperação gerado")).toHaveCount(0);
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("Código de recuperação", { exact: true }).fill(code);
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("minha nova senha segura");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("minha nova senha segura");
  await page
    .getByRole("button", { name: "Redefinir senha", exact: true })
    .click();
  await expect(page.getByText(/Senha redefinida/)).toBeVisible();
  await page
    .getByLabel("Senha", { exact: true })
    .fill("minha nova senha segura");
  await page.getByRole("button", { name: "Desbloquear", exact: true }).click();
  await expect(
    page.getByText("Dados preservados após recuperar"),
  ).toBeVisible();
  await page.keyboard.press("F11");
  await expect(page.getByRole("button", { name: /^Tela cheia/ })).toBeVisible();
  await page.keyboard.press("F11");
  await expect(
    page.getByRole("button", { name: /Sair da tela cheia/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Tela cheia/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/security-desktop.png",
    fullPage: true,
  });
});
test("usa toda a largura útil em monitor grande", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  const bounds = await page.locator("#main-content").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThan(1600);
  expect(bounds!.x + bounds!.width).toBe(1920);
  await page.screenshot({
    path: "test-results/full-width-desktop.png",
    fullPage: true,
  });
});
