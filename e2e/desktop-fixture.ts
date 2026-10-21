import type { Page } from "@playwright/test";
import type { TracksSnapshot, TracksAction } from "../src/domain/tracks";
import type { LibraryAction, LibrarySnapshot } from "../src/domain/library";
import type {
  AgendaAction,
  AgendaSnapshot,
  ImportedTaskInput,
} from "../src/domain/agenda";
import lessons from "../src-tauri/content/english.json" with { type: "json" };
import coding from "../src-tauri/content/coding.json" with { type: "json" };
import type {
  CodingChallenge,
  TutorSnapshot,
  TutorAction,
} from "../src/domain/tutors";
import type {
  OrganizerSnapshot,
  OrganizerAction,
} from "../src/domain/organizer";
import type {
  AreaInput,
  Snapshot,
  TaskInput,
  SessionInput,
  GoalInput,
  CheckpointInput,
} from "../src/domain/types";

export async function mockDesktop(page: Page) {
  await page.addInitScript(
    ({ lessons, coding }) => {
      // Simula apenas o transporte IPC neste teste de navegador. Este teste não
      // substitui a suíte Rust nem comprova autenticação ou persistência SQLite.
      let configured = false;
      let unlocked = false;
      let googleAuthorizing = false;
      const tutors: TutorSnapshot = {
        settings: {
          provider: "disabled",
          openaiModel: "",
          ollamaModel: "",
          monthlyLimitMicros: 0,
          inputPricePerMillion: 0,
          outputPricePerMillion: 0,
          currency: "USD",
          pricesUpdatedAt: "",
          maxOutputTokens: 4096,
        },
        hasKey: false,
        challenges: coding.map((c) => c.challenge) as CodingChallenge[],
        submissions: [],
        evaluations: [],
        usage: [],
        executionAvailable: false,
      };
      const organizer: OrganizerSnapshot = { topics: [], resources: [] };
      const tracks: TracksSnapshot = {
        profiles: [],
        documents: [],
        errors: [],
        pdfs: [],
        pdfReviews: [],
      };
      const data: Snapshot = {
        areas: [],
        tasks: [],
        sessions: [],
        goals: [],
        checkpoints: [],
        checkpointEvidence: [],
      };
      const library: LibrarySnapshot = {
        roadmaps: [],
        lessons,
        submissions: [],
        reviews: [],
        vocabulary: [],
      };
      const agenda: AgendaSnapshot = {
        recurrences: [],
        imported: [],
        occurrences: [],
      };
      const windowWithTauri = window as unknown as {
        isTauri: boolean;
        __TAURI_INTERNALS__: {
          invoke(
            command: string,
            args?: Record<string, unknown>,
          ): Promise<unknown>;
        };
      };
      windowWithTauri.isTauri = true;
      windowWithTauri.__TAURI_INTERNALS__ = {
        async invoke(command, args = {}) {
          if (command === "auth_status") return { configured, unlocked };
          if (command === "setup_password") {
            configured = true;
            unlocked = true;
            return { configured, unlocked };
          }
          if (command === "unlock") {
            if (args.password !== "uma frase longa segura")
              throw { code: "INVALID_PASSWORD", message: "Senha incorreta." };
            unlocked = true;
            return { configured, unlocked };
          }
          if (command === "lock") {
            unlocked = false;
            return;
          }
          if (!unlocked) throw { code: "LOCKED", message: "Bloqueado" };
          if (command === "user_activity") return;
          if (command === "workspace_snapshot") return structuredClone(data);
          if (command === "tutor_snapshot") return structuredClone(tutors);
          if (command === "tracks_snapshot") return structuredClone(tracks);
          if (command === "tracks_action") {
            const action = args.action as TracksAction;
            if (action.kind === "saveProfile") {
              tracks.profiles = tracks.profiles.filter(
                (p) => p.id !== action.input.id,
              );
              tracks.profiles.push(action.input);
            }
            if (
              action.kind === "saveResume" ||
              action.kind === "saveJob" ||
              action.kind === "saveSource"
            ) {
              const base = {
                id: crypto.randomUUID(),
                profileId: null,
                createdAt: new Date().toISOString(),
              };
              if (action.kind === "saveResume")
                tracks.documents.unshift({
                  ...base,
                  kind: "resume",
                  content: action.input,
                });
              if (action.kind === "saveJob")
                tracks.documents.unshift({
                  ...base,
                  kind: "job",
                  content: action.input,
                });
              if (action.kind === "saveSource")
                tracks.documents.unshift({
                  ...base,
                  kind: "source",
                  content: action.input,
                });
            }
            return;
          }
          if (command === "challenge_solution")
            return coding.find((c) => c.challenge.id === args.id)?.reference;
          if (command === "tutor_action") {
            const action = args.action as TutorAction;
            if (action.kind === "saveCode") {
              tutors.submissions = tutors.submissions.filter(
                (s) => s.id !== action.id,
              );
              tutors.submissions.push({
                id: action.id,
                challengeId: action.challengeId,
                code: action.code,
                submittedAt: action.submit ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              });
            }
            if (action.kind === "staticReview")
              tutors.evaluations.push({
                id: crypto.randomUUID(),
                codeSubmissionId: action.submissionId,
                englishSubmissionId: null,
                source: "static",
                createdAt: new Date().toISOString(),
                feedback: {
                  summary: "Leitura estática limitada. Nenhum teste executado.",
                  findings: [],
                  revised: "",
                  followUp: "Reveja os critérios.",
                  uncertainties: ["A correção funcional não foi verificada."],
                },
              });
            return;
          }
          if (command === "export_backup")
            return "Backup simulado pelo teste; nenhum arquivo real foi criado.";
          if (command === "organizer_snapshot")
            return structuredClone(organizer);
          if (command === "organizer_action") {
            const action = args.action as OrganizerAction;
            if (action.kind === "saveTopic") {
              organizer.topics = organizer.topics.filter(
                (t) => t.id !== action.input.id,
              );
              organizer.topics.push(action.input);
            }
            if (action.kind === "saveResource") {
              organizer.resources = organizer.resources.filter(
                (r) => r.id !== action.input.id,
              );
              organizer.resources.push(action.input);
            }
            return;
          }
          if (command === "google_status")
            return {
              connected: false,
              email: null,
              calendar: false,
              gmail: false,
              authorizing: googleAuthorizing,
              queue: [],
            };
          if (command === "google_begin") {
            googleAuthorizing = true;
            return;
          }
          if (command === "google_action") {
            googleAuthorizing = false;
            return;
          }
          if (command === "agenda_snapshot") return structuredClone(agenda);
          if (command === "preview_import")
            return JSON.parse(args.content as string) as ImportedTaskInput[];
          if (command === "agenda_action") {
            const action = args.action as AgendaAction;
            if (action.kind === "saveRecurrence")
              agenda.recurrences.push(action.input);
            if (action.kind === "import")
              for (const item of JSON.parse(
                action.content,
              ) as ImportedTaskInput[]) {
                const prior = agenda.imported.find(
                  (i) => i.externalId === item.externalId,
                );
                if (prior) Object.assign(prior, item);
                else
                  agenda.imported.push({
                    ...item,
                    id: crypto.randomUUID(),
                    updatedAt: new Date().toISOString(),
                    localTaskId: null,
                    convertedAt: null,
                  });
              }
            if (action.kind === "convert") {
              const item = agenda.imported.find((i) => i.id === action.id)!;
              if (!item.convertedAt) {
                const id = crypto.randomUUID();
                item.localTaskId = id;
                item.convertedAt = new Date().toISOString();
                data.tasks.push({
                  id,
                  title: item.title,
                  notes: "Origem: ChatGPT (importação manual)",
                  areaId: null,
                  priority: "medium",
                  status: "todo",
                  dueDate: action.dueDate,
                  estimateMinutes: null,
                  createdAt: item.convertedAt,
                  updatedAt: item.convertedAt,
                  completedAt: null,
                });
              }
            }
            return;
          }
          if (command === "library_snapshot") return structuredClone(library);
          if (command === "library_action") {
            const action = args.action as LibraryAction;
            if (action.kind === "saveSubmission") {
              library.submissions = library.submissions.filter(
                (s) => s.id !== action.id,
              );
              library.submissions.push({
                id: action.id,
                lessonId: action.lessonId,
                writing: action.writing,
                answers: action.answers,
                submittedAt: action.submit ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              });
            }
            if (action.kind === "saveReview") library.reviews.push(action);
            if (action.kind === "saveWord")
              library.vocabulary.push({
                ...action,
                stage: 0,
                dueDate: new Date().toLocaleDateString("sv-SE"),
                reviews: 0,
              });
            return;
          }
          if (command === "save_area") {
            const input = args.input as AreaInput;
            if (input.id)
              Object.assign(
                data.areas.find((a) => a.id === input.id)!,
                input,
              );
            else
              data.areas.push({
                ...input,
                id: crypto.randomUUID(),
                archived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            return;
          }
          if (command === "save_task") {
            const input = args.input as TaskInput;
            const timestamp = new Date().toISOString();
            if (input.id)
              Object.assign(
                data.tasks.find((t) => t.id === input.id)!,
                input,
                {
                  updatedAt: timestamp,
                  completedAt: input.status === "done" ? timestamp : null,
                },
              );
            else
              data.tasks.push({
                ...input,
                id: crypto.randomUUID(),
                createdAt: timestamp,
                updatedAt: timestamp,
                completedAt: null,
              });
            return;
          }
          if (command === "delete_task") {
            data.tasks = data.tasks.filter((t) => t.id !== args.id);
            return;
          }
          if (command === "save_session" || command === "start_session") {
            const input = args.input as SessionInput;
            const timestamp = new Date().toISOString();
            const existing = data.sessions.find((s) => s.id === input.id);
            if (existing)
              Object.assign(existing, input, { updatedAt: timestamp });
            else
              data.sessions.push({
                ...input,
                mode: command === "save_session" ? "manual" : "timer",
                status: command === "save_session" ? "completed" : "running",
                createdAt: timestamp,
                updatedAt: timestamp,
                completedAt: command === "save_session" ? timestamp : null,
              });
            return;
          }
          if (command === "pulse_session")
            return structuredClone(data.sessions.find((s) => s.id === args.id));
          if (command === "control_session") {
            const session = data.sessions.find((s) => s.id === args.id)!;
            session.status =
              args.action === "pause"
                ? "paused"
                : args.action === "resume"
                  ? "running"
                  : "completed";
            if (session.status === "completed")
              session.completedAt = new Date().toISOString();
            return;
          }
          if (command === "save_goal") {
            const input = args.input as GoalInput;
            const existing = data.goals.find((g) => g.id === input.id);
            const timestamp = new Date().toISOString();
            if (existing)
              Object.assign(existing, input, { updatedAt: timestamp });
            else
              data.goals.push({
                ...input,
                archived: false,
                createdAt: timestamp,
                updatedAt: timestamp,
              });
            return;
          }
          if (command === "archive_goal") {
            const goal = data.goals.find((g) => g.id === args.id)!;
            goal.archived = args.archived as boolean;
            return;
          }
          if (command === "save_checkpoint") {
            const input = args.input as CheckpointInput;
            const existing = data.checkpoints.find((c) => c.id === input.id);
            const timestamp = new Date().toISOString();
            if (existing)
              Object.assign(existing, input, { updatedAt: timestamp });
            else
              data.checkpoints.push({
                ...input,
                completedAt: null,
                createdAt: timestamp,
                updatedAt: timestamp,
              });
            return;
          }
          if (command === "complete_checkpoint") {
            const checkpoint = data.checkpoints.find((c) => c.id === args.id)!;
            if (checkpoint.completedAt) return;
            const timestamp = new Date().toISOString();
            checkpoint.completedAt = timestamp;
            data.checkpointEvidence.push({
              id: crypto.randomUUID(),
              checkpointId: checkpoint.id,
              content: args.evidence as string,
              createdAt: timestamp,
            });
            return;
          }
          if (command === "reopen_checkpoint") {
            data.checkpoints.find((c) => c.id === args.id)!.completedAt = null;
            return;
          }
          if (command === "delete_progress") {
            if (args.kind === "session")
              data.sessions = data.sessions.filter((s) => s.id !== args.id);
            if (args.kind === "goal")
              data.goals = data.goals.filter((g) => g.id !== args.id);
            if (args.kind === "checkpoint") {
              data.checkpoints = data.checkpoints.filter(
                (c) => c.id !== args.id,
              );
              data.checkpointEvidence = data.checkpointEvidence.filter(
                (e) => e.checkpointId !== args.id,
              );
            }
            return;
          }
          throw {
            code: "UNSUPPORTED",
            message: "Comando não coberto pela fixture.",
          };
        },
      };
    },
    { lessons, coding },
  );
}
