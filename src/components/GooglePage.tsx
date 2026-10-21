import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "../domain/types";
import type { GoogleAction, GoogleApi, GoogleStatus } from "../domain/google";
import { syncStates } from "../domain/google";
import { googleApi } from "../services/google";
import { normalizeError } from "../services/tauri";
import { Dialog } from "./Dialog";
interface Props {
  snapshot: Snapshot;
  busy: boolean;
  run(action: () => Promise<void>, message: string): Promise<boolean>;
  service?: GoogleApi;
}
export function GooglePage({
  snapshot,
  busy,
  run,
  service = googleApi,
}: Props) {
  const [data, setData] = useState<GoogleStatus | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [auto, setAuto] = useState(false);
  const [clientId, setClientId] = useState(""),
    [calendarId, setCalendarId] = useState(""),
    [clientSecret, setClientSecret] = useState(""),
    [calendar, setCalendar] = useState(false),
    [gmail, setGmail] = useState(false);
  const [confirm, setConfirm] = useState<GoogleAction | null>(null),
    [taskId, setTaskId] = useState("");
  const [id, setId] = useState(crypto.randomUUID()),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [sendAfter, setSendAfter] = useState("");
  const runner = useRef(run);
  useEffect(() => {
    runner.current = run;
  }, [run]);
  useEffect(() => {
    let active = true,
      inFlight = false;
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      void service
        .status()
        .then((value) => {
          if (active) {
            setData(value);
            setError("");
          }
        })
        .catch((e: unknown) => {
          if (active) setError(normalizeError(e).message);
        })
        .finally(() => {
          inFlight = false;
        });
    };
    const start = window.setTimeout(load, 0),
      interval = window.setInterval(load, 3000);
    return () => {
      active = false;
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [service, refresh]);
  useEffect(() => {
    if (!auto || !data?.connected) return;
    const timer = window.setInterval(() => {
      void runner.current(
        () => service.action({ kind: "processQueue" }),
        "Fila processada.",
      );
    }, 30000);
    return () => window.clearInterval(timer);
  }, [auto, data?.connected, service]);
  async function act(action: GoogleAction) {
    const ok = await run(
      () => service.action(action),
      "Configuração/fila atualizada.",
    );
    if (ok) {
      setConfirm(null);
      setRefresh((v) => v + 1);
      if (action.kind === "disconnect") setAuto(false);
      if (action.kind === "queueEmail") {
        setSubject("");
        setBody("");
        setId(crypto.randomUUID());
      }
    }
  }
  async function connect() {
    const input = { clientId, clientSecret, calendar, gmail };
    setClientSecret("");
    if (
      await run(
        () => service.begin(input),
        "Continue a autorização no navegador padrão.",
      )
    )
      setRefresh((v) => v + 1);
  }
  function prepareEmail() {
    if (!subject.trim() || !body.trim()) return;
    try {
      const when = sendAfter
        ? new Date(sendAfter).toISOString()
        : new Date().toISOString();
      setConfirm({
        kind: "queueEmail",
        id,
        subject,
        body,
        sendAfter: when,
        consent: true,
      });
    } catch {
      setError("Informe um horário válido.");
    }
  }
  return (
    <div className="library-page">
      <div className="page-intro">
        <div>
          <h2>Google, quando você escolher</h2>
          <p>
            Autorize no navegador padrão. Tokens ficam no cofre do Windows. O
            aplicativo não pede sua senha do Google.
          </p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <section className="panel">
          <p>
            {error
              ? "Não foi possível acessar as integrações."
              : "Carregando integração…"}
          </p>
          <button
            className="button secondary"
            onClick={() => setRefresh((v) => v + 1)}
          >
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>
              {data.connected
                ? `Conta conectada: ${data.email}`
                : "Nenhuma conta conectada"}
            </h2>
            {data.authorizing ? (
              <>
                <p role="status">
                  Aguardando autorização no navegador, por até cinco minutos.
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void act({ kind: "cancelAuthorization" })}
                >
                  Cancelar autorização
                </button>
              </>
            ) : !data.connected ? (
              <form
                className="editor-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void connect();
                }}
              >
                <details>
                  <summary>Preparar um cliente OAuth para uso pessoal</summary>
                  <p>
                    No Google Cloud, habilite Calendar API e/ou Gmail API,
                    configure a tela de consentimento e crie credenciais do tipo
                    Aplicativo para computador. Se o projeto estiver em teste,
                    inclua sua conta como usuário de teste. Cole abaixo o
                    client_id e, se fornecido, client_secret do arquivo de
                    credenciais. Não envie esses dados pelo chat.
                  </p>
                  <p>
                    Calendar usa calendar.app.created, restrito a calendários
                    criados pelo aplicativo. Gmail usa gmail.send, sem acesso de
                    leitura à caixa de entrada. A identificação da conta usa
                    openid e email. A autorização usa PKCE e retorno temporário
                    em 127.0.0.1; não há serviço separado a iniciar.
                  </p>
                </details>
                <label>
                  Client ID do aplicativo para computador
                  <input
                    required
                    maxLength={200}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Client secret, se fornecido
                  <input
                    type="password"
                    maxLength={300}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={calendar}
                    onChange={(e) => setCalendar(e.target.checked)}
                  />
                  Autorizar calendário exclusivo do LearningStudio
                </label>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={gmail}
                    onChange={(e) => setGmail(e.target.checked)}
                  />
                  Autorizar envio de lembretes para minha própria conta
                </label>
                <button
                  className="button primary"
                  disabled={busy || (!calendar && !gmail)}
                >
                  Conectar no navegador
                </button>
              </form>
            ) : (
              <>
                <p>
                  Calendar: {data.calendar ? "autorizado" : "desativado"} ·
                  Gmail: {data.gmail ? "autorizado" : "desativado"}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: "disconnect" })}
                >
                  Desconectar e remover tokens locais
                </button>
                <p className="helper">
                  Desconectar preserva os dados locais e não apaga
                  eventos/e-mails. Para revogar o consentimento remoto, use as
                  permissões da sua Conta Google.
                </p>
              </>
            )}
          </section>
          {data.connected && (
            <>
              <section className="panel">
                <h2>Calendário do LearningStudio</h2>
                <details>
                  <summary>
                    Reconciliar criação não confirmada de calendário
                  </summary>
                  <p>
                    Se a primeira criação falhou sem confirmação, confira o
                    Google Calendar. Copie o ID do calendário LearningStudio
                    criado por este aplicativo. O acesso é validado com o escopo
                    restrito antes de recuperar o vínculo; nenhum evento é
                    alterado nesta etapa.
                  </p>
                  <form
                    className="editor-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act({ kind: "recoverCalendar", id: calendarId });
                    }}
                  >
                    <label>
                      ID do calendário criado pelo aplicativo
                      <input
                        required
                        maxLength={1024}
                        value={calendarId}
                        onChange={(e) => setCalendarId(e.target.value)}
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={busy || !calendarId}
                    >
                      Recuperar vínculo do calendário
                    </button>
                  </form>
                </details>
                <p>
                  O primeiro envio cria um calendário separado. Você confirma
                  cada solicitação; o aplicativo não lê nem modifica eventos de
                  outros calendários.
                </p>
                <label>
                  Tarefa com prazo
                  <select
                    value={taskId}
                    disabled={busy || !data.calendar}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">Selecione uma tarefa</option>
                    {snapshot.tasks
                      .filter((t) => t.dueDate)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} · {t.dueDate}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="inline-actions">
                  <button
                    className="button primary"
                    disabled={busy || !taskId || !data.calendar}
                    onClick={() =>
                      setConfirm({ kind: "queueTask", taskId, consent: true })
                    }
                  >
                    Preparar envio ao calendário
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !taskId || !data.calendar}
                    onClick={() =>
                      setConfirm({ kind: "deleteEvent", taskId, consent: true })
                    }
                  >
                    Remover evento do aplicativo
                  </button>
                </div>
                <p className="helper">
                  Tarefas são enviadas como eventos de dia inteiro. Edições
                  posteriores exigem nova confirmação de envio; conflitos
                  remotos são recusados.
                </p>
              </section>
              <section className="panel">
                <h2>Lembrete por Gmail</h2>
                <p>
                  Destinatário fixo: {data.email}. Revise a mensagem antes de
                  colocá-la na fila.
                </p>
                <form
                  className="editor-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    prepareEmail();
                  }}
                >
                  <label>
                    Assunto
                    <input
                      required
                      maxLength={200}
                      disabled={!data.gmail}
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setConfirm(null);
                      }}
                    />
                  </label>
                  <label>
                    Mensagem
                    <textarea
                      required
                      rows={5}
                      maxLength={20000}
                      disabled={!data.gmail}
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        setConfirm(null);
                      }}
                    />
                  </label>
                  <label>
                    Enviar a partir de (opcional, horário deste computador)
                    <input
                      type="datetime-local"
                      disabled={!data.gmail}
                      value={sendAfter}
                      onChange={(e) => setSendAfter(e.target.value)}
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={busy || !data.gmail}
                  >
                    Revisar lembrete
                  </button>
                </form>
                <p className="helper">
                  Deixe vazio para um envio de teste imediato. Nenhuma mensagem
                  é enviada antes da confirmação e do processamento da fila.
                </p>
              </section>
              <section className="panel">
                <h2>Fila de sincronização</h2>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                  />
                  Processar a cada 30 segundos enquanto esta tela estiver aberta
                </label>
                <p>
                  O aplicativo precisa estar aberto, desbloqueado e conectado à
                  internet. Fechar esta tela pausa o processamento automático.
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void act({ kind: "processQueue" })}
                >
                  Processar próximo item agora
                </button>
                {data.queue.length === 0 ? (
                  <p>Sem operações na fila.</p>
                ) : (
                  data.queue.map((job) => (
                    <div className="review-note" key={job.id}>
                      <strong>
                        {job.kind === "gmail_send"
                          ? "E-mail"
                          : job.kind === "calendar_delete"
                            ? "Remover evento"
                            : "Atualizar evento"}{" "}
                        · {syncStates[job.state]}
                      </strong>
                      <p>
                        {job.message || "Aguardando processamento."} ·{" "}
                        {job.attempts} tentativas
                      </p>
                      {["pending", "failed"].includes(job.state) && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({ kind: "cancelJob", id: job.id })
                          }
                        >
                          Cancelar item da fila
                        </button>
                      )}
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </>
      )}
      {confirm && (
        <Dialog
          title="Confirmar operação Google"
          busy={busy}
          onClose={() => setConfirm(null)}
        >
          {confirm.kind === "queueEmail" ? (
            <>
              <p>
                Enviar para <strong>{data?.email}</strong> a partir de{" "}
                {new Date(confirm.sendAfter).toLocaleString("pt-BR")}.
              </p>
              <h3>{confirm.subject}</h3>
              <p className="preserve-text">{confirm.body}</p>
            </>
          ) : confirm.kind === "queueTask" ? (
            <>
              <p>
                Enviar título, notas e prazo de{" "}
                <strong>
                  {snapshot.tasks.find((t) => t.id === confirm.taskId)?.title}
                </strong>{" "}
                ao calendário exclusivo do aplicativo.
              </p>
              <p className="preserve-text">
                {snapshot.tasks.find((t) => t.id === confirm.taskId)?.notes}
              </p>
            </>
          ) : (
            <p>
              {confirm.kind === "deleteEvent"
                ? "Remover apenas o evento vinculado a esta tarefa e criado pelo LearningStudio?"
                : confirm.kind === "disconnect"
                  ? "Remover os tokens do cofre local e desconectar a conta?"
                  : "Cancelar esta operação pendente?"}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Voltar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void act(confirm)}
            >
              Confirmar operação
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
