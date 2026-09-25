"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/features/labels";
import type { NotificationsRow } from "@/types/database";
import { markOnboardingNotificationRead } from "./actions";

export function OnboardingNotificationList({ notifications }: { notifications: NotificationsRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!notifications.length) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4" />Thông báo onboarding</CardTitle></CardHeader>
      <CardContent className="divide-y px-0">
        {notifications.map((notification) => (
          <div key={notification.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-2 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-muted" : "bg-emerald-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{notification.title}</p>
              {notification.body ? <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(notification.created_at)}</p>
            </div>
            {!notification.read_at ? (
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                aria-label="Đánh dấu đã đọc"
                onClick={() => startTransition(async () => {
                  const result = await markOnboardingNotificationRead(notification.id);
                  if (result.error) return;
                  router.refresh();
                })}
              >
                <Check />
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
