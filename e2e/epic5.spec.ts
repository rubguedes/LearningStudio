import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";
test("EPIC 5 com IPC simulado: seleção explícita de escopos e cancelamento OAuth", async ({
  page,
}) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByLabel("Confirmar senha").fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await page
    .getByRole("button", { name: "Integrações Google", exact: true })
    .click();
  await expect(page.getByText("Nenhuma conta conectada")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar no navegador" }),
  ).toBeDisabled();
  await page
    .getByLabel("Client ID do aplicativo para computador")
    .fill("fixture.apps.googleusercontent.com");
  await page.getByLabel("Client secret, se fornecido").fill("fixture-secret");
  await page
    .getByLabel("Autorizar calendário exclusivo do LearningStudio")
    .check();
  await page.getByRole("button", { name: "Conectar no navegador" }).click();
  await expect(
    page.getByText(
      "Aguardando autorização no navegador, por até cinco minutos.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar autorização" }).click();
  await expect(page.getByLabel("Client secret, se fornecido")).toHaveValue("");
});
