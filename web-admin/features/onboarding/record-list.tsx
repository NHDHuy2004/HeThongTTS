import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, getStatusLabel } from "@/features/labels";
import { ONBOARDING_RECORD_STATUSES } from "./constants";
import { OnboardingProgress } from "./progress";
import type { OnboardingListRecord, SelectOption } from "./types";
import type { OnboardingListFilters } from "./data";

function pageHref(
  basePath: string,
  filters: OnboardingListFilters,
  page: number,
  sort?: string,
  direction?: string,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.batchId) params.set("batch_id", filters.batchId);
  if (filters.departmentId) params.set("department_id", filters.departmentId);
  if (filters.startFrom) params.set("start_from", filters.startFrom);
  if (filters.startTo) params.set("start_to", filters.startTo);
  if (sort) params.set("sort", sort);
  if (direction) params.set("direction", direction);
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

function SortLink({
  basePath,
  filters,
  column,
  children,
}: {
  basePath: string;
  filters: OnboardingListFilters;
  column: string;
  children: React.ReactNode;
}) {
  const active = filters.sort === column;
  const direction = active && filters.direction === "asc" ? "desc" : "asc";
  return (
    <Link
      href={pageHref(basePath, filters, 1, column, direction)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {children}
      <span className="text-[10px]">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </Link>
  );
}

export function OnboardingRecordList({
  basePath,
  records,
  total,
  page,
  pageSize,
  filters,
  batches,
  departments,
}: {
  basePath: string;
  records: OnboardingListRecord[];
  total: number;
  page: number;
  pageSize: number;
  filters: OnboardingListFilters;
  batches: SelectOption[];
  departments: SelectOption[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  return (
    <div className="flex flex-col gap-4">
      <form action={basePath} method="get" className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-7">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={filters.q} placeholder="Tên hoặc mã hồ sơ" className="pl-8" />
        </div>
        <select name="status" defaultValue={filters.status ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">Tất cả trạng thái</option>
          {ONBOARDING_RECORD_STATUSES.map((status) => (
            <option key={status} value={status}>{getStatusLabel(status)}</option>
          ))}
        </select>
        <select name="batch_id" defaultValue={filters.batchId ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">Tất cả đợt thực tập</option>
          {batches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="department_id" defaultValue={filters.departmentId ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">Tất cả phòng ban</option>
          {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Input type="date" name="start_from" defaultValue={filters.startFrom} aria-label="Từ ngày bắt đầu" />
        <Input type="date" name="start_to" defaultValue={filters.startTo} aria-label="Đến ngày bắt đầu" />
        <div className="flex gap-2 xl:col-span-7">
          <Button type="submit" size="sm"><SlidersHorizontal />Áp dụng</Button>
          <Button type="button" size="sm" variant="outline" render={<Link href={basePath} />}>
            Đặt lại
          </Button>
        </div>
      </form>

      {records.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ onboarding" description="Tạo hồ sơ mới hoặc điều chỉnh bộ lọc." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã hồ sơ</TableHead>
                <TableHead>Thực tập sinh</TableHead>
                <TableHead>Đợt / Phòng ban</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead><SortLink basePath={basePath} filters={filters} column="start_date">Ngày bắt đầu</SortLink></TableHead>
                <TableHead><SortLink basePath={basePath} filters={filters} column="due_date">Hạn hoàn thành</SortLink></TableHead>
                <TableHead><SortLink basePath={basePath} filters={filters} column="progress_percent">Checklist</SortLink></TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const overdue = record.due_date < new Date().toISOString().slice(0, 10)
                  && !["completed", "cancelled"].includes(record.status);
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-xs font-semibold">{record.code}</TableCell>
                    <TableCell>
                      <p className="font-medium">{record.intern?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{record.intern?.student_code ?? "—"}</p>
                    </TableCell>
                    <TableCell>
                      <p>{record.batch?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{record.department?.name ?? "Chưa gán phòng ban"}</p>
                    </TableCell>
                    <TableCell>{record.mentor?.full_name ?? "—"}</TableCell>
                    <TableCell>{formatDate(record.start_date)}</TableCell>
                    <TableCell className={overdue ? "font-medium text-red-600" : ""}>
                      {formatDate(record.due_date)}{overdue ? " · quá hạn" : ""}
                    </TableCell>
                    <TableCell className="min-w-32"><OnboardingProgress value={record.progress_percent} /></TableCell>
                    <TableCell><StatusBadge value={record.status} /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" render={<Link href={`${basePath}/${record.id}`} />}>
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Trang {safePage}/{totalPages} · {total} hồ sơ</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={safePage <= 1} render={<Link href={pageHref(basePath, filters, safePage - 1, filters.sort, filters.direction)} />}>
            Trước
          </Button>
          <Button size="sm" variant="outline" disabled={safePage >= totalPages} render={<Link href={pageHref(basePath, filters, safePage + 1, filters.sort, filters.direction)} />}>
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
