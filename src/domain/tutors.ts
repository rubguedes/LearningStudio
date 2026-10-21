export interface AISettings {
  provider: "disabled" | "openai" | "ollama";
  openaiModel: string;
  ollamaModel: string;
  monthlyLimitMicros: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  currency: string;
  pricesUpdatedAt: string;
  maxOutputTokens: number;
}
export interface CodingChallenge {
  id: string;
  title: string;
  language: "python" | "typescript";
  difficulty: string;
  prompt: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  hints: string[];
  criteria: string[];
  visibleTests: string[];
}
export interface GeneratedChallenge {
  challenge: CodingChallenge;
  reference: string;
  hiddenTests: string[];
}
export interface Finding {
  category: string;
  excerpt: string;
  suggestion: string;
  explanation: string;
}
export interface Feedback {
  summary: string;
  findings: Finding[];
  revised: string;
  followUp: string;
  uncertainties: string[];
}
export interface CodeSubmission {
  id: string;
  challengeId: string;
  code: string;
  submittedAt: string | null;
  updatedAt: string;
}
export interface EvaluationResult {
  id: string;
  englishSubmissionId: string | null;
  codeSubmissionId: string | null;
  source: "static" | "self" | "openai" | "ollama";
  feedback: Feedback;
  createdAt: string;
}
export interface AIUsageRecord {
  id: string;
  provider: string;
  model: string;
  task: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  reservedMicros: number;
  currency: string;
  state: string;
  createdAt: string;
}
export interface TutorSnapshot {
  settings: AISettings;
  hasKey: boolean;
  challenges: CodingChallenge[];
  submissions: CodeSubmission[];
  evaluations: EvaluationResult[];
  usage: AIUsageRecord[];
  executionAvailable: boolean;
}
export type TutorAction =
  | { kind: "quickSetup"; key: string }
  | { kind: "checkConnection" }
  | { kind: "saveSettings"; settings: AISettings }
  | { kind: "saveKey"; key: string }
  | { kind: "removeKey" }
  | { kind: "saveChallenge"; input: GeneratedChallenge }
  | {
      kind: "saveCode";
      id: string;
      challengeId: string;
      code: string;
      submit: boolean;
    }
  | { kind: "staticReview"; submissionId: string }
  | { kind: "selfReview"; submissionId: string; notes: string; revised: string }
  | { kind: "generateLesson"; topic: string; level: string; consent: boolean }
  | {
      kind: "generateChallenge";
      topic: string;
      language: string;
      difficulty: string;
      consent: boolean;
    }
  | { kind: "reviewEnglish"; submissionId: string; consent: boolean }
  | { kind: "reviewCode"; submissionId: string; consent: boolean };
export interface TutorApi {
  snapshot(): Promise<TutorSnapshot>;
  action(action: TutorAction): Promise<void>;
  solution(id: string): Promise<string>;
}
export function monthlySpend(
  usage: AIUsageRecord[],
  month = new Date().toISOString().slice(0, 7),
) {
  return usage
    .filter((u) => u.provider === "openai" && u.createdAt.startsWith(month))
    .reduce((sum, u) => sum + (u.costMicros ?? u.reservedMicros), 0);
}
export function money(micros: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 4,
  }).format(micros / 1_000_000);
}
