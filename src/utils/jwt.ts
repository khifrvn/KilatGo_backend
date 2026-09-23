import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Payload token yang sudah dibaca kembali, plus `iat` (issued-at, detik).
 * `iat` dibandingkan dengan `User.passwordChangedAt` untuk mencabut token lama
 * setelah sandi diganti — token di sini stateless, jadi tanpa cek ini refresh
 * token 30 hari tetap hidup walau sandinya sudah direset.
 */
export interface TokenClaims extends TokenPayload {
  iat: number;
}

/** iat ditulis eksplisit supaya pasti ada saat token dibaca kembali. */
const withIssuedAt = (payload: TokenPayload) => ({
  ...payload,
  iat: Math.floor(Date.now() / 1000),
});

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
// Refresh tokens use a separate secret so an access token can never double as a refresh token.
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}-refresh`;
// Short-lived access token, long-lived refresh token (stateless).
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(withIssuedAt(payload), JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...withIssuedAt(payload), type: 'refresh' }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function generateTokens(payload: TokenPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/** Verify an access token (Authorization header / socket / KYC img query). */
export function verifyToken(token: string): TokenClaims {
  return jwt.verify(token, JWT_SECRET) as TokenClaims;
}

/** Verify a refresh token; throws if it isn't a refresh token. */
export function verifyRefreshToken(token: string): TokenClaims {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenClaims & { type?: string };
  if (decoded.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('Not a refresh token');
  }
  return { userId: decoded.userId, email: decoded.email, role: decoded.role, iat: decoded.iat };
}

/** @deprecated use generateAccessToken; kept for existing callers. */
export const generateToken = generateAccessToken;
