/**
 * Thông báo khi bảng/migration chưa sẵn sàng.
 * Chỉ hiển thị hướng dẫn kỹ thuật cho admin; role khác thấy thông báo thân thiện.
 */
export function MigrationNotice({
  role,
  table,
  migration,
}: {
  role: string;
  table: string;
  migration: string;
}) {
  if (role === "admin") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
      >
        Chưa tìm thấy bảng <code>{table}</code> — hãy chạy migration{" "}
        <code>{migration}</code> trong Supabase Dashboard.
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
    >
      Tính năng này tạm thời không khả dụng. Vui lòng thử lại sau hoặc liên hệ quản
      trị viên.
    </div>
  );
}
