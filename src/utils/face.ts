// Face verification 1:1 untuk absen. Descriptor = 128 angka dari face-api.js (client).
// Backend hanya membandingkan (euclidean distance) — mobile-agnostic.

export function parseDescriptor(s?: string | null): number[] | null {
  if (!s) return null;
  try {
    const a = typeof s === 'string' ? JSON.parse(s) : s;
    return Array.isArray(a) && a.length >= 64 ? a.map(Number) : null;
  } catch {
    return null;
  }
}

export function euclidean(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// threshold 0.6 = default face-api.js (distance < 0.6 dianggap orang yang sama)
export function verifyFace(
  ref: number[] | null,
  live: number[] | null,
  threshold = 0.6
): { verified: boolean; score: number | null; distance: number | null } {
  if (!ref || !live) return { verified: false, score: null, distance: null };
  const distance = euclidean(ref, live);
  const score = Math.max(0, Math.min(1, 1 - distance)); // 0..1, makin tinggi makin mirip
  return { verified: distance < threshold, score, distance };
}
