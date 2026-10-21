import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";
test("trilhas: configura idioma, exige consentimento e preserva currículo", async ({
  page,
}) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByLabel("Confirmar senha").fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await page.getByRole("button", { name: "Trilhas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sugerir plano com IA" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/tracks-language.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salvar perfil de idioma" }).click();
  await expect(
    page.getByRole("combobox", { name: "Perfil de idioma salvo" }),
  ).toHaveValue(/.+/);
  await expect(
    page.getByRole("button", { name: "Sugerir plano com IA" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Trilha de Carreira", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Currículo", exact: true })
    .fill("Desenvolvedor com experiência comprovável em Python.");
  await page
    .getByRole("textbox", { name: "Competências comprováveis" })
    .fill("Python, SQL");
  await page
    .getByRole("button", { name: "Aprovar e salvar nova versão do currículo" })
    .click();
  await page
    .getByText("Histórico de versões e sugestões", { exact: true })
    .click();
  await expect(
    page
      .locator("pre")
      .filter({ hasText: "Desenvolvedor com experiência comprovável" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Solicitar sugestões para a versão salva",
    }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/tracks-career.png",
    fullPage: true,
  });
});
