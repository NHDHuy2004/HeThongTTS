import { createAdminClient } from "../_shared/supabase.ts";
import { AppError, errorFrom, errorJson, json } from "../_shared/errors.ts";
import { handleCors } from "../_shared/cors.ts";

type CheckInPayload = {
  latitude: number;
  longitude: number;
  internship_id?: string;
  check_out?: boolean;
  note?: string;
};

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // bán kính trái đất (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function todayInHanoi(now: Date): string {
  // Server chạy UTC; tính theo múi giờ Việt Nam (+7) cho ngày công.
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}

function vnTimeParts(now: Date): { hours: number; minutes: number } {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { hours: vn.getUTCHours(), minutes: vn.getUTCMinutes() };
}

async function getSystemSetting(key: string): Promise<Record<string, unknown> | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as Record<string, unknown> | null) ?? null;
}

function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST", 405);
    }

    const body = (await req.json().catch(() => null)) as CheckInPayload | null;
    if (!body) return errorJson("VALIDATION_ERROR", "Body không hợp lệ");

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return errorJson("VALIDATION_ERROR", "Thiếu tọa độ GPS hợp lệ");
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return errorJson("VALIDATION_ERROR", "Tọa độ GPS ngoài phạm vi hợp lệ");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorJson("AUTH_ERROR", "Vui lòng đăng nhập", 401);
    }
    const accessToken = authHeader.slice(7);

    const supabase = createAdminClient();

    // 1. Xác thực user
    const { data: user, error: userErr } = await supabase.auth.getUser(accessToken);
    if (userErr || !user.user) return errorJson("AUTH_ERROR", "Phiên đăng nhập không hợp lệ", 401);

    // 2. Tìm intern ứng với user
    const { data: intern } = await supabase
      .from("interns")
      .select("id, user_id")
      .eq("user_id", user.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!intern) return errorJson("NOT_FOUND", "Không tìm thấy hồ sơ thực tập sinh", 404);

    // 3. Xác định internship đang active
    let internshipId = body.internship_id ?? null;
    if (!internshipId) {
      const { data: active } = await supabase
        .from("internships")
        .select("id")
        .eq("intern_id", intern.id)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();
      internshipId = active?.id ?? null;
    }
    if (!internshipId) {
      return errorJson("GPS_VALIDATION_ERROR", "Bạn chưa có đợt thực tập đang hoạt động", 403);
    }

    // 4. Validate GPS theo attendance_locations (server-side — chống gian lận)
    const { data: locations } = await supabase
      .from("attendance_locations")
      .select("id, name, latitude, longitude, radius_m, is_active")
      .eq("is_active", true);

    let matched: (typeof locations)[number] | null = null;
    let minDistance = Number.POSITIVE_INFINITY;
    for (const loc of locations ?? []) {
      const dist = haversineDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
      if (dist <= Number(loc.radius_m) && dist < minDistance) {
        matched = loc;
        minDistance = dist;
      }
    }
    if (!matched) {
      return errorJson(
        "GPS_VALIDATION_ERROR",
        "Vị trí của bạn nằm ngoài phạm vi cho phép điểm danh",
      );
    }

    const workDate = todayInHanoi(new Date());
    const { hours, minutes } = vnTimeParts(new Date());
    const currentMin = hours * 60 + minutes;

    const settings = (await getSystemSetting("attendance")) ?? {};
    const checkInStart = minutesOf(settings.check_in_start as string);
    const checkInLate = minutesOf(settings.check_in_late as string);
    const checkOutStart = minutesOf(settings.check_out_start as string);

    // 5. Đã có bản ghi điểm danh hôm nay?
    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("intern_id", intern.id)
      .eq("work_date", workDate)
      .maybeSingle();

    if (body.check_out) {
      if (!existing?.check_in_at) {
        return errorJson("GPS_VALIDATION_ERROR", "Chưa check-in trong ngày", 400);
      }
      // Sớm hơn khung giờ chuẩn về → early_leave
      let status = existing.status;
      if (checkOutStart != null && currentMin < checkOutStart && status !== "leave") {
        status = "early_leave";
      }
      const { data, error } = await supabase
        .from("attendance")
        .update({ check_out_at: new Date().toISOString(), status, note: body.note ?? existing.note })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new AppError("DB_ERROR", error.message, 500, error);
      return json({ success: true, check_out: true, record: data }, 200);
    }

    // Check-in
    if (existing?.check_in_at) {
      return json(
        {
          success: true,
          already: true,
          record: existing,
          message: "Bạn đã check-in trong ngày hôm nay",
        },
        200,
      );
    }

    let status: "present" | "late";
    if (checkInStart != null && currentMin < checkInStart) {
      status = "present"; // check-in sớm vẫn tính có mặt (theo cấu hình giờ bắt đầu)
    } else if (checkInLate != null && currentMin > checkInLate) {
      status = "late";
    } else {
      status = "present";
    }

    const { data: created, error: insertErr } = await supabase
      .from("attendance")
      .insert({
        intern_id: intern.id,
        internship_id: internshipId,
        location_id: matched.id,
        work_date: workDate,
        check_in_at: new Date().toISOString(),
        status,
        is_geo_validated: true,
        note: body.note,
      })
      .select()
      .single();

    if (insertErr) throw new AppError("DB_ERROR", insertErr.message, 500, insertErr);

    return json({ success: true, check_out: false, record: created, status }, 201);
  } catch (e) {
    return errorFrom(e);
  }
});