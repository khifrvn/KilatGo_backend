/**
 * Keputusan siapa yang boleh memanggil API dari browser.
 * Dipisah dari app.ts supaya bisa diuji tanpa menyalakan server & DB.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  opts: { allowed: string[]; isProduction: boolean }
): boolean {
  if (!origin) return true; // app mobile / curl / server-to-server tidak mengirim Origin
  if (opts.allowed.includes(origin)) return true;
  // Dev server CMS (Vite) — hanya di luar production.
  return !opts.isProduction && /^https?:\/\/localhost(:\d+)?$/.test(origin);
}

/** Isi CORS_ORIGINS ("a.com, b.com") jadi daftar bersih. */
export const parseOrigins = (raw: string | undefined): string[] =>
  (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
