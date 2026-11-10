import type { Metadata } from "next";
import { ModulePreview } from "@/components/layout/module-preview";

export const metadata: Metadata = { title: "Rapports d'activité" };

export default function RapportsPage() {
  return (
    <ModulePreview
      title="Rapports d'activité"
      description="Produire des synthèses périodiques à partir du journal d'activité."
      table="activity_log"
      capabilities={[
        "Synthèse mensuelle : documents déposés, brouillons produits et relus, publications réalisées.",
        "Journal d'activité alimenté automatiquement par déclencheurs SQL, non modifiable depuis l'application.",
        "Export du rapport en PDF pour transmission hiérarchique.",
      ]}
    />
  );
}
