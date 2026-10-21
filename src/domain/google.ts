export interface SyncRecord {
  id: string;
  kind: "calendar_upsert" | "calendar_delete" | "gmail_send";
  localId: string;
  state: "pending" | "sending" | "done" | "failed" | "uncertain" | "cancelled";
  attempts: number;
  message: string;
  updatedAt: string;
}
export interface GoogleStatus {
  connected: boolean;
  email: string | null;
  calendar: boolean;
  gmail: boolean;
  authorizing: boolean;
  queue: SyncRecord[];
}
export interface GoogleConnect {
  clientId: string;
  clientSecret: string;
  calendar: boolean;
  gmail: boolean;
}
export type GoogleAction =
  | { kind: "recoverCalendar"; id: string }
  | { kind: "cancelAuthorization" }
  | { kind: "disconnect" }
  | { kind: "queueTask"; taskId: string; consent: boolean }
  | { kind: "deleteEvent"; taskId: string; consent: boolean }
  | {
      kind: "queueEmail";
      id: string;
      subject: string;
      body: string;
      sendAfter: string;
      consent: boolean;
    }
  | { kind: "processQueue" }
  | { kind: "cancelJob"; id: string };
export interface GoogleApi {
  status(): Promise<GoogleStatus>;
  begin(input: GoogleConnect): Promise<void>;
  action(action: GoogleAction): Promise<void>;
}
export const syncStates = {
  pending: "Pendente",
  sending: "Enviando",
  done: "Confirmado",
  failed: "Falhou",
  uncertain: "Resultado incerto",
  cancelled: "Cancelado",
};
