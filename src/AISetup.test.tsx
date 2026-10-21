import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { TutorSettings } from "./components/TutorSettings";
import type { TutorSnapshot } from "./domain/tutors";
const data: TutorSnapshot = {
  settings: {
    provider: "disabled",
    openaiModel: "",
    ollamaModel: "",
    monthlyLimitMicros: 0,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    currency: "USD",
    pricesUpdatedAt: "",
    maxOutputTokens: 4096,
  },
  hasKey: false,
  challenges: [],
  submissions: [],
  evaluations: [],
  usage: [],
  executionAvailable: false,
};
it("ativação rápida informa orçamento, envia somente pelo comando e limpa a chave do campo", async () => {
  const act = vi.fn(async () => true);
  const user = userEvent.setup();
  render(<TutorSettings data={data} busy={false} act={act} />);
  expect(screen.getByText(/orçamento de US\$ 5 por mês/)).toBeInTheDocument();
  const input = screen.getByLabelText("Chave para ativação rápida");
  await user.type(input, "test-key-for-secure-storage-only");
  await user.click(
    screen.getByRole("button", { name: "Guardar chave e ativar OpenAI" }),
  );
  await waitFor(() =>
    expect(act).toHaveBeenCalledWith({
      kind: "quickSetup",
      key: "test-key-for-secure-storage-only",
    }),
  );
  expect(input).toHaveValue("");
  expect(
    screen.getByRole("button", { name: "Verificar conexão e modelo" }),
  ).toBeDisabled();
});
