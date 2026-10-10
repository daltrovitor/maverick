// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Renova a sessão do Supabase a cada navegação e faz a checagem otimista do painel:
 * sem sessão, /admin redireciona para o login. A autorização real (papel admin) acontece
 * no layout do painel e em cada Server Action/função do banco.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAdminArea = request.nextUrl.pathname.startsWith("/admin");

  if (isAdminArea && !data?.claims) {
    const login = request.nextUrl.clone();
    login.pathname = "/conta";
    login.search = `?proximo=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(login);
  }

  if (isAdminArea) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    // Apenas rotas que dependem de sessão; catálogo e landing seguem estáticos.
    "/admin/:path*",
    "/conta/:path*",
    "/checkout",
    "/auth/:path*",
  ],
};
