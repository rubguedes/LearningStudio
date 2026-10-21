import { test, expect } from "@playwright/test";
import { mockDesktop } from "./desktop-fixture";
test("EPIC 3 com IPC simulado: redação, autocorreção e vocabulário offline", async ({
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
    .getByRole("button", { name: "Inglês offline", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir lição" }).first().click();
  await page
    .getByLabel("Sua redação original")
    .fill(
      "I would compare morning and evening study. Although mornings are quiet, I might be tired.",
    );
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByLabel("Histórico de tentativas")).toContainText(
    "Rascunho",
  );
  await page
    .getByLabel("It could not afford both options permanently.")
    .check();
  await page
    .getByLabel("Weather and the college holiday might affect demand.")
    .check();
  await page.getByLabel("Small experiments help expose assumptions.").check();
  await page.getByRole("button", { name: "Finalizar resposta" }).click();
  await expect(
    page.getByText(
      "Compreensão: 3 de 3. A redação não recebeu nota automática.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Sua redação original")).toBeDisabled();
  await page
    .getByLabel("Dificuldades e observações")
    .fill("Rever although e while.");
  await page
    .getByLabel("Versão revisada (separada do original)")
    .fill("Separate revision with an explicit limitation.");
  await page.getByRole("button", { name: "Salvar autocorreção" }).click();
  await page
    .getByRole("button", { name: "Salvar assumption para revisão" })
    .click();
  await page.screenshot({
    path: "test-results/epic3-lesson.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Vocabulário", exact: true }).click();
  await expect(page.getByRole("heading", { name: "assumption" })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar significado" }).click();
  await expect(
    page.getByText("suposição usada como ponto de partida"),
  ).toBeVisible();
});
