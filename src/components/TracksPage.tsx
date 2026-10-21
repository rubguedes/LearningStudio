import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Snapshot, StudyApi, Page } from "../domain/types";
import type { LibrarySnapshot } from "../domain/library";
import type {
  TracksSnapshot,
  TracksAction,
  LanguageProfile,
  TrackPlan,
  TrackDocument,
  PracticeError,
  JobRecord,
  ResumeVersion,
  SourceRecord,
} from "../domain/tracks";
import {
  pathSteps,
  rankErrors,
  marketRanking,
  jobMatch,
} from "../domain/tracks";
import { tracksApi } from "../services/tracks";
import { learningApi } from "../services/library";
import { normalizeError } from "../services/tauri";
import { dateKey } from "../domain/rules";
import { LibraryPage } from "./LibraryPage";

type Props = {
  snapshot: Snapshot;
  api: StudyApi;
  busy: boolean;
  setPage: (p: Page) => void;
  run: (action: () => Promise<void>, message: string) => Promise<boolean>;
};
type Act = (action: TracksAction) => Promise<boolean>;
export function TracksPage(props: Props) {
  const [data, setData] = useState<TracksSnapshot | null>(null),
    [library, setLibrary] = useState<LibrarySnapshot | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [tab, setTab] = useState<"language" | "career">("language");
  useEffect(() => {
    let active = true;
    void Promise.all([tracksApi.snapshot(), learningApi.snapshot()])
      .then(([d, l]) => {
        if (active) {
          setData(d);
          setLibrary(l);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (active) setError(normalizeError(e).message);
      });
    return () => {
      active = false;
    };
  }, [revision, props.snapshot]);
  const act: Act = async (action) => {
    const ok = await props.run(
      () => tracksApi.action(action),
      "Alteração da trilha salva.",
    );
    if (ok) setRevision((v) => v + 1);
    return ok;
  };
  if (!data || !library)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>
          {error || "Carregando trilhas locais…"}
        </p>
        {error && (
          <button
            className="button secondary"
            onClick={() => setRevision((v) => v + 1)}
          >
            Tentar novamente
          </button>
        )}
      </section>
    );
  const roadmaps = library.roadmaps.filter((r) => {
    const language =
      /inglês|idioma/i.test(r.title) ||
      data.documents.some((d) => d.kind === "plan" && d.id === r.id);
    return tab === "language" ? language : !language;
  });
  return (
    <div className="library-page">
      <div className="inline-actions" role="group" aria-label="Tipo de trilha">
        <button
          className={`button ${tab === "language" ? "primary" : "secondary"}`}
          aria-pressed={tab === "language"}
          onClick={() => setTab("language")}
        >
          Trilha de Idiomas
        </button>
        <button
          className={`button ${tab === "career" ? "primary" : "secondary"}`}
          aria-pressed={tab === "career"}
          onClick={() => setTab("career")}
        >
          Trilha de Carreira
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {roadmaps.map((roadmap) => {
        const steps = pathSteps(roadmap, props.snapshot.checkpoints);
        const done = steps.filter((s) => s.state === "completed").length;
        const next = steps.find((s) => s.state === "available");
        return (
          <section className="panel" key={roadmap.id}>
            <h2>{roadmap.title}</h2>
            <p>{roadmap.description}</p>
            <progress
              value={done}
              max={Math.max(steps.length, 1)}
              aria-label={`Progresso de ${roadmap.title}`}
            />
            <p>
              {done} de {steps.length} etapas concluídas com evidência.
            </p>
            <p>
              Próxima ação:{" "}
              {next?.checkpoint.activity ??
                "Todas as etapas registradas foram concluídas."}
            </p>
            <ol className="track-path">
              {steps.map(({ checkpoint: c, state }, i) => (
                <li key={c.id} className={`track-node ${state}`}>
                  <span className="track-marker" aria-hidden="true">
                    {state === "completed" ? "✓" : i + 1}
                  </span>
                  <div>
                    <strong>{c.title}</strong>
                    <p>
                      {state === "completed"
                        ? "Concluído com evidência"
                        : state === "available"
                          ? "Disponível · próximo passo"
                          : "Bloqueado na sequência recomendada"}
                    </p>
                    <details>
                      <summary>Atividade e critérios</summary>
                      <p>{c.activity}</p>
                      <p>
                        <strong>Critérios:</strong> {c.criteria}
                      </p>
                      <button
                        className="button secondary"
                        disabled={props.busy || state === "locked"}
                        onClick={() => props.setPage("checkpoints")}
                      >
                        Abrir checkpoints e registrar evidência
                      </button>
                    </details>
                  </div>
                </li>
              ))}
            </ol>
            <p className="helper">
              O bloqueio orienta a sequência. Você pode adaptar o percurso no
              editor; progresso depende das evidências, nunca de abrir telas.
            </p>
          </section>
        );
      })}
      {tab === "language" ? (
        <>
          <LanguageSettings data={data} act={act} busy={props.busy} />
          <section className="panel">
            <h2>Lições em PDF para anotação</h2>
            <p>
              PDF padrão A4, campos identificados, margens amplas e espaço para
              escrita. Samsung Notes/S Pen não foram testados. Esta versão usa
              fontes latinas; outros alfabetos exigem suporte tipográfico
              adicional.
            </p>
            {library.lessons.map((l) => (
              <div className="section-heading" key={l.id}>
                <span>{l.title}</span>
                <div className="inline-actions">
                  {[false, true].map((importFile) => (
                    <button
                      key={String(importFile)}
                      className="button secondary"
                      disabled={props.busy}
                      onClick={() => {
                        void props.run(async () => {
                          const message = await tracksApi.pdf(l.id, importFile);
                          setError(message);
                          setRevision((v) => v + 1);
                        }, "Operação PDF concluída.");
                      }}
                    >
                      {importFile ? "Importar anotado" : "Exportar PDF"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="helper">
              Importações: até 512 KiB por versão, preservadas localmente. OCR e
              leitura manuscrita não estão configurados: a correção envia apenas
              sua transcrição confirmada.
            </p>
            {data.pdfs.map((pdf) => (
              <PdfReview
                key={pdf.id}
                pdf={pdf}
                reviews={data.pdfReviews.filter((r) => r.pdfId === pdf.id)}
                act={act}
                busy={props.busy}
              />
            ))}
          </section>
          <PracticeArea errors={data.errors} act={act} busy={props.busy} />
        </>
      ) : (
        <CareerArea data={data} act={act} busy={props.busy} />
      )}
      <details className="panel">
        <summary>Editar percursos e checkpoints existentes</summary>
        <LibraryPage {...props} page="roadmaps" />
      </details>
    </div>
  );
}
function Consent({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children ??
        "Autorizo enviar os campos desta solicitação ao provedor configurado, consumindo o orçamento de IA."}
    </label>
  );
}
function LanguageSettings({
  data,
  act,
  busy,
}: {
  data: TracksSnapshot;
  act: Act;
  busy: boolean;
}) {
  const [profile, setProfile] = useState<LanguageProfile>({
      id: crypto.randomUUID(),
      language: "Inglês",
      currentLevel: "B1",
      targetLevel: "C1",
      deadline: `${new Date().getFullYear() + 1}-12-31`,
      minutesPerDay: 30,
      weekdays: [0, 2, 4],
    }),
    [consent, setConsent] = useState(false),
    [topic, setTopic] = useState("Leitura e escrita no trabalho");
  const saved = data.profiles.find((p) => p.id === profile.id);
  return (
    <section className="panel">
      <h2>Escolha o idioma e personalize seu plano</h2>
      <select
        aria-label="Perfil de idioma salvo"
        value={saved ? profile.id : ""}
        onChange={(e) => {
          const p = data.profiles.find((p) => p.id === e.target.value);
          if (p) setProfile(p);
          else setProfile({ ...profile, id: crypto.randomUUID() });
        }}
      >
        <option value="">Novo idioma</option>
        {data.profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.language} · {p.currentLevel} → {p.targetLevel}
          </option>
        ))}
      </select>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ kind: "saveProfile", input: profile });
        }}
      >
        <label>
          Idioma
          <input
            list="languages"
            required
            maxLength={80}
            value={profile.language}
            onChange={(e) =>
              setProfile({ ...profile, language: e.target.value })
            }
          />
          <datalist id="languages">
            {[
              "Inglês",
              "Espanhol",
              "Francês",
              "Alemão",
              "Italiano",
              "Português",
            ].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </datalist>
        </label>
        <div className="form-grid">
          {(["currentLevel", "targetLevel"] as const).map((field) => (
            <label key={field}>
              {field === "currentLevel" ? "Nível atual estimado" : "Nível-alvo"}
              <select
                value={profile[field]}
                onChange={(e) =>
                  setProfile({ ...profile, [field]: e.target.value })
                }
              >
                {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Prazo desejado
            <input
              type="date"
              required
              min={dateKey()}
              value={profile.deadline}
              onChange={(e) =>
                setProfile({ ...profile, deadline: e.target.value })
              }
            />
          </label>
          <label>
            Minutos por dia
            <input
              type="number"
              required
              min={5}
              max={480}
              value={profile.minutesPerDay}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  minutesPerDay: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <fieldset>
          <legend>Disponibilidade semanal</legend>
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day, i) => (
            <label className="checkbox-label" key={day}>
              <input
                type="checkbox"
                checked={profile.weekdays.includes(i)}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    weekdays: e.target.checked
                      ? [...profile.weekdays, i]
                      : profile.weekdays.filter((d) => d !== i),
                  })
                }
              />
              {day}
            </label>
          ))}
        </fieldset>
        <button className="button primary" disabled={busy}>
          Salvar perfil de idioma
        </button>
      </form>
      <p className="helper">
        CEFR é uma referência declarada, sem teste de certificação. A carga do
        plano é conferida contra os dias disponíveis; não há promessa de
        fluência.
      </p>
      <label>
        Tema da próxima lição
        <input
          maxLength={160}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </label>
      <Consent checked={consent} onChange={setConsent} />
      <div className="inline-actions">
        <button
          className="button primary"
          disabled={busy || !saved || !consent}
          onClick={() =>
            void act({ kind: "suggestPlan", profileId: profile.id, consent })
          }
        >
          Sugerir plano com IA
        </button>
        <button
          className="button secondary"
          disabled={busy || !saved || !consent || !topic.trim()}
          onClick={() =>
            void act({
              kind: "generateLanguageLesson",
              profileId: profile.id,
              topic,
              consent,
            })
          }
        >
          Gerar lição no idioma
        </button>
      </div>
      {data.documents
        .filter((d) => d.kind === "plan" && d.profileId === profile.id)
        .map(
          (d) =>
            d.kind === "plan" && (
              <PlanEditor key={d.id} document={d} act={act} busy={busy} />
            ),
        )}
    </section>
  );
}
function PlanEditor({
  document: d,
  act,
  busy,
}: {
  document: Extract<TrackDocument, { kind: "plan" }>;
  act: Act;
  busy: boolean;
}) {
  const [plan, setPlan] = useState<TrackPlan>(d.content),
    [dirty, setDirty] = useState(false);
  return (
    <details className="panel">
      <summary>
        {d.content.title} · proposta de{" "}
        {new Date(d.createdAt).toLocaleDateString("pt-BR")}
      </summary>
      <p>{plan.assumptions.join(" ")}</p>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (d.profileId)
            void act({
              kind: "savePlan",
              id: d.id,
              profileId: d.profileId,
              input: plan,
            });
        }}
      >
        <label>
          Título do plano
          <input
            required
            maxLength={160}
            value={plan.title}
            onChange={(e) => {
              setPlan({ ...plan, title: e.target.value });
              setDirty(true);
            }}
          />
        </label>
        <label>
          Premissas do plano (uma por linha)
          <textarea
            required
            maxLength={10000}
            value={plan.assumptions.join("\n")}
            onChange={(e) => {
              setPlan({ ...plan, assumptions: e.target.value.split("\n") });
              setDirty(true);
            }}
          />
        </label>
        {plan.steps.map((step, i) => (
          <fieldset key={i}>
            <legend>Etapa {i + 1}</legend>
            {(["title", "activity", "criteria", "review"] as const).map(
              (field) => (
                <label key={field}>
                  {
                    {
                      title: "Título",
                      activity: "Atividade",
                      criteria: "Critérios de aceite",
                      review: "Revisão",
                    }[field]
                  }
                  <textarea
                    required
                    maxLength={field === "title" ? 160 : 2000}
                    value={step[field]}
                    onChange={(e) => {
                      setPlan({
                        ...plan,
                        steps: plan.steps.map((s, n) =>
                          n === i ? { ...s, [field]: e.target.value } : s,
                        ),
                      });
                      setDirty(true);
                    }}
                  />
                </label>
              ),
            )}
            <label>
              Carga em minutos
              <input
                type="number"
                min={5}
                max={10000}
                required
                value={step.minutes}
                onChange={(e) => {
                  setPlan({
                    ...plan,
                    steps: plan.steps.map((s, n) =>
                      n === i ? { ...s, minutes: Number(e.target.value) } : s,
                    ),
                  });
                  setDirty(true);
                }}
              />
            </label>
          </fieldset>
        ))}
        <p>
          {plan.steps.reduce((n, s) => n + s.minutes, 0)} minutos no total,
          incluindo revisões.
        </p>
        <button className="button secondary" disabled={busy || !dirty}>
          Salvar como nova versão
        </button>
      </form>
      <button
        className="button primary"
        disabled={busy || dirty}
        onClick={() => void act({ kind: "applyPlan", id: d.id })}
      >
        Aprovar esta versão e criar percurso
      </button>
      {dirty && (
        <p>Salve as alterações e aprove a nova versão para criar o percurso.</p>
      )}
    </details>
  );
}
function PdfReview({
  pdf,
  reviews,
  act,
  busy,
}: {
  pdf: TracksSnapshot["pdfs"][number];
  reviews: TracksSnapshot["pdfReviews"];
  act: Act;
  busy: boolean;
}) {
  const [transcription, setTranscription] = useState(""),
    [consent, setConsent] = useState(false);
  return (
    <details>
      <summary>
        {pdf.name} · {new Date(pdf.createdAt).toLocaleString("pt-BR")}
      </summary>
      <label>
        Transcrição conferida do campo de redação
        <textarea
          maxLength={20000}
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
        />
      </label>
      <Consent checked={consent} onChange={setConsent}>
        Conferi a transcrição e autorizo enviar somente esse texto para correção
        pela IA.
      </Consent>
      <button
        className="button secondary"
        disabled={busy || !consent || !transcription.trim()}
        onClick={() =>
          void act({ kind: "reviewPdf", id: pdf.id, transcription, consent })
        }
      >
        Corrigir transcrição confirmada
      </button>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void act({ kind: "exportPdf", id: pdf.id })}
      >
        Exportar versão anotada preservada
      </button>
      {reviews.map((review) => (
        <article className="panel" key={review.id}>
          <h3>
            Revisão de {new Date(review.createdAt).toLocaleString("pt-BR")}
          </h3>
          <p>Original confirmado:</p>
          <pre>{review.transcription}</pre>
          <p>{review.feedback.summary}</p>
          <p>Versão sugerida, separada do original:</p>
          <pre>{review.feedback.revised}</pre>
          <p>Próxima prática: {review.feedback.followUp}</p>
          <p>Incertezas: {review.feedback.uncertainties.join("; ")}</p>
        </article>
      ))}
    </details>
  );
}
function PracticeArea({
  errors,
  act,
  busy,
}: {
  errors: PracticeError[];
  act: Act;
  busy: boolean;
}) {
  const [mode, setMode] = useState("reinforce");
  const ranked = rankErrors(errors);
  const visible =
    mode === "remember"
      ? ranked.filter((e) => e.nextReview <= dateKey())
      : [
          ...errors.filter((e) => e.classification === "unconfirmed"),
          ...ranked,
        ];
  return (
    <section className="panel">
      <h2>{mode === "remember" ? "Área de Relembrar" : "Área de Reforço"}</h2>
      <div className="inline-actions">
        <button
          className="button secondary"
          onClick={() => setMode("reinforce")}
        >
          Reforço de erros
        </button>
        <button
          className="button secondary"
          onClick={() => setMode("remember")}
        >
          Relembrar conteúdos vencidos
        </button>
      </div>
      <p>
        Confirme as sugestões da IA antes de tratá-las como erro. Prioridade:
        recorrência × 3 + gravidade × 2 − revisões com acerto. Revisões offline
        em 1, 3, 7, 14 e 30 dias; erro volta no dia seguinte.
      </p>
      {!visible.length && (
        <p>
          Nenhum erro confirmado ou revisão pendente. Corrija uma tentativa ou
          confira suas classificações.
        </p>
      )}
      {visible.map((e) => (
        <ErrorPractice key={e.id} error={e} act={act} busy={busy} />
      ))}
      {errors.some((e) =>
        ["style", "dismissed"].includes(e.classification),
      ) && (
        <details>
          <summary>Classificações corrigidas e alternativas válidas</summary>
          {errors
            .filter((e) => ["style", "dismissed"].includes(e.classification))
            .map((e) => (
              <ErrorPractice key={e.id} error={e} act={act} busy={busy} />
            ))}
        </details>
      )}
    </section>
  );
}
function ErrorPractice({
  error: e,
  act,
  busy,
}: {
  error: PracticeError;
  act: Act;
  busy: boolean;
}) {
  const [answer, setAnswer] = useState(""),
    [reveal, setReveal] = useState(false);
  return (
    <article className="panel">
      <h3>
        {e.topic} · {e.category}
      </h3>
      <blockquote>{e.excerpt}</blockquote>
      <p>{e.explanation}</p>
      <p>
        {e.repetitions} ocorrências confirmadas na categoria/tópico ·{" "}
        {e.successes}/{e.reviews} revisões com acerto · próxima: {e.nextReview}
      </p>
      <label>
        Classificação
        <select
          value={e.classification}
          disabled={busy}
          onChange={(event) =>
            void act({
              kind: "classify",
              id: e.id,
              classification: event.target.value,
              severity: e.severity,
            })
          }
        >
          <option value="unconfirmed">Sugestão ainda não confirmada</option>
          <option value="error">Erro confirmado por mim</option>
          <option value="style">Alternativa de estilo</option>
          <option value="dismissed">Classificação equivocada</option>
        </select>
      </label>
      <label>
        Gravidade
        <select
          value={e.severity}
          disabled={busy}
          onChange={(event) =>
            void act({
              kind: "classify",
              id: e.id,
              classification: e.classification,
              severity: Number(event.target.value),
            })
          }
        >
          <option value={1}>Leve</option>
          <option value={2}>Moderada</option>
          <option value={3}>Alta</option>
        </select>
      </label>
      {e.classification === "error" && (
        <>
          <label>
            Reescreva o trecho e explique o ajuste
            <textarea
              maxLength={4000}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </label>
          <button className="text-button" onClick={() => setReveal(true)}>
            Conferir sugestão de correção
          </button>
          {reveal && (
            <>
              <p>{e.correction}</p>
              <div className="inline-actions">
                {[true, false].map((recalled) => (
                  <button
                    key={String(recalled)}
                    className="button secondary"
                    disabled={
                      busy || !answer.trim() || e.nextReview > dateKey()
                    }
                    onClick={() =>
                      void act({ kind: "recall", id: e.id, answer, recalled })
                    }
                  >
                    {recalled
                      ? "Lembrei · registrar autoavaliação"
                      : "Preciso rever · registrar"}
                  </button>
                ))}
              </div>
              <p className="helper">
                O acerto é sua autoavaliação; não representa teste
                determinístico nem nota da IA.
              </p>
            </>
          )}
        </>
      )}
    </article>
  );
}
function CareerArea({
  data,
  act,
  busy,
}: {
  data: TracksSnapshot;
  act: Act;
  busy: boolean;
}) {
  const preferences = data.documents.find(
    (d) => d.kind === "career_preferences",
  );
  const [topic, setTopic] = useState(""),
    [consent, setConsent] = useState(false),
    [repository, setRepository] = useState(""),
    [githubConsent, setGithubConsent] = useState(false),
    [targetRole, setTargetRole] = useState(
      preferences?.kind === "career_preferences"
        ? preferences.content.targetRole
        : "AI Engineer",
    ),
    [region, setRegion] = useState(
      preferences?.kind === "career_preferences"
        ? preferences.content.region
        : "",
    );
  const resume = data.documents.find((d) => d.kind === "resume");
  const jobs = data.documents
    .filter(
      (d): d is Extract<TrackDocument, { kind: "job" }> => d.kind === "job",
    )
    .filter(
      (d) =>
        !region ||
        d.content.location
          .toLocaleLowerCase()
          .includes(region.toLocaleLowerCase()),
    );
  const skills = resume?.kind === "resume" ? resume.content.skills : [];
  const ranking = marketRanking(
    jobs.map((d) => d.content),
    skills,
    targetRole,
    dateKey(),
  );
  return (
    <>
      <section className="panel">
        <h2>Competências na sua amostra de vagas</h2>
        <button
          className="button secondary"
          disabled={busy || !targetRole.trim()}
          onClick={() =>
            void act({ kind: "saveCareerPreferences", targetRole, region })
          }
        >
          Salvar cargo-alvo e região
        </button>
        <div className="form-grid">
          <label>
            Cargo-alvo para relevância
            <input
              maxLength={160}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </label>
          <label>
            Filtrar região da amostra
            <input
              maxLength={160}
              placeholder="Todas as localidades"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </label>
        </div>
        <p>
          Amostra local: {jobs.length} vagas cadastradas, sem busca automática
          ou afirmação de que continuam abertas. Prioridade calculada: 50%
          frequência de requisitos + 20% proporção de títulos que contêm o
          cargo-alvo + 20% atualidade das fontes (decai linearmente em 180 dias)
          + 10% lacuna declarada no currículo. Os campos vêm das fontes
          cadastradas; a amostra pode ser pequena e não representa todo o
          mercado.
        </p>
        <p>
          Período:{" "}
          {jobs.length
            ? [...jobs.map((j) => j.content.date)]
                .sort()
                .filter((_, i, a) => i === 0 || i === a.length - 1)
                .join(" a ")
            : "sem amostra"}
          . Regiões:{" "}
          {[...new Set(jobs.map((j) => j.content.location))].join(", ") ||
            "não informadas"}
          . Último cadastro:{" "}
          {jobs[0]
            ? new Date(jobs[0].createdAt).toLocaleDateString("pt-BR")
            : "nenhum"}
          .
        </p>
        {!ranking.length ? (
          <p>
            Cadastre vagas reais com fonte e requisitos para calcular
            frequências.
          </p>
        ) : (
          <ul>
            {ranking.map((r) => (
              <li key={r.skill}>
                {r.skill}: prioridade {r.score}/100 · frequência {r.count}/
                {jobs.length} ({r.percent}%) · relevância {r.relevance}% ·
                atualidade {r.recency}% ·{" "}
                {r.gap
                  ? "lacuna declarada"
                  : "presente nas competências declaradas"}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Conteúdo de carreira e desafios</h2>
        <label>
          Sugerir tema
          <input
            maxLength={160}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        <Consent checked={consent} onChange={setConsent}>
          Autorizo enviar o tema e as fontes cadastradas à IA para uma proposta
          de conteúdo, sem alterar o percurso.
        </Consent>
        <button
          className="button primary"
          disabled={busy || !topic.trim() || !consent}
          onClick={() => void act({ kind: "suggestTopic", topic, consent })}
        >
          Sugerir tema com IA
        </button>
        <SourceForm act={act} busy={busy} />
        {data.documents
          .filter((d) => d.kind === "source")
          .map(
            (d) =>
              d.kind === "source" && (
                <p key={d.id}>
                  <a href={d.content.url} target="_blank" rel="noreferrer">
                    {d.content.title}
                  </a>{" "}
                  · {d.content.institution} · {d.content.date}
                  <br />
                  {d.content.claim} (fonte declarada pelo usuário)
                </p>
              ),
          )}
        {data.documents
          .filter((d) => d.kind === "career")
          .map(
            (d) =>
              d.kind === "career" && (
                <article className="panel" key={d.id}>
                  <h3>{d.content.topic}</h3>
                  <p>{d.content.priority}</p>
                  <p>Pré-requisitos: {d.content.prerequisites.join("; ")}</p>
                  <p>{d.content.theory}</p>
                  <p>Conceitos: {d.content.concepts.join("; ")}</p>
                  <pre>{d.content.example}</pre>
                  <p>{d.content.explanation}</p>
                  <h4>Desafio verificável</h4>
                  <p>{d.content.challenge}</p>
                  <ul>
                    {d.content.acceptance.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p>Artefato sugerido: {d.content.artifact}</p>
                  <p>Incertezas: {d.content.uncertainties.join("; ")}</p>
                  <p>
                    Conteúdo sugerido por IA. Exemplos não executados. Fontes
                    vinculadas:{" "}
                    {d.content.sourceIds
                      .map((id) =>
                        data.documents.find(
                          (s) => s.id === id && s.kind === "source",
                        ),
                      )
                      .map((s) =>
                        s?.kind === "source"
                          ? s.content.title
                          : "fonte ausente",
                      )
                      .join("; ") || "nenhuma; conteúdo não verificado"}
                    .
                  </p>
                </article>
              ),
          )}
      </section>
      <ResumeArea documents={data.documents} act={act} busy={busy} />
      <section className="panel">
        <h2>Sugestões de Vagas</h2>
        <p>
          Cadastro manual de fontes reais. Proximidade é uma heurística por
          igualdade normalizada de competências explicitamente declaradas, com
          confiança limitada; não indica probabilidade de contratação ou visto.
        </p>
        <JobForm act={act} busy={busy} />
        {jobs.map((d) => {
          const match = jobMatch(d.content, skills);
          return (
            <article className="panel" key={d.id}>
              <h3>
                <a href={d.content.url} target="_blank" rel="noreferrer">
                  {d.content.title}
                </a>
              </h3>
              <p>
                {d.content.location} · {d.content.modality} ·{" "}
                {d.content.seniority} · fonte de {d.content.date}
              </p>
              <p>{d.content.evidence}</p>
              <p>
                {match.percent}% de proximidade · atendidas:{" "}
                {match.matched.join(", ") || "nenhuma"}; lacunas:{" "}
                {match.missing.join(", ") || "nenhuma declarada"}.
              </p>
              <p className="helper">
                Disponibilidade atual não verificada pelo aplicativo. Abra a
                fonte antes de candidatar-se.
              </p>
            </article>
          );
        })}
      </section>
      <section className="panel">
        <h2>GitHub · evidências de portfólio</h2>
        <p>
          Consulta somente leitura de repositórios públicos, commits recentes e
          resultados de CI. Não publica código nem executa workflows.
          Repositórios privados exigem uma integração autenticada adicional.
        </p>
        <label>
          Repositório (proprietário/nome)
          <input
            placeholder="rubguedes/LearningStudio"
            maxLength={201}
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
          />
        </label>
        <Consent checked={githubConsent} onChange={setGithubConsent}>
          Autorizo consultar este repositório na API pública do GitHub.
        </Consent>
        <button
          className="button secondary"
          disabled={busy || !githubConsent || !repository}
          onClick={() =>
            void act({
              kind: "fetchGithub",
              repository,
              consent: githubConsent,
            })
          }
        >
          Consultar commits e CI
        </button>
        {data.documents
          .filter((d) => d.kind === "github")
          .map(
            (d) =>
              d.kind === "github" && (
                <details key={d.id}>
                  <summary>
                    {d.content.repository} · consulta de{" "}
                    {new Date(d.createdAt).toLocaleString("pt-BR")}
                  </summary>
                  <p>{d.content.scope}</p>
                  <p>
                    Vincule a URL e o SHA como evidência em um checkpoint;
                    confira se o CI corresponde ao código submetido.
                  </p>
                  <pre>{JSON.stringify(d.content, null, 2)}</pre>
                </details>
              ),
          )}
      </section>
    </>
  );
}
function ResumeArea({
  documents,
  act,
  busy,
}: {
  documents: TrackDocument[];
  act: Act;
  busy: boolean;
}) {
  const latest = documents.find((d) => d.kind === "resume");
  const initial =
    latest?.kind === "resume"
      ? latest.content
      : { text: "", skills: [], reviewDays: 30 };
  const [resume, setResume] = useState<ResumeVersion>(initial),
    [consent, setConsent] = useState(false),
    [fileError, setFileError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const due = latest
    ? new Date(latest.createdAt).getTime() + resume.reviewDays * 86400000 <= now
    : false;
  return (
    <section className="panel">
      <h2>Área do Currículo</h2>
      <p>
        Edição e importação de texto local. Cada salvamento cria uma versão; a
        IA propõe sugestões e não substitui seu currículo.
      </p>
      <label>
        Importar currículo em texto (.txt, até 100 KiB)
        <input
          type="file"
          accept=".txt,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 102400) {
              setFileError("Escolha um arquivo de texto de até 100 KiB.");
              return;
            }
            void file
              .text()
              .then((text) => {
                if (text.length > 30000 || text.includes("\0")) {
                  setFileError(
                    "O texto excede 30 mil caracteres ou contém dados inválidos.",
                  );
                  return;
                }
                setResume({ ...resume, text });
                setFileError("");
              })
              .catch(() => setFileError("Não foi possível ler o arquivo."));
            e.target.value = "";
          }}
        />
      </label>
      {fileError && <p role="alert">{fileError}</p>}
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ kind: "saveResume", input: resume });
        }}
      >
        <label>
          Currículo
          <textarea
            required
            maxLength={30000}
            rows={10}
            value={resume.text}
            onChange={(e) => setResume({ ...resume, text: e.target.value })}
          />
        </label>
        <label>
          Competências comprováveis (separadas por vírgula)
          <input
            maxLength={5000}
            value={resume.skills.join(", ")}
            onChange={(e) =>
              setResume({
                ...resume,
                skills: e.target.value.split(",").map((s) => s.trim()),
              })
            }
          />
        </label>
        <label>
          Lembrar de revisar após quantos dias
          <input
            type="number"
            min={1}
            max={365}
            required
            value={resume.reviewDays}
            onChange={(e) =>
              setResume({ ...resume, reviewDays: Number(e.target.value) })
            }
          />
        </label>
        <button className="button primary" disabled={busy}>
          Aprovar e salvar nova versão do currículo
        </button>
      </form>
      {due && (
        <p role="status">
          A revisão periódica do currículo está vencida. O lembrete é calculado
          enquanto o aplicativo está aberto; nenhum envio automático ocorre.
        </p>
      )}
      <Consent checked={consent} onChange={setConsent}>
        Autorizo enviar a versão salva do currículo e suas competências à IA
        para sugestões, com custo no provedor.
      </Consent>
      <button
        className="button secondary"
        disabled={busy || !latest || !consent}
        onClick={() => {
          if (latest)
            void act({ kind: "reviewResume", id: latest.id, consent });
        }}
      >
        Solicitar sugestões para a versão salva
      </button>
      <details>
        <summary>Histórico de versões e sugestões</summary>
        {documents
          .filter((d) => ["resume", "resume_proposal"].includes(d.kind))
          .map((d) => (
            <article key={d.id}>
              <p>{new Date(d.createdAt).toLocaleString("pt-BR")}</p>
              {d.kind === "resume" ? (
                <>
                  <pre>{d.content.text}</pre>
                  <button
                    className="text-button"
                    onClick={() => setResume(d.content)}
                  >
                    Carregar versão para editar e aprovar
                  </button>
                </>
              ) : d.kind === "resume_proposal" ? (
                <>
                  <p>Sugestões para a versão {d.content.originalId}:</p>
                  <ul>
                    {d.content.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p>Incertezas: {d.content.uncertainties.join("; ")}</p>
                </>
              ) : null}
            </article>
          ))}
      </details>
    </section>
  );
}
function SourceForm({ act, busy }: { act: Act; busy: boolean }) {
  const [input, setInput] = useState<SourceRecord>({
    title: "",
    institution: "",
    url: "",
    date: dateKey(),
    claim: "",
  });
  return (
    <details>
      <summary>Cadastrar fonte verificável antes de gerar conteúdo</summary>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ kind: "saveSource", input });
        }}
      >
        {(["title", "institution", "url", "date", "claim"] as const).map(
          (field) => (
            <label key={field}>
              {
                {
                  title: "Título da fonte",
                  institution: "Autoria ou instituição",
                  url: "URL HTTPS",
                  date: "Data da publicação",
                  claim: "Trecho ou afirmação sustentada",
                }[field]
              }
              <input
                required
                type={
                  field === "url" ? "url" : field === "date" ? "date" : "text"
                }
                maxLength={
                  field === "claim" ? 4000 : field === "url" ? 2000 : 160
                }
                value={input[field]}
                onChange={(e) =>
                  setInput({ ...input, [field]: e.target.value })
                }
              />
            </label>
          ),
        )}
        <button className="button secondary" disabled={busy}>
          Salvar fonte declarada
        </button>
      </form>
    </details>
  );
}
function JobForm({ act, busy }: { act: Act; busy: boolean }) {
  const [input, setInput] = useState<JobRecord>({
    title: "",
    url: "",
    date: dateKey(),
    location: "",
    modality: "",
    seniority: "",
    requirements: [],
    evidence: "",
  });
  return (
    <details>
      <summary>Cadastrar vaga com origem e evidência</summary>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ kind: "saveJob", input });
        }}
      >
        {(
          [
            "title",
            "url",
            "date",
            "location",
            "modality",
            "seniority",
            "evidence",
          ] as const
        ).map((field) => (
          <label key={field}>
            {
              {
                title: "Título da vaga",
                url: "URL da vaga",
                date: "Data da fonte",
                location: "Localidade",
                modality: "Modalidade",
                seniority: "Senioridade",
                evidence: "Evidência dos requisitos",
              }[field]
            }
            <input
              required
              type={
                field === "url" ? "url" : field === "date" ? "date" : "text"
              }
              maxLength={
                field === "evidence" ? 6000 : field === "url" ? 2000 : 160
              }
              value={input[field]}
              onChange={(e) => setInput({ ...input, [field]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Requisitos explícitos (separados por vírgula)
          <input
            required
            maxLength={5000}
            value={input.requirements.join(", ")}
            onChange={(e) =>
              setInput({
                ...input,
                requirements: e.target.value.split(",").map((s) => s.trim()),
              })
            }
          />
        </label>
        <button className="button secondary" disabled={busy}>
          Salvar vaga da fonte
        </button>
      </form>
    </details>
  );
}
