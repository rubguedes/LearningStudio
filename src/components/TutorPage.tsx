import { useEffect, useState } from "react";
import type { Page } from "../domain/types";
import type {
  CodingChallenge,
  CodeSubmission,
  EvaluationResult,
  TutorAction,
  TutorApi,
  TutorSnapshot,
} from "../domain/tutors";
import type { LearningApi, LibrarySnapshot } from "../domain/library";
import { comprehension } from "../domain/library";
import { monthlySpend, money } from "../domain/tutors";
import { tutorApi } from "../services/tutors";
import { learningApi } from "../services/library";
import { normalizeError } from "../services/tauri";
import { Dialog } from "./Dialog";
import { CodeEditor } from "./CodeEditor";
import { TutorSettings, UsagePanel } from "./TutorSettings";
interface Props {
  page: Page;
  busy: boolean;
  run(action: () => Promise<void>, message: string): Promise<boolean>;
  setPage(page: Page): void;
  service?: TutorApi;
  library?: LearningApi;
}
type Act = (a: TutorAction) => Promise<boolean>;
export function TutorPage({
  page,
  busy,
  run,
  setPage,
  service = tutorApi,
  library = learningApi,
}: Props) {
  const [data, setData] = useState<TutorSnapshot | null>(null),
    [english, setEnglish] = useState<LibrarySnapshot | null>(null),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  const [topic, setTopic] = useState(""),
    [level, setLevel] = useState("B2"),
    [language, setLanguage] = useState("python"),
    [difficulty, setDifficulty] = useState("iniciante"),
    [submissionId, setSubmissionId] = useState("");
  const [pending, setPending] = useState<{
      action: TutorAction;
      preview: string;
    } | null>(null),
    [manual, setManual] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all([service.snapshot(), library.snapshot()])
        .then(([t, e]) => {
          if (active) {
            setData(t);
            setEnglish(e);
            setError("");
          }
        })
        .catch((e: unknown) => {
          if (active) setError(normalizeError(e).message);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [service, library, refresh]);
  async function act(action: TutorAction) {
    const ok = await run(() => service.action(action), "Tutor atualizado.");
    if (ok) {
      setRefresh((v) => v + 1);
      setPending(null);
      setManual(false);
    }
    return ok;
  }
  if (!data || !english)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>
          {error || "Carregando tutores locais…"}
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
  const aiReady =
    data.settings.provider !== "disabled" &&
    (data.settings.provider !== "openai" || data.hasKey);
  const challenge = data.challenges.find((c) => c.id === selected);
  const chosen = english.submissions.find((s) => s.id === submissionId),
    lesson = english.lessons.find((l) => l.id === chosen?.lessonId);
  const recommendations = english.reviews
    .map((r) => r.difficulties)
    .concat(
      english.submissions
        .filter((s) => s.submittedAt)
        .flatMap((s) => {
          const l = english.lessons.find((l) => l.id === s.lessonId);
          if (!l) return [];
          const result = comprehension(l, s);
          return result.correct < result.total
            ? [
                `Rever compreensão em “${l.title}”: ${result.correct}/${result.total} questões corretas.`,
              ]
            : [];
        }),
    );
  return (
    <div className="library-page">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {page === "settings" ? (
        <TutorSettings
          key={JSON.stringify(data.settings) + data.hasKey}
          data={data}
          busy={busy}
          act={act}
        />
      ) : (
        <>
          <div className="page-intro">
            <div>
              <h2>
                {page === "coding"
                  ? "Pratique Python e TypeScript"
                  : "Tutor de inglês"}
              </h2>
              <p>
                {page === "coding"
                  ? "Enunciados, dicas, tentativas e revisões preservadas. Nenhum código submetido é executado neste computador."
                  : "Gere lições originais ou peça uma revisão de respostas já finalizadas. A prática offline continua disponível."}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setPage("settings")}
            >
              Configurar IA e orçamento
            </button>
          </div>
          <section className="panel">
            <h2>
              {page === "coding"
                ? "Gerar próximo desafio"
                : "Gerar próxima lição"}
            </h2>
            <p>
              Provedor:{" "}
              {data.settings.provider === "disabled"
                ? "desativado"
                : data.settings.provider}
              . A IA fornece sugestões, sem certificar nível ou comprovar
              execução de testes.
            </p>
            <label>
              Tema e dificuldades para praticar
              <textarea
                maxLength={1000}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  page === "coding"
                    ? "Ex.: testes, APIs, automação, algoritmos, agentes ou integração com modelos"
                    : "Ex.: contrast connectors, writing about technical decisions"
                }
              />
            </label>
            <div className="form-grid">
              {page === "coding" ? (
                <>
                  <label>
                    Linguagem
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="python">Python</option>
                      <option value="typescript">TypeScript</option>
                    </select>
                  </label>
                  <label>
                    Dificuldade
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option>iniciante</option>
                      <option>intermediário</option>
                      <option>avançado</option>
                    </select>
                  </label>
                </>
              ) : (
                <label>
                  Nível de referência
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option>B1</option>
                    <option>B2</option>
                    <option>C1</option>
                  </select>
                </label>
              )}
            </div>
            <div className="inline-actions">
              <button
                className="button primary"
                disabled={busy || !aiReady || !topic.trim()}
                onClick={() =>
                  setPending({
                    action:
                      page === "coding"
                        ? {
                            kind: "generateChallenge",
                            topic,
                            language,
                            difficulty,
                            consent: true,
                          }
                        : {
                            kind: "generateLesson",
                            topic,
                            level,
                            consent: true,
                          },
                    preview:
                      page === "coding"
                        ? `${language} · ${difficulty}\n${topic}`
                        : `${level} estimado\n${topic}`,
                  })
                }
              >
                Revisar pedido de geração
              </button>
              {page === "coding" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setManual(true)}
                >
                  Novo desafio manual
                </button>
              )}
              {page === "tutors" && (
                <button
                  className="button secondary"
                  onClick={() => setPage("english")}
                >
                  Abrir lições offline
                </button>
              )}
            </div>
            {!aiReady && (
              <p className="helper">
                Configure um provedor para gerar conteúdo. Os exercícios já
                instalados podem ser usados agora.
              </p>
            )}
          </section>
          {page === "coding" ? (
            challenge ? (
              <>
                <button className="text-button" onClick={() => setSelected("")}>
                  ← Todos os desafios
                </button>
                <CodePractice
                  key={challenge.id}
                  challenge={challenge}
                  submissions={data.submissions.filter(
                    (s) => s.challengeId === challenge.id,
                  )}
                  evaluations={data.evaluations}
                  busy={busy}
                  aiReady={aiReady}
                  act={act}
                  solution={(id) => service.solution(id)}
                  requestReview={(submission) =>
                    setPending({
                      action: {
                        kind: "reviewCode",
                        submissionId: submission.id,
                        consent: true,
                      },
                      preview: `${challenge.prompt}\nCritérios: ${challenge.criteria.join("; ")}\n\nCódigo original:\n${submission.code}`,
                    })
                  }
                />
              </>
            ) : (
              <div className="library-grid">
                {data.challenges.map((c) => (
                  <section className="panel" key={c.id}>
                    <span className="eyebrow">
                      {c.language} · {c.difficulty}
                    </span>
                    <h2>{c.title}</h2>
                    <p>{c.prompt}</p>
                    <button
                      className="button primary"
                      onClick={() => setSelected(c.id)}
                    >
                      Abrir desafio
                    </button>
                  </section>
                ))}
              </div>
            )
          ) : (
            <>
              <section className="panel">
                <h2>Revisar uma redação finalizada</h2>
                <label>
                  Resposta original
                  <select
                    value={submissionId}
                    onChange={(e) => setSubmissionId(e.target.value)}
                  >
                    <option value="">Selecione uma tentativa</option>
                    {english.submissions
                      .filter((s) => s.submittedAt)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {
                            english.lessons.find((l) => l.id === s.lessonId)
                              ?.title
                          }{" "}
                          · {new Date(s.updatedAt).toLocaleString("pt-BR")}
                        </option>
                      ))}
                  </select>
                </label>
                {chosen && (
                  <blockquote className="preserve-text" lang="en">
                    {chosen.writing}
                  </blockquote>
                )}
                <button
                  className="button primary"
                  disabled={busy || !aiReady || !chosen}
                  onClick={() => {
                    if (chosen && lesson)
                      setPending({
                        action: {
                          kind: "reviewEnglish",
                          submissionId: chosen.id,
                          consent: true,
                        },
                        preview: `Proposta: ${lesson.writingPrompt}\nRubrica: ${lesson.rubric.join("; ")}\n\nOriginal:\n${chosen.writing}`,
                      });
                  }}
                >
                  Revisar envio para correção
                </button>
                {data.evaluations
                  .filter((e) => e.englishSubmissionId === submissionId)
                  .map((e) => (
                    <FeedbackCard key={e.id} evaluation={e} />
                  ))}
              </section>
              <section className="panel">
                <h2>Próximas revisões a partir do seu histórico</h2>
                <p>
                  Estas sugestões vêm de dificuldades registradas por você e de
                  questões de compreensão corrigidas pelo gabarito. Você escolhe
                  o foco e ajusta o nível.
                </p>
                {recommendations.length === 0 ? (
                  <p>
                    Finalize uma lição e registre sua autocorreção para reunir
                    evidências de evolução.
                  </p>
                ) : (
                  recommendations.slice(0, 8).map((r, i) => (
                    <div className="review-note" key={i}>
                      <p>{r}</p>
                      <button
                        className="text-button"
                        onClick={() => setTopic(r.slice(0, 1000))}
                      >
                        Usar como foco da próxima lição
                      </button>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
          <UsagePanel data={data} />
        </>
      )}
      {pending && (
        <Dialog
          title="Revisar envio para IA"
          busy={busy}
          onClose={() => setPending(null)}
        >
          <p>
            Destino:{" "}
            <strong>
              {data.settings.provider === "openai"
                ? `OpenAI API · ${data.settings.openaiModel}`
                : `Ollama neste computador · ${data.settings.ollamaModel}`}
            </strong>
            .
          </p>
          <pre className="ai-preview">{pending.preview}</pre>
          <p>
            {data.settings.provider === "openai"
              ? `Consumo e reservas do mês: ${money(monthlySpend(data.usage), data.settings.currency)}. A próxima chamada pode gerar cobrança; o aplicativo verificará a reserva contra o limite configurado.`
              : "O conteúdo será enviado ao serviço Ollama local configurado. Ele usa recursos deste computador."}
          </p>
          <p>
            O feedback não substitui verificação humana nem demonstra testes de
            código. Sua resposta original será mantida.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void act(pending.action)}
            >
              Confirmar envio para IA
            </button>
          </div>
        </Dialog>
      )}
      {manual && (
        <ManualChallenge busy={busy} act={act} close={() => setManual(false)} />
      )}
    </div>
  );
}
function CodePractice({
  challenge,
  submissions,
  evaluations,
  busy,
  aiReady,
  act,
  solution,
  requestReview,
}: {
  challenge: CodingChallenge;
  submissions: CodeSubmission[];
  evaluations: EvaluationResult[];
  busy: boolean;
  aiReady: boolean;
  act: Act;
  solution: (id: string) => Promise<string>;
  requestReview: (s: CodeSubmission) => void;
}) {
  const [attempt, setAttempt] = useState<CodeSubmission | null>(
      submissions.find((s) => !s.submittedAt) ?? null,
    ),
    [version, setVersion] = useState(0),
    [hints, setHints] = useState(0),
    [reference, setReference] = useState(""),
    [issue, setIssue] = useState("");
  return (
    <div className="lesson-layout">
      <section className="panel">
        <span className="eyebrow">
          {challenge.language} · {challenge.difficulty}
        </span>
        <h2>{challenge.title}</h2>
        <p className="preserve-text">{challenge.prompt}</p>
        <h3>Exemplos</h3>
        {challenge.examples.map((e, i) => (
          <pre key={i}>
            Entrada: {e.input}
            {"\n"}Saída: {e.output}
          </pre>
        ))}
        <h3>Restrições e critérios</h3>
        <ul>
          {[...challenge.constraints, ...challenge.criteria].map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <h3>Casos de teste para estudar · não executados</h3>
        {challenge.visibleTests.map((t, i) => (
          <pre key={i}>{t}</pre>
        ))}
        <h3>Dicas graduais</h3>
        {challenge.hints.slice(0, hints).map((h, i) => (
          <p key={i}>
            {i + 1}. {h}
          </p>
        ))}
        <button
          className="button secondary"
          disabled={hints >= challenge.hints.length}
          onClick={() => setHints((v) => v + 1)}
        >
          Mostrar próxima dica
        </button>
      </section>
      <section className="panel">
        <label>
          Histórico de código
          <select
            value={attempt?.id ?? ""}
            onChange={(e) => {
              setAttempt(
                submissions.find((s) => s.id === e.target.value) ?? null,
              );
              setVersion((v) => v + 1);
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
        <CodeAnswer
          key={`${attempt?.id ?? "new"}:${version}`}
          challengeId={challenge.id}
          submission={attempt}
          busy={busy}
          aiReady={aiReady}
          act={act}
          saved={setAttempt}
          requestReview={requestReview}
        />
        <button
          className="button secondary"
          disabled
          title="Não há sandbox validada com limites de rede, arquivos, permissões, CPU, memória e tempo."
        >
          Executar testes · indisponível
        </button>
        <p className="helper">
          A execução está desativada por falta de isolamento comprovado. O
          aplicativo oferece leitura estática, autorrevisão e IA opcional.
          Nenhum resultado de teste é inventado.
        </p>
        {submissions.some((s) => s.submittedAt) && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              void solution(challenge.id)
                .then(setReference)
                .catch((e: unknown) => setIssue(normalizeError(e).message));
            }}
          >
            Revelar solução de referência após a tentativa
          </button>
        )}
        {issue && (
          <p className="error" role="alert">
            {issue}
          </p>
        )}
        {reference && (
          <details open>
            <summary>
              Referência de estudo · não executada pelo aplicativo
            </summary>
            <pre>{reference}</pre>
          </details>
        )}
        {evaluations
          .filter((e) => e.codeSubmissionId === attempt?.id)
          .map((e) => (
            <FeedbackCard key={e.id} evaluation={e} />
          ))}
      </section>
    </div>
  );
}
function CodeAnswer({
  challengeId,
  submission,
  busy,
  aiReady,
  act,
  saved,
  requestReview,
}: {
  challengeId: string;
  submission: CodeSubmission | null;
  busy: boolean;
  aiReady: boolean;
  act: Act;
  saved: (s: CodeSubmission) => void;
  requestReview: (s: CodeSubmission) => void;
}) {
  const [id] = useState(submission?.id ?? crypto.randomUUID()),
    [code, setCode] = useState(submission?.code ?? ""),
    [notes, setNotes] = useState(""),
    [revised, setRevised] = useState("");
  async function save(submit: boolean) {
    if (await act({ kind: "saveCode", id, challengeId, code, submit }))
      saved({
        id,
        challengeId,
        code,
        submittedAt: submit ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
  }
  return (
    <>
      <CodeEditor
        value={code}
        onChange={setCode}
        disabled={!!submission?.submittedAt}
      />
      {!submission?.submittedAt ? (
        <div className="inline-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            Salvar rascunho de código
          </button>
          <button
            className="button primary"
            disabled={busy || !code.trim()}
            onClick={() => void save(true)}
          >
            Finalizar código
          </button>
        </div>
      ) : (
        <>
          <div className="inline-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void act({ kind: "staticReview", submissionId: id })
              }
            >
              Leitura estática limitada
            </button>
            <button
              className="button primary"
              disabled={busy || !aiReady}
              onClick={() => requestReview(submission)}
            >
              Revisar código com IA
            </button>
          </div>
          <details>
            <summary>Registrar minha autorrevisão</summary>
            <form
              className="editor-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act({
                  kind: "selfReview",
                  submissionId: id,
                  notes,
                  revised,
                });
              }}
            >
              <label>
                Observações sobre os critérios
                <textarea
                  required
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <CodeEditor
                label="Minha revisão de código"
                value={revised}
                onChange={setRevised}
              />
              <button className="button primary" disabled={busy}>
                Salvar autorrevisão de código
              </button>
            </form>
          </details>
        </>
      )}
    </>
  );
}
function FeedbackCard({ evaluation }: { evaluation: EvaluationResult }) {
  const f = evaluation.feedback;
  return (
    <section className="feedback-card">
      <span className="eyebrow">
        {evaluation.source === "self"
          ? "Autorrevisão"
          : evaluation.source === "static"
            ? "Leitura estática limitada"
            : `Sugestão de IA · ${evaluation.source}`}{" "}
        · {new Date(evaluation.createdAt).toLocaleString("pt-BR")}
      </span>
      <h3>Feedback · testes de código não executados</h3>
      <p>{f.summary}</p>
      {f.findings.map((finding, i) => (
        <div className="review-note" key={i}>
          <strong>{finding.category}</strong>
          <blockquote>{finding.excerpt}</blockquote>
          <p>{finding.suggestion}</p>
          <p>{finding.explanation}</p>
        </div>
      ))}
      {f.revised && (
        <details>
          <summary>Versão sugerida, separada do original</summary>
          <pre>{f.revised}</pre>
        </details>
      )}
      <p>
        <strong>Próximo exercício: </strong>
        {f.followUp}
      </p>
      <ul>
        {f.uncertainties.map((u, i) => (
          <li key={i}>{u}</li>
        ))}
      </ul>
    </section>
  );
}
function ManualChallenge({
  busy,
  act,
  close,
}: {
  busy: boolean;
  act: Act;
  close: () => void;
}) {
  const [id] = useState(crypto.randomUUID()),
    [title, setTitle] = useState(""),
    [prompt, setPrompt] = useState(""),
    [language, setLanguage] = useState<"python" | "typescript">("python"),
    [criteria, setCriteria] = useState(""),
    [reference, setReference] = useState(""),
    [test, setTest] = useState(""),
    [exampleInput, setExampleInput] = useState(""),
    [exampleOutput, setExampleOutput] = useState("");
  return (
    <Dialog title="Novo desafio manual" busy={busy} onClose={close}>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({
            kind: "saveChallenge",
            input: {
              challenge: {
                id,
                title,
                language,
                difficulty: "personalizado",
                prompt,
                criteria: criteria.split("\n").filter((s) => s.trim()),
                constraints: ["Sem execução automática no aplicativo."],
                hints: [
                  "Compare sua resposta com os critérios antes de consultar a referência.",
                ],
                examples: [{ input: exampleInput, output: exampleOutput }],
                visibleTests: [test],
              },
              reference,
              hiddenTests: ["Revisão manual dos critérios."],
            },
          });
        }}
      >
        <label>
          Título do desafio
          <input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Linguagem
          <select
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value as "python" | "typescript")
            }
          >
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
          </select>
        </label>
        <label>
          Enunciado
          <textarea
            required
            minLength={20}
            maxLength={12000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <label>
          Exemplo de entrada
          <input
            required
            maxLength={2000}
            value={exampleInput}
            onChange={(e) => setExampleInput(e.target.value)}
          />
        </label>
        <label>
          Exemplo de saída
          <input
            required
            maxLength={2000}
            value={exampleOutput}
            onChange={(e) => setExampleOutput(e.target.value)}
          />
        </label>
        <label>
          Critérios, um por linha
          <textarea
            required
            maxLength={4000}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
          />
        </label>
        <label>
          Caso de teste para estudar (texto)
          <textarea
            required
            maxLength={4000}
            value={test}
            onChange={(e) => setTest(e.target.value)}
          />
        </label>
        <label>
          Referência guardada para depois da tentativa
          <textarea
            required
            maxLength={20000}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            Salvar desafio manual
          </button>
        </div>
      </form>
    </Dialog>
  );
}
