"use client";

import { Check, Send, Trash2, X } from "lucide-react";
import {
  deciderBrouillon,
  soumettreBrouillon,
  supprimerBrouillon,
} from "@/lib/actions/assistant";
import { Button } from "@/components/ui/button";
import type { AiDraftStatus } from "@/types/database";

/**
 * Les gestes qui font passer un brouillon d'un état à l'autre.
 *
 * Aucun de ces boutons n'est une garantie : chaque Server Action relit la
 * session et le rôle, et la base elle-même refuse une validation non
 * administrateur. Masquer un bouton n'a jamais protégé quoi que ce soit.
 */
export function DraftDecisionForm({
  id,
  status,
  title,
  isAdmin,
  canWrite,
}: {
  id: string;
  status: AiDraftStatus;
  title: string;
  isAdmin: boolean;
  canWrite: boolean;
}) {
  const canSubmit = canWrite && (status === "brouillon" || status === "rejete");
  const canDecide = isAdmin && status === "en_revue";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSubmit ? (
        <form action={soumettreBrouillon}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="secondary">
            <Send className="h-4 w-4" aria-hidden="true" />
            Soumettre à relecture
          </Button>
        </form>
      ) : null}

      {canDecide ? (
        <>
          <form action={deciderBrouillon}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="approuve" />
            <Button type="submit">
              <Check className="h-4 w-4" aria-hidden="true" />
              Approuver
            </Button>
          </form>
          <form action={deciderBrouillon}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="rejete" />
            <Button type="submit" variant="secondary">
              <X className="h-4 w-4" aria-hidden="true" />
              Rejeter
            </Button>
          </form>
        </>
      ) : null}

      {isAdmin ? (
        <form
          action={supprimerBrouillon}
          onSubmit={(event) => {
            const confirmed = window.confirm(
              `Supprimer définitivement « ${title} » ? Son historique sera perdu.`,
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
      ) : null}
    </div>
  );
}
