import { z } from "zod";

/**
 * Schémas de validation partagés.
 *
 * Chaque formulaire est validé côté serveur avec ces schémas : la validation
 * côté navigateur n'est qu'un confort d'usage et ne constitue jamais un
 * contrôle de sécurité.
 */

const trimmedText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} est obligatoire.` })
    .max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` });

// --- Authentification -------------------------------------------------------
export const loginSchema = z.object({
  email: z
    .email({ error: "Adresse e-mail invalide." })
    .transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." })
    .max(200, { error: "Le mot de passe est trop long." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// --- Documents --------------------------------------------------------------
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 Mio, aligné sur le bucket

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
] as const;

export const documentMetadataSchema = z.object({
  title: trimmedText("Le titre", 200),
  description: z
    .string()
    .trim()
    .max(2000, { error: "La description ne doit pas dépasser 2000 caractères." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  category: z
    .string()
    .trim()
    .max(80, { error: "La catégorie ne doit pas dépasser 80 caractères." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Vérifie le fichier lui-même (taille et type déclaré par le navigateur). */
export const documentFileSchema = z.object({
  file_name: trimmedText("Le nom du fichier", 255),
  mime_type: z.enum(ALLOWED_DOCUMENT_MIME_TYPES, {
    error: "Type de fichier non autorisé (PDF, Word, Excel, PowerPoint, texte, CSV, PNG ou JPEG).",
  }),
  size_bytes: z
    .number()
    .int()
    .positive({ error: "Le fichier est vide." })
    .max(MAX_DOCUMENT_BYTES, { error: "Le fichier dépasse la limite de 10 Mo." }),
});

// --- Assistant IA -----------------------------------------------------------
export const aiBriefSchema = z.object({
  title: trimmedText("Le titre du brouillon", 200),
  brief: trimmedText("La consigne", 4000),
  objective: z
    .string()
    .trim()
    .max(200, { error: "L'objectif ne doit pas dépasser 200 caractères." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  sourceMaterial: z
    .string()
    .trim()
    .max(20000, {
      error: "Les éléments de contexte ne doivent pas dépasser 20 000 caractères.",
    })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type AiBriefInput = z.infer<typeof aiBriefSchema>;

/** Texte qu'un document source peut fournir : sans analyseur, seuls ces types sont lisibles. */
export const AI_READABLE_DOCUMENT_MIME_TYPES = ["text/plain", "text/csv"] as const;

/**
 * Doit rester aligné sur `MAX_EXTERNAL_SOURCE_CHARS` dans
 * `src/lib/ai/confidentiality.ts` : un écart ferait accepter ici un texte que
 * l'envoi externe refusera, ou l'inverse. Vérifié par un test croisé dans
 * `tests/assistant.test.mjs`.
 */
export const AI_MAX_SOURCE_CHARS = 60_000;

export const assistantRequestSchema = z
  .object({
    operation: z.enum(
      ["correction", "amelioration", "reformulation", "resume", "traduction", "redaction"],
      { error: "Opération inconnue." },
    ),
    title: trimmedText("Le titre du brouillon", 200),
    brief: trimmedText("La consigne", 4000),
    objective: z
      .string()
      .trim()
      .max(200, { error: "L'objectif ne doit pas dépasser 200 caractères." })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    sourceText: z
      .string()
      .trim()
      .max(AI_MAX_SOURCE_CHARS, {
        error: `Le texte à traiter ne doit pas dépasser ${AI_MAX_SOURCE_CHARS} caractères.`,
      })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    documentId: z
      .uuid({ error: "Document invalide." })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    targetLanguage: z
      .string()
      .trim()
      .max(40, { error: "La langue cible ne doit pas dépasser 40 caractères." })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    maxWords: z.coerce
      .number()
      .int()
      .min(50, { error: "Indiquez au moins 50 mots." })
      .max(5000, { error: "Indiquez au plus 5000 mots." })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    /** Case cochée par l'utilisateur : autorisation d'envoi externe pour CETTE requête. */
    externalAuthorized: z
      .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
      .transform((value) => value === "on" || value === "true"),
  })
  .superRefine((value, ctx) => {
    const needsSource = value.operation !== "redaction";
    if (needsSource && !value.sourceText && !value.documentId) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceText"],
        message: "Fournissez le texte à traiter ou choisissez un document.",
      });
    }
    if (value.sourceText && value.documentId) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceText"],
        message: "Choisissez une seule source : le texte collé ou un document.",
      });
    }
    if (value.operation === "traduction" && !value.targetLanguage) {
      ctx.addIssue({
        code: "custom",
        path: ["targetLanguage"],
        message: "Indiquez la langue de traduction.",
      });
    }
  });

export type AssistantRequestInput = z.infer<typeof assistantRequestSchema>;

export const aiDraftContentSchema = z.object({
  title: trimmedText("Le titre", 200),
  content: z
    .string()
    .trim()
    .min(1, { error: "Le texte du brouillon est vide." })
    .max(100_000, { error: "Le brouillon ne doit pas dépasser 100 000 caractères." }),
});

export type AiDraftContentInput = z.infer<typeof aiDraftContentSchema>;

// --- Calendrier éditorial ---------------------------------------------------
export const CALENDAR_CHANNELS = [
  "Communiqué de presse",
  "Réseaux sociaux",
  "Site institutionnel",
  "Discours",
  "Newsletter",
  "Autre",
] as const;

export const calendarEntrySchema = z.object({
  title: trimmedText("Le titre", 200),
  channel: z.enum(CALENDAR_CHANNELS, { error: "Canal invalide." }),
  summary: z
    .string()
    .trim()
    .max(2000, { error: "Le résumé ne doit pas dépasser 2000 caractères." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  planned_for: z.coerce.date({ error: "Date de publication invalide." }),
});

// --- Tâches -----------------------------------------------------------------
export const taskSchema = z.object({
  title: trimmedText("Le titre", 200),
  details: z
    .string()
    .trim()
    .max(4000, { error: "Les détails ne doivent pas dépasser 4000 caractères." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  priority: z.enum(["basse", "normale", "haute"]).default("normale"),
  due_at: z.coerce.date().optional().nullable(),
  assignee_id: z.uuid({ error: "Utilisateur invalide." }).optional().nullable(),
});
