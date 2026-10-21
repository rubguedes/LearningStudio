import type { Checkpoint } from "./types";
import type { Roadmap } from "./library";
import type { Feedback } from "./tutors";
export interface LanguageProfile {
  id: string;
  language: string;
  currentLevel: string;
  targetLevel: string;
  deadline: string;
  minutesPerDay: number;
  weekdays: number[];
}
export interface PlanStep {
  title: string;
  minutes: number;
  activity: string;
  criteria: string;
  review: string;
}
export interface TrackPlan {
  title: string;
  assumptions: string[];
  steps: PlanStep[];
}
export interface CareerContent {
  topic: string;
  prerequisites: string[];
  priority: string;
  theory: string;
  concepts: string[];
  example: string;
  explanation: string;
  challenge: string;
  acceptance: string[];
  artifact: string;
  sourceIds: string[];
  uncertainties: string[];
}
export interface ResumeVersion {
  text: string;
  skills: string[];
  reviewDays: number;
}
export interface SourceRecord {
  title: string;
  institution: string;
  url: string;
  date: string;
  claim: string;
}
export interface JobRecord {
  title: string;
  url: string;
  date: string;
  location: string;
  modality: string;
  seniority: string;
  requirements: string[];
  evidence: string;
}
type DocumentContent = {
  career_preferences: { targetRole: string; region: string };
  plan: TrackPlan;
  career: CareerContent;
  resume: ResumeVersion;
  resume_proposal: {
    originalId: string;
    suggestions: string[];
    uncertainties: string[];
  };
  job: JobRecord;
  source: SourceRecord;
  github: {
    repository: string;
    commits: unknown;
    workflowRuns: unknown;
    verifiedAt: string;
    scope: string;
  };
};
export type TrackDocument = {
  [K in keyof DocumentContent]: {
    id: string;
    profileId: string | null;
    kind: K;
    content: DocumentContent[K];
    createdAt: string;
  };
}[keyof DocumentContent];
export interface PracticeError {
  id: string;
  topic: string;
  category: string;
  excerpt: string;
  correction: string;
  explanation: string;
  severity: number;
  classification: string;
  repetitions: number;
  reviews: number;
  successes: number;
  nextReview: string;
}
export interface TracksSnapshot {
  profiles: LanguageProfile[];
  documents: TrackDocument[];
  errors: PracticeError[];
  pdfs: { id: string; lessonId: string; name: string; createdAt: string }[];
  pdfReviews: {
    id: string;
    pdfId: string;
    transcription: string;
    feedback: Feedback;
    createdAt: string;
  }[];
}
export type TracksAction =
  | { kind: "exportPdf"; id: string }
  | { kind: "saveCareerPreferences"; targetRole: string; region: string }
  | { kind: "saveProfile"; input: LanguageProfile }
  | { kind: "suggestPlan"; profileId: string; consent: boolean }
  | { kind: "savePlan"; id: string; profileId: string; input: TrackPlan }
  | { kind: "applyPlan"; id: string }
  | { kind: "classify"; id: string; classification: string; severity: number }
  | { kind: "recall"; id: string; answer: string; recalled: boolean }
  | { kind: "saveSource"; input: SourceRecord }
  | { kind: "suggestTopic"; topic: string; consent: boolean }
  | { kind: "saveResume"; input: ResumeVersion }
  | { kind: "reviewResume"; id: string; consent: boolean }
  | { kind: "saveJob"; input: JobRecord }
  | { kind: "fetchGithub"; repository: string; consent: boolean }
  | { kind: "reviewPdf"; id: string; transcription: string; consent: boolean }
  | {
      kind: "generateLanguageLesson";
      profileId: string;
      topic: string;
      consent: boolean;
    };
export function pathSteps(roadmap: Roadmap, checkpoints: Checkpoint[]) {
  let available = true;
  return roadmap.items.flatMap((id) => {
    const checkpoint = checkpoints.find((c) => c.id === id);
    if (!checkpoint) return [];
    const state = checkpoint.completedAt
      ? "completed"
      : available
        ? "available"
        : "locked";
    if (!checkpoint.completedAt) available = false;
    return [{ checkpoint, state }];
  });
}
export function rankErrors(errors: PracticeError[]) {
  return errors
    .filter((e) => e.classification === "error")
    .sort(
      (a, b) =>
        b.repetitions * 3 +
        b.severity * 2 -
        b.successes -
        (a.repetitions * 3 + a.severity * 2 - a.successes),
    );
}
const normalize = (s: string) =>
  s
    .trim()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
export function jobMatch(job: JobRecord, skills: string[]) {
  const known = new Set(skills.map(normalize));
  const requirements = [...new Set(job.requirements.map(normalize))];
  const matched = requirements.filter((r) => known.has(r)),
    missing = requirements.filter((r) => !known.has(r));
  return {
    matched,
    missing,
    percent: requirements.length
      ? Math.round((matched.length * 100) / requirements.length)
      : 0,
  };
}
export function marketSkills(jobs: JobRecord[], skills: string[]) {
  const counts = new Map<string, number>();
  for (const job of jobs)
    for (const skill of new Set(job.requirements.map(normalize)))
      counts.set(skill, (counts.get(skill) ?? 0) + 1);
  const known = new Set(skills.map(normalize));
  return [...counts]
    .map(([skill, count]) => ({
      skill,
      count,
      percent: Math.round((count * 100) / jobs.length),
      gap: !known.has(skill),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(b.gap) - Number(a.gap) ||
        a.skill.localeCompare(b.skill),
    );
}
export function marketRanking(
  jobs: JobRecord[],
  skills: string[],
  targetRole: string,
  today: string,
) {
  const now = Date.parse(`${today}T00:00:00Z`),
    role = normalize(targetRole);
  return marketSkills(jobs, skills)
    .map((item) => {
      const sources = jobs.filter((job) =>
        job.requirements.some((r) => normalize(r) === item.skill),
      );
      const relevance = role
        ? sources.filter((j) => normalize(j.title).includes(role)).length /
          sources.length
        : 0;
      const recency =
        sources.reduce(
          (total, j) =>
            total +
            Math.max(
              0,
              Math.min(
                1,
                1 - (now - Date.parse(`${j.date}T00:00:00Z`)) / 86400000 / 180,
              ),
            ),
          0,
        ) / sources.length;
      const score = Math.round(
        item.percent * 0.5 +
          relevance * 20 +
          recency * 20 +
          Number(item.gap) * 10,
      );
      return {
        ...item,
        relevance: Math.round(relevance * 100),
        recency: Math.round(recency * 100),
        score,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.count - a.count ||
        a.skill.localeCompare(b.skill),
    );
}
