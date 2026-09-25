import { AppError, errorFrom, errorJson, json } from "../_shared/errors.ts";
import { handleCors } from "../_shared/cors.ts";
import { getCallerUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { layoutHtml, sendResendEmail } from "../_shared/resend.ts";

type TemplateData = Record<string, string | number>;

const EMAIL_TEMPLATES: Record<
  string,
  (d: TemplateData) => { subject: string; html: string }
> = {
  welcome: (d) => ({
    subject: `Chào mừng ${d.full_name} đến với đợt thực tập ${d.batch_name ?? ""}`,
    html: layoutHtml(`
      <h2 style="margin-top:0">Chào mừng bạn đến với IMS!</h2>
      <p>Xin chào <strong>${d.full_name}</strong>,</p>
      <p>Tài khoản thực tập của bạn đã được kích hoạt thành công.</p>
      <ul>
        <li>Phòng ban: <strong>${d.department_name ?? "—"}</strong></li>
        <li>Mentor: <strong>${d.mentor_name ?? "Sẽ được phân công"}</strong></li>
        <li>Đợt thực tập: <strong>${d.batch_name ?? "—"}</strong></li>
        <li>Thời gian: <strong>${d.start_date ?? "—"} → ${d.end_date ?? "—"}</strong></li>
      </ul>
      <p>Vui lòng đăng nhập ứng dụng IMS để hoàn thành bảng kiểm đầu việc (onboarding) và xem các nhiệm vụ được giao.</p>`),
  }),

  account_info: (d) => ({
    subject: "Tài khoản hệ thống thực tập của bạn",
    html: layoutHtml(`
      <h2 style="margin-top:0">Thông tin tài khoản</h2>
      <p>Xin chào <strong>${d.full_name}</strong>,</p>
      <p>Tài khoản truy cập hệ thống quản lý thực tập:</p>
      <p><strong>Email:</strong> ${d.email}<br>
      <strong>Mật khẩu:</strong> ${d.password}</p>
      <p>Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>`),
  }),

  task_assigned: (d) => ({
    subject: `[Task mới] ${d.task_title}`,
    html: layoutHtml(`
      <h2 style="margin-top:0">Bạn vừa được giao một task</h2>
      <p><strong>${d.task_title}</strong></p>
      <p>${d.task_description ?? "—"}</p>
      <p>Độ ưu tiên: <strong>${d.priority ?? "—"}</strong> · Deadline: <strong>${d.deadline ?? "—"}</strong></p>`),
  }),

  report_approved: (d) => ({
    subject: `Báo cáo đã được duyệt`,
    html: layoutHtml(`<h2 style="margin-top:0">Báo cáo được duyệt ✅</h2>
      <p>Báo cáo của bạn (${d.report_type ?? ""} ngày ${d.report_date ?? ""}) đã được <strong>${d.reviewer ?? ""}</strong> duyệt.</p>
      ${d.feedback ? `<p><em>Phản hồi: ${d.feedback}</em></p>` : ""}`),
  }),

  report_rejected: (d) => ({
    subject: `Báo cáo cần chỉnh sửa`,
    html: layoutHtml(`<h2 style="margin-top:0">Báo cáo bị từ chối</h2>
      <p>Báo cáo của bạn (${d.report_type ?? ""} ngày ${d.report_date ?? ""}) chưa được duyệt.</p>
      ${d.feedback ? `<p><em>Lý do: ${d.feedback}</em></p>` : ""}
      <p>Vui lòng chỉnh sửa và nộp lại.</p>`),
  }),

  request_approved: (d) => ({
    subject: `Đơn từ đã được duyệt`,
    html: layoutHtml(`<h2 style="margin-top:0">Đơn của bạn đã được duyệt ✅</h2>
      <p>Loại đơn: <strong>${d.request_type ?? ""}</strong> · Ngày: <strong>${d.request_date ?? ""}</strong></p>
      ${d.review_note ? `<p><em>Ghi chú: ${d.review_note}</em></p>` : ""}`),
  }),

  request_rejected: (d) => ({
    subject: `Đơn từ bị từ chối`,
    html: layoutHtml(`<h2 style="margin-top:0">Đơn của bạn đã bị từ chối</h2>
      <p>Loại đơn: <strong>${d.request_type ?? ""}</strong> · Ngày: <strong>${d.request_date ?? ""}</strong></p>
      ${d.review_note ? `<p><em>Ghi chú: ${d.review_note}</em></p>` : ""}`),
  }),

  internship_completed: (d) => ({
    subject: `Hoàn thành thực tập — ${d.full_name ?? ""}`,
    html: layoutHtml(`<h2 style="margin-top:0">Chúc mừng, bạn đã hoàn thành kỳ thực tập 🎉</h2>
      <p>${d.full_name ?? ""} đã hoàn thành đợt thực tập <strong>${d.batch_name ?? ""}</strong>.</p>
      <p>Chứng nhận hoàn thành sẽ được cấp trong thời gian sớm nhất.</p>`),
  }),

  certificate_ready: (d) => ({
    subject: `Chứng nhận thực tập của bạn đã sẵn sàng`,
    html: layoutHtml(`<h2 style="margin-top:0">Chứng nhận hoàn thành thực tập</h2>
      <p>Chào <strong>${d.full_name}</strong>,</p>
      <p>Chứng nhận thực tập của bạn (mã <strong>${d.certificate_code ?? ""}</strong>) đã được phát hành và có thể tải về từ hệ thống.</p>`),
  }),
};

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST", 405);
    }

    const body = (await req.json().catch(() => null)) as {
      onboarding_id?: string;
      template?: string;
    } | null;

    if (!body?.onboarding_id) return errorJson("VALIDATION_ERROR", "Thiếu 'onboarding_id'");
    const template = body.template ?? "welcome";

    const caller = await getCallerUser(req);
    if (!caller?.role || (caller.role !== "admin" && caller.role !== "hr")) {
      return errorJson("PERMISSION_DENIED", "Chỉ admin/HR được gửi email", 403);
    }

    const render = EMAIL_TEMPLATES[template];
    if (template !== "welcome" || !render) {
      return errorJson("VALIDATION_ERROR", `Template không tồn tại: ${template} (có: ${Object.keys(EMAIL_TEMPLATES).join(", ")})`);
    }

    const supabase = createAdminClient();
    const { data: onboarding, error: onboardingError } = await supabase
      .from("onboarding_records")
      .select(
        "status, assigned_hr_id, internships!inner(interns!inner(full_name,email), internship_batches!inner(name,start_date,end_date), departments(name), mentors(full_name))",
      )
      .eq("id", body.onboarding_id)
      .maybeSingle();
    if (onboardingError) throw new AppError("DB_ERROR", onboardingError.message, 500, onboardingError);
    if (!onboarding) return errorJson("NOT_FOUND", "Không tìm thấy hồ sơ onboarding", 404);
    if (caller.role === "hr" && onboarding.assigned_hr_id && onboarding.assigned_hr_id !== caller.user.id) {
      return errorJson("PERMISSION_DENIED", "Hồ sơ không thuộc phạm vi phụ trách", 403);
    }
    if (onboarding.status === "cancelled" || onboarding.status === "completed") {
      return errorJson("VALIDATION_ERROR", "Không thể gửi email cho hồ sơ đã đóng", 400);
    }

    const internship = onboarding.internships as unknown as {
      interns: { full_name: string; email: string };
      internship_batches: { name: string; start_date: string | null; end_date: string | null };
      departments: { name: string } | null;
      mentors: { full_name: string } | null;
    };
    const templateData: TemplateData = {
      full_name: internship.interns.full_name,
      batch_name: internship.internship_batches.name,
      department_name: internship.departments?.name ?? "—",
      mentor_name: internship.mentors?.full_name ?? "Sẽ được phân công",
      start_date: internship.internship_batches.start_date ?? "—",
      end_date: internship.internship_batches.end_date ?? "—",
    };
    const { subject, html } = render(templateData);

    const result = await sendResendEmail({
      to: internship.interns.email,
      subject,
      html,
    });

    return json({ success: true, id: result?.id }, 200);
  } catch (e) {
    return errorFrom(e);
  }
});