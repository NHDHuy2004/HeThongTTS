/** Chuyển lỗi bất kỳ (Error | string | object có message) thành chuỗi hiển thị. */
export function getErrorMessage(error: unknown): string {
  if (!error) return "Đã xảy ra lỗi không xác định.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/** Map code auth Supabase → tiếng Việt thân thiện. */
export function getAuthErrorMessage(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return "";
  const code = error.code ?? "";
  switch (code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Email chưa được xác nhận. Kiểm tra hộp thư rồi bấm link xác nhận.";
    case "user_already_exists":
      return "Email đã được đăng ký. Dùng chức năng Đăng nhập hoặc Đặt lại mật khẩu.";
    case "user_not_found":
      return "Không tìm thấy tài khoản với email này.";
    case "weak_password":
      return "Mật khẩu quá yếu. Dùng tối thiểu 8 ký tự, gồm chữ và số.";
    case "over_request_rate_limit":
      return "Quá nhiều yêu cầu. Thử lại sau vài phút.";
    default:
      return error.message || "Đã xảy ra lỗi đăng nhập.";
  }
}

/** Map code Postgres hay gặp (duplicate/foreign key/...) thành chuỗi dễ hiểu. */
export function getPostgresErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return "";
  const code = error.code ?? "";
  switch (code) {
    case "23505":
      return "Dữ liệu bị trùng (duplicate key).";
    case "23503":
      return "Bản ghi đang được nơi khác tham chiếu (foreign key).";
    case "23514":
      return "Dữ liệu vi phạm ràng buộc check.";
    default:
      return error.message || "Đã xảy ra lỗi cơ sở dữ liệu.";
  }
}

/** Lỗi Zod v4: dùng `issues` (không phải `errors`). */
export function getZodErrorMessage(
  error: { issues?: { message: string }[] } | undefined,
): string {
  return error?.issues?.[0]?.message ?? "Dữ liệu không hợp lệ.";
}
