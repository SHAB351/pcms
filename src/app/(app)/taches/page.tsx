import type { Metadata } from "next";
import { ModulePreview } from "@/components/layout/module-preview";

export const metadata: Metadata = { title: "Tâches" };

export default function TachesPage() {
  return (
    <ModulePreview
      title="Tâches"
      description="Suivre les travaux en cours, les responsables et les échéances."
      table="tasks"
      capabilities={[
        "Création de tâches avec priorité, échéance et responsable.",
        "Statuts : à faire, en cours, bloqué, terminé.",
        "Rattachement facultatif à une échéance du calendrier éditorial.",
        "Le responsable peut faire avancer sa tâche même avec un rôle en lecture seule.",
      ]}
    />
  );
}
