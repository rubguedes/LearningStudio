import { useEffect, useState } from "react";
import type { Page, Snapshot } from "../domain/types";
import type {
  AgendaAction,
  AgendaApi,
  AgendaSnapshot,
  ImportedTaskInput,
  Recurrence,
} from "../domain/agenda";
import { calendarDays, calendarRange } from "../domain/agenda";
import { dateKey, formatDate } from "../domain/rules";
import { agendaApi } from "../services/agenda";
import { normalizeError } from "../services/tauri";
import { Dialog } from "./Dialog";
interface Props {
  page: Page;
  snapshot: Snapshot;
  busy: boolean;
  run(action: () => Promise<void>, message: string): Promise<boolean>;
  service?: AgendaApi;
}
export function AgendaPage({
  page,
  snapshot,
  busy,
  run,
  service = agendaApi,
}: Props) {
  const [day, setDay] = useState(dateKey()),
    [mode, setMode] = useState<"week" | "month">("week"),
    [data, setData] = useState<AgendaSnapshot | null>(null),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<Recurrence | null | undefined>(
      undefined,
    ),
    [deletion, setDeletion] = useState<AgendaAction | null>(null);
  const range = calendarRange(day, mode);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void service
        .snapshot(range.start, range.end)
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
      window.clearTimeout(timer);
    };
  }, [service, range.start, range.end, refresh]);
  async function act(action: AgendaAction) {
    const ok = await run(() => service.action(action), "Agenda atualizada.");
    if (ok) {
      setRefresh((v) => v + 1);
      setEditing(undefined);
      setDeletion(null);
    }
    return ok;
  }
  return (
    <div className="library-page">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <section className="panel">
          <p role="status">
            {error
              ? "Não foi possível carregar a agenda."
              : "Carregando agenda local…"}
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
      ) : page === "agenda" ? (
        <>
          <div className="page-intro">
            <div>
              <h2>Reserve espaço para aprender</h2>
              <p>
                Datas das tarefas e estudos registrados. Horários recorrentes
                mostram seu fuso de origem.
              </p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Nova recorrência
            </button>
          </div>
          <div className="filter-bar">
            <label>
              Data de referência
              <input
                type="date"
                required
                value={day}
                onChange={(e) => {
                  if (e.target.value) setDay(e.target.value);
                }}
              />
            </label>
            <label>
              Visualização
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "week" | "month")}
              >
                <option value="week">Semana</option>
                <option value="month">Mês</option>
              </select>
            </label>
            <button
              className="button secondary"
              disabled={
                busy ||
                !data.occurrences.some((o) => !o.materialized && o.startsAt)
              }
              onClick={() =>
                void act({
                  kind: "materialize",
                  from: range.start,
                  to: range.end,
                })
              }
            >
              Criar tarefas deste período
            </button>
          </div>
          <p className="helper">
            {formatDate(range.start)} a {formatDate(range.end)}. Alterações na
            recorrência valem para novas ocorrências; tarefas já criadas são
            preservadas. Ocorrências excluídas não são recriadas ao repetir a
            operação.
          </p>
          <div className={`calendar-grid ${mode}`}>
            {calendarDays(range.start, range.end).map((key) => {
              const tasks = snapshot.tasks.filter((t) => t.dueDate === key),
                sessions = snapshot.sessions.filter((s) => s.studyDate === key),
                occurrences = data.occurrences.filter((o) => o.date === key);
              return (
                <section
                  className={`calendar-day ${key === dateKey() ? "today" : ""}`}
                  key={key}
                >
                  <h3>
                    {new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </h3>
                  {tasks.length + sessions.length + occurrences.length ===
                    0 && <p className="helper">Sem itens</p>}
                  {tasks.map((t) => (
                    <p className="calendar-task" key={t.id}>
                      <strong>
                        {t.status === "done" ? "✓ " : ""}
                        {t.title}
                      </strong>
                      <small>
                        Tarefa ·{" "}
                        {t.status === "done" ? "concluída" : "pendente"}
                      </small>
                    </p>
                  ))}
                  {sessions.map((s) => (
                    <p className="calendar-study" key={s.id}>
                      {s.title}
                      <small>
                        Estudo · {Math.floor(s.durationSeconds / 60)} min ·{" "}
                        {s.status === "completed"
                          ? "finalizado"
                          : "em pausa/andamento"}
                      </small>
                    </p>
                  ))}
                  {occurrences.map((o) => {
                    const r = data.recurrences.find(
                      (r) => r.id === o.recurrenceId,
                    );
                    return (
                      <p className="calendar-preview" key={o.recurrenceId}>
                        <strong>
                          {r?.localTime} · {r?.title}
                        </strong>
                        <small>
                          {r?.timezone} ·{" "}
                          {o.materialized
                            ? o.taskId
                              ? "tarefa criada"
                              : "tarefa excluída"
                            : "prévia recorrente"}
                        </small>
                        {o.warning && <small>{o.warning}</small>}
                      </p>
                    );
                  })}
                </section>
              );
            })}
          </div>
          <section className="panel">
            <h2>Recorrências</h2>
            <p>
              O modelo de escrita começa desativado. Ativação e criação de
              tarefas dependem da sua escolha; esta etapa não envia
              notificações.
            </p>
            {data.recurrences.map((r) => (
              <div className="review-note" key={r.id}>
                <div className="section-heading">
                  <div>
                    <h3>{r.title}</h3>
                    <p>
                      {r.enabled ? "Ativa" : "Desativada"} ·{" "}
                      {weekdayLabels
                        .filter((_, i) => r.weekdays & (1 << i))
                        .join(", ")}{" "}
                      · {r.localTime} · {r.timezone}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setEditing(r)}
                    >
                      Editar recorrência
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() =>
                        setDeletion({ kind: "deleteRecurrence", id: r.id })
                      }
                    >
                      Excluir recorrência
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>
          {editing !== undefined && (
            <RecurrenceEditor
              key={editing?.id ?? "new"}
              recurrence={editing}
              busy={busy}
              close={() => setEditing(undefined)}
              save={act}
            />
          )}
        </>
      ) : (
        <>
          <div className="page-intro">
            <div>
              <h2>Importação manual do ChatGPT</h2>
              <p>
                Cadastre ou cole seus próprios dados. Não há sincronização
                automática com o ChatGPT.
              </p>
            </div>
          </div>
          <ChatGPTImport service={service} busy={busy} act={act} />
          {data.imported.length === 0 ? (
            <section className="panel">
              <p>Nenhuma tarefa importada. Revise a prévia antes de salvar.</p>
            </section>
          ) : (
            data.imported.map((item) => (
              <section className="panel" key={item.id}>
                <span className="eyebrow">
                  ChatGPT · importação manual ·{" "}
                  {new Date(item.updatedAt).toLocaleString("pt-BR")}
                </span>
                <h2>{item.title}</h2>
                <p className="preserve-text">{item.instructions}</p>
                <p>Agenda informada: {item.schedule || "Não informada"}</p>
                {item.url && <p className="helper">Referência: {item.url}</p>}
                <p>{item.notes}</p>
                {item.convertedAt ? (
                  <p>
                    {item.localTaskId
                      ? "Convertida em tarefa local."
                      : "A tarefa convertida foi excluída; ela não será recriada automaticamente."}
                  </p>
                ) : (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void act({ kind: "convert", id: item.id, dueDate: null })
                    }
                  >
                    Converter em tarefa local
                  </button>
                )}
                <button
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() =>
                    setDeletion({ kind: "deleteImport", id: item.id })
                  }
                >
                  Excluir importação
                </button>
              </section>
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
            Este registro será excluído. As tarefas locais já criadas serão
            mantidas.
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
const weekdayLabels = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
function RecurrenceEditor({
  recurrence,
  busy,
  close,
  save,
}: {
  recurrence: Recurrence | null;
  busy: boolean;
  close: () => void;
  save: (a: AgendaAction) => Promise<boolean>;
}) {
  const [input, setInput] = useState<Recurrence>(
    recurrence ?? {
      id: crypto.randomUUID(),
      title: "",
      notes: "",
      weekdays: 21,
      localTime: "15:00",
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      startDate: dateKey(),
      endDate: null,
      enabled: false,
    },
  );
  return (
    <Dialog
      title={recurrence ? "Editar recorrência" : "Nova recorrência"}
      busy={busy}
      onClose={close}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save({ kind: "saveRecurrence", input });
        }}
      >
        <label>
          Título da recorrência
          <input
            required
            maxLength={160}
            value={input.title}
            onChange={(e) => setInput({ ...input, title: e.target.value })}
            autoFocus
          />
        </label>
        <label>
          Observações
          <textarea
            maxLength={4000}
            value={input.notes}
            onChange={(e) => setInput({ ...input, notes: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Dias da semana</legend>
          <div className="weekday-picker">
            {weekdayLabels.map((d, i) => (
              <label className="choice" key={d}>
                <input
                  type="checkbox"
                  checked={!!(input.weekdays & (1 << i))}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      weekdays: e.target.checked
                        ? input.weekdays | (1 << i)
                        : input.weekdays & ~(1 << i),
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Horário
          <input
            required
            type="time"
            value={input.localTime}
            onChange={(e) => setInput({ ...input, localTime: e.target.value })}
          />
        </label>
        <label>
          Fuso IANA
          <input
            required
            maxLength={100}
            placeholder="America/Sao_Paulo"
            value={input.timezone}
            onChange={(e) => setInput({ ...input, timezone: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Início
            <input
              required
              type="date"
              value={input.startDate}
              onChange={(e) =>
                setInput({ ...input, startDate: e.target.value })
              }
            />
          </label>
          <label>
            Fim opcional
            <input
              type="date"
              min={input.startDate}
              value={input.endDate ?? ""}
              onChange={(e) =>
                setInput({ ...input, endDate: e.target.value || null })
              }
            />
          </label>
        </div>
        <label className="choice">
          <input
            type="checkbox"
            checked={input.enabled}
            onChange={(e) => setInput({ ...input, enabled: e.target.checked })}
          />
          Ativar este agendamento
        </label>
        <p className="helper">
          Ative somente após conferir dias, horário e fuso. As tarefas serão
          criadas quando você escolher o período na agenda.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || input.weekdays === 0}
          >
            Salvar recorrência
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ChatGPTImport({
  service,
  busy,
  act,
}: {
  service: AgendaApi;
  busy: boolean;
  act: (a: AgendaAction) => Promise<boolean>;
}) {
  const [format, setFormat] = useState<"json" | "csv">("json"),
    [content, setContent] = useState(""),
    [preview, setPreview] = useState<ImportedTaskInput[] | null>(null),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false);
  const [manual, setManual] = useState<ImportedTaskInput>({
    externalId: "",
    title: "",
    instructions: "",
    schedule: "",
    url: "",
    notes: "",
  });
  function update(value: string) {
    setContent(value);
    setPreview(null);
    setError("");
  }
  async function inspect() {
    setChecking(true);
    setError("");
    try {
      setPreview(await service.preview(format, content));
    } catch (e: unknown) {
      setError(normalizeError(e).message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="panel">
      <details>
        <summary>Cadastro manual e colagem de texto</summary>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            setFormat("json");
            update(JSON.stringify([manual], null, 2));
          }}
        >
          <label>
            Identificador de origem
            <input
              required
              maxLength={120}
              value={manual.externalId}
              onChange={(e) =>
                setManual({ ...manual, externalId: e.target.value })
              }
            />
          </label>
          <p className="helper">
            Use o mesmo identificador ao atualizar esta tarefa, para evitar
            duplicatas.
          </p>
          <label>
            Título
            <input
              required
              maxLength={160}
              value={manual.title}
              onChange={(e) => setManual({ ...manual, title: e.target.value })}
            />
          </label>
          <label>
            Instruções coladas
            <textarea
              maxLength={12000}
              value={manual.instructions}
              onChange={(e) =>
                setManual({ ...manual, instructions: e.target.value })
              }
            />
          </label>
          <label>
            Recorrência e horário informados
            <input
              maxLength={2000}
              value={manual.schedule}
              onChange={(e) =>
                setManual({ ...manual, schedule: e.target.value })
              }
            />
          </label>
          <label>
            Link HTTPS opcional
            <input
              maxLength={2000}
              value={manual.url}
              onChange={(e) => setManual({ ...manual, url: e.target.value })}
            />
          </label>
          <label>
            Notas
            <textarea
              maxLength={4000}
              value={manual.notes}
              onChange={(e) => setManual({ ...manual, notes: e.target.value })}
            />
          </label>
          <button className="button secondary" disabled={busy}>
            Preparar dados para revisão
          </button>
        </form>
      </details>
      <details>
        <summary>Formato de JSON e CSV</summary>
        <p>
          Até 200 registros e 256 KiB. Identificadores devem ser únicos no
          arquivo. Atualizar o mesmo identificador preserva o vínculo local.
        </p>
        <pre>
          {JSON.stringify(
            [
              {
                externalId: "escrita-ingles",
                title: "Praticar escrita",
                instructions: "Explique uma decisão",
                schedule: "seg/qua/sex 15h America/Sao_Paulo",
                url: "https://chatgpt.com/",
                notes: "Importação manual",
              },
            ],
            null,
            2,
          )}
        </pre>
        <p>
          CSV: cabeçalho exato abaixo. Use aspas duplas para campos com vírgulas
          ou quebras de linha.
        </p>
        <pre>externalId,title,instructions,schedule,url,notes</pre>
        <p>
          Horários importados são texto de referência; converter não ativa
          recorrência nem calcula prazos. Configure essas opções na agenda.
        </p>
      </details>
      <label>
        Formato
        <select
          value={format}
          disabled={checking}
          onChange={(e) => {
            setFormat(e.target.value as "json" | "csv");
            setPreview(null);
          }}
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
      </label>
      <label>
        Dados para importar
        <textarea
          rows={8}
          maxLength={262144}
          disabled={checking}
          value={content}
          onChange={(e) => update(e.target.value)}
        />
      </label>
      <button
        className="button secondary"
        disabled={busy || checking || !content.trim()}
        onClick={() => void inspect()}
      >
        {checking ? "Validando…" : "Validar e mostrar prévia"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="import-preview">
          <h3>Prévia: {preview.length} registros</h3>
          {preview.map((r) => (
            <p key={r.externalId}>
              <strong>{r.title}</strong> · {r.externalId}
              <br />
              {r.schedule}
            </p>
          ))}
          <button
            className="button primary"
            disabled={busy || checking}
            onClick={() =>
              void act({ kind: "import", format, content }).then((ok) => {
                if (ok) {
                  setPreview(null);
                  setContent("");
                }
              })
            }
          >
            Confirmar importação
          </button>
        </div>
      )}
    </section>
  );
}
