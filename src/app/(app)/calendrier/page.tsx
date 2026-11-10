import type { Metadata } from "next";
import { ModulePreview } from "@/components/layout/module-preview";

export const metadata: Metadata = { title: "Calendrier éditorial" };

export default function CalendrierPage() {
  return (
    <ModulePreview
      title="Calendrier éditorial"
      description="Planifier les prises de parole et les publications du service."
      table="calendar_entries"
      capabilities={[
        "Planification par canal : communiqué, réseaux sociaux, site institutionnel, discours, newsletter.",
        "Suivi du cycle de vie : idée, en préparation, en revue, prêt, publié, annulé.",
        "Rattachement des documents de référence à chaque échéance.",
        "Vue mensuelle et liste des prochaines échéances reprise sur le tableau de bord.",
      ]}
    />
  );
}
