"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Điều hướng</SheetTitle>
          <Sidebar role={user.role} />
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
                <Avatar className="size-8 ring-2 ring-emerald-600/20">
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-800 text-white text-xs font-bold shadow-xs">
                    {user.full_name.slice(0, 2).toUpperCase()}
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
                <span className="mt-1.5 inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold rounded-md bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {roleLabel[user.role] ?? user.role}
                </span>
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
