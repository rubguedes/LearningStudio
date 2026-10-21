import {
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  formatDate,
  isOverdue,
  priorityLabels,
  statusLabels,
} from "../domain/rules";
import type { StudyArea, Task } from "../domain/types";

interface Props {
  tasks: Task[];
  areas: StudyArea[];
  busy: boolean;
  onEdit(task: Task): void;
  onToggle(task: Task): void;
  onDelete(task: Task): void;
}
export function TaskList({
  tasks,
  areas,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  return (
    <ul className="task-list">
      {tasks.map((task) => {
        const area = areas.find((a) => a.id === task.areaId);
        return (
          <li
            key={task.id}
            className={`task-row ${task.status === "done" ? "task-done" : ""}`}
          >
            <button
              className={`task-check ${task.status === "done" ? "checked" : ""}`}
              disabled={busy}
              onClick={() => onToggle(task)}
              aria-label={`${task.status === "done" ? "Reabrir" : "Concluir"} tarefa ${task.title}`}
            >
              {task.status === "done" ? (
                <Check size={16} />
              ) : (
                <Circle size={20} />
              )}
            </button>
            <div className="task-content">
              <button
                className="task-title"
                onClick={() => onEdit(task)}
                disabled={busy}
              >
                {task.title}
              </button>
              <div className="task-meta">
                {area && (
                  <span className={`area-tag ${area.color}`}>{area.name}</span>
                )}
                <span className={isOverdue(task) ? "overdue" : ""}>
                  <CalendarDays size={13} />
                  {formatDate(task.dueDate)}
                  {isOverdue(task) ? " · vencida" : ""}
                </span>
                {task.estimateMinutes && (
                  <span>
                    <Clock3 size={13} />
                    {task.estimateMinutes} min
                  </span>
                )}
                <span>{statusLabels[task.status]}</span>
              </div>
            </div>
            <span className={`priority ${task.priority}`}>
              <i />
              {priorityLabels[task.priority]}
            </span>
            <div className="row-actions">
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`Editar tarefa ${task.title}`}
                onClick={() => onEdit(task)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger-text"
                disabled={busy}
                aria-label={`Excluir tarefa ${task.title}`}
                onClick={() => onDelete(task)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
