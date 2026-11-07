"use client";

import * as React from "react";

import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

export type DataTableEmptyState = {
  title?: string;
  description?: string;
};

const PAGE_SIZES = [10, 25, 50, 100];

function getNestedValue(record: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return record[path];
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, record);
}

export function DataTable<T>({
  data,
  columns,
  searchKeys,
  searchText,
  searchPlaceholder = "Tìm kiếm...",
  searchLabel,
  toolbar,
  emptyState,
  rowKey,
  pageSize: initialPageSize = 25,
}: {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T | string)[];
  /** Hàm nối chuỗi tìm kiếm cho cột lồng nhau (vd. `interns.full_name`). */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Vùng bộ lọc/hiện count đặt cạnh ô tìm kiếm. */
  toolbar?: React.ReactNode;
  emptyState?: DataTableEmptyState;
  rowKey?: (row: T) => string;
  pageSize?: number;
}) {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const searchable = Boolean(searchText) || Boolean(searchKeys?.length);

  // Debounce 300ms: input hiển thị ngay (query), nhưng việc filter + render
  // lại bảng chỉ chạy khi người dùng ngừng gõ — giảm re-render với bảng lớn.
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const rows = React.useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return data;
    if (searchText) {
      return data.filter((row) => searchText(row).toLowerCase().includes(q));
    }
    if (!searchKeys?.length) return data;
    return data.filter((row) =>
      searchKeys.some((key) => {
        const value = getNestedValue(row as Record<string, unknown>, String(key));
        if (value == null) return false;
        return String(value).toLowerCase().includes(q);
      }),
    );
  }, [data, debouncedQuery, searchKeys, searchText]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-3">
      {searchable || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {searchable ? (
            <div className="relative w-full max-w-xs flex-1 sm:flex-none">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchLabel ?? searchPlaceholder}
                className="h-9 w-full pl-8 pr-8"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => onQueryChange("")}
                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={emptyState?.title ?? "Không tìm thấy dữ liệu"}
          description={
            emptyState?.description ??
            "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
          <Table>
            <TableHeader className="border-b border-border/70 bg-muted/40">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className={cn("py-3 text-xs font-semibold uppercase tracking-wider text-foreground/80", col.className)}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => (
                <TableRow
                  key={rowKey ? rowKey(row) : i}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-primary/5"
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn("py-3 text-sm", col.className)}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          Trang <span className="font-semibold text-foreground">{safePage}</span> / {totalPages} · {rows.length} dòng
        </p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="data-table-page-size">
            Số dòng mỗi trang
          </label>
          <select
            id="data-table-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Số dòng mỗi trang"
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} dòng
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
