import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";

test("EPIC 2 com IPC simulado: estudo, meta automática, evidência e relatório", async ({
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
    .getByRole("button", { name: "Sessões de estudo", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova sessão" }).click();
  await page
    .getByLabel("O que você estudou ou vai estudar?")
    .fill("Fundamentos de Python");
  await page.getByLabel("Minutos estudados").fill("45");
  await page.getByRole("button", { name: "Salvar sessão" }).click();
  await expect(
    page.getByRole("heading", { name: "Fundamentos de Python" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Metas", exact: true }).click();
  await page.getByRole("button", { name: "Nova meta" }).click();
  await page.getByLabel("Nome da meta").fill("Uma hora de prática");
  await page.getByLabel("Alvo", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Salvar meta" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Progresso de Uma hora de prática" }),
  ).toHaveAttribute("value", "75");
  await page.getByRole("button", { name: "Checkpoints", exact: true }).click();
  await page.getByRole("button", { name: "Novo checkpoint" }).click();
  await page
    .getByLabel("Título do checkpoint")
    .fill("Resolver o primeiro desafio");
  await page
    .getByLabel("Atividade prática")
    .fill("Implementar uma função com testes.");
  await page
    .getByLabel("Critérios de conclusão")
    .fill("Exemplos e testes revisados.");
  await page.getByRole("button", { name: "Salvar checkpoint" }).click();
  await page.getByRole("button", { name: "Concluir com evidência" }).click();
  await page
    .getByLabel("Evidência da atividade")
    .fill("Projeto local concluído, com testes conferidos manualmente.");
  await page
    .getByRole("button", { name: "Salvar evidência e concluir" })
    .click();
  await expect(
    page.getByRole("button", { name: "Reabrir checkpoint" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reabrir checkpoint" }).click();
  await expect(
    page.getByRole("button", { name: "Concluir com evidência" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Projeto local concluído, com testes conferidos manualmente.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  await expect(page.getByText("1 sessões finalizadas")).toBeVisible();
  await expect(page.getByRole("cell", { name: "45min" })).toBeVisible();
  await page.screenshot({
    path: "test-results/epic2-report.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.screenshot({
    path: "test-results/epic2-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 850, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Metas", exact: true }).click();
  await page
    .getByRole("button", { name: "Excluir meta Uma hora de prática" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Uma hora de prática" }),
  ).toBeVisible();
});
