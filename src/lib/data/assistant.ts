import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escapeSearchTerm } from "@/lib/data/documents";
import { AI_DRAFT_STATUSES, DRAFTS_PAGE_SIZE, type AiDraftStatusValue } from "@/lib/assistant/constants";
import { AI_READABLE_DOCUMENT_MIME_TYPES } from "@/lib/validation/schemas";
import type { AiDraft, AiDraftRevision } from "@/types/database";

/**
 * Lectures du module Assistant. Comme pour les documents, tout passe par le
 * client « serveur » : les politiques RLS décident, pas cette couche.
 */

export type DraftListParams = {
  q: string;
  status: AiDraftStatusValue | "tous";
  page: number;
};

export type DraftListResult = {
  items: AiDraft[];
  total: number;
  page: number;
  pageCount: number;
  degraded: boolean;
};

export const EMPTY_DRAFT_LIST: DraftListResult = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 1,
  degraded: false,
};

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseDraftListParams(
  searchParams: Record<string, string | string[] | undefined>,
): DraftListParams {
  const rawStatus = firstValue(searchParams.statut);
  const status = (AI_DRAFT_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as AiDraftStatusValue)
    : "tous";
  const rawPage = Number.parseInt(firstValue(searchParams.page), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 500) : 1;

  return { q: escapeSearchTerm(firstValue(searchParams.q)), status, page };
}

export function buildDraftsQuery(
  params: DraftListParams,
  overrides: Partial<DraftListParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (merged.q) search.set("q", merged.q);
  if (merged.status !== "tous") search.set("statut", merged.status);
  if (merged.page > 1) search.set("page", String(merged.page));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listDrafts(params: DraftListParams): Promise<DraftListResult> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("ai_drafts")
    .select(
      "id, title, brief, content, operation, source_text, document_id, target_language, external_sent, warnings, provider, model, status, created_by, reviewed_by, reviewed_at, created_at, updated_at",
      { count: "exact" },
    );

  if (params.status !== "tous") query = query.eq("status", params.status);
  if (params.q) {
    query = query.or(`title.ilike.%${params.q}%,brief.ilike.%${params.q}%`);
  }

  const from = (params.page - 1) * DRAFTS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + DRAFTS_PAGE_SIZE - 1);

  if (error) {
    return { ...EMPTY_DRAFT_LIST, degraded: true };
  }

  const total = count ?? data?.length ?? 0;
  return {
    items: (data ?? []) as AiDraft[],
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / DRAFTS_PAGE_SIZE)),
    degraded: false,
  };
}

export type DraftDetail = {
  draft: AiDraft | null;
  revisions: AiDraftRevision[];
  documentTitle: string | null;
  degraded: boolean;
};

export async function getDraft(id: string): Promise<DraftDetail> {
  if (!UUID_PATTERN.test(id)) {
    return { draft: null, revisions: [], documentTitle: null, degraded: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_drafts")
    .select(
      "id, title, brief, content, operation, source_text, document_id, target_language, external_sent, warnings, provider, model, status, created_by, reviewed_by, reviewed_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { draft: null, revisions: [], documentTitle: null, degraded: Boolean(error) };
  }

  const draft = data as AiDraft;

  const [revisionsResult, documentResult] = await Promise.all([
    supabase
      .from("ai_draft_revisions")
      .select("id, draft_id, content, status, external_sent, author_id, created_at")
      .eq("draft_id", draft.id)
      .order("created_at", { ascending: false })
      .limit(50),
    draft.document_id
      ? supabase.from("documents").select("id, title").eq("id", draft.document_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    draft,
    revisions: (revisionsResult.data ?? []) as AiDraftRevision[],
    documentTitle: documentResult.data?.title ?? null,
    degraded: Boolean(revisionsResult.error),
  };
}

export type SourceDocumentOption = { id: string; title: string };

/**
 * Documents dont le texte est lisible sans analyseur de fichier.
 *
 * Un PDF ou un DOCX demanderait une bibliothèque d'extraction : elle n'est pas
 * installée, et un « résumé » de fichier illisible serait une invention. Seuls
 * les formats texte sont donc proposés comme source.
 */
export async function listSourceDocuments(): Promise<SourceDocumentOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title")
    .in("mime_type", [...AI_READABLE_DOCUMENT_MIME_TYPES])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []) as SourceDocumentOption[];
}

export type DocumentSourceResult =
  | { ok: true; title: string; text: string }
  | { ok: false; reason: string };

/** Lit le contenu texte d'un document du module Documents, sous RLS. */
export async function readDocumentSource(id: string): Promise<DocumentSourceResult> {
  if (!UUID_PATTERN.test(id)) {
    return { ok: false, reason: "Document introuvable." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("documents")
    .select("id, title, mime_type, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) return { ok: false, reason: "Document introuvable ou non autorisé." };

  if (!(AI_READABLE_DOCUMENT_MIME_TYPES as readonly string[]).includes(row.mime_type)) {
    return {
      ok: false,
      reason:
        "Ce format n'est pas lisible sans outil d'extraction (PDF, Word). Collez le texte à traiter à la place.",
    };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("documents")
    .download(row.storage_path);

  if (downloadError || !file) {
    return { ok: false, reason: "Le fichier du document n'a pas pu être lu." };
  }

  return { ok: true, title: row.title, text: await file.text() };
}
