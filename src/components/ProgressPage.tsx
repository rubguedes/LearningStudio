import { useEffect, useState } from "react";
import {
  Archive,
  Check,
  Flag,
  Pause,
  Pencil,
  Play,
  Plus,
  Square,
  Target,
  Timer,
  Trash2,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { CheckpointEditor, GoalEditor, SessionEditor } from "./ProgressEditors";
import { dateKey, formatDate } from "../domain/rules";
import {
  addDays,
  durationLabel,
  goalPercent,
  goalValue,
  sessionStates,
  studyStreak,
  weeklyReport,
} from "../domain/progress";
import type {
  Checkpoint,
  Goal,
  Page,
  Snapshot,
  StudyApi,
  StudySession,
} from "../domain/types";

export type ProgressAction = (
  action: () => Promise<void>,
  message: string,
) => Promise<boolean>;
interface Props {
  page: Page;
  snapshot: Snapshot;
  api: StudyApi;
  busy: boolean;
  error: string;
  run: ProgressAction;
}
type Modal =
  | { kind: "session"; session: StudySession | null }
  | { kind: "goal"; goal: Goal | null }
  | { kind: "checkpoint"; checkpoint: Checkpoint | null }
  | { kind: "evidence"; checkpoint: Checkpoint }
  | {
      kind: "delete";
      record: "session" | "goal" | "checkpoint";
      id: string;
      title: string;
    }
  | null;

function RunningClock({ session }: { session: StudySession }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const interval = window.setInterval(
      () =>
        setElapsed(
          Math.min(45, Math.floor((performance.now() - start) / 1000)),
        ),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);
  const seconds = session.durationSeconds + elapsed;
  return (
    <strong className="clock-display" aria-label="Cronômetro">
      {String(Math.floor(seconds / 3600)).padStart(2, "0")}:
      {String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
    </strong>
  );
}

export function StudyOverview({
  snapshot,
  onStudy,
}: {
  snapshot: Snapshot;
  onStudy(): void;
}) {
  const report = weeklyReport(snapshot);
  return (
    <section className="study-overview" aria-label="Resumo dos estudos">
      <div>
        <Timer size={19} />
        <strong>{durationLabel(report.seconds)}</strong>
        <span>estudados nesta semana</span>
      </div>
      <div>
        <Flag size={19} />
        <strong>{studyStreak(snapshot.sessions)}</strong>
        <span>dias de sequência</span>
      </div>
      <div>
        <Target size={19} />
        <strong>
          {
            snapshot.goals.filter(
              (g) => !g.archived && goalValue(g, snapshot) < g.target,
            ).length
          }
        </strong>
        <span>metas em andamento</span>
      </div>
      <button className="button secondary" onClick={onStudy}>
        <Play size={16} />
        Iniciar sessão
      </button>
    </section>
  );
}

export function ProgressPage({ page, snapshot, api, busy, error, run }: Props) {
  const [modal, setModal] = useState<Modal>(null);
  const [evidence, setEvidence] = useState("");
  const [localError, setLocalError] = useState("");
  const [archived, setArchived] = useState(false);
  const [anchor, setAnchor] = useState(dateKey());
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  function close() {
    setModal(null);
    setEvidence("");
    setLocalError("");
  }
  function open(value: Modal) {
    setLocalError("");
    setEvidence("");
    setModal(value);
  }
  const current = snapshot.sessions.filter((s) => s.status !== "completed");
  const sessions = snapshot.sessions.filter(
    (s) =>
      s.status === "completed" &&
      (!area || s.areaId === area) &&
      `${s.title} ${s.notes}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const goals = snapshot.goals.filter((g) => g.archived === archived);
  const common = { areas: snapshot.areas, busy, error, onClose: close };
  const report = weeklyReport(snapshot, anchor);
  const valueFormat = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  });
  return (
    <>
      <div className="progress-toolbar">
        {page === "study" && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => open({ kind: "session", session: null })}
          >
            <Plus size={17} />
            Nova sessão
          </button>
        )}
        {page === "goals" && (
          <>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => open({ kind: "goal", goal: null })}
            >
              <Plus size={17} />
              Nova meta
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Mostrar metas arquivadas
            </label>
          </>
        )}
        {page === "checkpoints" && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => open({ kind: "checkpoint", checkpoint: null })}
          >
            <Plus size={17} />
            Novo checkpoint
          </button>
        )}
      </div>
      {page === "study" && (
        <>
          {current.map((session) => (
            <section key={session.id} className="active-session panel">
              <div>
                <span className="eyebrow">{sessionStates[session.status]}</span>
                <h2>{session.title}</h2>
                {session.status === "running" ? (
                  <RunningClock
                    key={`${session.id}:${session.updatedAt}`}
                    session={session}
                  />
                ) : (
                  <strong className="clock-display">
                    {durationLabel(session.durationSeconds)}
                  </strong>
                )}
                <p className="fine-print">
                  {durationLabel(session.durationSeconds)} confirmados no banco.
                  Somente sessões finalizadas entram nas metas e relatórios.
                </p>
              </div>
              <div className="session-controls">
                {session.status === "running" ? (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      void run(
                        () => api.controlSession(session.id, "pause"),
                        "Sessão pausada.",
                      );
                    }}
                  >
                    <Pause size={16} />
                    Pausar
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    disabled={
                      busy || current.some((s) => s.status === "running")
                    }
                    onClick={() => {
                      void run(
                        () => api.controlSession(session.id, "resume"),
                        "Cronômetro retomado.",
                      );
                    }}
                  >
                    <Play size={16} />
                    Retomar
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    void run(
                      () => api.controlSession(session.id, "finish"),
                      "Sessão finalizada.",
                    );
                  }}
                >
                  <Square size={15} />
                  Finalizar
                </button>
                {session.status === "paused" && (
                  <button
                    className="icon-button danger-text"
                    disabled={busy}
                    aria-label={`Excluir sessão ${session.title}`}
                    onClick={() =>
                      open({
                        kind: "delete",
                        record: "session",
                        id: session.id,
                        title: session.title,
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </section>
          ))}
          <div className="filters">
            <label className="search-box">
              <input
                aria-label="Pesquisar sessões"
                placeholder="Pesquisar histórico de estudos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Área das sessões"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">Todas as áreas</option>
              {snapshot.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Histórico de estudos</h2>
                <p>Apenas tempo finalizado e registrado por você.</p>
              </div>
            </div>
            {sessions.length ? (
              <ul className="progress-list">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <div className="progress-list-content">
                      <h3>{session.title}</h3>
                      <p>
                        {formatDate(session.studyDate)} ·{" "}
                        {durationLabel(session.durationSeconds)} ·{" "}
                        {session.mode === "manual"
                          ? "registro manual"
                          : "cronometrado"}
                        {session.areaId
                          ? ` · ${snapshot.areas.find((a) => a.id === session.areaId)?.name ?? "Sem área"}`
                          : ""}
                      </p>
                      {session.notes && (
                        <p className="preserve-text">{session.notes}</p>
                      )}
                    </div>
                    {session.mode === "manual" && (
                      <button
                        className="icon-button"
                        aria-label={`Editar sessão ${session.title}`}
                        disabled={busy}
                        onClick={() => open({ kind: "session", session })}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    <button
                      className="icon-button danger-text"
                      aria-label={`Excluir sessão ${session.title}`}
                      disabled={busy}
                      onClick={() =>
                        open({
                          kind: "delete",
                          record: "session",
                          id: session.id,
                          title: session.title,
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <Timer size={32} />
                <h3>Nenhum estudo registrado</h3>
                <p>
                  Inicie o cronômetro ou registre uma sessão que já realizou.
                </p>
              </div>
            )}
          </section>
        </>
      )}
      {page === "goals" && (
        <>
          {goals.length ? (
            <div className="progress-cards">
              {goals.map((goal) => {
                const value = goalValue(goal, snapshot);
                const percent = goalPercent(goal, snapshot);
                return (
                  <article className="panel goal-card" key={goal.id}>
                    <span className="eyebrow">
                      {goal.mode === "manual"
                        ? "PROGRESSO MANUAL"
                        : "CALCULADA POR ATIVIDADES"}
                    </span>
                    <h2>{goal.title}</h2>
                    <p>
                      {valueFormat.format(value)} / {goal.target} {goal.unit}
                    </p>
                    <progress
                      value={percent}
                      max={100}
                      aria-label={`Progresso de ${goal.title}`}
                    />
                    <div className="goal-meta">
                      <span>
                        {value >= goal.target
                          ? "Alvo alcançado"
                          : goal.dueDate < dateKey()
                            ? "Prazo encerrado"
                            : `${percent}% concluído`}
                      </span>
                      <span>Até {formatDate(goal.dueDate)}</span>
                    </div>
                    <p className="fine-print">
                      {snapshot.areas.find((a) => a.id === goal.areaId)?.name ??
                        "Todas as áreas"}{" "}
                      · desde {formatDate(goal.startDate)}
                    </p>
                    <div className="area-card-actions">
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => open({ kind: "goal", goal })}
                      >
                        <Pencil size={15} />
                        Editar meta
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`${goal.archived ? "Restaurar" : "Arquivar"} meta ${goal.title}`}
                        onClick={() => {
                          void run(
                            () => api.archiveGoal(goal.id, !goal.archived),
                            goal.archived
                              ? "Meta restaurada."
                              : "Meta arquivada.",
                          );
                        }}
                      >
                        <Archive size={17} />
                      </button>
                      <button
                        className="icon-button danger-text"
                        disabled={busy}
                        aria-label={`Excluir meta ${goal.title}`}
                        onClick={() =>
                          open({
                            kind: "delete",
                            record: "goal",
                            id: goal.id,
                            title: goal.title,
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="panel empty-state">
              <Target size={32} />
              <h3>
                {archived
                  ? "Nenhuma meta arquivada"
                  : "Um objetivo que dá para medir"}
              </h3>
              <p>Defina um alvo, um prazo e como acompanhar seu progresso.</p>
            </section>
          )}
        </>
      )}
      {page === "checkpoints" && (
        <>
          {snapshot.checkpoints.length ? (
            <div className="checkpoint-list">
              {snapshot.checkpoints.map((checkpoint) => (
                <article className="panel checkpoint-card" key={checkpoint.id}>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        {checkpoint.completedAt
                          ? "CONCLUÍDO COM EVIDÊNCIA"
                          : "PRÓXIMO MARCO"}
                      </span>
                      <h2>{checkpoint.title}</h2>
                    </div>
                    <div>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`Editar checkpoint ${checkpoint.title}`}
                        onClick={() => open({ kind: "checkpoint", checkpoint })}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button danger-text"
                        disabled={busy}
                        aria-label={`Excluir checkpoint ${checkpoint.title}`}
                        onClick={() =>
                          open({
                            kind: "delete",
                            record: "checkpoint",
                            id: checkpoint.id,
                            title: checkpoint.title,
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="checkpoint-body">
                    {checkpoint.description && (
                      <p className="preserve-text">{checkpoint.description}</p>
                    )}
                    <h3>Atividade prática</h3>
                    <p className="preserve-text">{checkpoint.activity}</p>
                    <h3>Critérios de conclusão</h3>
                    <p className="preserve-text">{checkpoint.criteria}</p>
                    {snapshot.checkpointEvidence
                      .filter((e) => e.checkpointId === checkpoint.id)
                      .map((item) => (
                        <div className="evidence" key={item.id}>
                          <strong>
                            Evidência ·{" "}
                            {formatDate(dateKey(new Date(item.createdAt)))}
                          </strong>
                          <p className="preserve-text">{item.content}</p>
                        </div>
                      ))}
                    <button
                      className={`button ${checkpoint.completedAt ? "secondary" : "primary"}`}
                      disabled={busy}
                      onClick={() => {
                        if (checkpoint.completedAt)
                          void run(
                            () => api.reopenCheckpoint(checkpoint.id),
                            "Checkpoint reaberto. Evidências anteriores preservadas.",
                          );
                        else open({ kind: "evidence", checkpoint });
                      }}
                    >
                      <Check size={17} />
                      {checkpoint.completedAt
                        ? "Reabrir checkpoint"
                        : "Concluir com evidência"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="panel empty-state">
              <Flag size={32} />
              <h3>Marcos com critérios claros</h3>
              <p>
                Defina uma atividade prática e guarde a evidência do que
                conseguiu fazer.
              </p>
            </section>
          )}
        </>
      )}
      {page === "reports" && (
        <>
          <div className="report-period">
            <label htmlFor="report-week">Semana que contém o dia</label>
            <input
              id="report-week"
              type="date"
              value={anchor}
              onChange={(e) => {
                if (e.target.value) setAnchor(e.target.value);
              }}
            />
            <span>
              {report.start.split("-").reverse().join("/")} a{" "}
              {report.end.split("-").reverse().join("/")}
            </span>
          </div>
          <div className="stats-grid report-stats">
            <div className="stat-card">
              <span>Tempo estudado</span>
              <strong>{durationLabel(report.seconds)}</strong>
              <small>{report.sessionCount} sessões finalizadas</small>
            </div>
            <div className="stat-card">
              <span>Dias com estudo</span>
              <strong>{report.activeDays} / 7</strong>
              <small>Datas distintas com registro</small>
            </div>
            <div className="stat-card">
              <span>Tarefas concluídas</span>
              <strong>{report.tasks}</strong>
              <small>{report.checkpoints} checkpoints concluídos</small>
            </div>
          </div>
          <section className="panel report-panel">
            <h2>Tempo por área</h2>
            {report.byArea.length ? (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Área</th>
                    <th scope="col">Tempo registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byArea.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{durationLabel(item.seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Não há sessões finalizadas nesta semana.</p>
            )}
            <h2>Consistência na semana</h2>
            <div className="week-days">
              {Array.from({ length: 7 }, (_, index) => {
                const day = addDays(report.start, index);
                const seconds = snapshot.sessions
                  .filter(
                    (s) => s.status === "completed" && s.studyDate === day,
                  )
                  .reduce((sum, s) => sum + s.durationSeconds, 0);
                return (
                  <div className={seconds ? "has-study" : ""} key={day}>
                    <strong>
                      {new Intl.DateTimeFormat("pt-BR", {
                        weekday: "short",
                      }).format(new Date(`${day}T12:00:00`))}
                    </strong>
                    <span>{durationLabel(seconds)}</span>
                  </div>
                );
              })}
            </div>
            <p className="fine-print">
              Sessões pausadas não contam. Registros manuais são informados por
              você; o tempo é atribuído à data do estudo. Conclusões refletem o
              estado atual dos registros.
            </p>
          </section>
        </>
      )}
      {error && !modal && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {modal?.kind === "session" && (
        <SessionEditor
          {...common}
          session={modal.session}
          onSave={(input, timer) =>
            run(
              () => (timer ? api.startSession(input) : api.saveSession(input)),
              timer ? "Cronômetro iniciado." : "Sessão salva.",
            )
          }
        />
      )}
      {modal?.kind === "goal" && (
        <GoalEditor
          {...common}
          goal={modal.goal}
          onSave={(input) => run(() => api.saveGoal(input), "Meta salva.")}
        />
      )}
      {modal?.kind === "checkpoint" && (
        <CheckpointEditor
          {...common}
          checkpoint={modal.checkpoint}
          onSave={(input) =>
            run(() => api.saveCheckpoint(input), "Checkpoint salvo.")
          }
        />
      )}
      {modal?.kind === "evidence" && (
        <Dialog
          title="Concluir checkpoint com evidência"
          busy={busy}
          onClose={close}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!evidence.trim() || evidence.trim().length > 4000) {
                setLocalError("Descreva a evidência em até 4000 caracteres.");
                return;
              }
              void run(
                () => api.completeCheckpoint(modal.checkpoint.id, evidence),
                "Checkpoint concluído com evidência.",
              ).then((saved) => {
                if (saved) close();
              });
            }}
          >
            <p className="dialog-copy">
              Confira os critérios: {modal.checkpoint.criteria}
            </p>
            <label htmlFor="checkpoint-evidence">Evidência da atividade</label>
            <textarea
              id="checkpoint-evidence"
              autoFocus
              rows={5}
              required
              maxLength={4000}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Descreva o resultado e, se houver, inclua links para seu projeto."
              disabled={busy}
            />
            {(localError || error) && (
              <p role="alert" className="error">
                {localError || error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary"
                type="button"
                onClick={close}
                disabled={busy}
              >
                Cancelar
              </button>
              <button className="button primary" type="submit" disabled={busy}>
                Salvar evidência e concluir
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal?.kind === "delete" && (
        <Dialog title="Excluir registro?" busy={busy} onClose={close}>
          <p className="dialog-copy">
            “{modal.title}” será excluído permanentemente.
            {modal.record === "checkpoint"
              ? " Todas as evidências deste checkpoint também serão excluídas."
              : ""}{" "}
            O progresso e os relatórios serão recalculados.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              autoFocus
              onClick={close}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                void run(
                  () => api.deleteProgress(modal.record, modal.id),
                  "Registro excluído.",
                ).then((saved) => {
                  if (saved) close();
                });
              }}
            >
              Confirmar exclusão
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
