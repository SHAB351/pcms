import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { DOCUMENT_STATUSES } from "@/lib/documents/constants";
import type { DocumentListParams } from "@/lib/data/documents";
import { DOCUMENT_STATUS_LABELS } from "@/lib/format";

/**
 * Filtres de la liste. Formulaire GET simple : l'état de la recherche vit dans
 * l'URL, donc il est partageable, rechargeable et compatible avec le rendu
 * serveur — aucun état client à maintenir.
 */
export function DocumentFilters({
  params,
  categories,
}: {
  params: DocumentListParams;
  categories: string[];
}) {
  const hasFilters =
    params.q !== "" || params.category !== "" || params.status !== "tous";

  return (
    <form action="/documents" method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="q">Recherche</Label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={params.q}
          placeholder="Titre, nom de fichier, description"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categorie">Catégorie</Label>
        <Select id="categorie" name="categorie" defaultValue={params.category}>
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="statut">Statut</Label>
        <Select id="statut" name="statut" defaultValue={params.status}>
          <option value="tous">Tous</option>
          {DOCUMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DOCUMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit">
          <Search className="h-4 w-4" aria-hidden="true" />
          Filtrer
        </Button>
        {hasFilters ? (
          <Link
            href="/documents"
            className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Réinitialiser
          </Link>
        ) : null}
      </div>
    </form>
  );
}
