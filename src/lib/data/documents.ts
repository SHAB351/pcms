import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOCUMENTS_PAGE_SIZE, DOCUMENT_STATUSES } from "@/lib/documents/constants";
import type { DocumentRecord, DocumentStatus } from "@/types/database";

/**
 * Lecture des documents. Toutes les requêtes passent par le client « serveur »,
 * donc par les politiques RLS de l'utilisateur connecté : aucune lecture
 * privilégiée n'est faite ici.
 */

export type DocumentListParams = {
  q: string;
  category: string;
  status: DocumentStatus | "tous";
  page: number;
};

export type DocumentListResult = {
  items: DocumentRecord[];
  total: number;
  page: number;
  pageCount: number;
  categories: string[];
  /** `true` si une requête a échoué : l'interface l'affiche explicitement. */
  degraded: boolean;
};

export const EMPTY_DOCUMENT_LIST: DocumentListResult = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 1,
  categories: [],
  degraded: false,
};

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Neutralise un terme de recherche avant de l'insérer dans un filtre PostgREST.
 *
 * `.or()` construit une expression dont la syntaxe utilise `,` `(` `)` et les
 * guillemets ; `%` et `_` sont des jokers pour `ilike`. Laisser passer ces
 * caractères permettrait de modifier la requête elle-même. Ils sont remplacés
 * par une espace, ce qui ne change pas sensiblement le résultat pour un usager.
 */
export function escapeSearchTerm(term: string): string {
  return term
    .replace(/[%_\\,()"]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

export function parseDocumentListParams(
  searchParams: Record<string, string | string[] | undefined>,
): DocumentListParams {
  const rawStatus = firstValue(searchParams.statut);
  const status = DOCUMENT_STATUSES.includes(rawStatus as DocumentStatus)
    ? (rawStatus as DocumentStatus)
    : "tous";

  const rawPage = Number.parseInt(firstValue(searchParams.page), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 500) : 1;

  return {
    q: escapeSearchTerm(firstValue(searchParams.q)),
    category: firstValue(searchParams.categorie).trim().slice(0, 80),
    status,
    page,
  };
}

/** Paramètres d'URL correspondants, pour construire les liens de pagination. */
export function buildDocumentsQuery(
  params: DocumentListParams,
  overrides: Partial<DocumentListParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();
  if (merged.q) query.set("q", merged.q);
  if (merged.category) query.set("categorie", merged.category);
  if (merged.status !== "tous") query.set("statut", merged.status);
  if (merged.page > 1) query.set("page", String(merged.page));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

/** Liste filtrée et paginée. */
export async function listDocuments(
  params: DocumentListParams,
): Promise<DocumentListResult> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * DOCUMENTS_PAGE_SIZE;
  const to = from + DOCUMENTS_PAGE_SIZE - 1;

  let query = supabase
    .from("documents")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) {
    const pattern = `%${params.q}%`;
    query = query.or(
      `title.ilike.${pattern},file_name.ilike.${pattern},description.ilike.${pattern}`,
    );
  }
  if (params.category) {
    query = query.eq("category", params.category);
  }
  if (params.status !== "tous") {
    query = query.eq("status", params.status);
  }

  const [documents, categories] = await Promise.all([
    query,
    supabase
      .from("documents")
      .select("category")
      .not("category", "is", null)
      .limit(1000),
  ]);

  const uniqueCategories = Array.from(
    new Set(
      (categories.data ?? [])
        .map((row) => (row as { category: string | null }).category)
        .filter((value): value is string => Boolean(value && value.trim())),
    ),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  const total = documents.count ?? 0;

  return {
    items: documents.data ?? [],
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PAGE_SIZE)),
    categories: uniqueCategories,
    degraded: Boolean(documents.error || categories.error),
  };
}

/** Un document par son identifiant, ou `null` s'il n'existe pas ou n'est pas lisible. */
export async function getDocument(
  id: string,
): Promise<{ document: DocumentRecord | null; degraded: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { document: null, degraded: false };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return { document: data ?? null, degraded: Boolean(error) };
}
