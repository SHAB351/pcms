import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.NODE_ENV === "production" ? [
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ] : []),
    ] }];
  },
  // Cache Components is disabled on purpose: every route of this application is
  // per-user and authenticated (session + RLS-filtered reads), so the "use cache"
  // model would only add <Suspense> boundaries without a measurable benefit.
  // Revisit if public, cacheable routes are added later.
  cacheComponents: false,
  experimental: {
    serverActions: {
      // Le dépôt de documents passe par une Server Action (multipart). La limite
      // par défaut est de 1 Mo, très en dessous du 10 Mio autorisé par le bucket.
      // 12 Mo laisse la marge nécessaire aux frontières multipart (~10-20 Ko
      // annoncés par la documentation Next, ici largement couverte).
      bodySizeLimit: "12mb",
    },
  },

  // Tailwind est compilé par PostCSS (voir postcss.config.mjs). Le loader
  // Turbopack `@tailwindcss/turbopack` a été retiré : il ne s'exécutait pas et
  // laissait passer le CSS sans générer les classes utilitaires.
};

export default nextConfig;
