import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, RefreshCw } from "lucide-react";
import type {
  AuthStatus,
  Page,
  Snapshot,
  StudyApi,
  StudyArea,
  Task,
} from "./domain/types";
import { taskToInput } from "./domain/rules";
import { normalizeError, tauriApi } from "./services/tauri";
import { AuthScreen } from "./components/AuthScreen";
import { Workspace } from "./components/Workspace";
import { AreaEditor, TaskEditor } from "./components/Editors";
import { Dialog } from "./components/Dialog";
import { ProgressPage } from "./components/ProgressPage";
import { LibraryPage } from "./components/LibraryPage";
import { TracksPage } from "./components/TracksPage";
import { AgendaPage } from "./components/AgendaPage";
import { GooglePage } from "./components/GooglePage";
import { TutorPage } from "./components/TutorPage";
import { BackupPage } from "./components/BackupPage";
import { OperationErrorContext } from "./domain/operationError";
import { ResourcesPage } from "./components/ResourcesPage";

type Modal =
  | { kind: "area"; area: StudyArea | null }
  | { kind: "task"; task: Task | null }
  | { kind: "deleteArea"; area: StudyArea }
  | { kind: "deleteTask"; task: Task }
  | null;

export function App({ api = tauriApi }: { api?: StudyApi }) {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState("");
  const [notice, setNotice] = useState("");
  const epoch = useRef(0);
  const executing = useRef(false);
  const lastActivity = useRef(0);
  const revision = useRef(0);
  const runningSessionId = snapshot?.sessions.find(
    (session) => session.status === "running",
  )?.id;

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const clearPrivateState = useCallback(() => {
    epoch.current += 1;
    setSnapshot(null);
    setModal(null);
    setError("");
    setNotice("");
    setPage("dashboard");
    setAuth((previous) => ({
      configured: previous?.configured ?? true,
      unlocked: false,
    }));
  }, []);

  const initialize = useCallback(async () => {
    const generation = ++epoch.current;
    try {
      const status = await api.authStatus();
      if (generation !== epoch.current) return;
      setAuth(status);
      if (status.unlocked) {
        const data = await api.snapshot();
        if (generation === epoch.current) setSnapshot(data);
      }
    } catch (issue: unknown) {
      if (generation === epoch.current) setFatal(normalizeError(issue).message);
    }
  }, [api]);

  useEffect(() => {
    const start = window.setTimeout(() => {
      void initialize();
    }, 0);
    return () => {
      window.clearTimeout(start);
      epoch.current += 1;
    };
  }, [initialize]);

  const lock = useCallback(async () => {
    clearPrivateState();
    try {
      await api.lock();
    } catch {
      setError(
        "Não foi possível confirmar o bloqueio no núcleo. Feche o aplicativo para encerrar a sessão com segurança.",
      );
    }
  }, [api, clearPrivateState]);

  useEffect(() => {
    if (!auth?.unlocked) return;
    lastActivity.current = performance.now();
    let lastNativeActivity = -30000;
    const activity = () => {
      lastActivity.current = performance.now();
      if (lastActivity.current - lastNativeActivity < 30000) return;
      lastNativeActivity = lastActivity.current;
      const generation = epoch.current;
      void api.userActivity().catch((issue: unknown) => {
        if (generation !== epoch.current) return;
        const normalized = normalizeError(issue);
        if (normalized.code === "LOCKED") clearPrivateState();
        setError(normalized.message);
      });
    };
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        void lock();
      }
    };
    const interval = window.setInterval(() => {
      if (performance.now() - lastActivity.current >= 15 * 60 * 1000)
        void lock();
    }, 1000);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("keydown", shortcut);
    };
  }, [api, auth?.unlocked, lock, clearPrivateState]);

  useEffect(() => {
    if (!auth?.unlocked || !runningSessionId) return;
    let disposed = false;
    let inFlight = false;
    const interval = window.setInterval(() => {
      if (inFlight || executing.current) return;
      inFlight = true;
      const generation = epoch.current;
      const version = revision.current;
      void api
        .pulseSession(runningSessionId)
        .then((session) => {
          if (
            disposed ||
            generation !== epoch.current ||
            version !== revision.current
          )
            return;
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  sessions: current.sessions.map((item) =>
                    item.id === session.id ? session : item,
                  ),
                }
              : current,
          );
        })
        .catch((issue: unknown) => {
          if (disposed || generation !== epoch.current) return;
          const normalized = normalizeError(issue);
          if (normalized.code === "LOCKED") clearPrivateState();
          setError(normalized.message);
        })
        .finally(() => {
          inFlight = false;
        });
    }, 10000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [api, auth?.unlocked, runningSessionId, clearPrivateState]);

  async function authenticate(password: string) {
    if (executing.current) return;
    executing.current = true;
    setBusy(true);
    setError("");
    const generation = epoch.current;
    try {
      const status = await (auth?.configured
        ? api.unlock(password)
        : api.setupPassword(password));
      if (generation !== epoch.current) return;
      const data = await api.snapshot();
      if (generation !== epoch.current) return;
      setAuth(status);
      setSnapshot(data);
    } catch (issue: unknown) {
      if (generation === epoch.current) {
        const normalized = normalizeError(issue);
        if (normalized.code === "ALREADY_CONFIGURED")
          setAuth({ configured: true, unlocked: false });
        setError(normalized.message);
      }
    } finally {
      executing.current = false;
      setBusy(false);
    }
  }

  async function mutate(
    action: () => Promise<void>,
    message: string,
    close = false,
  ) {
    if (executing.current) return false;
    executing.current = true;
    revision.current += 1;
    setBusy(true);
    setError("");
    setNotice("");
    const generation = epoch.current;
    let saved = false;
    try {
      await action();
      saved = true;
      if (generation !== epoch.current) return false;
      const data = await api.snapshot();
      if (generation !== epoch.current) return false;
      setSnapshot(data);
      setNotice(message);
      if (close) setModal(null);
      return true;
    } catch (issue: unknown) {
      if (generation === epoch.current) {
        const normalized = normalizeError(issue);
        if (normalized.code === "LOCKED") {
          clearPrivateState();
          setError(normalized.message);
        } else if (saved) {
          if (close) setModal(null);
          setSnapshot(null);
          setError(
            "A alteração foi salva, mas a lista não pôde ser atualizada. Recarregue os dados antes de continuar.",
          );
        } else setError(normalized.message);
      }
      return false;
    } finally {
      executing.current = false;
      setBusy(false);
    }
  }

  async function reload() {
    setBusy(true);
    setError("");
    const generation = epoch.current;
    try {
      const data = await api.snapshot();
      if (generation === epoch.current) setSnapshot(data);
    } catch (issue: unknown) {
      const normalized = normalizeError(issue);
      if (generation === epoch.current) {
        if (normalized.code === "LOCKED") clearPrivateState();
        setError(normalized.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function open(next: Modal) {
    setError("");
    setNotice("");
    setModal(next);
  }
  function close() {
    setModal(null);
    setError("");
  }

  if (fatal)
    return (
      <main className="startup-state">
        <AlertCircle size={32} />
        <h1>Não foi possível abrir seu espaço</h1>
        <p role="alert">{fatal}</p>
        <button
          className="button primary"
          onClick={() => {
            setFatal("");
            setAuth(null);
            setSnapshot(null);
            void initialize();
          }}
        >
          <RefreshCw size={17} />
          Tentar novamente
        </button>
      </main>
    );
  if (!auth)
    return (
      <main className="startup-state" role="status">
        <BookOpen size={32} />
        <p>Abrindo seu espaço…</p>
      </main>
    );
  if (!auth.unlocked)
    return (
      <AuthScreen
        configured={auth.configured}
        busy={busy}
        error={error}
        onSubmit={authenticate}
      />
    );
  if (!snapshot)
    return (
      <main className="startup-state">
        <BookOpen size={32} />
        <h1>Atualizar seus dados</h1>
        <p role="alert">{error || "Carregando seu espaço…"}</p>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            void reload();
          }}
        >
          Recarregar dados
        </button>
        <button
          className="text-button"
          onClick={() => {
            void lock();
          }}
        >
          Bloquear
        </button>
      </main>
    );

  return (
    <>
      <OperationErrorContext.Provider
        value={
          [
            "dashboard",
            "tasks",
            "areas",
            "study",
            "goals",
            "checkpoints",
            "reports",
          ].includes(page)
            ? ""
            : error
        }
      >
        <Workspace
          snapshot={snapshot}
          busy={busy}
          page={page}
          setPage={setPage}
          onLock={() => {
            void lock();
          }}
          onNewTask={() => open({ kind: "task", task: null })}
          onNewArea={() => open({ kind: "area", area: null })}
          onEditTask={(task) => open({ kind: "task", task })}
          onEditArea={(area) => open({ kind: "area", area })}
          onToggleTask={(task) => {
            void mutate(
              () =>
                api.saveTask({
                  ...taskToInput(task),
                  status: task.status === "done" ? "todo" : "done",
                }),
              task.status === "done" ? "Tarefa reaberta." : "Tarefa concluída.",
            );
          }}
          onDeleteTask={(task) => open({ kind: "deleteTask", task })}
          onDeleteArea={(area) => open({ kind: "deleteArea", area })}
          onArchiveArea={(area) => {
            void mutate(
              () => api.archiveArea(area.id, !area.archived),
              area.archived
                ? "Área restaurada."
                : "Área arquivada. Suas tarefas foram preservadas.",
            );
          }}
          progressContent={
            ["study", "goals", "checkpoints", "reports"].includes(page) ? (
              <ProgressPage
                key={page}
                page={page}
                snapshot={snapshot}
                api={api}
                busy={busy}
                error={error}
                run={(action, message) => mutate(action, message)}
              />
            ) : page === "roadmaps" ? (
              <TracksPage
                snapshot={snapshot}
                api={api}
                busy={busy}
                setPage={setPage}
                run={(action, message) => mutate(action, message)}
              />
            ) : ["english", "vocabulary"].includes(page) ? (
              <LibraryPage
                key={page}
                page={page}
                snapshot={snapshot}
                api={api}
                busy={busy}
                setPage={setPage}
                run={(action, message) => mutate(action, message)}
              />
            ) : ["agenda", "chatgpt"].includes(page) ? (
              <AgendaPage
                key={page}
                page={page}
                snapshot={snapshot}
                busy={busy}
                run={(action, message) => mutate(action, message)}
              />
            ) : page === "google" ? (
              <GooglePage
                snapshot={snapshot}
                busy={busy}
                run={(action, message) => mutate(action, message)}
              />
            ) : ["coding", "tutors", "settings"].includes(page) ? (
              <TutorPage
                key={page}
                page={page}
                busy={busy}
                setPage={setPage}
                run={(action, message) => mutate(action, message)}
              />
            ) : page === "backup" ? (
              <BackupPage
                busy={busy}
                run={(action, message) => mutate(action, message)}
              />
            ) : page === "resources" ? (
              <ResourcesPage
                snapshot={snapshot}
                busy={busy}
                run={(action, message) => mutate(action, message)}
              />
            ) : null
          }
        />
      </OperationErrorContext.Provider>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {error &&
        !modal &&
        !["study", "goals", "checkpoints", "reports"].includes(page) && (
          <div className="error-banner" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => {
                setError("");
              }}
            >
              Fechar
            </button>
          </div>
        )}
      {modal?.kind === "area" && (
        <AreaEditor
          area={modal.area}
          busy={busy}
          error={error}
          onClose={close}
          onSave={(input) =>
            mutate(() => api.saveArea(input), "Área salva.", true).then(
              () => {},
            )
          }
        />
      )}
      {modal?.kind === "task" && (
        <TaskEditor
          task={modal.task}
          checkpoints={snapshot.checkpoints}
          areas={snapshot.areas}
          busy={busy}
          error={error}
          onClose={close}
          onSave={(input) =>
            mutate(() => api.saveTask(input), "Tarefa salva.", true).then(
              () => {},
            )
          }
        />
      )}
      {(modal?.kind === "deleteArea" || modal?.kind === "deleteTask") && (
        <Dialog
          title={
            modal.kind === "deleteArea"
              ? "Excluir área de estudo?"
              : "Excluir tarefa?"
          }
          busy={busy}
          onClose={close}
        >
          <p className="dialog-copy">
            {modal.kind === "deleteArea"
              ? `“${modal.area.name}” será excluída. As tarefas vinculadas serão mantidas, sem área.`
              : `“${modal.task.title}” será excluída permanentemente.`}{" "}
            Esta ação não pode ser desfeita.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={close}
              autoFocus
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                void mutate(
                  () =>
                    modal.kind === "deleteArea"
                      ? api.deleteArea(modal.area.id)
                      : api.deleteTask(modal.task.id),
                  "Registro excluído.",
                  true,
                );
              }}
            >
              {busy ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
