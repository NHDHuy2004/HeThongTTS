"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { routeLabel } from "@/features/nav";

/**
 * Tự sinh breadcrumb từ pathname + bảng `routeLabels`.
 * Ẩn trên màn hình nhỏ; ẩn luôn ở trang đầu tiên (vd. /dashboard).
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments
    .map((segment, i) => {
      const href = `/${segments.slice(0, i + 1).join("/")}`;
      const label = routeLabel(href);
      return label ? { href, label } : null;
    })
    .filter((crumb): crumb is { href: string; label: string } => crumb !== null);

  if (crumbs.length <= 1) return null;

  const truncated = crumbs.length > 3;
  const visible = truncated ? [crumbs[0], ...crumbs.slice(-2)] : crumbs;

  return (
    <Breadcrumb className="hidden min-w-0 sm:flex">
      <BreadcrumbList className="min-w-0">
        {visible.map((crumb, i) => {
          const isLast = i === visible.length - 1;
          const showEllipsis = truncated && i === 1;
          return (
            <Fragment key={crumb.href}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              {showEllipsis ? (
                <Fragment>
                  <BreadcrumbItem>
                    <BreadcrumbEllipsis />
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              ) : null}
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />} className="truncate">
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
