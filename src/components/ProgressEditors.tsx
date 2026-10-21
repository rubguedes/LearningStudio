import { useState, type FormEvent } from "react";
import { Dialog } from "./Dialog";
import { dateKey } from "../domain/rules";
import {
  addDays,
  checkpointError,
  goalError,
  goalInput,
  goalModes,
  sessionError,
  sessionInput,
} from "../domain/progress";
import type {
  Checkpoint,
  CheckpointInput,
  Goal,
  GoalInput,
  SessionInput,
  StudyArea,
  StudySession,
} from "../domain/types";

interface Common {
  areas: StudyArea[];
  busy: boolean;
  error: string;
  onClose(): void;
}

function AreaField({
  areas,
  value,
  onChange,
  disabled,
}: {
  areas: StudyArea[];
  value: string | null;
  onChange(value: string | null): void;
  disabled: boolean;
}) {
  return (
    <>
      <label htmlFor="progress-area">Área de estudo</label>
      <select
        id="progress-area"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      >
        <option value="">Todas / sem área específica</option>
        {areas
          .filter((a) => !a.archived || a.id === value)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived ? " (arquivada)" : ""}
            </option>
          ))}
      </select>
    </>
  );
}
function Actions({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose(): void;
  label: string;
}) {
  return (
    <div className="dialog-actions">
      <button
        className="button secondary"
        type="button"
        disabled={busy}
        onClick={onClose}
      >
        Cancelar
      </button>
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Salvando…" : label}
      </button>
    </div>
  );
}

export function SessionEditor({
  session,
  areas,
  busy,
  error,
  onClose,
  onSave,
}: Common & {
  session: StudySession | null;
  onSave(input: SessionInput, timer: boolean): Promise<boolean>;
}) {
  const [input, setInput] = useState<SessionInput>(() =>
    session
      ? sessionInput(session)
      : {
          id: crypto.randomUUID(),
          title: "",
          notes: "",
          areaId: null,
          studyDate: dateKey(),
          durationSeconds: 1500,
        },
  );
  const [timer, setTimer] = useState(false);
  const [issue, setIssue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = {
      ...input,
      durationSeconds: timer ? 0 : input.durationSeconds,
    };
    const problem = sessionError(value, timer);
    setIssue(problem ?? "");
    if (!problem && (await onSave(value, timer))) onClose();
  }
  return (
    <Dialog
      title={session ? "Editar registro de estudo" : "Nova sessão de estudo"}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
      >
        {!session && (
          <>
            <label htmlFor="session-mode">Como registrar</label>
            <select
              id="session-mode"
              value={timer ? "timer" : "manual"}
              onChange={(e) => setTimer(e.target.value === "timer")}
              disabled={busy}
            >
              <option value="manual">Registrar estudo já realizado</option>
              <option value="timer">Iniciar cronômetro agora</option>
            </select>
          </>
        )}
        <label htmlFor="session-title">
          O que você estudou ou vai estudar?
        </label>
        <input
          id="session-title"
          autoFocus
          required
          maxLength={160}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
          disabled={busy}
        />
        <AreaField
          areas={areas}
          value={input.areaId}
          onChange={(areaId) => setInput({ ...input, areaId })}
          disabled={busy}
        />
        {!timer && (
          <div className="form-grid">
            <div>
              <label htmlFor="session-date">Data do estudo</label>
              <input
                id="session-date"
                type="date"
                max={dateKey()}
                required
                value={input.studyDate}
                onChange={(e) =>
                  setInput({ ...input, studyDate: e.target.value })
                }
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="session-minutes">Minutos estudados</label>
              <input
                id="session-minutes"
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                value={input.durationSeconds / 60}
                onChange={(e) =>
                  setInput({
                    ...input,
                    durationSeconds: Number(e.target.value) * 60,
                  })
                }
                disabled={busy}
              />
            </div>
          </div>
        )}
        <label htmlFor="session-notes">
          Notas <span className="optional">opcional</span>
        </label>
        <textarea
          id="session-notes"
          rows={3}
          maxLength={5000}
          value={input.notes}
          onChange={(e) => setInput({ ...input, notes: e.target.value })}
          disabled={busy}
        />
        {timer && (
          <p className="fine-print progress-help">
            O tempo é salvo a cada 10 segundos. Ao fechar o aplicativo, a sessão
            fica pausada no último tempo salvo. Interrupções longas exigem
            retomada explícita.
          </p>
        )}
        {(issue || error) && (
          <p className="error" role="alert">
            {issue || error}
          </p>
        )}
        <Actions
          busy={busy}
          onClose={onClose}
          label={timer ? "Iniciar cronômetro" : "Salvar sessão"}
        />
      </form>
    </Dialog>
  );
}

