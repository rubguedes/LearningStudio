import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";
test("EPIC 6 com IPC simulado: código preservado, execução bloqueada e referência após tentativa", async ({
  page,
}) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByLabel("Confirmar senha").fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await page.getByRole("button", { name: "Programação", exact: true }).click();
  await page.getByRole("button", { name: "Abrir desafio" }).first().click();
  await expect(
    page.getByRole("button", { name: "Executar testes · indisponível" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Revelar solução de referência após a tentativa",
    }),
  ).toHaveCount(0);
  await page
    .getByLabel("Seu código original")
    .fill("def total_minutes(values):\n    return sum(values)");
  await page.getByRole("button", { name: "Salvar rascunho de código" }).click();
  await expect(page.getByLabel("Histórico de código")).toContainText(
    "Rascunho",
  );
  await page.getByRole("button", { name: "Finalizar código" }).click();
  await expect(page.getByLabel("Seu código original")).toBeDisabled();
  await page
    .getByRole("button", { name: "Leitura estática limitada", exact: true })
    .click();
  await expect(
    page.getByText("Leitura estática limitada. Nenhum teste executado."),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Revelar solução de referência após a tentativa",
    })
    .click();
  await expect(
    page.getByText("Referência de estudo · não executada pelo aplicativo"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/epic6-coding.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "IA e consumo", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Provedor", exact: true }),
  ).toHaveValue("disabled");
  await expect(page.getByText("Nenhuma chave configurada.")).toBeVisible();
  await page.getByRole("button", { name: "Backup local", exact: true }).click();
  await page.getByRole("button", { name: "Exportar backup local" }).click();
  await expect(
    page.getByText(
      "Backup simulado pelo teste; nenhum arquivo real foi criado.",
    ),
  ).toBeVisible();
});
test("organização de tópicos e notas com IPC simulado", async ({ page }) => {
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma frase longa segura");
  await page.getByLabel("Confirmar senha").fill("uma frase longa segura");
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await page
    .getByRole("button", { name: "Tópicos e recursos", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo tópico" }).click();
  await page.getByLabel("Título", { exact: true }).fill("SQL");
  await page.getByRole("button", { name: "Salvar tópico" }).click();
  await page.getByRole("button", { name: "Novo recurso" }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Consultas parametrizadas");
  await page
    .getByLabel("Notas", { exact: true })
    .fill("Usar parâmetros nas consultas.");
  await page.getByLabel("Link HTTPS opcional").fill("https://www.sqlite.org/");
  await page
    .getByRole("combobox", { name: "Tópico", exact: true })
    .selectOption({ label: "SQL" });
  await page.getByRole("button", { name: "Salvar recurso" }).click();
  await expect(
    page.getByRole("heading", { name: "Consultas parametrizadas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Arquivar recurso" }).click();
  await expect(
    page.getByRole("heading", { name: "Consultas parametrizadas" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("archived");
  await expect(
    page.getByRole("heading", { name: "Consultas parametrizadas" }),
  ).toBeVisible();
});
