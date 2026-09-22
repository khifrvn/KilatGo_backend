import { prisma } from '../config/database';

// Default pengaturan komisi & tarif (dipakai jika belum diset admin).
export const DEFAULT_SETTINGS: Record<string, string> = {
  commission_percent: '15', // komisi platform dari driver (%) — Ride/Car/Send/Food
  food_commission_percent: '20', // komisi KilatFood dari merchant (%)
  service_fee: '0', // biaya layanan flat per order (Rp) — dibebankan ke customer, semua layanan
  // Tarif per-layanan (Rp). base = tarif dasar, per_km = per km, min = tarif minimum.
  ride_base_fare: '5000', ride_per_km: '2500', ride_min_fare: '8000',
  car_base_fare: '10000', car_per_km: '4000', car_min_fare: '15000',
  send_base_fare: '6000', send_per_km: '2500', send_min_fare: '9000',
  food_base_fare: '5000', food_per_km: '2500', food_min_fare: '8000',
  food_merchant_radius_km: '15', // radius (km) merchant tampil di beranda KilatFood; 0 = tanpa batas
  // Promosi berbayar mitra ("Promosikan Jualan kamu"): paket durasi + harga, editable di CMS.
  // Daftar kosong ([]) = fitur promosi dimatikan (app mitra menampilkan info "belum tersedia").
  merchant_promo_packages:
    '[{"name":"30 Menit","minutes":30,"price":2000},{"name":"1 Jam","minutes":60,"price":3500},{"name":"6 Jam","minutes":360,"price":15000},{"name":"1 Hari","minutes":1440,"price":25000},{"name":"7 Hari","minutes":10080,"price":150000}]',
  merchant_promo_min_topup: '10000', // minimal isi saldo mitra untuk promosi (Rp)
  // Membership driver: poin per order selesai + tier (nama & minimal poin). Editable di CMS.
  points_per_order: '10',
  member_tiers: '[{"name":"Silver","minPoints":0},{"name":"Gold","minPoints":500},{"name":"Platinum","minPoints":2000}]',
  // Auto-dispatch order ke driver
  dispatch_radius_km: '5', // radius cari driver (km)
  dispatch_timeout_sec: '15', // waktu tunggu tiap driver sebelum dilempar ke berikutnya (detik)
  dispatch_location_fresh_min: '10', // lokasi driver dianggap valid jika update < menit ini
  // Batas waktu pesanan — SEMUA dihitung sejak pesanan dibuat (createdAt).
  order_cancel_grace_sec: '30', // jendela "Batalkan pesanan" bebas setelah customer memesan (detik)
  merchant_confirm_min: '5', // FOOD: batas warung konfirmasi terima; lewat → pesanan auto-batal (menit)
  dispatch_no_driver_warn_min: '10', // muncul notif "belum dapat driver" + tombol batal/boost lagi (menit)
  dispatch_no_driver_min: '15', // tetap tanpa driver sampai menit ini → pesanan auto-batal (menit)
  // Dompet driver (semua configurable, jangan hardcode di app)
  driver_registration_open: '1', // '1' = pendaftaran driver dibuka, '0' = ditutup
  merchant_registration_open: '1', // '1' = pendaftaran mitra dibuka, '0' = ditutup
  driver_package_price: '350000', // harga Paket Mitra Driver (Jacket + Helm SNI), Rp
  min_topup: '25000', // minimal top up kredit awal + ambang aktif layanan (Rp)
  min_withdraw: '50000', // minimal penarikan saldo (Rp)
  withdraw_admin_fee: '2500', // biaya admin per penarikan saldo (Rp)
  maintenance_mode: '0', // '1' = app dalam perbaikan (blokir request non-admin)
  maintenance_message: 'Aplikasi sedang dalam perbaikan. Silakan coba lagi nanti.',
  // Musik latar layar perbaikan (URL penuh, hasil unggah admin atau link luar).
  // Kosong = tanpa musik; pengguna tetap bisa pause/play sendiri.
  maintenance_music_url: '',
  // Kontak (tampil di landing)
  contact_email: 'costumerservice@kilatgo.com',
  contact_phone: '0895418213962',
  contact_whatsapp: '0895418213962',
  contact_address: 'Dusun 3 Rejo Sari, Kwala Begumit, Kec. Stabat, Kab. Langkat, Sumatera Utara',
  // Konten Bantuan & Tips mitra (dikelola admin). Tiap item dipisah baris "---";
  // baris pertama = judul/pertanyaan, sisanya = isi/jawaban.
  merchant_help:
    'Bagaimana cara menerima pesanan?\nBuka tab Transaksi. Saat ada pesanan masuk, tekan "Terima pesanan" — sistem otomatis mencarikan driver.\n---\nBagaimana mengatur stok menu?\nBuka fitur Atur Stok di beranda, atur jumlah stok tiap menu, lalu Simpan.\n---\nBagaimana menarik saldo?\nBuka Payment Link, pastikan rekening pencairan benar (di Profil restoran), lalu tekan Tarik saldo.',
  merchant_tips:
    'Foto menu yang menggugah selera\nGunakan foto asli, pencahayaan terang, dan ambil dari atas agar makanan terlihat menarik.\n---\nBalas pesanan dengan cepat\nSemakin cepat menerima pesanan, semakin tinggi skor performa dan kepercayaan pelanggan.\n---\nJaga jam operasional akurat\nAtur Jam operasional sesuai realita agar pelanggan tidak memesan saat tutup.',
  // Payment gateway iPaymu (dipakai backend untuk transaksi mobile). JANGAN masuk PUBLIC_KEYS.
  // Credential disimpan terpisah per-mode: ganti mode otomatis pakai VA/API key mode itu.
  ipaymu_mode: 'sandbox', // 'sandbox' | 'production' — menentukan credential & base URL aktif
  ipaymu_sandbox_va: '', // Virtual Account iPaymu (sandbox)
  ipaymu_sandbox_api_key: '', // API Key iPaymu (sandbox)
  ipaymu_prod_va: '', // Virtual Account iPaymu (production)
  ipaymu_prod_api_key: '', // API Key iPaymu (production)
  // PPOB (Digiflazz) — pulsa, paket data, token PLN, e-wallet, voucher game.
  ppob_enabled: '0', // '1' = fitur PPOB aktif di app
  ppob_markup_percent: '3', // margin KilatGo dari harga vendor (%)
  ppob_markup_flat: '500', // margin tambahan flat per transaksi (Rp)
  digiflazz_mode: 'development', // 'development' | 'production' — development pakai flag testing
  digiflazz_username: '', // username API Digiflazz
  digiflazz_dev_key: '', // API key development
  digiflazz_prod_key: '', // API key production
  digiflazz_webhook_secret: '', // secret webhook (verifikasi HMAC-SHA1)
  // SKU yang dipilih admin untuk dijual (JSON array). Kosong = jual semua yang
  // tersedia di vendor, supaya fitur tetap jalan sebelum sempat diseleksi.
  ppob_active_skus: '',
  // Perekat user ID & zone/server ID produk game (mis. Mobile Legends). Format
  // gabungannya ditentukan vendor dan belum pasti, jadi disimpan sebagai setting
  // agar bisa dikoreksi lewat admin tanpa merilis ulang app. Kosong = digabung
  // langsung tanpa pemisah.
  ppob_game_id_separator: '',
};

