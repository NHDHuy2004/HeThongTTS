"use server";

import { createClient } from "@/lib/supabase/server";

export type CertFormState = { error?: string };

function genCode() {
  return `IMS-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createCertificate(
  prevState: CertFormState,
  formData: FormData,
): Promise<CertFormState> {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") {
    return { error: "Bạn không có quyền tạo chứng nhận." };
  }

  const intern_id = String(formData.get("intern_id") ?? "");
  if (!intern_id) return { error: "Vui lòng chọn intern." };

  const { data: intern } = await supabase
    .from("interns")
    .select("id, full_name, internships(department_id, internship_batches(name, start_date, end_date))")
    .eq("id", intern_id)
    .maybeSingle()
    .then((r) => r as { data: InternRow | null });

  if (!intern) return { error: "Không tìm thấy intern." };

  const ip = intern.internships?.[0];
  const { data: dep } = await supabase
    .from("departments")
    .select("name")
    .eq("id", ip?.department_id ?? "")
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("certificates").insert({
    internship_id: ip?.id ?? null,
    intern_id: intern.id,
    certificate_code: genCode(),
    full_name: intern.full_name,
    department_name: dep?.name ?? null,
    batch_name: ip?.internship_batches?.name ?? null,
    start_date: ip?.internship_batches?.start_date ?? null,
    end_date: ip?.internship_batches?.end_date ?? null,
    status: "draft",
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  return {};
}

type InternRow = {
  id: string;
  full_name: string;
  internships: {
    id: string;
    department_id: string | null;
    internship_batches: {
      name: string;
      start_date: string;
      end_date: string;
    } | null;
  }[];
};

export async function setCertificateStatus(id: string, status: "issued" | "revoked") {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") {
    return { error: "Bạn không có quyền đổi trạng thái chứng nhận." };
  }

  const payload =
    status === "issued"
      ? {
          status: "issued" as const,
          issued_at: new Date().toISOString(),
          signed_by: "IMS Hệ thống quản lý thực tập",
          signed_title: "Phòng Nhân sự",
        }
      : { status: "revoked" as const, issued_at: null as string | null };

  const { error } = await supabase.from("certificates").update(payload).eq("id", id);
  return { error: error?.message ?? undefined };
}