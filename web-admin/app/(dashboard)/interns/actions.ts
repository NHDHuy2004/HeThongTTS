"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InternFormState = { error?: string };

type InternInput = {
  student_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  school: string | null;
  major: string | null;
  class_name: string | null;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  address: string | null;
  status: "pending" | "onboarding" | "active";
  batch_id: string | null;
  department_id: string | null;
  mentor_id: string | null;
  create_account: boolean;
  password?: string;
};

export async function createIntern(
  prevState: InternFormState,
  formData: FormData,
): Promise<InternFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") {
    return { error: "Bạn không có quyền tạo thực tập sinh." };
  }

  const input: InternInput = {
    student_code: String(formData.get("student_code") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: (formData.get("phone") as string) || null,
    school: (formData.get("school") as string) || null,
    major: (formData.get("major") as string) || null,
    class_name: (formData.get("class_name") as string) || null,
    gender: (formData.get("gender") as InternInput["gender"]) || null,
    birth_date: (formData.get("birth_date") as string) || null,
    address: (formData.get("address") as string) || null,
    status: (formData.get("status") as InternInput["status"]) || "pending",
    batch_id: (formData.get("batch_id") as string) || null,
    department_id: (formData.get("department_id") as string) || null,
    mentor_id: (formData.get("mentor_id") as string) || null,
    create_account: formData.get("create_account") === "on",
    password: (formData.get("password") as string) || undefined,
  };

  if (!input.student_code || !input.full_name || !input.email) {
    return { error: "Vui lòng nhập đủ mã SV, họ tên và email." };
  }

  let existingProfileId: string | null = null;
  let existingProfileRole: string | null = null;
  if (input.create_account) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, roles(code)")
      .ilike("email", input.email)
      .maybeSingle();
    const matchedProfile = profile as unknown as { id: string; roles: { code: string } | null } | null;
    existingProfileId = matchedProfile?.id ?? null;
    existingProfileRole = matchedProfile?.roles?.code ?? null;
  }

  if (input.create_account && !existingProfileId && (!input.password || input.password.length < 8)) {
    return { error: "Mật khẩu cho tài khoản phải có tối thiểu 8 ký tự." };
  }

  if (existingProfileId && existingProfileRole !== "intern") {
    return { error: "Email đã thuộc tài khoản không phải thực tập sinh." };
  }

  if (existingProfileId) {
    const { data: linkedIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", existingProfileId)
      .is("deleted_at", null)
      .maybeSingle();
    if (linkedIntern) {
      return { error: "Tài khoản này đã được liên kết với một hồ sơ thực tập sinh khác." };
    }
  }

  let user_id: string | null = existingProfileId;
  let createdUserId: string | null = null;
  if (input.create_account && !existingProfileId) {
    const admin = createAdminClient();
    const {
      data: authUser,
      error: authErr,
    } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name, role: "intern" },
    });
    if (authErr || !authUser.user) return { error: authErr?.message ?? "Không thể tạo tài khoản." };
    user_id = authUser.user.id;
    createdUserId = authUser.user.id;
  }

  // 2. Tạo hồ sơ intern
  const { data: intern, error } = await supabase
    .from("interns")
    .insert({
      user_id,
      student_code: input.student_code,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      school: input.school,
      major: input.major,
      class_name: input.class_name,
      gender: input.gender,
      birth_date: input.birth_date,
      address: input.address,
      status: input.status,
    })
    .select("id")
    .single();
  if (error) {
    if (createdUserId) {
      const admin = createAdminClient();
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return { error: error.message };
  }

  // 3. Gán vào đợt + phòng ban + mentor (nếu có)
  if (input.batch_id) {
    const { error: ipErr } = await supabase.from("internships").insert({
      intern_id: intern.id,
      batch_id: input.batch_id,
      department_id: input.department_id,
      mentor_id: input.mentor_id,
      status: "upcoming",
      created_by: user.id,
    });
    if (ipErr) {
      await supabase.from("interns").delete().eq("id", intern.id);
      if (createdUserId) {
        const admin = createAdminClient();
        await admin.auth.admin.deleteUser(createdUserId);
      }
      return { error: ipErr.message };
    }
  }

  return {};
}

export async function assignInternship(
  internId: string,
  formData: FormData,
): Promise<InternFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") {
    return { error: "Bạn không có quyền phân bổ." };
  }

  const batch_id = (formData.get("batch_id") as string) || null;
  if (!batch_id) return { error: "Vui lòng chọn đợt thực tập." };

  const { data: internship, error } = await supabase
    .from("internships")
    .insert({
      intern_id: internId,
      batch_id,
      department_id: (formData.get("department_id") as string) || null,
      mentor_id: (formData.get("mentor_id") as string) || null,
      status: "upcoming",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  void internship;
  return {};
}

export async function updateInternStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") return { error: "PERMISSION_DENIED" };
  const { error } = await supabase
    .from("interns")
    .update({ status: status as "pending" | "onboarding" | "active" })
    .eq("id", id);
  return { error: error?.message };
}

export type CsvInternRow = {
  student_code: string;
  full_name: string;
  email: string;
  phone: string;
  school: string;
  major: string;
  class_name: string;
  gender: string;
  birth_date: string;
  address: string;
};

export type ImportCsvState = {
  error?: string;
  imported?: number;
  failed?: { index: number; reason: string }[];
};

/** Import hàng loạt intern từ CSV. Role: admin/hr. */
export async function importInternsCsv(
  rows: CsvInternRow[],
  assignment: { batch_id: string | null; department_id: string | null; mentor_id: string | null },
): Promise<ImportCsvState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") {
    return { error: "Bạn không có quyền import thực tập sinh." };
  }

  if (!rows.length) return { error: "File không có dữ liệu hợp lệ." };

  const failed: ImportCsvState["failed"] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.student_code || !r.full_name || !r.email) {
      failed.push({ index: i + 1, reason: "Thiếu mã SV / họ tên / email." });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
      failed.push({ index: i + 1, reason: "Email không hợp lệ." });
      continue;
    }

    const { data: intern, error } = await supabase
      .from("interns")
      .insert({
        student_code: r.student_code,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone || null,
        school: r.school || null,
        major: r.major || null,
        class_name: r.class_name || null,
        gender: ["male", "female", "other"].includes(r.gender)
          ? (r.gender as "male" | "female" | "other")
          : null,
        birth_date: r.birth_date || null,
        address: r.address || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      failed.push({ index: i + 1, reason: error.message });
      continue;
    }

    if (assignment.batch_id) {
      const { error: ipErr } = await supabase.from("internships").insert({
        intern_id: intern.id,
        batch_id: assignment.batch_id,
        department_id: assignment.department_id,
        mentor_id: assignment.mentor_id,
        status: "upcoming",
        created_by: user.id,
      });
      if (ipErr) failed.push({ index: i + 1, reason: `Thêm vào đợt thất bại: ${ipErr.message}` });
    }

    imported += 1;
  }

  return { imported, failed, ...(imported === 0 && !failed.length && rows.length ? { error: "Không import được dòng nào." } : {}) };
}