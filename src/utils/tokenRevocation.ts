import type { TokenClaims } from './jwt';

/**
 * Apakah token sudah dicabut karena sandi akun diganti setelah token terbit?
 *
 * Dipakai di dua tempat (middleware HTTP dan refresh token) supaya aturannya
 * hanya ada satu — token di sini stateless, jadi inilah satu-satunya cara
 * mencabut sesi lama setelah reset sandi.
 *
 * Dibandingkan dalam detik: `iat` presisi detik sedangkan kolomnya milidetik,
 * jadi membulatkan ke bawah mencegah token yang terbit pada detik yang sama
 * ikut tercabut (kasus umum: daftar lalu langsung dipakai).
 */
export function isTokenRevoked(passwordChangedAt: Date, iat: TokenClaims['iat']): boolean {
  return Math.floor(passwordChangedAt.getTime() / 1000) > iat;
}
