import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const protectedPaths = new Set([
  "/dashboard",
  "/interns",
  "/mentors",
  "/departments",
  "/internship-batches",
  "/onboarding",
  "/tasks",
  "/attendance",
  "/requests",
  "/reports",
  "/evaluations",
  "/certificates",
  "/settings",
  "/users",
  "/audit-logs",
]);

export async function updateSession(request: NextRequest) {
  let supabaseResponse: NextResponse<unknown>;

  try {
    supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // Kiểm tra session (refresh cookie token) — chưa đăng nhập thì user = null
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isAuthPage =
      pathname.startsWith("/login") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password");

    // Chưa đăng nhập:
    //   - ra trang auth → cho qua (rewrite tới đích, tránh loop)
    //   - tới trang bảo vệ → redirect sang /login
    if (!user) {
      if (!isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    // Đã đăng nhập mà vào trang auth → về dashboard
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Route không nằm trong danh sách bảo vệ → cho qua (trang / thì về dashboard)
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (![...protectedPaths].some((p) => pathname === p)) {
      return supabaseResponse;
    }

    // Route bảo vệ + đã đăng nhập → cho qua
    return supabaseResponse;
  } catch (e) {
    console.error("[guard] updateSession error:", e);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  // Bỏ qua api, _next/static, _next/image, favicon, public assets
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
