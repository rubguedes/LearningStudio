import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";
test("EPIC 4 com IPC simulado: agenda, prévia e conversão manual sem duplicatas", async ({
  page,
}) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByLabel("Confirmar senha").fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page.getByLabel("Visualização").selectOption("month");
  await expect(page.locator(".calendar-day")).toHaveCount(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
  );
  await page
    .getByRole("button", { name: "Tarefas do ChatGPT", exact: true })
    .click();
  const content = JSON.stringify([
    {
      externalId: "writing-1",
      title: "Prática importada",
      instructions: "Describe a decision",
      schedule: "seg 15h",
      url: "https://chatgpt.com/",
      notes: "Manual",
    },
  ]);
  await page.getByLabel("Dados para importar").fill(content);
  await page.getByRole("button", { name: "Validar e mostrar prévia" }).click();
  await expect(
    page.getByRole("heading", { name: "Prévia: 1 registros" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await page.getByRole("button", { name: "Converter em tarefa local" }).click();
  await expect(page.getByText("Convertida em tarefa local.")).toBeVisible();
  await page.getByLabel("Dados para importar").fill(content);
  await page.getByRole("button", { name: "Validar e mostrar prévia" }).click();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(
    page.getByRole("heading", { name: "Prática importada" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Minhas tarefas", exact: true })
    .click();
  await expect(
    page.getByText("Prática importada", { exact: true }),
  ).toHaveCount(1);
});
