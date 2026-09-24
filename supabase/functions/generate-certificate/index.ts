import { createAdminClient } from "../_shared/supabase.ts";
import { AppError, errorFrom, errorJson, json } from "../_shared/errors.ts";
import { handleCors } from "../_shared/cors.ts";
import { getCallerUser } from "../_shared/auth.ts";
import { buildCertificatePdf } from "../_shared/certificate-pdf.ts";

function formatDate(date?: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

async function formatVnDate(date?: string | null): Promise<string> {
  return formatDate(date);
}

async function nextCertificateCode(
  year: number,
): Promise<{ code: string; check: () => Promise<boolean> }> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("certificates")
    .select("id", { count: "exact", head: true })
    .like("certificate_code", `CERT-${year}-%`);
  const seq = (count ?? 0) + 1;
  return {
    code: `CERT-${year}-${String(seq).padStart(6, "0")}`,
    check: () =>
      supabase
        .from("certificates")
        .select("id")
        .eq("certificate_code", `CERT-${year}-${String(seq).padStart(6, "0")}`)
        .maybeSingle()
        .then(({ data }) => !data),
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST", 405);
    }

    const body = (await req.json().catch(() => null)) as { internship_id?: string } | null;
    const internshipId = body?.internship_id;
    if (!internshipId) return errorJson("VALIDATION_ERROR", "Thiếu internship_id");

    // Chỉ Admin/HR được phát hành chứng nhận
    const caller = await getCallerUser(req);
    if (!caller?.role || (caller.role !== "admin" && caller.role !== "hr")) {
      return errorJson("PERMISSION_DENIED", "Chỉ Admin/HR được phát hành chứng nhận", 403);
    }

    const supabase = createAdminClient();

    const { data: ip, error: ipErr } = await supabase
      .from("internships")
      .select(`
        id, status, start_date, end_date, position,
        interns(id, full_name, student_code, school, major),
        internship_batches(id, name),
        departments(id, name),
        mentors(id, full_name)
      `)
      .eq("id", internshipId)
      .is("deleted_at", null)
      .maybeSingle();
    if (ipErr || !ip) return errorJson("NOT_FOUND", "Không tìm thấy đợt thực tập", 404);

    const intern = ip.interns as { id: string; full_name: string } | null;
    if (!intern) return errorJson("NOT_FOUND", "Không tìm thấy thông tin intern", 404);

    // Duplicate check: đã có chứng nhận cho internship này chưa?
    const { data: existing } = await supabase
      .from("certificates")
      .select("id, certificate_code, status, file_path")
      .eq("internship_id", internshipId)
      .maybeSingle();
    if (existing && existing.status !== "revoked") {
      return json({ success: true, already: true, certificate: existing }, 200);
    }

    // Lấy người ký + công ty từ system_settings
    const { data: certSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "certificate")
      .maybeSingle();
    const certCfg = (certSetting?.value as Record<string, string> | null) ?? {};

    const { data: companySetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "company")
      .maybeSingle();
    const companyCfg = (companySetting?.value as Record<string, string> | null) ?? {};

    const year = new Date().getFullYear();
    let certCode = await nextCertificateCode(year);
    for (let i = 0; i < 5; i++) {
      if (await certCode.check()) break;
      certCode = await nextCertificateCode(year);
    }
    const code = certCode.code;

    // Build PDF (có logo trường)
    const pdf = await buildCertificatePdf({
      companyName: companyCfg.name ?? "Công ty TNHH ABC",
      title: "CHỨNG NHẬN HOÀN THÀNH THỰC TẬP",
      fullName: intern.full_name,
      position: (ip.position as string | null) ?? "Thực tập sinh",
      departmentName: (ip.departments as { name?: string } | null)?.name ?? "",
      batchName: (ip.internship_batches as { name?: string } | null)?.name ?? "",
      startDate: await formatVnDate(ip.start_date),
      endDate: await formatVnDate(ip.end_date),
      certificateCode: code,
      signerName: certCfg.signer_name ?? Deno.env.get("CERT_SIGNER_NAME") ?? "",
      signerTitle: certCfg.signer_title ?? Deno.env.get("CERT_SIGNER_TITLE") ?? "",
    });

    const filePath = `certificates/${intern.id}/${code}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("certificates")
      .upload(filePath, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new AppError("FILE_UPLOAD_ERROR", uploadErr.message, 500, uploadErr);

    const now = new Date().toISOString();
    const record = {
      internship_id: internshipId,
      intern_id: intern.id,
      certificate_code: code,
      full_name: intern.full_name,
      department_name: (ip.departments as { name?: string } | null)?.name ?? null,
      batch_name: (ip.internship_batches as { name?: string } | null)?.name ?? null,
      position: (ip.position as string | null) ?? null,
      start_date: ip.start_date,
      end_date: ip.end_date,
      file_path: filePath,
      status: "issued",
      issued_at: now,
      signed_by: certCfg.signer_name ?? null,
      signed_title: certCfg.signer_title ?? null,
      created_by: caller.user.id,
    };

    let result;
    if (existing && existing.status === "revoked") {
      const { data, error } = await supabase
        .from("certificates")
        .update(record)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new AppError("DB_ERROR", error.message, 500, error);
      result = data;
    } else {
      const { data, error } = await supabase
        .from("certificates")
        .insert(record)
        .select()
        .single();
      if (error) throw new AppError("DB_ERROR", error.message, 500, error);
      result = data;
    }

    return json({ success: true, certificate: result }, 201);
  } catch (e) {
    return errorFrom(e);
  }
});