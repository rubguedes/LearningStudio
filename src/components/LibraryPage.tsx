import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Page, Snapshot, StudyApi } from "../domain/types";
import type {
  EnglishLesson,
  EnglishSubmission,
  LearningApi,
  LibraryAction,
  LibrarySnapshot,
  Roadmap,
  VocabularyItem,
  LearningReview,
} from "../domain/library";
import { comprehension, reordered } from "../domain/library";
import { dateKey } from "../domain/rules";
import { learningApi } from "../services/library";
import { normalizeError } from "../services/tauri";
import { Dialog } from "./Dialog";

interface Props {
  page: Page;
  snapshot: Snapshot;
  api: StudyApi;
  busy: boolean;
  setPage(page: Page): void;
  run(action: () => Promise<void>, message: string): Promise<boolean>;
  libraryApi?: LearningApi;
}
export function LibraryPage({
  page,
  snapshot,
  setPage,
  run,
  busy,
  libraryApi = learningApi,
}: Props) {
  const [data, setData] = useState<LibrarySnapshot | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(""),
    [deletion, setDeletion] = useState<LibraryAction | null>(null);
  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void libraryApi
        .snapshot()
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
          }
        })
        .catch((e: unknown) => {
          if (active) setError(normalizeError(e).message);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [libraryApi, refresh]);
  const act = useCallback(
    async (action: LibraryAction) => {
      const ok = await run(() => libraryApi.action(action), "Alteração salva.");
      if (ok) {
        setRefresh((v) => v + 1);
        setDeletion(null);
      }
      return ok;
    },
    [libraryApi, run],
  );
  if (!data)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>
          {error || "Carregando biblioteca local…"}
        </p>
        {error && (
          <button
            className="button secondary"
            onClick={() => setRefresh((v) => v + 1)}
          >
            Tentar novamente
          </button>
        )}
      </section>
    );
  const lesson = data.lessons.find((l) => l.id === selected);
  return (
    <div className="library-page">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {page === "roadmaps" && (
        <>
          <div className="page-intro">
            <div>
              <h2>Um caminho que você pode adaptar</h2>
              <p>
                Reorganize etapas e use evidências para registrar suas
                conquistas. Abrir uma trilha não conta como progresso.
              </p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => setSelected("new")}
            >
              Nova trilha
            </button>
          </div>
          {(selected === "new" ||
            data.roadmaps.some((r) => r.id === selected)) && (
            <RoadmapEditor
              key={selected}
              roadmap={data.roadmaps.find((r) => r.id === selected)}
              busy={busy}
              save={async (a) => {
                if (await act(a)) setSelected("");
              }}
              close={() => setSelected("")}
            />
          )}
          <button
            className="text-button"
            onClick={() => setPage("checkpoints")}
          >
            Criar, editar e concluir checkpoints com evidências →
          </button>
          {data.roadmaps.length === 0 && (
            <section className="panel">
              <p>Nenhuma trilha. Crie uma para organizar seus checkpoints.</p>
            </section>
          )}
          {data.roadmaps.map((roadmap) => {
            const completed = roadmap.items.filter(
              (id) =>
                snapshot.checkpoints.find((c) => c.id === id)?.completedAt,
            ).length;
            return (
              <section className="panel roadmap" key={roadmap.id}>
                <div className="section-heading">
                  <div>
                    <h2>{roadmap.title}</h2>
                    <p>{roadmap.description}</p>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setSelected(roadmap.id)}
                    >
                      Editar trilha
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() =>
                        setDeletion({ kind: "deleteRoadmap", id: roadmap.id })
                      }
                    >
                      Excluir trilha
                    </button>
                  </div>
                </div>
                <p>
                  {completed} de {roadmap.items.length} etapas concluídas com
                  evidência
                </p>
                <progress
                  max={Math.max(1, roadmap.items.length)}
                  value={completed}
                  aria-label={`Progresso de ${roadmap.title}`}
                />
                <ol className="roadmap-steps">
                  {roadmap.items.map((id, index) => {
                    const checkpoint = snapshot.checkpoints.find(
                      (c) => c.id === id,
                    );
                    return (
                      checkpoint && (
                        <li key={id}>
                          <div>
                            <strong>
                              {checkpoint.completedAt ? "✓ " : ""}
                              {checkpoint.title}
                            </strong>
                            <p>{checkpoint.description}</p>
                            <details>
                              <summary>Atividade e critérios</summary>
                              <p>{checkpoint.activity}</p>
                              <p>
                                <strong>Critérios: </strong>
                                {checkpoint.criteria}
                              </p>
                              {snapshot.checkpointEvidence
                                .filter((e) => e.checkpointId === id)
                                .map((e) => (
                                  <blockquote key={e.id}>
                                    {e.content}
                                  </blockquote>
                                ))}
                            </details>
                          </div>
                          <div className="inline-actions">
                            <button
                              className="text-button"
                              disabled={busy || index === 0}
                              aria-label={`Subir ${checkpoint.title}`}
                              onClick={() =>
                                void act({
                                  kind: "reorder",
                                  roadmapId: roadmap.id,
                                  ids: reordered(roadmap.items, id, -1),
                                })
                              }
                            >
                              ↑
                            </button>
                            <button
                              className="text-button"
                              disabled={
                                busy || index === roadmap.items.length - 1
                              }
                              aria-label={`Descer ${checkpoint.title}`}
                              onClick={() =>
                                void act({
                                  kind: "reorder",
                                  roadmapId: roadmap.id,
                                  ids: reordered(roadmap.items, id, 1),
                                })
                              }
                            >
                              ↓
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              aria-label={`Remover ${checkpoint.title} da trilha`}
                              onClick={() =>
                                void act({
                                  kind: "unlinkCheckpoint",
                                  checkpointId: id,
                                })
                              }
                            >
                              Desvincular
                            </button>
                          </div>
                        </li>
                      )
                    );
                  })}
                </ol>
                <label>
                  Acrescentar checkpoint existente
                  <select
                    value=""
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.value)
                        void act({
                          kind: "linkCheckpoint",
                          roadmapId: roadmap.id,
                          checkpointId: e.target.value,
                        });
                    }}
                  >
                    <option value="">Escolha uma etapa sem trilha</option>
                    {snapshot.checkpoints
                      .filter(
                        (c) =>
                          !data.roadmaps.some((r) => r.items.includes(c.id)),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
              </section>
            );
          })}
        </>
      )}
      {page === "english" && (
        <>
          <div className="page-intro">
            <div>
              <h2>Prática com leitura e escrita</h2>
              <p>
                Lições originais disponíveis offline. B1–B2 é uma referência
                estimada, sem certificação. A redação usa autocorreção guiada.
              </p>
            </div>
          </div>
          <p className="helper">
            Modelo de escrita: segundas, quartas e sextas às 15h. Começa
            desativado; configure e ative em Agenda.
          </p>
          {!lesson ? (
            <div className="library-grid">
              {data.lessons.map((l) => (
                <section className="panel" key={l.id}>
                  <span className="eyebrow">
                    {l.level} · {l.minutes} min
                  </span>
                  <h2>{l.title}</h2>
                  <p>{l.objectives.join(" · ")}</p>
                  <p>
                    {
                      data.submissions.filter(
                        (s) => s.lessonId === l.id && s.submittedAt,
                      ).length
                    }{" "}
                    respostas finalizadas
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setSelected(l.id)}
                  >
                    Abrir lição
                  </button>
                </section>
              ))}
            </div>
          ) : (
            <>
              <button className="text-button" onClick={() => setSelected("")}>
                ← Todas as lições
              </button>
              <LessonPractice
                key={lesson.id}
                lesson={lesson}
                submissions={data.submissions.filter(
                  (s) => s.lessonId === lesson.id,
                )}
                reviews={data.reviews}
                busy={busy}
                act={act}
              />
            </>
          )}
          <section className="panel">
            <h2>Revisões de escrita</h2>
            {data.reviews.length === 0 ? (
              <p>
                Suas dificuldades e próximas revisões aparecerão aqui após a
                autocorreção.
              </p>
            ) : (
              data.reviews.map((r) => (
                <div className="review-note" key={r.submissionId}>
                  <strong>
                    {r.nextReview <= dateKey()
                      ? "Revisão disponível"
                      : "Próxima revisão"}{" "}
                    · {r.nextReview}
                  </strong>
                  <p>{r.difficulties}</p>
                </div>
              ))
            )}
          </section>
        </>
      )}
      {page === "vocabulary" && (
        <>
          <div className="page-intro">
            <div>
              <h2>Palavras em contexto</h2>
              <p>
                Revisões em 1, 3, 7, 14 e 30 dias conforme suas respostas.
                “Preciso rever” volta ao primeiro intervalo.
              </p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => setSelected("new")}
            >
              Adicionar palavra
            </button>
          </div>
          {(selected === "new" ||
            data.vocabulary.some((w) => w.id === selected)) && (
            <WordEditor
              key={selected}
              word={data.vocabulary.find((w) => w.id === selected)}
              busy={busy}
              close={() => setSelected("")}
              save={async (a) => {
                if (await act(a)) setSelected("");
              }}
            />
          )}
          {data.vocabulary.length === 0 ? (
            <section className="panel">
              <p>
                Salve uma expressão de uma lição ou adicione sua própria
                palavra.
              </p>
            </section>
          ) : (
            data.vocabulary.map((w) => (
              <VocabularyCard
                key={`${w.id}:${w.dueDate}`}
                word={w}
                busy={busy}
                act={act}
                edit={() => setSelected(w.id)}
                remove={() => setDeletion({ kind: "deleteWord", id: w.id })}
              />
            ))
          )}
        </>
      )}
      {deletion && (
        <Dialog
          title="Confirmar exclusão?"
          busy={busy}
          onClose={() => setDeletion(null)}
        >
          <p>
            {deletion.kind === "deleteRoadmap"
              ? "A trilha será excluída. Os checkpoints e suas evidências serão mantidos."
              : "A palavra e seu histórico de revisão serão excluídos."}
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeletion(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void act(deletion)}
            >
              Confirmar exclusão
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
type Act = (action: LibraryAction) => Promise<boolean>;
function RoadmapEditor({
  roadmap,
  busy,
  save,
  close,
}: {
  roadmap?: Roadmap;
  busy: boolean;
  save: (a: LibraryAction) => Promise<void>;
  close: () => void;
}) {
  const [id] = useState(roadmap?.id ?? crypto.randomUUID()),
    [title, setTitle] = useState(roadmap?.title ?? ""),
    [description, setDescription] = useState(roadmap?.description ?? "");
  return (
    <form
      className="panel editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ kind: "saveRoadmap", id, title, description });
      }}
    >
      <label>
        Título da trilha
        <input
          required
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </label>
      <label>
        Descrição
        <textarea
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="inline-actions">
        <button className="button primary" disabled={busy}>
          Salvar trilha
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={close}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
function LessonPractice({
  lesson,
  submissions,
  reviews,
  busy,
  act,
}: {
  lesson: EnglishLesson;
  submissions: EnglishSubmission[];
  reviews: LearningReview[];
  busy: boolean;
  act: Act;
}) {
  const [attempt, setAttempt] = useState<EnglishSubmission | null>(
      submissions.find((s) => !s.submittedAt) ?? null,
    ),
    [revision, setRevision] = useState(0);
  return (
    <div className="lesson-layout">
      <section className="panel lesson-reading">
        <h2>{lesson.title}</h2>
        <span className="eyebrow">
          {lesson.level} · {lesson.minutes} min sugeridos
        </span>
        <ul>
          {lesson.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <div className="reading-text" lang="en">
          {lesson.reading.split("\n\n").map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <h3>Vocabulário útil</h3>
        {lesson.vocabulary.map((w) => (
          <div className="review-note" key={w.term}>
            <strong lang="en">{w.term}</strong>
            <p>{w.meaning}</p>
            <p lang="en">{w.example}</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void act({ kind: "saveWord", id: crypto.randomUUID(), ...w })
              }
            >
              Salvar {w.term} para revisão
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Sua prática</h2>
        <label>
          Histórico de tentativas
          <select
            value={attempt?.id ?? ""}
            onChange={(e) => {
              setAttempt(
                submissions.find((s) => s.id === e.target.value) ?? null,
              );
              setRevision((v) => v + 1);
            }}
          >
            <option value="">Nova tentativa</option>
            {submissions.map((s, i) => (
              <option key={s.id} value={s.id}>
                {s.submittedAt ? "Finalizada" : "Rascunho"} ·{" "}
                {new Date(s.updatedAt).toLocaleString("pt-BR")} ·{" "}
                {submissions.length - i}
              </option>
            ))}
          </select>
        </label>
        <LessonAnswer
          key={`${attempt?.id ?? "new"}:${revision}`}
          lesson={lesson}
          submission={attempt}
          review={reviews.find((r) => r.submissionId === attempt?.id)}
          busy={busy}
          act={act}
          saved={(s) => setAttempt(s)}
        />
      </section>
    </div>
  );
}
function LessonAnswer({
  lesson,
  submission,
  review,
  busy,
  act,
  saved,
}: {
  lesson: EnglishLesson;
  submission: EnglishSubmission | null;
  review?: LearningReview;
  busy: boolean;
  act: Act;
  saved: (s: EnglishSubmission) => void;
}) {
  const [id] = useState(submission?.id ?? crypto.randomUUID()),
    [writing, setWriting] = useState(submission?.writing ?? ""),
    [answers, setAnswers] = useState<(number | null)[]>(
      submission?.answers ?? lesson.questions.map(() => null),
    );
  const [difficulties, setDifficulties] = useState(review?.difficulties ?? ""),
    [revisedWriting, setRevisedWriting] = useState(
      review?.revisedWriting ?? "",
    ),
    [nextReview, setNextReview] = useState(review?.nextReview ?? dateKey());
  const finished = !!submission?.submittedAt;
  async function save(submit: boolean) {
    if (
      await act({
        kind: "saveSubmission",
        id,
        lessonId: lesson.id,
        writing,
        answers,
        submit,
      })
    ) {
      saved({
        id,
        lessonId: lesson.id,
        writing,
        answers,
        submittedAt: submit ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  const result = submission ? comprehension(lesson, submission) : null;
  return (
    <>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        {lesson.questions.map((q, i) => (
          <fieldset key={q.prompt} disabled={busy || finished}>
            <legend lang="en">
              {i + 1}. {q.prompt}
            </legend>
            {q.choices.map((choice, index) => (
              <label className="choice" key={choice}>
                <input
                  type="radio"
                  required
                  name={`question-${i}`}
                  checked={answers[i] === index}
                  onChange={() =>
                    setAnswers((a) => a.map((v, n) => (n === i ? index : v)))
                  }
                />
                <span lang="en">{choice}</span>
              </label>
            ))}
            {finished && (
              <p className="answer-note">
                {answers[i] === q.answer
                  ? "Resposta correta."
                  : "Rever esta questão."}{" "}
                {q.explanation}
              </p>
            )}
          </fieldset>
        ))}
        <label>
          Proposta de escrita<p lang="en">{lesson.writingPrompt}</p>
          <textarea
            aria-label="Sua redação original"
            required
            disabled={finished}
            rows={12}
            maxLength={20000}
            value={writing}
            onChange={(e) => setWriting(e.target.value)}
            lang="en"
            spellCheck
          />
        </label>
        {!finished && (
          <div className="inline-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void save(false)}
            >
              Salvar rascunho
            </button>
            <button className="button primary" disabled={busy}>
              Finalizar resposta
            </button>
          </div>
        )}
      </form>
      {finished && (
        <>
          <p role="status">
            Compreensão: {result?.correct} de {result?.total}. A redação não
            recebeu nota automática.
          </p>
          <details>
            <summary>Referência e orientação para autocorreção</summary>
            <p lang="en">{lesson.reference}</p>
            <p>
              Esta é uma resposta possível. Outras formulações também podem ser
              válidas.
            </p>
            <ul>
              {lesson.rubric.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <h3>Desafio de continuação</h3>
            <p lang="en">{lesson.followUp}</p>
          </details>
          <form
            className="editor-form review-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act({
                kind: "saveReview",
                submissionId: id,
                difficulties,
                revisedWriting,
                nextReview,
              });
            }}
          >
            <h3>Minha autocorreção</h3>
            <label>
              Dificuldades e observações
              <textarea
                required
                maxLength={4000}
                value={difficulties}
                onChange={(e) => setDifficulties(e.target.value)}
              />
            </label>
            <label>
              Versão revisada (separada do original)
              <textarea
                lang="en"
                rows={8}
                maxLength={20000}
                value={revisedWriting}
                onChange={(e) => setRevisedWriting(e.target.value)}
              />
            </label>
            <label>
              Data da próxima revisão
              <input
                required
                type="date"
                min={dateKey()}
                value={nextReview}
                onChange={(e) => setNextReview(e.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy}>
              Salvar autocorreção
            </button>
          </form>
        </>
      )}
    </>
  );
}
function WordEditor({
  word,
  busy,
  save,
  close,
}: {
  word?: VocabularyItem;
  busy: boolean;
  save: (a: LibraryAction) => Promise<void>;
  close: () => void;
}) {
  const [id] = useState(word?.id ?? crypto.randomUUID()),
    [term, setTerm] = useState(word?.term ?? ""),
    [meaning, setMeaning] = useState(word?.meaning ?? ""),
    [example, setExample] = useState(word?.example ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    void save({ kind: "saveWord", id, term, meaning, example });
  }
  return (
    <form className="panel editor-form" onSubmit={submit}>
      <label>
        Palavra ou expressão
        <input
          required
          maxLength={120}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
        />
      </label>
      <label>
        Significado
        <input
          required
          maxLength={1000}
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
        />
      </label>
      <label>
        Exemplo em contexto
        <textarea
          maxLength={2000}
          value={example}
          onChange={(e) => setExample(e.target.value)}
        />
      </label>
      <div className="inline-actions">
        <button className="button primary" disabled={busy}>
          Salvar palavra
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={close}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
function VocabularyCard({
  word,
  busy,
  act,
  edit,
  remove,
}: {
  word: VocabularyItem;
  busy: boolean;
  act: Act;
  edit: () => void;
  remove: () => void;
}) {
  const [revealed, setRevealed] = useState(false),
    [reviewId] = useState(crypto.randomUUID());
  const due = word.dueDate <= dateKey();
  return (
    <section className="panel">
      <div className="section-heading">
        <h2 lang="en">{word.term}</h2>
        <div className="inline-actions">
          <button className="text-button" disabled={busy} onClick={edit}>
            Editar palavra
          </button>
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={remove}
          >
            Excluir palavra
          </button>
        </div>
      </div>
      <p>
        {word.reviews} revisões registradas ·{" "}
        {due ? "Revisão disponível" : `Próxima revisão: ${word.dueDate}`}
      </p>
      {!revealed ? (
        <button className="button secondary" onClick={() => setRevealed(true)}>
          Mostrar significado
        </button>
      ) : (
        <>
          <p>{word.meaning}</p>
          <p lang="en">{word.example}</p>
          {due && (
            <div className="inline-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void act({
                    kind: "reviewWord",
                    id: word.id,
                    remembered: false,
                    reviewId,
                  })
                }
              >
                Preciso rever
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void act({
                    kind: "reviewWord",
                    id: word.id,
                    remembered: true,
                    reviewId,
                  })
                }
              >
                Lembrei
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
