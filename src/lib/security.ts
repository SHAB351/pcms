/** Pure helpers shared by the proxy and regression tests. */
export function safeRedirectTarget(value: unknown): string {
  const fallback = "/tableau-de-bord";
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://pcms.invalid");
    return url.origin === "https://pcms.invalid" ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

export function contentSecurityPolicy(nonce: string, development: boolean, supabaseUrl?: string): string {
  const connections = ["'self'"];
  if (development) connections.push("ws:", "wss:");
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (["https:", "http:"].includes(url.protocol)) connections.push(url.origin);
    } catch { /* Invalid configuration is reported by the configuration screen. */ }
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:", "font-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    `connect-src ${connections.join(" ")}`,
  ].join("; ");
}

/** Apply on normal responses AND redirects carrying refreshed session cookies. */
export function preventPrivateCaching(headers: Headers): void {
  headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
}
