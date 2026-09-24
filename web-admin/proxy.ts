import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/guard";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Bỏ qua api, _next/static, _next/image, favicon, public assets.
  // Khai báo inline (bắt buộc ở Next 16 vì config phải được parse tĩnh tại build).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
