// Thống kê điểm danh — tính phía SERVER (Server Component / page) từ dữ liệu
// thật trong PostgreSQL. Không tính lại toàn bộ dữ liệu ở client.
//
// Quy ước:
// - "Hôm nay" = ngày theo múi giờ Asia/Ho_Chi_Minh (khớp cách RPC
//   `attendance_check` tính `work_date` ở backend — xem 0016 L261).
// - Tỷ lệ chuyên cần khớp KPI hệ thống (`attendance_rate` trong 0004):
//   (present + late) / tổng bản ghi.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type StatusRow = {
  status: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
};

export type AttendanceSummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  wfh: number;
  earlyLeave: number;
  /** Bản ghi đã check-in nhưng chưa check-out. */
  missingCheckout: number;
  /** Phần trăm — làm tròn 1 chữ số. */
  attendanceRate: number;
};

export type TodayAttendanceStats = {
  /** Số bản ghi điểm danh trong ngày. */
  records: number;
  /** Số người đã check-in. */
  checkedIn: number;
  late: number;
  absent: number;
  /** Đã check-in nhưng chưa check-out. */
  missingCheckout: number;
  /** Số bản ghi nghỉ phép / WFH trong ngày (không cần check-in GPS). */
  onLeave: number;
  workFromHome: number;
};

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD). */
export function getTodayVN(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Cộng dồn thống kê từ danh sách bản ghi (đã được RLS scope sẵn). */
export function summarizeAttendance(rows: StatusRow[]): AttendanceSummary {
  const summary: AttendanceSummary = {
    total: rows.length,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    wfh: 0,
    earlyLeave: 0,
    missingCheckout: 0,
    attendanceRate: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case "present":
        summary.present += 1;
        break;
      case "late":
        summary.late += 1;
        break;
      case "absent":
        summary.absent += 1;
        break;
      case "leave":
        summary.leave += 1;
        break;
      case "wfh":
        summary.wfh += 1;
        break;
      case "early_leave":
        summary.earlyLeave += 1;
        break;
    }
    if (row.check_in_at && !row.check_out_at) summary.missingCheckout += 1;
  }

  summary.attendanceRate =
    summary.total === 0
      ? 0
      : round1((100 * (summary.present + summary.late)) / summary.total);

  return summary;
}

/**
 * Thống kê "hôm nay" — một query nhẹ theo `work_date` (dùng index
 * `idx_attendance_work_date`). Tự scope theo RLS của người gọi.
 */
export async function getTodayAttendanceStats(
  supabase: SupabaseClient<Database>,
): Promise<TodayAttendanceStats> {
  const empty: TodayAttendanceStats = {
    records: 0,
    checkedIn: 0,
    late: 0,
    absent: 0,
    missingCheckout: 0,
    onLeave: 0,
    workFromHome: 0,
  };

  const { data, error } = await supabase
    .from("attendance")
    .select("status, check_in_at, check_out_at")
    .eq("work_date", getTodayVN());

  if (error) {
    // Không làm hỏng trang nếu query lỗi — trả số 0 và ghi log server-side.
    console.error("[attendance-stats] today query failed", error.message);
    return empty;
  }

  const rows = (data ?? []) as StatusRow[];
  const stats = summarizeAttendance(rows);
  return {
    records: rows.length,
    checkedIn: rows.filter((row) => Boolean(row.check_in_at)).length,
    late: stats.late,
    absent: stats.absent,
    missingCheckout: stats.missingCheckout,
    onLeave: stats.leave,
    workFromHome: stats.wfh,
  };
}
