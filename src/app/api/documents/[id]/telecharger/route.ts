import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDocument } from "@/lib/data/documents";
import { createSignedDownloadUrl } from "@/lib/documents/storage";

export const dynamic = "force-dynamic";

/**
 * Téléchargement d'un document.
 *
 * Le fichier n'est jamais servi directement : l'application vérifie la session,
 * relit la fiche (donc RLS), puis redirige vers une URL signée valable une
 * minute et forcée en pièce jointe. Aucun lien permanent n'est créé, et un lien
 * copié cesse de fonctionner presque aussitôt.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { erreur: "Authentification requise." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { id } = await params;
  const { document } = await getDocument(id);
  if (!document) {
    return NextResponse.json(
      { erreur: "Document introuvable." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const signedUrl = await createSignedDownloadUrl(
    document.storage_path,
    document.file_name,
  );
  if (!signedUrl) {
    return NextResponse.json(
      { erreur: "Le lien de téléchargement n'a pas pu être généré." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const response = NextResponse.redirect(signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
