import { useEffect, useState } from "react";
import type { Snapshot } from "../domain/types";
import type {
  OrganizerAction,
  OrganizerApi,
  OrganizerSnapshot,
  Resource,
  Topic,
} from "../domain/organizer";
import { organizerApi } from "../services/organizer";
import { normalizeError } from "../services/tauri";
import { Dialog } from "./Dialog";
type Editor = Topic & Resource & { kind: "topic" | "resource" };
export function ResourcesPage({
  snapshot,
  busy,
  run,
  service = organizerApi,
}: {
  snapshot: Snapshot;
  busy: boolean;
  run(fn: () => Promise<void>, message: string): Promise<boolean>;
  service?: OrganizerApi;
}) {
  const [data, setData] = useState<OrganizerSnapshot | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [query, setQuery] = useState(""),
    [topic, setTopic] = useState(""),
    [archived, setArchived] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null),
    [deletion, setDeletion] = useState<OrganizerAction | null>(null);
  function open(kind: Editor["kind"], input?: Topic | Resource) {
    setEditor({
      kind,
      id: crypto.randomUUID(),
      title: "",
      notes: "",
      areaId: null,
      topicId: null,
      url: "",
      archived: false,
      ...input,
    });
  }
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void service
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
      window.clearTimeout(timer);
    };
  }, [service, refresh]);
  async function act(a: OrganizerAction) {
    const ok = await run(() => service.action(a), "Organização atualizada.");
    if (ok) {
      setRefresh((v) => v + 1);
      setEditor(null);
      setDeletion(null);
    }
    return ok;
  }
  const visible =
    data?.resources.filter(
      (r) =>
        r.archived === archived &&
        (!topic || r.topicId === topic) &&
        `${r.title} ${r.notes} ${r.url}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
    ) ?? [];
  return (
    <div className="library-page">
      <div className="page-intro">
        <div>
          <h2>Tópicos, links e notas</h2>
          <p>
            Agrupe referências por tema e área de estudo. Suas notas ficam
            disponíveis offline.
          </p>
        </div>
        <div className="inline-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => open("topic")}
          >
            Novo tópico
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => open("resource")}
          >
            Novo recurso
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <section className="panel">
          <p>Carregando referências locais…</p>
          {error && (
            <button
              className="text-button"
              onClick={() => setRefresh((v) => v + 1)}
            >
              Tentar novamente
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Seus tópicos</h2>
            {data.topics.length === 0 ? (
              <p>Crie um tópico para agrupar recursos.</p>
            ) : (
              data.topics.map((t) => (
                <div className="review-note" key={t.id}>
                  <strong>{t.title}</strong>
                  <p>
                    {snapshot.areas.find((a) => a.id === t.areaId)?.name ||
                      "Sem área"}{" "}
                    · {t.notes}
                  </p>
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => open("topic", t)}
                    >
                      Editar tópico {t.title}
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() =>
                        setDeletion({ kind: "deleteTopic", id: t.id })
                      }
                    >
                      Excluir tópico {t.title}
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
          <div className="filter-bar">
            <label>
              Pesquisar recursos
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Filtrar por tópico
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Todos os tópicos</option>
                {data.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={archived ? "archived" : "active"}
                onChange={(e) => setArchived(e.target.value === "archived")}
              >
                <option value="active">Ativos</option>
                <option value="archived">Arquivados</option>
              </select>
            </label>
          </div>
          {visible.length === 0 ? (
            <section className="panel">
              <p>Nenhum recurso para estes filtros.</p>
            </section>
          ) : (
            visible.map((r) => (
              <section className="panel" key={r.id}>
                <span className="eyebrow">
                  {data.topics.find((t) => t.id === r.topicId)?.title ||
                    "Sem tópico"}
                </span>
                <h2>{r.title}</h2>
                <p className="preserve-text">{r.notes}</p>
                {r.url && (
                  <label>
                    Link de referência
                    <input
                      readOnly
                      value={r.url}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </label>
                )}
                <div className="inline-actions">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => open("resource", r)}
                  >
                    Editar recurso {r.title}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        kind: "saveResource",
                        input: { ...r, archived: !r.archived },
                      })
                    }
                  >
                    {r.archived ? "Restaurar recurso" : "Arquivar recurso"}
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={busy}
                    onClick={() =>
                      setDeletion({ kind: "deleteResource", id: r.id })
                    }
                  >
                    Excluir recurso {r.title}
                  </button>
                </div>
              </section>
            ))
          )}
        </>
      )}
      {editor && (
        <Dialog
          title={editor.kind === "topic" ? "Editar tópico" : "Editar recurso"}
          busy={busy}
          onClose={() => setEditor(null)}
        >
          <form
            className="editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              const { id, title, notes, areaId, topicId, url, archived } =
                editor;
              void act(
                editor.kind === "topic"
                  ? { kind: "saveTopic", input: { id, title, notes, areaId } }
                  : {
                      kind: "saveResource",
                      input: { id, title, notes, url, topicId, archived },
                    },
              );
            }}
          >
            <label>
              Título
              <input
                autoFocus
                required
                maxLength={160}
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
              />
            </label>
            <label>
              Notas
              <textarea
                maxLength={editor.kind === "topic" ? 4000 : 12000}
                rows={7}
                value={editor.notes}
                onChange={(e) =>
                  setEditor({ ...editor, notes: e.target.value })
                }
              />
            </label>
            {editor.kind === "topic" ? (
              <label>
                Área de estudo
                <select
                  value={editor.areaId ?? ""}
                  onChange={(e) =>
                    setEditor({ ...editor, areaId: e.target.value || null })
                  }
                >
                  <option value="">Sem área</option>
                  {snapshot.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Link HTTPS opcional
                  <input
                    maxLength={2000}
                    value={editor.url}
                    onChange={(e) =>
                      setEditor({ ...editor, url: e.target.value })
                    }
                  />
                </label>
                <label>
                  Tópico
                  <select
                    value={editor.topicId ?? ""}
                    onChange={(e) =>
                      setEditor({ ...editor, topicId: e.target.value || null })
                    }
                  >
                    <option value="">Sem tópico</option>
                    {data?.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Salvar {editor.kind === "topic" ? "tópico" : "recurso"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deletion && (
        <Dialog
          title="Confirmar exclusão?"
          busy={busy}
          onClose={() => setDeletion(null)}
        >
          <p>
            {deletion.kind === "deleteTopic"
              ? "O tópico será removido. Recursos e notas serão preservados sem vínculo."
              : "O recurso e suas notas serão excluídos."}
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
