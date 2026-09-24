import { AppError } from "./errors.ts";

const RESEND_URL = "https://api.resend.com/emails";

type ResendResponse = {
  data?: { id: string };
  error?: { message: string; name: string; statusCode: number };
};

/** Gửi email qua Resend (server-side, không bao giờ lộ API key ra client). */
export async function sendResendEmail(params: {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new AppError("CONFIG_ERROR", "RESEND_API_KEY chưa được cấu hình", 500);
  }

  const from =
    params.from ??
    Deno.env.get("RESEND_FROM_EMAIL") ??
    `IMS <${processName()}>`;
  if (!from) {
    throw new AppError("CONFIG_ERROR", "RESEND_FROM_EMAIL chưa được cấu hình", 500);
  }

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as ResendResponse;

  if (!res.ok || payload.error) {
    throw new AppError(
      "EMAIL_SEND_ERROR",
      `Không gửi được email: ${payload.error?.message ?? res.statusText}`,
      res.status,
    );
  }
  return payload.data;
}

function processName(): string {
  const from = Deno.env.get("RESEND_FROM_NAME") ?? "IMS";
  const domain = Deno.env.get("RESEND_DOMAIN") ?? "";
  return domain ? `${from} <${domain}>` : `${from} <onboarding@resend.dev>`;
}

/** Bọc HTML tiếng Việt chuẩn (bảng/Wrapper) cho email. */
export function layoutHtml(body: string): string {
  const company = Deno.env.get("RESEND_FROM_NAME") ?? "IMS";
  return `<!DOCTYPE html><html lang="vi"><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="background:#1e3a5f;color:#ffffff;padding:20px 28px;font-size:18px;font-weight:bold">${company}</td></tr>
        <tr><td style="padding:28px;color:#18181b;font-size:14px;line-height:1.6">${body}</td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px">Email tự động từ Hệ thống Quản lý Thực tập. Vui lòng không trả lời email này.</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}