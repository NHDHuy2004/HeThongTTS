"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { roleLabel } from "@/features/labels";
import { logout } from "@/app/(auth)/login/actions";
import { Breadcrumbs } from "./breadcrumbs";
import { Sidebar } from "./sidebar";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

export function Topbar({
  user,
}: {
  user: { email: string; full_name: string; role: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Mở menu"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
        <SheetContent side="left" showCloseButton={false} className="w-72 max-w-[85vw] p-0">
          <SheetTitle className="sr-only">Điều hướng</SheetTitle>
          <Sidebar role={user.role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette role={user.role} />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-2 px-2" aria-label="Tài khoản">
                <Avatar aria-label={user.full_name} className="size-8 ring-2 ring-primary/20">
                  <span className="flex size-full items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground">
                    {getInitials(user.full_name)}
                  </span>
                </Avatar>
                <span className="hidden max-w-36 truncate text-sm font-medium md:inline">
                  {user.full_name}
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold">{user.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <Badge variant="success" className="mt-1.5 text-[11px]">
                  {roleLabel[user.role] ?? user.role}
                </Badge>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void logout();
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
