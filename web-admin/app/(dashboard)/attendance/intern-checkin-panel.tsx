"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LogIn, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/features/labels";

/**
 * Bảng điểm danh GPS cho Intern (web).
 *
 * Client CHỈ lấy tọa độ GPS rồi gọi POST /api/attendance/check —
 * toàn bộ xác minh địa điểm / bán kính / khung giờ / lưu bản ghi đều do
 * Postgres (`attendance_check`) quyết định với thời gian server. Không tin
 * user_id, trạng thái hay kết quả xác minh do client gửi lên.
 */

export type TodayAttendance = {
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
} | null;

type PendingAction = "CHECK_IN" | "CHECK_OUT" | null;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(Object.assign(new Error("no-geo"), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

function geoErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? Number((error as { code: number }).code)
      : 0;
  switch (code) {
    case 1:
      return "Bạn chưa cấp quyền truy cập vị trí. Vui lòng cho phép quyền Vị trí trong trình duyệt rồi thử lại.";
    case 2:
      return "Không thể xác định vị trí. Vui lòng bật GPS và thử lại.";
    case 3:
      return "Hết thời gian lấy vị trí GPS. Vui lòng thử lại.";
    default:
      return "Thiết bị không hỗ trợ hoặc không lấy được vị trí GPS.";
  }
}

type CheckResponse = {
  success?: boolean;
  message?: string;
  distance_meters?: number | null;
  error?: { code?: string; message?: string };
};

export function InternCheckinPanel({ today }: { today: TodayAttendance }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [accuracy, setAccuracy] = React.useState<number | null>(null);

  const checkedIn = Boolean(today?.check_in_at);
  const checkedOut = Boolean(today?.check_out_at);
  const action: PendingAction = !checkedIn
    ? "CHECK_IN"
    : !checkedOut
      ? "CHECK_OUT"
      : null;

  async function run() {
    if (!action || pending) return;
    setPending(action);

    try {
      let position: GeolocationPosition;
      try {
        position = await getPosition();
      } catch (geoError) {
        toast.error(geoErrorMessage(geoError));
        return;
      }

      const { latitude, longitude, accuracy: acc } = position.coords;
      if (!Number.isFinite(acc) || acc <= 0) {
        toast.error(
          "Không đọc được độ chính xác GPS. Vui lòng bật GPS chế độ độ chính xác cao và thử lại.",
        );
        return;
      }
      setAccuracy(acc);

      // Gọi API phía server — server tự xác thực phiên và gọi RPC xác minh.
      let payload: CheckResponse | null = null;
      let response: Response;
      try {
        response = await fetch("/api/attendance/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, latitude, longitude, accuracy: acc }),
        });
        payload = (await response.json().catch(() => null)) as CheckResponse | null;
      } catch {
        toast.error(
          "Không thể kết nối tới dịch vụ điểm danh. Vui lòng kiểm tra mạng và thử lại.",
        );
        return;
      }

      if (!response.ok || payload?.error) {
        toast.error(
          payload?.error?.message ??
            "Không thể điểm danh. Vui lòng thử lại.",
        );
        return;
      }

      if (!payload?.success) {
        toast.error(payload?.message ?? "Điểm danh bị từ chối. Vui lòng thử lại.");
        return;
      }

      const distance =
        typeof payload.distance_meters === "number"
          ? ` (cách địa điểm ~${Math.round(payload.distance_meters)} m)`
          : "";
      toast.success(`${payload.message ?? "Điểm danh thành công."}${distance}`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-emerald-600" />
          Điểm danh hôm nay
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Giờ vào</span>
            <p className="font-medium">
              {today?.check_in_at ? formatDateTime(today.check_in_at) : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Giờ ra</span>
            <p className="font-medium">
              {today?.check_out_at ? formatDateTime(today.check_out_at) : "—"}
            </p>
          </div>
        </div>

        {checkedIn && checkedOut ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            Bạn đã hoàn tất điểm danh hôm nay.
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              onClick={() => void run()}
              disabled={Boolean(pending)}
              className="sm:w-auto"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : action === "CHECK_OUT" ? (
                <LogOut className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
              {action === "CHECK_OUT" ? "Check-out GPS" : "Check-in GPS"}
            </Button>
            <p className="text-xs text-muted-foreground sm:flex-1">
              Vị trí được xác minh phía máy chủ theo địa điểm làm việc và bán
              kính đã cấu hình.
              {accuracy != null
                ? ` Độ chính xác GPS hiện tại: ±${Math.round(accuracy)} m.`
                : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
