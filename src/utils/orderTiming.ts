// Aturan pembatalan customer yang murni bergantung waktu. Dipisah dari order.service
// supaya bisa dites tanpa DB (jalankan: npx tsx src/utils/orderTiming.ts).
//
// Tahapan (semua diukur sejak order dibuat / createdAt):
//   1. <= grace detik            → boleh batal bebas (tombol "Batalkan pesanan").
//   2. masih mencari driver      → tidak boleh batal (tunggu warung/driver).
//   3. >= warn menit tanpa driver → boleh batal lagi ("belum dapat driver nih").
//   4. status lain (ACCEPTED dst) → 'defer': pakai aturan lama di order.service.

export type CancelDecision =
  | { kind: 'allow' }
  | { kind: 'block'; message: string }
  | { kind: 'defer' };

export function customerCancelDecision(p: {
  status: string;
  ageSec: number;
  hasDriver: boolean;
  graceSec: number;
  warnMin: number;
}): CancelDecision {
  if (p.ageSec <= p.graceSec) return { kind: 'allow' };
  const searching = p.status === 'PENDING' || p.status === 'MERCHANT_ACCEPTED';
  if (!searching) return { kind: 'defer' };
  if (!p.hasDriver && p.ageSec >= p.warnMin * 60) return { kind: 'allow' };
  return {
    kind: 'block',
    message: `Belum bisa dibatalkan saat masih mencari driver. Kalau ${p.warnMin} menit belum dapat driver, tombol batal akan muncul lagi.`,
  };
}

// Ambil angka setting (menit/detik) dengan fallback aman: kosong/NaN/<=0 → default.
export function settingNum(raw: string | undefined, fallback: number): number {
  const v = parseFloat(raw ?? '');
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

if (require.main === module) {
  const base = { graceSec: 30, warnMin: 10 };
  const d = (p: Partial<Parameters<typeof customerCancelDecision>[0]>) =>
    customerCancelDecision({ status: 'PENDING', ageSec: 0, hasDriver: false, ...base, ...p }).kind;

  console.assert(d({ ageSec: 5 }) === 'allow', 'dalam grace → boleh batal');
  console.assert(d({ ageSec: 30 }) === 'allow', 'tepat di batas grace → masih boleh');
  console.assert(d({ ageSec: 31 }) === 'block', 'lewat grace & masih cari driver → blokir');
  console.assert(d({ ageSec: 400, status: 'MERCHANT_ACCEPTED' }) === 'block', 'belum sampai warn → blokir');
  console.assert(d({ ageSec: 600 }) === 'allow', 'tepat di warn tanpa driver → boleh batal');
  console.assert(d({ ageSec: 900, hasDriver: true }) === 'block', 'sudah dapat driver → bukan jalur no-driver');
  console.assert(d({ ageSec: 900, status: 'ACCEPTED' }) === 'defer', 'ACCEPTED → aturan lama');
  console.assert(d({ ageSec: 900, status: 'ON_RIDE' }) === 'defer', 'ON_RIDE → aturan lama');
  console.assert(settingNum('', 5) === 5 && settingNum('0', 5) === 5 && settingNum('3', 5) === 3, 'settingNum');
  console.log('orderTiming: OK');
}
