export interface LessonQuestion {
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
}
export interface LessonWord {
  term: string;
  meaning: string;
  example: string;
}
export interface EnglishLesson {
  id: string;
  title: string;
  level: string;
  minutes: number;
  objectives: string[];
  reading: string;
  questions: LessonQuestion[];
  writingPrompt: string;
  reference: string;
  rubric: string[];
  vocabulary: LessonWord[];
  followUp: string;
}
export interface Roadmap {
  id: string;
  title: string;
  description: string;
  items: string[];
}
export interface EnglishSubmission {
  id: string;
  lessonId: string;
  writing: string;
  answers: (number | null)[];
  submittedAt: string | null;
  updatedAt: string;
}
export interface LearningReview {
  submissionId: string;
  difficulties: string;
  revisedWriting: string;
  nextReview: string;
}
export interface VocabularyItem extends LessonWord {
  id: string;
  stage: number;
  dueDate: string;
  reviews: number;
}
export interface LibrarySnapshot {
  roadmaps: Roadmap[];
  lessons: EnglishLesson[];
  submissions: EnglishSubmission[];
  reviews: LearningReview[];
  vocabulary: VocabularyItem[];
}
export type LibraryAction =
  | { kind: "saveRoadmap"; id: string; title: string; description: string }
  | { kind: "deleteRoadmap"; id: string }
  | { kind: "linkCheckpoint"; roadmapId: string; checkpointId: string }
  | { kind: "unlinkCheckpoint"; checkpointId: string }
  | { kind: "reorder"; roadmapId: string; ids: string[] }
  | {
      kind: "saveSubmission";
      id: string;
      lessonId: string;
      writing: string;
      answers: (number | null)[];
      submit: boolean;
    }
  | {
      kind: "saveReview";
      submissionId: string;
      difficulties: string;
      revisedWriting: string;
      nextReview: string;
    }
  | ({ kind: "saveWord"; id: string } & LessonWord)
  | { kind: "reviewWord"; id: string; remembered: boolean; reviewId: string }
  | { kind: "deleteWord"; id: string };
export interface LearningApi {
  snapshot(): Promise<LibrarySnapshot>;
  action(action: LibraryAction): Promise<void>;
}
export function comprehension(
  lesson: EnglishLesson,
  submission: EnglishSubmission,
) {
  return {
    correct: lesson.questions.filter(
      (q, i) => q.answer === submission.answers[i],
    ).length,
    total: lesson.questions.length,
  };
}
export function reordered(
  ids: string[],
  id: string,
  direction: -1 | 1,
): string[] {
  const index = ids.indexOf(id),
    next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return [...ids];
  const copy = [...ids];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}
