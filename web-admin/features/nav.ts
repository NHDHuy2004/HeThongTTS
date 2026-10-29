import {
  Award,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MapPin,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/database";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * Menu điều hướng chia theo nhóm chức năng.
 * Mỗi item giữ mảng `roles` — sidebar lọc theo role hiện tại,
 * nhóm rỗng sau khi lọc sẽ bị ẩn.
 */
export const navSections: NavSection[] = [
  {
    title: "Tổng quan",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "hr", "mentor", "intern"],
      },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      {
        href: "/interns",
        label: "Thực tập sinh",
        icon: Users,
        roles: ["admin", "hr", "mentor"],
      },
      {
        href: "/mentors",
        label: "Mentor",
        icon: UserCog,
        roles: ["admin", "hr"],
      },
      {
        href: "/departments",
        label: "Phòng ban",
        icon: Building2,
        roles: ["admin", "hr"],
      },
      {
        href: "/internship-batches",
        label: "Đợt thực tập",
        icon: CalendarRange,
        roles: ["admin", "hr"],
      },
    ],
  },
  {
    title: "Onboarding",
    items: [
      {
        href: "/admin/onboarding",
        label: "Onboarding",
        icon: ClipboardCheck,
        roles: ["admin", "hr"],
      },
      {
        href: "/mentor/onboarding",
        label: "Onboarding",
        icon: ClipboardCheck,
        roles: ["mentor"],
      },
      {
        href: "/intern/onboarding",
        label: "Onboarding",
        icon: ClipboardCheck,
        roles: ["intern"],
      },
    ],
  },
  {
    title: "Vận hành",
    items: [
      {
        href: "/tasks",
        label: "Công việc",
        icon: ListTodo,
        roles: ["admin", "hr", "mentor", "intern"],
      },
      {
        href: "/mentor/review",
        label: "Hàng đợi duyệt",
        icon: ClipboardCheck,
        roles: ["mentor"],
      },
      {
        href: "/admin/attendance",
        label: "Điểm danh",
        icon: Clock,
        roles: ["admin", "hr"],
      },
      {
        href: "/attendance",
        label: "Điểm danh",
        icon: Clock,
        roles: ["mentor", "intern"],
      },
      {
        href: "/admin/work-locations",
        label: "Địa điểm",
        icon: MapPin,
        roles: ["admin", "hr"],
      },
      {
        href: "/admin/requests",
        label: "Đơn từ",
        icon: Inbox,
        roles: ["admin", "hr", "mentor"],
      },
      {
        href: "/intern/requests",
        label: "Đơn từ",
        icon: Inbox,
        roles: ["intern"],
      },
      {
        href: "/admin/reports",
        label: "Báo cáo",
        icon: FileText,
        roles: ["admin", "hr", "mentor"],
      },
      {
        href: "/intern/reports",
        label: "Báo cáo",
        icon: FileText,
        roles: ["intern"],
      },
    ],
  },
  {
    title: "Kết quả",
    items: [
      {
        href: "/evaluations",
        label: "Đánh giá",
        icon: ClipboardList,
        roles: ["admin", "hr", "mentor", "intern"],
      },
      {
        href: "/certificates",
        label: "Chứng nhận",
        icon: Award,
        roles: ["admin", "hr", "intern"],
      },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      {
        href: "/users",
        label: "Người dùng",
        icon: Users,
        roles: ["admin"],
      },
      {
        href: "/settings",
        label: "Cấu hình",
        icon: Settings,
        roles: ["admin"],
      },
      {
        href: "/audit-logs",
        label: "Nhật ký hệ thống",
        icon: ScrollText,
        roles: ["admin"],
      },
    ],
  },
];

/** Danh sách phẳng (giữ tương thích ngược). */
export const navItems: NavItem[] = navSections.flatMap((section) => section.items);

export function getNavSections(role: string): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.roles.includes(role as UserRole),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function getNavItems(role: string): NavItem[] {
  return navItems.filter((item) =>
    item.roles.includes(role as UserRole),
  );
}

/** Nhãn đường dẫn cho breadcrumb (khớp theo prefix). */
export const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/interns": "Thực tập sinh",
  "/interns/new": "Thêm thực tập sinh",
  "/interns/import-jobs": "Lịch sử import",
  "/mentors": "Mentor",
  "/departments": "Phòng ban",
  "/internship-batches": "Đợt thực tập",
  "/onboarding": "Onboarding",
  "/admin/onboarding": "Onboarding",
  "/admin/onboarding/templates": "Mẫu onboarding",
  "/mentor/onboarding": "Onboarding",
  "/mentor/review": "Hàng đợi duyệt",
  "/intern/onboarding": "Onboarding",
  "/tasks": "Công việc",
  "/attendance": "Điểm danh",
  "/admin/attendance": "Điểm danh",
  "/admin/work-locations": "Địa điểm",
  "/requests": "Đơn từ",
  "/admin/requests": "Đơn từ",
  "/intern/requests": "Đơn từ",
  "/reports": "Báo cáo",
  "/admin/reports": "Báo cáo",
  "/intern/reports": "Báo cáo",
  "/intern/reports/new": "Tạo báo cáo",
  "/evaluations": "Đánh giá",
  "/evaluations/new": "Tạo đánh giá",
  "/certificates": "Chứng nhận",
  "/users": "Người dùng",
  "/settings": "Cấu hình",
  "/audit-logs": "Nhật ký hệ thống",
};

/** Trả nhãn cho một pathname cụ thể; null nếu không khớp route nào đã biết. */
export function routeLabel(href: string): string | null {
  const exact = routeLabels[href];
  if (exact) return exact;
  const parent = Object.keys(routeLabels)
    .filter((base) => href.startsWith(`${base}/`))
    .sort((a, b) => b.length - a.length)[0];
  return parent ? "Chi tiết" : null;
}
