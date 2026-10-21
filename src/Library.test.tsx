import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LibraryPage } from "./components/LibraryPage";
import { comprehension, reordered } from "./domain/library";
import type {
  LearningApi,
  LibraryAction,
  LibrarySnapshot,
} from "./domain/library";
import type { Page } from "./domain/types";
import lessons from "../src-tauri/content/english.json";
import { fakeApi } from "./test/fakeApi";
function fixture(page: Page) {
  const data: LibrarySnapshot = {
    roadmaps: [],
    lessons,
    submissions: [],
    reviews: [],
    vocabulary: [],
  };
  const action = vi.fn(async (a: LibraryAction) => {
    if (a.kind === "saveSubmission")
      data.submissions = [
        {
          id: a.id,
          lessonId: a.lessonId,
          writing: a.writing,
          answers: a.answers,
          submittedAt: a.submit ? "2026-10-19T18:00:00Z" : null,
          updatedAt: "2026-10-19T18:00:00Z",
        },
      ];
    if (a.kind === "saveReview") data.reviews = [a];
  });
  const libraryApi: LearningApi = {
    snapshot: async () => structuredClone(data),
    action,
  };
  render(
    <LibraryPage
      page={page}
      snapshot={fakeApi().data}
      api={fakeApi().api}
      busy={false}
      setPage={vi.fn()}
      libraryApi={libraryApi}
      run={async (operation) => {
        await operation();
        return true;
      }}
    />,
  );
  return { action, user: userEvent.setup(), data };
}
describe("Biblioteca offline", () => {
  it("reordena sem alterar o original e respeita limites", () => {
    const ids = ["a", "b", "c"];
    expect(reordered(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(reordered(ids, "a", -1)).toEqual(ids);
  });
  it("calcula compreensão por questão, sem atribuir nota à redação", () => {
    expect(
      comprehension(lessons[0], {
        id: "x",
        lessonId: lessons[0].id,
        writing: "Any valid argument",
        answers: [1, 0, 2],
        submittedAt: "today",
        updatedAt: "today",
      }),
    ).toEqual({ correct: 3, total: 3 });
  });
  it("salva rascunho incompleto e preserva a tentativa finalizada", async () => {
    const { user, action } = fixture("english");
    await user.click(
      (await screen.findAllByRole("button", { name: "Abrir lição" }))[0],
    );
    await user.type(
      screen.getByLabelText("Sua redação original"),
      "I would compare two study schedules.",
    );
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "saveSubmission",
          submit: false,
          answers: [null, null, null],
        }),
      ),
    );
    await user.click(
      screen.getByLabelText("It could not afford both options permanently."),
    );
    await user.click(
      screen.getByLabelText(
        "Weather and the college holiday might affect demand.",
      ),
    );
    await user.click(
      screen.getByLabelText("Small experiments help expose assumptions."),
    );
    await user.click(
      screen.getByRole("button", { name: "Finalizar resposta" }),
    );
    await screen.findByText(
      "Compreensão: 3 de 3. A redação não recebeu nota automática.",
    );
    expect(screen.getByLabelText("Sua redação original")).toBeDisabled();
    await user.type(
      screen.getByLabelText("Dificuldades e observações"),
      "Use although with a complete clause.",
    );
    await user.type(
      screen.getByLabelText("Versão revisada (separada do original)"),
      "A separate revision.",
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar autocorreção" }),
    );
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "saveReview",
          revisedWriting: "A separate revision.",
        }),
      ),
    );
    expect(screen.getByLabelText("Sua redação original")).toHaveValue(
      "I would compare two study schedules.",
    );
  });
  it("não expõe referência de escrita antes de finalizar e permite salvar vocabulário", async () => {
    const { user, action } = fixture("english");
    await user.click(
      (await screen.findAllByRole("button", { name: "Abrir lição" }))[0],
    );
    expect(
      screen.queryByText("Referência e orientação para autocorreção"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Salvar assumption para revisão" }),
    );
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "saveWord", term: "assumption" }),
    );
  });
});
