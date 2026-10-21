import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AgendaPage } from "./components/AgendaPage";
import { calendarDays, calendarRange } from "./domain/agenda";
import type { AgendaApi, AgendaSnapshot } from "./domain/agenda";
import { fakeApi } from "./test/fakeApi";
describe("Agenda e importação manual", () => {
  it("delimita semanas e meses incluindo ano bissexto", () => {
    expect(calendarRange("2028-02-20", "month")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
    expect(calendarDays("2028-02-27", "2028-03-01")).toHaveLength(4);
    expect(calendarRange("2026-10-25", "week")).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
    });
  });
  it("nova recorrência começa desativada e requer escolha explícita", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => {});
    const data: AgendaSnapshot = {
      recurrences: [],
      imported: [],
      occurrences: [],
    };
    const service: AgendaApi = {
      snapshot: async () => data,
      action,
      preview: async () => [],
    };
    render(
      <AgendaPage
        page="agenda"
        snapshot={fakeApi().data}
        busy={false}
        service={service}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />,
    );
    await user.click(
      await screen.findByRole("button", { name: "Nova recorrência" }),
    );
    expect(screen.getByLabelText("Ativar este agendamento")).not.toBeChecked();
    await user.type(
      screen.getByLabelText("Título da recorrência"),
      "Escrita recorrente",
    );
    await user.click(screen.getByLabelText("Ativar este agendamento"));
    await user.click(
      screen.getByRole("button", { name: "Salvar recorrência" }),
    );
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "saveRecurrence",
          input: expect.objectContaining({
            title: "Escrita recorrente",
            enabled: true,
            weekdays: 21,
          }),
        }),
      ),
    );
  });
  it("exige prévia antes de confirmar importação e invalida prévia editada", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => {}),
      preview = vi.fn(async () => [
        {
          externalId: "x",
          title: "Writing",
          instructions: "Read",
          schedule: "weekly",
          url: "",
          notes: "",
        },
      ]);
    const service: AgendaApi = {
      snapshot: async () => ({
        recurrences: [],
        imported: [],
        occurrences: [],
      }),
      action,
      preview,
    };
    render(
      <AgendaPage
        page="chatgpt"
        snapshot={fakeApi().data}
        busy={false}
        service={service}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />,
    );
    const input = await screen.findByLabelText("Dados para importar");
    await user.type(input, "example");
    expect(
      screen.queryByRole("button", { name: "Confirmar importação" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Validar e mostrar prévia" }),
    );
    await screen.findByRole("heading", { name: "Prévia: 1 registros" });
    expect(action).not.toHaveBeenCalled();
    await user.type(input, " edited");
    expect(
      screen.queryByRole("button", { name: "Confirmar importação" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Validar e mostrar prévia" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirmar importação" }),
    );
    expect(action).toHaveBeenCalledWith({
      kind: "import",
      format: "json",
      content: "example edited",
    });
  });
});
