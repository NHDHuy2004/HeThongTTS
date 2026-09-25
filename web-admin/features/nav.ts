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

export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "hr", "mentor", "intern"],
  },
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
  {
    href: "/tasks",
    label: "Công việc",
    icon: ListTodo,
    roles: ["admin", "hr", "mentor", "intern"],
  },
  {
    href: "/attendance",
    label: "Điểm danh",
    icon: Clock,
    roles: ["admin", "hr", "mentor", "intern"],
  },
  {
    href: "/requests",
    label: "Đơn từ",
    icon: Inbox,
    roles: ["admin", "hr", "mentor", "intern"],
  },
  {
    href: "/reports",
    label: "Báo cáo",
    icon: FileText,
    roles: ["admin", "hr", "mentor", "intern"],
  },
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
];

export function getNavItems(role: string): NavItem[] {
  return navItems.filter((item) =>
    item.roles.includes(role as UserRole),
  );
}