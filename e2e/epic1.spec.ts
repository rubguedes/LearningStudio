import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";

test("informa requisito desktop quando aberto sem Tauri", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("aplicativo Windows");
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("interface completa com IPC simulado: onboarding, área, tarefa, edição, filtro, exclusão e bloqueio", async ({
  page,
}) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByLabel("Confirmar senha").fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu próximo passo começa aqui." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Áreas de estudo", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova área", exact: true }).click();
  await page.getByLabel("Nome da área").fill("Engenharia de IA");
  await page
    .getByLabel("Descrição")
    .fill("Prática e fundamentos para construir sistemas úteis.");
  await page.getByRole("button", { name: "Salvar área" }).click();
  await expect(
    page.getByRole("heading", { name: "Engenharia de IA" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Minhas tarefas" }).click();
  await page
    .getByRole("button", { name: "Nova tarefa", exact: true })
    .first()
    .click();
  await page
    .getByLabel("O que você quer fazer?")
    .fill("Praticar consultas SQL");
  await page
    .getByLabel("Área de estudo", { exact: true })
    .selectOption({ label: "Engenharia de IA" });
  await page.getByLabel("Prioridade", { exact: true }).selectOption("high");
  await page.getByLabel("Estimativa em minutos").fill("30");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await expect(
    page.getByRole("button", { name: "Praticar consultas SQL", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Editar tarefa Praticar consultas SQL",
      exact: true,
    })
    .click();
  await page.getByLabel("O que você quer fazer?").fill("Revisar SQL e joins");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await page
    .getByRole("button", {
      name: "Concluir tarefa Revisar SQL e joins",
      exact: true,
    })
    .click();
  await page.getByLabel("Filtrar por status").selectOption("done");
  await page.getByRole("textbox", { name: "Pesquisar tarefas" }).fill("joins");
  await expect(
    page.getByRole("button", {
      name: "Reabrir tarefa Revisar SQL e joins",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Excluir tarefa Revisar SQL e joins",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revisar SQL e joins", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.screenshot({
    path: "test-results/epic1-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 850, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/epic1-compact.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Minhas tarefas" }).click();
  await page
    .getByRole("button", {
      name: "Excluir tarefa Revisar SQL e joins",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma tarefa por aqui" }),
  ).toBeVisible();
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page
    .getByLabel("Senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByRole("button", { name: "Desbloquear" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu próximo passo começa aqui." }),
  ).toBeVisible();
});
