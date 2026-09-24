"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { roleLabel } from "@/features/labels";
import { logout } from "@/app/(auth)/login/actions";
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

      <div className="hidden items-center gap-1 text-sm sm:flex">
        <span className="font-medium">{user.full_name}</span>
        <span className="text-muted-foreground">
          · {roleLabel[user.role] ?? user.role}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Avatar className="size-8" aria-label={user.full_name}>
          <span className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold">
            {user.full_name.slice(0, 2).toUpperCase()}
          </span>
        </Avatar>
        <Separator orientation="vertical" className="h-5" />
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Đăng xuất
          </Button>
        </form>
      </div>
    </header>
  );
}