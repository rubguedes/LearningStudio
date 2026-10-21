export interface Topic {
  id: string;
  title: string;
  notes: string;
  areaId: string | null;
}
export interface Resource {
  id: string;
  title: string;
  notes: string;
  url: string;
  topicId: string | null;
  archived: boolean;
}
export interface OrganizerSnapshot {
  topics: Topic[];
  resources: Resource[];
}
export type OrganizerAction =
  | { kind: "saveTopic"; input: Topic }
  | { kind: "saveResource"; input: Resource }
  | { kind: "deleteTopic"; id: string }
  | { kind: "deleteResource"; id: string };
export interface OrganizerApi {
  snapshot(): Promise<OrganizerSnapshot>;
  action(action: OrganizerAction): Promise<void>;
}
