import type {
  AiDraftStatus,
  CalendarStatus,
  DocumentStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "@/types/database";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const relativeFormatter = new Intl.RelativeTimeFormat("fr-FR", {
  numeric: "auto",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

/** « il y a 3 minutes », « demain »… Utilisé par le fil d'activité. */
export function formatRelative(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let duration = diffSeconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return relativeFormatter.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return relativeFormatter.format(Math.round(duration), "year");
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// --- Traductions des valeurs stockées --------------------------------------

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  editor: "Rédacteur",
  reader: "Lecteur",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  brouillon: "Brouillon",
  en_revue: "En revue",
  valide: "Validé",
  archive: "Archivé",
};

export const AI_DRAFT_STATUS_LABELS: Record<AiDraftStatus, string> = {
  brouillon: "Brouillon",
  en_revue: "En revue",
  approuve: "Approuvé",
  rejete: "Rejeté",
};

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  idee: "Idée",
  en_preparation: "En préparation",
  en_revue: "En revue",
  pret: "Prêt",
  publie: "Publié",
  annule: "Annulé",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  bloque: "Bloqué",
  termine: "Terminé",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
};
