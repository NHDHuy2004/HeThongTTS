import { Badge } from "@/components/ui/badge";
import {
  getStatusLabel,
  getStatusVariant,
} from "@/features/labels";

export function StatusBadge({ value }: { value?: string | null }) {
  return (
    <Badge variant={getStatusVariant(value ?? "")}>
      {getStatusLabel(value)}
    </Badge>
  );
}