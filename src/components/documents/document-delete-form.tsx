"use client";

import { Trash2 } from "lucide-react";
import { supprimerDocument } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";

/**
 * Suppression définitive. La confirmation est demandée côté navigateur, mais la
 * décision reste serveur : RLS n'autorise la suppression qu'aux administrateurs.
 */
export function DocumentDeleteForm({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={supprimerDocument}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Supprimer définitivement « ${name} » ? Le fichier sera retiré du stockage et la fiche ne pourra pas être restaurée.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Supprimer
      </Button>
    </form>
  );
}
