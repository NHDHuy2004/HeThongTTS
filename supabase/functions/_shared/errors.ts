import { corsHeaders } from "./cors.ts";

/** Trả JSON thành công (200). */
export function json<T>(data: T, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
  });
}

/** Trả lỗi chuẩn hóa: { error: { code, message, details? } }. */
export function errorJson(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return json({ error: { code, message, details } }, status);
}

/** Trả lỗi từ AppError. */
export function errorFrom(e: unknown, fallbackCode = "INTERNAL_SERVER_ERROR", fallbackStatus = 500) {
  if (e instanceof AppError) {
    return errorJson(e.code, e.message, e.status, e.details);
  }
  console.error("[edge-function]", String(e));
  return errorJson(fallbackCode, "Đã xảy ra lỗi không mong muốn", fallbackStatus);
}

export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}