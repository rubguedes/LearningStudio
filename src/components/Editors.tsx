import { useState, type FormEvent } from "react";
import {
  areaError,
  colors,
  priorityLabels,
  statusLabels,
  taskError,
} from "../domain/rules";
import type {
  AreaInput,
  StudyArea,
  Task,
  TaskInput,
  Checkpoint,
} from "../domain/types";
import { Dialog } from "./Dialog";

interface CommonProps {
  busy: boolean;
  error: string;
  onClose(): void;
}

export function AreaEditor({
  area,
  busy,
  error,
  onClose,
  onSave,
}: CommonProps & {
  area: StudyArea | null;
  onSave(input: AreaInput): Promise<void>;
}) {
  const [input, setInput] = useState<AreaInput>({
    id: area?.id ?? null,
    name: area?.name ?? "",
    description: area?.description ?? "",
    color: area?.color ?? "forest",
  });
  const [issue, setIssue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = areaError(input);
    setIssue(message ?? "");
    if (!message) await onSave(input);
  }
  return (
    <Dialog
      title={area ? "Editar área de estudo" : "Nova área de estudo"}
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label htmlFor="area-name">Nome da área</label>
        <input
          id="area-name"
          autoFocus
          required
          maxLength={80}
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          placeholder="Ex.: Engenharia de IA"
          disabled={busy}
        />
        <label htmlFor="area-description">
          Descrição <span className="optional">opcional</span>
        </label>
        <textarea
          id="area-description"
          maxLength={1000}
          rows={3}
          value={input.description}
          onChange={(e) => setInput({ ...input, description: e.target.value })}
          placeholder="O que você quer aprender?"
          disabled={busy}
        />
        <label htmlFor="area-color">Cor</label>
        <select
          id="area-color"
          value={input.color}
          onChange={(e) =>
            setInput({ ...input, color: e.target.value as AreaInput["color"] })
          }
          disabled={busy}
        >
          {Object.entries(colors).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        {(issue || error) && (
          <p role="alert" className="error">
            {issue || error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar área"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function TaskEditor({
  task,
  areas,
  checkpoints = [],
  busy,
  error,
  onClose,
  onSave,
}: CommonProps & {
  task: Task | null;
  areas: StudyArea[];
  checkpoints?: Checkpoint[];
  onSave(input: TaskInput): Promise<void>;
}) {
  const [input, setInput] = useState<TaskInput>({
    checkpointId: task?.checkpointId ?? null,
    id: task?.id ?? null,
    title: task?.title ?? "",
    notes: task?.notes ?? "",
    areaId: task?.areaId ?? null,
    priority: task?.priority ?? "medium",
    status: task?.status ?? "todo",
    dueDate: task?.dueDate ?? null,
    estimateMinutes: task?.estimateMinutes ?? null,
  });
  const [issue, setIssue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = taskError(input);
    setIssue(message ?? "");
    if (!message) await onSave(input);
  }
  return (
    <Dialog
      title={task ? "Editar tarefa" : "Nova tarefa"}
      busy={busy}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label htmlFor="task-title">O que você quer fazer?</label>
        <input
          id="task-title"
          autoFocus
          required
          maxLength={160}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
          placeholder="Ex.: Praticar consultas SQL"
          disabled={busy}
        />
        <label htmlFor="task-notes">
          Notas <span className="optional">opcional</span>
        </label>
        <textarea
          id="task-notes"
          rows={3}
          maxLength={5000}
          value={input.notes}
          onChange={(e) => setInput({ ...input, notes: e.target.value })}
          disabled={busy}
        />
        <label htmlFor="task-checkpoint">Checkpoint da trilha (opcional)</label>
        <select
          id="task-checkpoint"
          value={input.checkpointId ?? ""}
          disabled={busy}
          onChange={(e) =>
            setInput({ ...input, checkpointId: e.target.value || null })
          }
        >
          <option value="">Sem vínculo com checkpoint</option>
          {checkpoints.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <label htmlFor="task-area">Área de estudo</label>
        <select
          id="task-area"
          value={input.areaId ?? ""}
          onChange={(e) =>
            setInput({ ...input, areaId: e.target.value || null })
          }
          disabled={busy}
        >
          <option value="">Sem área</option>
          {areas
            .filter((a) => !a.archived || a.id === input.areaId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? " (arquivada)" : ""}
              </option>
            ))}
        </select>
        <div className="form-grid">
          <div>
            <label htmlFor="task-priority">Prioridade</label>
            <select
              id="task-priority"
              value={input.priority}
              onChange={(e) =>
                setInput({
                  ...input,
                  priority: e.target.value as TaskInput["priority"],
                })
              }
              disabled={busy}
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-status">Status</label>
            <select
              id="task-status"
              value={input.status}
              onChange={(e) =>
                setInput({
                  ...input,
                  status: e.target.value as TaskInput["status"],
                })
              }
              disabled={busy}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label htmlFor="task-date">
              Prazo <span className="optional">opcional</span>
            </label>
            <input
              id="task-date"
              type="date"
              value={input.dueDate ?? ""}
              onChange={(e) =>
                setInput({ ...input, dueDate: e.target.value || null })
              }
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="task-estimate">Estimativa em minutos</label>
            <input
              id="task-estimate"
              type="number"
              min={1}
              max={1440}
              step={1}
              value={input.estimateMinutes ?? ""}
              onChange={(e) =>
                setInput({
                  ...input,
                  estimateMinutes: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              placeholder="Ex.: 25"
              disabled={busy}
            />
          </div>
        </div>
        {(issue || error) && (
          <p className="error" role="alert">
            {issue || error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar tarefa"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
