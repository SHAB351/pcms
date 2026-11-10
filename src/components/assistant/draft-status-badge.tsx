import { Badge } from "@/components/ui/badge";
import { DRAFT_STATUS_LABELS, type AiDraftStatusValue } from "@/lib/assistant/constants";
import type { AiDraftStatus } from "@/types/database";

const TONES: Record<AiDraftStatusValue, "neutral" | "info" | "success" | "danger"> = {
  brouillon: "neutral",
  en_revue: "info",
  approuve: "success",
  rejete: "danger",
};

export function DraftStatusBadge({ status }: { status: AiDraftStatus }) {
  return <Badge tone={TONES[status]}>{DRAFT_STATUS_LABELS[status]}</Badge>;
}
