import { Badge } from "@/components/ui/badge";
import { DOCUMENT_STATUS_LABELS } from "@/lib/format";
import type { DocumentStatus } from "@/types/database";

const TONES: Record<DocumentStatus, "neutral" | "info" | "success" | "warning"> = {
  brouillon: "neutral",
  en_revue: "info",
  valide: "success",
  archive: "warning",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={TONES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}
