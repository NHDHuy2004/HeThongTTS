import { formatDate, formatDateTime } from "@/features/labels";
import { REPORT_FIELDS } from "./constants";

type LinkItem = { url?: string; label?: string } | string;

function normalizeLinks(links: unknown): LinkItem[] {
  if (!Array.isArray(links)) return [];
  return links as LinkItem[];
}

export function ReportContent({
  reportType,
  content,
}: {
  reportType: string;
  content: unknown;
}) {
  const fields = REPORT_FIELDS[reportType] ?? [];
  const obj = (content && typeof content === "object" && !Array.isArray(content)
    ? content
    : {}) as Record<string, unknown>;

  return (
    <div className="grid gap-4">
      {fields.map((f) => {
        const value = obj[f.key];
        if (value === null || value === undefined || String(value).trim() === "") {
          return null;
        }
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
            <p className="whitespace-pre-wrap text-sm">{String(value)}</p>
          </div>
        );
      })}
      {fields.every((f) => !obj[f.key]) ? (
        <p className="text-sm text-muted-foreground">Chưa có nội dung.</p>
      ) : null}
    </div>
  );
}

export function ReportLinks({ links }: { links: unknown }) {
  const items = normalizeLinks(links);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((l, i) => {
        const url = typeof l === "string" ? l : (l.url ?? "");
        const label = typeof l === "string" ? l : (l.label ?? l.url ?? "");
        if (!url) return null;
        return (
          <li key={`${url}-${i}`} className="text-sm">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function ReportVersionsList({
  versions,
}: {
  versions: {
    id: string;
    version_number: number;
    submitted_at: string;
    profiles: { full_name: string } | null;
  }[];
}) {
  if (versions.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {[...versions]
        .sort((a, b) => b.version_number - a.version_number)
        .map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border px-1.5 py-0.5 text-xs font-medium">
              Phiên bản {v.version_number}
            </span>
            <span className="text-muted-foreground">{formatDateTime(v.submitted_at)}</span>
            <span className="text-muted-foreground">
              {v.profiles?.full_name ?? "—"}
            </span>
          </li>
        ))}
    </ul>
  );
}

export function ReportMeta({
  dueDate,
  submittedAt,
  reviewedAt,
}: {
  dueDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}) {
  return (
    <>
      <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
        <span className="text-muted-foreground">Hạn nộp</span>
        <span className="font-medium">{formatDate(dueDate)}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
        <span className="text-muted-foreground">Nộp lúc</span>
        <span className="font-medium">{formatDateTime(submittedAt)}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
        <span className="text-muted-foreground">Phê duyệt lúc</span>
        <span className="font-medium">{formatDateTime(reviewedAt)}</span>
      </div>
    </>
  );
}
