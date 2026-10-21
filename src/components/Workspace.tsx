import { useState, type ReactNode } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Flag,
  BarChart3,
  Trash2,
} from "lucide-react";
import { dateKey, isOverdue, selectTasks } from "../domain/rules";
import type { Page, Snapshot, StudyArea, Task } from "../domain/types";
import { TaskList } from "./TaskList";
import { StudyOverview } from "./ProgressPage";

interface Props {
  snapshot: Snapshot;
  busy: boolean;
  page: Page;
  setPage(page: Page): void;
  onLock(): void;
  onNewTask(): void;
  onNewArea(): void;
  onEditTask(task: Task): void;
  onEditArea(area: StudyArea): void;
  onToggleTask(task: Task): void;
  onDeleteTask(task: Task): void;
  onDeleteArea(area: StudyArea): void;
  onArchiveArea(area: StudyArea): void;
  progressContent: ReactNode;
}

export function Workspace(props: Props) {
  const { snapshot, page, busy } = props;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [areaFilter, setAreaFilter] = useState("");
  const [archived, setArchived] = useState(false);
  const activeAreas = snapshot.areas.filter((a) => !a.archived);
  const pending = snapshot.tasks.filter((t) => t.status !== "done");
  const overdue = pending.filter((t) => isOverdue(t));
  const done = snapshot.tasks.filter((t) => t.status === "done");
  const today = dateKey();
  const date = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const headings = {
    dashboard: "Visão geral",
    tasks: "Minhas tarefas",
    areas: "Áreas de estudo",
    study: "Sessões de estudo",
    goals: "Metas",
    checkpoints: "Checkpoints",
    reports: "Relatórios",
    roadmaps: "Trilhas de aprendizagem",
    english: "Inglês offline",
    vocabulary: "Vocabulário e revisões",
    agenda: "Agenda de estudos",
    chatgpt: "Tarefas do ChatGPT",
    google: "Integrações Google",
    coding: "Tutor de programação",
    tutors: "Tutor de inglês",
    settings: "IA e consumo",
    backup: "Backup local",
    resources: "Tópicos e recursos",
  };
  const taskListProps = {
    areas: snapshot.areas,
    busy,
    onEdit: props.onEditTask,
    onToggle: props.onToggleTask,
    onDelete: props.onDeleteTask,
  };
  function goTasks(nextFilter = "open") {
    setFilter(nextFilter);
    setQuery("");
    props.setPage("tasks");
  }
  const visibleAreas = snapshot.areas.filter(
    (a) =>
      a.archived === archived &&
      `${a.name} ${a.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={21} />
          </span>
          <span>
            Learning<span className="brand-light">Studio</span>
          </span>
        </div>
        <span className="sidebar-caption">MEU ESPAÇO</span>
        <nav aria-label="Navegação principal">
          {(
            [
              { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
              { id: "tasks", label: "Minhas tarefas", icon: ListTodo },
              { id: "areas", label: "Áreas de estudo", icon: FolderOpen },
              { id: "resources", label: "Tópicos e recursos", icon: BookOpen },
              { id: "study", label: "Sessões de estudo", icon: Timer },
              { id: "goals", label: "Metas", icon: Target },
              { id: "checkpoints", label: "Checkpoints", icon: Flag },
              { id: "reports", label: "Relatórios", icon: BarChart3 },
              { id: "roadmaps", label: "Trilhas", icon: Flag },
              { id: "english", label: "Inglês offline", icon: BookOpen },
              { id: "vocabulary", label: "Vocabulário", icon: CheckCheck },
              { id: "agenda", label: "Agenda", icon: Timer },
              { id: "chatgpt", label: "Tarefas do ChatGPT", icon: ListTodo },
              { id: "google", label: "Integrações Google", icon: ShieldCheck },
              { id: "coding", label: "Programação", icon: ListTodo },
              { id: "tutors", label: "Tutor de inglês", icon: BookOpen },
              { id: "settings", label: "IA e consumo", icon: Sparkles },
              { id: "backup", label: "Backup local", icon: ArrowDownToLine },
            ] as const
          ).map((item) => (
            <button
              className={`nav-item ${page === item.id ? "active" : ""}`}
              key={item.id}
              aria-label={item.label}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => {
                setQuery("");
                props.setPage(item.id);
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "tasks" && pending.length > 0 && (
                <span className="count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-growing">
          <span className="sidebar-caption">NO SEU RITMO</span>
          <span>
            <BookOpen size={17} />
            Prática com evidências
          </span>
          <p>Revise o que aprendeu e registre seu próximo passo.</p>
        </div>
        <div className="sidebar-bottom">
          <div className="offline-note">
            <span className="status-dot" />
            <span>Dados locais · uso offline</span>
          </div>
          <button
            className="nav-item"
            onClick={props.onLock}
            aria-label="Bloquear espaço"
            aria-keyshortcuts="Control+Shift+L"
          >
            <LockKeyhole size={18} />
            <span>Bloquear espaço</span>
            <kbd aria-hidden="true">⌃ ⇧ L</kbd>
          </button>
          <span className="version">LearningStudio · base 0.1</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Meu espaço
            <ChevronRight size={14} />
            <span>{headings[page]}</span>
          </div>
          <span className="local-badge">
            <ShieldCheck size={15} />
            Pessoal e local
          </span>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "dashboard"
                  ? date
                  : "UM POUCO DE ORGANIZAÇÃO, MAIS FOCO"}
              </span>
              <h1>
                {page === "dashboard"
                  ? "Seu próximo passo começa aqui."
                  : headings[page]}
              </h1>
              <p>
                {page === "dashboard"
                  ? "Transforme o que você quer aprender em pequenos passos."
                  : page === "tasks"
                    ? "Defina o que importa e avance no seu ritmo."
                    : page === "areas"
                      ? "Dê um lugar para cada novo interesse."
                      : "Registre a prática, preserve evidências e acompanhe o que fez."}
              </p>
            </div>
            {(page === "dashboard" || page === "tasks" || page === "areas") && (
              <button
                className="button primary"
                onClick={page === "areas" ? props.onNewArea : props.onNewTask}
                disabled={busy}
              >
                <Plus size={18} />
                {page === "areas" ? "Nova área" : "Nova tarefa"}
              </button>
            )}
          </div>
          {page === "dashboard" && (
            <>
              <StudyOverview
                snapshot={snapshot}
                onStudy={() => props.setPage("study")}
              />
              <section className="stats-grid" aria-label="Resumo das tarefas">
                <button onClick={() => goTasks("open")} className="stat-card">
                  <span className="stat-label">
                    <ListTodo size={17} />
                    Em aberto
                  </span>
                  <strong>{pending.length}</strong>
                  <small>
                    {pending.filter((t) => t.dueDate === today).length} com
                    prazo para hoje
                  </small>
                </button>
                <button
                  onClick={() => goTasks("overdue")}
                  className="stat-card"
                >
                  <span className="stat-label">
                    <ClockIcon />
                    Precisam de atenção
                  </span>
                  <strong>{overdue.length}</strong>
                  <small>Tarefas com prazo vencido</small>
                </button>
                <button onClick={() => goTasks("done")} className="stat-card">
                  <span className="stat-label">
                    <CircleCheck size={17} />
                    Concluídas
                  </span>
                  <strong>{done.length}</strong>
                  <small>Passos que você já deu</small>
                </button>
              </section>
              <div className="inline-actions dashboard-shortcuts">
                <button
                  className="button secondary"
                  onClick={() => props.setPage("english")}
                >
                  Abrir lição de inglês
                </button>
                <button
                  className="text-button"
                  onClick={() => props.setPage("agenda")}
                >
                  Ver agenda de estudos →
                </button>
              </div>
              {!!snapshot.roadmaps?.length && (
                <section className="panel roadmap-overview">
                  <div className="section-heading">
                    <h2>Seu progresso nas trilhas</h2>
                    <button
                      className="text-button"
                      onClick={() => props.setPage("roadmaps")}
                    >
                      Ver trilhas →
                    </button>
                  </div>
                  {snapshot.roadmaps.map((r) => {
                    const complete = r.items.filter((id) =>
                      snapshot.checkpoints.some(
                        (c) => c.id === id && c.completedAt,
                      ),
                    ).length;
                    return (
                      <div className="review-note" key={r.id}>
                        <strong>{r.title}</strong>
                        <p>
                          {complete} de {r.items.length} etapas concluídas com
                          evidência
                        </p>
                        <progress
                          aria-label={`Resumo da trilha ${r.title}`}
                          value={complete}
                          max={Math.max(r.items.length, 1)}
                        />
                      </div>
                    );
                  })}
                </section>
              )}
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Próximas tarefas</h2>
                      <p>Uma coisa de cada vez.</p>
                    </div>
                    <button className="text-button" onClick={() => goTasks()}>
                      Ver todas
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  {pending.length ? (
                    <TaskList
                      {...taskListProps}
                      tasks={selectTasks(pending).slice(0, 5)}
                    />
                  ) : (
                    <div className="empty-state">
                      <CheckCheck size={32} />
                      <h3>
                        {done.length
                          ? "Tudo em dia por aqui"
                          : "Um começo com intenção"}
                      </h3>
                      <p>
                        {done.length
                          ? "Suas tarefas estão concluídas. Reserve espaço para o próximo passo."
                          : "Crie sua primeira tarefa e transforme uma ideia em ação."}
                      </p>
                      <button
                        className="button secondary"
                        onClick={props.onNewTask}
                      >
                        <Plus size={17} />
                        Criar uma tarefa
                      </button>
                    </div>
                  )}
                </section>
                <aside className="focus-card">
                  <span className="round-icon">
                    <Sparkles size={23} />
                  </span>
                  <span className="eyebrow">MENOS PRESSA, MAIS CONSTÂNCIA</span>
                  <h2>
                    Aprender também
                    <br />é criar espaço.
                  </h2>
                  <p>
                    Escolha uma área que desperta sua curiosidade. Depois,
                    planeje uma pequena atividade para ela.
                  </p>
                  <button className="text-button" onClick={props.onNewArea}>
                    Organizar minhas áreas
                    <ArrowRight size={17} />
                  </button>
                  <div className="focus-illustration" aria-hidden="true">
                    <div />
                    <div />
                    <div />
                    <span>um passo de cada vez</span>
                  </div>
                </aside>
              </div>
              <section className="panel areas-overview">
                <div className="section-heading">
                  <div>
                    <h2>Suas áreas de estudo</h2>
                    <p>Interesses que merecem tempo.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setQuery("");
                      props.setPage("areas");
                    }}
                  >
                    Explorar áreas
                    <ArrowRight size={16} />
                  </button>
                </div>
                {activeAreas.length ? (
                  <div className="area-chips">
                    {activeAreas.map((area) => (
                      <button
                        key={area.id}
                        className={`area-chip ${area.color}`}
                        onClick={() => {
                          setAreaFilter(area.id);
                          goTasks("all");
                        }}
                      >
                        <FolderOpen size={17} />
                        {area.name}
                        <span>
                          {
                            snapshot.tasks.filter(
                              (t) =>
                                t.areaId === area.id && t.status !== "done",
                            ).length
                          }{" "}
                          em aberto
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="inline-empty">
                    Você ainda não criou áreas. Comece com um assunto que quer
                    explorar.
                  </p>
                )}
              </section>
            </>
          )}
          {(page === "tasks" || page === "areas") && (
            <>
              <div className="filters">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    aria-label={
                      page === "tasks" ? "Pesquisar tarefas" : "Pesquisar áreas"
                    }
                    placeholder={
                      page === "tasks"
                        ? "Pesquisar tarefas e notas…"
                        : "Pesquisar áreas…"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {page === "tasks" ? (
                  <>
                    <select
                      aria-label="Filtrar por status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Todos os status</option>
                      <option value="open">Em aberto</option>
                      <option value="todo">A fazer</option>
                      <option value="doing">Em andamento</option>
                      <option value="done">Concluídas</option>
                      <option value="overdue">Vencidas</option>
                    </select>
                    <select
                      aria-label="Filtrar por área"
                      value={areaFilter}
                      onChange={(e) => setAreaFilter(e.target.value)}
                    >
                      <option value="">Todas as áreas</option>
                      {snapshot.areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.archived ? " (arquivada)" : ""}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={archived}
                      onChange={(e) => setArchived(e.target.checked)}
                    />
                    Mostrar arquivadas
                  </label>
                )}
              </div>
              {page === "tasks" ? (
                <section className="panel">
                  {selectTasks(snapshot.tasks, query, filter, areaFilter)
                    .length ? (
                    <TaskList
                      {...taskListProps}
                      tasks={selectTasks(
                        snapshot.tasks,
                        query,
                        filter,
                        areaFilter,
                      )}
                    />
                  ) : (
                    <div className="empty-state">
                      <ListTodo size={32} />
                      <h3>Nenhuma tarefa por aqui</h3>
                      <p>
                        {snapshot.tasks.length
                          ? "Ajuste os filtros para encontrar suas tarefas."
                          : "Crie sua primeira tarefa para começar."}
                      </p>
                      <button
                        className="button secondary"
                        onClick={props.onNewTask}
                      >
                        <Plus size={17} />
                        Nova tarefa
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <>
                  {visibleAreas.length ? (
                    <div className="areas-grid">
                      {visibleAreas.map((area) => (
                        <article className="area-card" key={area.id}>
                          <div className="area-card-top">
                            <span className={`area-symbol ${area.color}`}>
                              <FolderOpen size={23} />
                            </span>
                            <span className="small-label">
                              {area.archived
                                ? "Arquivada"
                                : `${snapshot.tasks.filter((t) => t.areaId === area.id).length} tarefas`}
                            </span>
                          </div>
                          <h2>{area.name}</h2>
                          <p>
                            {area.description ||
                              "Um espaço para aprender algo novo."}
                          </p>
                          <div className="area-card-actions">
                            <button
                              className="text-button"
                              onClick={() => props.onEditArea(area)}
                              disabled={busy}
                            >
                              <Pencil size={15} />
                              Editar
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`${area.archived ? "Restaurar" : "Arquivar"} área ${area.name}`}
                              onClick={() => props.onArchiveArea(area)}
                              disabled={busy}
                            >
                              {area.archived ? (
                                <ArrowDownToLine size={17} />
                              ) : (
                                <Archive size={17} />
                              )}
                            </button>
                            <button
                              className="icon-button danger-text"
                              aria-label={`Excluir área ${area.name}`}
                              onClick={() => props.onDeleteArea(area)}
                              disabled={busy}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <section className="panel empty-state">
                      <FolderOpen size={34} />
                      <h3>
                        {archived
                          ? "Nenhuma área arquivada"
                          : "O que você quer aprender?"}
                      </h3>
                      <p>
                        {query
                          ? "Nenhuma área corresponde à pesquisa."
                          : "Agrupe seus interesses e conecte suas tarefas a eles."}
                      </p>
                      <button
                        className="button secondary"
                        onClick={props.onNewArea}
                      >
                        <Plus size={17} />
                        Criar área de estudo
                      </button>
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {props.progressContent}
          <footer className="workspace-footer">
            <span>
              <span className="status-dot" />
              Alterações salvas neste computador
            </span>
            <span>Feito para aprender no seu ritmo.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <span aria-hidden="true" className="attention-icon">
      !
    </span>
  );
}
