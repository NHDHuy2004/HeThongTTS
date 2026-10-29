"use client";

import * as React from "react";

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
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const searchable = Boolean(searchText) || Boolean(searchKeys?.length);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    if (searchText) {
      return data.filter((row) => searchText(row).toLowerCase().includes(q));
    }
    if (!searchKeys?.length) return data;
    return data.filter((row) =>
      searchKeys.some((key) => {
        const value = (row as Record<string, unknown>)[key as string];
        if (value == null) return false;
        return String(value).toLowerCase().includes(q);
      }),
    );
  }, [data, query, searchKeys, searchText]);

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
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel ?? searchPlaceholder}
              className="h-9 w-full max-w-xs"
            />
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
        <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/70">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className={cn("font-semibold text-foreground/80 py-3 text-xs tracking-wider uppercase", col.className)}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => (
                <TableRow
                  key={rowKey ? rowKey(row) : i}
                  className="hover:bg-emerald-500/5 transition-colors border-b border-border/50 last:border-0"
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
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Số dòng mỗi trang"
            className="h-8 rounded-lg border bg-background px-2 text-xs"
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
            className="hover:border-emerald-600/40 hover:text-emerald-700"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hover:border-emerald-600/40 hover:text-emerald-700"
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