export function GoalEditor({
  goal,
  areas,
  busy,
  error,
  onClose,
  onSave,
}: Common & { goal: Goal | null; onSave(input: GoalInput): Promise<boolean> }) {
  const [input, setInput] = useState<GoalInput>(() =>
    goal
      ? goalInput(goal)
      : {
          id: crypto.randomUUID(),
          title: "",
          areaId: null,
          mode: "study_minutes",
          unit: "minutos",
          target: 120,
          manualValue: 0,
          startDate: dateKey(),
          dueDate: addDays(dateKey(), 30),
        },
  );
  const [issue, setIssue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = goalError(input);
    setIssue(problem ?? "");
    if (!problem && (await onSave(input))) onClose();
  }
  return (
    <Dialog
      title={goal ? "Editar meta" : "Nova meta"}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
      >
        <label htmlFor="goal-title">Nome da meta</label>
        <input
          id="goal-title"
          autoFocus
          required
          maxLength={160}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
          disabled={busy}
        />
        <label htmlFor="goal-mode">Como medir o progresso</label>
        <select
          id="goal-mode"
          value={input.mode}
          onChange={(e) => {
            const mode = e.target.value as GoalInput["mode"];
            setInput({
              ...input,
              mode,
              manualValue: 0,
              unit:
                mode === "study_minutes"
                  ? "minutos"
                  : mode === "task_count"
                    ? "tarefas"
                    : "itens",
            });
          }}
          disabled={busy}
        >
          {Object.entries(goalModes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <AreaField
          areas={areas}
          value={input.areaId}
          onChange={(areaId) => setInput({ ...input, areaId })}
          disabled={busy}
        />
        <div className="form-grid">
          <div>
            <label htmlFor="goal-target">Alvo</label>
            <input
              id="goal-target"
              type="number"
              min={1}
              max={1000000}
              step={1}
              required
              value={input.target}
              onChange={(e) =>
                setInput({ ...input, target: Number(e.target.value) })
              }
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="goal-unit">Unidade</label>
            <input
              id="goal-unit"
              required
              maxLength={40}
              value={input.unit}
              onChange={(e) => setInput({ ...input, unit: e.target.value })}
              disabled={busy || input.mode !== "manual"}
            />
          </div>
        </div>
        {input.mode === "manual" && (
          <>
            <label htmlFor="goal-value">Progresso registrado</label>
            <input
              id="goal-value"
              type="number"
              min={0}
              max={1000000000}
              step={1}
              value={input.manualValue}
              onChange={(e) =>
                setInput({ ...input, manualValue: Number(e.target.value) })
              }
              disabled={busy}
            />
          </>
        )}
        <div className="form-grid">
          <div>
            <label htmlFor="goal-start">A partir de</label>
            <input
              id="goal-start"
              type="date"
              required
              value={input.startDate}
              onChange={(e) =>
                setInput({ ...input, startDate: e.target.value })
              }
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="goal-due">Prazo da meta</label>
            <input
              id="goal-due"
              type="date"
              required
              min={input.startDate}
              value={input.dueDate}
              onChange={(e) => setInput({ ...input, dueDate: e.target.value })}
              disabled={busy}
            />
          </div>
        </div>
        <p className="fine-print progress-help">
          Metas automáticas consideram apenas sessões finalizadas ou tarefas
          concluídas dentro do período e da área selecionados. O progresso
          manual é informado por você.
        </p>
        {(issue || error) && (
          <p className="error" role="alert">
            {issue || error}
          </p>
        )}
        <Actions busy={busy} onClose={onClose} label="Salvar meta" />
      </form>
    </Dialog>
  );
}

export function CheckpointEditor({
  checkpoint,
  areas,
  busy,
  error,
  onClose,
  onSave,
}: Common & {
  checkpoint: Checkpoint | null;
  onSave(input: CheckpointInput): Promise<boolean>;
}) {
  const [input, setInput] = useState<CheckpointInput>(() => ({
    id: checkpoint?.id ?? crypto.randomUUID(),
    title: checkpoint?.title ?? "",
    description: checkpoint?.description ?? "",
    activity: checkpoint?.activity ?? "",
    criteria: checkpoint?.criteria ?? "",
    areaId: checkpoint?.areaId ?? null,
  }));
  const [issue, setIssue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = checkpointError(input);
    setIssue(problem ?? "");
    if (!problem && (await onSave(input))) onClose();
  }
  return (
    <Dialog
      title={checkpoint ? "Editar checkpoint" : "Novo checkpoint"}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
      >
        <label htmlFor="checkpoint-title">Título do checkpoint</label>
        <input
          id="checkpoint-title"
          autoFocus
          required
          maxLength={160}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
          disabled={busy}
        />
        <label htmlFor="checkpoint-description">
          Descrição <span className="optional">opcional</span>
        </label>
        <textarea
          id="checkpoint-description"
          maxLength={2000}
          rows={2}
          value={input.description}
          onChange={(e) => setInput({ ...input, description: e.target.value })}
          disabled={busy}
        />
        <label htmlFor="checkpoint-activity">Atividade prática</label>
        <textarea
          id="checkpoint-activity"
          required
          maxLength={2000}
          rows={3}
          value={input.activity}
          onChange={(e) => setInput({ ...input, activity: e.target.value })}
          disabled={busy || !!checkpoint?.completedAt}
        />
        <label htmlFor="checkpoint-criteria">Critérios de conclusão</label>
        <textarea
          id="checkpoint-criteria"
          required
          maxLength={2000}
          rows={3}
          value={input.criteria}
          onChange={(e) => setInput({ ...input, criteria: e.target.value })}
          disabled={busy || !!checkpoint?.completedAt}
        />
        {checkpoint?.completedAt && (
          <p className="fine-print">
            Reabra o checkpoint para alterar a atividade ou os critérios. As
            evidências anteriores serão preservadas.
          </p>
        )}
        <AreaField
          areas={areas}
          value={input.areaId}
          onChange={(areaId) => setInput({ ...input, areaId })}
          disabled={busy}
        />
        {(issue || error) && (
          <p className="error" role="alert">
            {issue || error}
          </p>
        )}
        <Actions busy={busy} onClose={onClose} label="Salvar checkpoint" />
      </form>
    </Dialog>
  );
}
