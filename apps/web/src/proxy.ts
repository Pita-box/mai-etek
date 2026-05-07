import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const authRoutes = new Set(["/login", "/register", "/forgot-password"]);
const protectedRoutePrefixes = [
  "/achievements",
  "/chat",
  "/dashboard",
  "/gallery",
  "/monitoring",
  "/punishments",
  "/rewards",
  "/settings",
  "/superadmin",
  "/tasks",
  "/wishes",
];

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cookiesToForward: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToForward.splice(0, cookiesToForward.length, ...cookiesToSet);

          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = normalizePathname(request.nextUrl.pathname);

  if (user && authRoutes.has(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";

    const redirectResponse = NextResponse.redirect(redirectUrl);
    cookiesToForward.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    return redirectResponse;
  }

  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    cookiesToForward.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