// Key yang boleh diakses publik (landing) — jangan bocorkan setting internal lain.
// Batas waktu pesanan ikut publik: app pakai untuk hitung mundur tombol batal & konfirmasi warung.
// `ppob_enabled` ikut publik (hanya flag on/off-nya). Tanpa ini app tidak bisa
// menyembunyikan pintu masuk PPOB saat admin mematikannya — kredensial, mode,
// margin, dan webhook secret tetap TIDAK ikut, jangan pernah tambahkan ke sini.
const PUBLIC_KEYS = ['contact_email', 'contact_phone', 'contact_whatsapp', 'contact_address', 'maintenance_mode', 'maintenance_message', 'maintenance_music_url', 'merchant_help', 'merchant_tips', 'service_fee', 'food_merchant_radius_km', 'driver_registration_open', 'merchant_registration_open', 'driver_package_price', 'order_cancel_grace_sec', 'merchant_confirm_min', 'dispatch_no_driver_warn_min', 'dispatch_no_driver_min', 'ppob_enabled'];

// Kunci rahasia yang tak boleh ikut keluar ke client (mis. hash PIN isi saldo).
const HIDDEN_KEYS = ['topup_pin_hash', 'broadcast_history'];

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const stored: Record<string, string> = {};
  for (const r of rows) if (!HIDDEN_KEYS.includes(r.key)) stored[r.key] = r.value;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const all = await getSettings();
  const out: Record<string, string> = {};
  for (const k of PUBLIC_KEYS) out[k] = all[k];
  return out;
}

// Credential iPaymu aktif sesuai mode. Backend selalu pakai ini, jangan baca key mentah.
export async function getIpaymuConfig(): Promise<{ va: string; apiKey: string; mode: string; baseUrl: string }> {
  const s = await getSettings();
  const prod = s.ipaymu_mode === 'production';
  return {
    mode: prod ? 'production' : 'sandbox',
    va: prod ? s.ipaymu_prod_va : s.ipaymu_sandbox_va,
    apiKey: prod ? s.ipaymu_prod_api_key : s.ipaymu_sandbox_api_key,
    baseUrl: prod ? 'https://my.ipaymu.com/api/v2' : 'https://sandbox.ipaymu.com/api/v2',
  };
}

// Credential Digiflazz aktif sesuai mode. `testing: true` dikirim saat mode development
// (transaksi tidak memotong deposit vendor).
export async function getDigiflazzConfig(): Promise<{ username: string; apiKey: string; testing: boolean; webhookSecret: string }> {
  const s = await getSettings();
  const prod = s.digiflazz_mode === 'production';
  return {
    username: s.digiflazz_username,
    apiKey: prod ? s.digiflazz_prod_key : s.digiflazz_dev_key,
    testing: !prod,
    webhookSecret: s.digiflazz_webhook_secret,
  };
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Record<string, string>> {
  const entries = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    const v = String(value);
    await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
  return getSettings();
}
