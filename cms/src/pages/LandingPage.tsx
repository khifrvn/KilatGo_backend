import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPublicSettings } from '../api/admin';
import {
  Zap, Motorbike, Car, Package, UtensilsCrossed, MapPin, Shield, Clock, Wallet, Star,
  ArrowRight, Smartphone, CheckCircle2, Navigation, Plus, Minus, ChevronDown, ChevronRight,
  Mail, Phone, MessageCircle, Send, Users, Store, Banknote, DollarSign, ShieldCheck,
  Headphones, Megaphone, Award, Percent, ClipboardList, CalendarClock, Lock,
} from 'lucide-react';

/* ============================================================================
   Landing KilatGo. Bahasa visual mengikuti logo: navy #0a1f4d → cyan #19b0f5
   dengan aksen kuning (kilat). Satu palet, satu skala radius (kontainer 2xl/3xl,
   elemen interaktif xl), navy hanya di kepala halaman, band mitra, dan footer.
   Motion CSS-native (kelas .reveal di index.css), tanpa library animasi.
   ========================================================================== */

const services = [
  { icon: Motorbike, name: 'KilatRide', desc: 'Ojek motor cepat sampai tujuan, tarif transparan sejak awal.' },
  { icon: Car, name: 'KilatCar', desc: 'Mobil ber-AC untuk perjalanan bersama keluarga.' },
  { icon: Package, name: 'KilatSend', desc: 'Kirim paket & dokumen instan dalam kota.' },
  { icon: UtensilsCrossed, name: 'KilatFood', desc: 'Pesan makanan favorit, diantar hangat.' },
];

const steps = [
  { icon: MapPin, title: 'Tentukan tujuan', desc: 'Masukkan titik jemput dan tujuan di aplikasi, tarif langsung terlihat.' },
  { icon: Navigation, title: 'Driver menjemput', desc: 'Driver terdekat otomatis ditawari order, posisinya terpantau di peta.' },
  { icon: CheckCircle2, title: 'Sampai tujuan', desc: 'Bayar tunai atau cashless, lalu beri rating untuk drivermu.' },
];

const stats = [
  { value: '4', label: 'Layanan dalam 1 aplikasi' },
  { value: '24/7', label: 'Order kapan saja' },
  { value: '30 dtk', label: 'Jendela batal pesanan' },
  { value: '2 arah', label: 'Rating pengguna & mitra' },
];

// Fitur yang benar-benar berjalan di aplikasi.
const appFeatures = [
  { icon: Navigation, title: 'Pelacakan real-time', desc: 'Posisi driver di peta sejak dijemput sampai tiba.' },
  { icon: MessageCircle, title: 'Chat dalam aplikasi', desc: 'Bicara dengan driver tanpa tukar nomor pribadi.' },
  { icon: Wallet, title: 'Saldo & voucher', desc: 'Tunai, saldo KilatGo, transfer, atau e-wallet.' },
  { icon: Shield, title: 'Kode pickup & bukti foto', desc: 'Pesanan makanan pakai kode, antaran ditutup foto.' },
  { icon: Zap, title: 'Boost pencarian driver', desc: 'Perluas jangkauan pencarian dengan sekali ketuk.' },
  { icon: Clock, title: 'Batalkan dalam 30 detik', desc: 'Ada jendela pembatalan tepat setelah memesan.' },
  { icon: Headphones, title: 'Live chat bantuan', desc: 'Tim CS bisa dihubungi langsung dari aplikasi.' },
  { icon: Star, title: 'Rating dua arah', desc: 'Pengguna menilai mitra, mitra menilai pengguna.' },
];

const joinReasons = [
  { icon: Percent, title: 'Komisi transparan', desc: 'Potongan jelas dan tercatat pada setiap order yang selesai.' },
  { icon: Banknote, title: 'Saldo bisa dicairkan', desc: 'Pendapatan masuk dompet mitra, tarik ke rekening sendiri.' },
  { icon: Package, title: 'Empat layanan, satu akun', desc: 'Driver bisa mengaktifkan Ride, Car, Send, dan Food sekaligus.' },
  { icon: Award, title: 'Poin & tier mitra', desc: 'Order selesai menambah poin: Silver, Gold, lalu Platinum.' },
  { icon: Megaphone, title: 'Promosi untuk mitra usaha', desc: 'Beli paket promosi, warung tampil teratas di KilatFood.' },
  { icon: Headphones, title: 'Dukungan tim lokal', desc: 'Kendala akun atau order dibantu lewat live chat mitra.' },
];

const driverBenefits = [
  'Penghasilan fleksibel: makin banyak order, makin besar pendapatan',
  'Atur jam kerja sendiri, cukup online atau offline dari aplikasi',
  'Order terdekat ditawarkan otomatis, tidak perlu rebutan',
  'Bisa menerima order ojek, mobil, kirim barang, dan makanan',
  'Poin dan tier mitra dari setiap order yang selesai',
  'Verifikasi wajah sebelum on-bid untuk menjaga keamanan akun',
];

const driverRequirements = [
  'WNI, usia 18 sampai 60 tahun, domisili di area operasional',
  'KTP dan SIM C atau SIM A yang masih berlaku',
  'Motor atau mobil pribadi beserta STNK',
  'HP Android minimal RAM 2GB dan nomor aktif',
  'Rekening bank atau e-wallet atas nama pribadi',
];

const merchantBenefits = [
  'Warungmu dilihat pelanggan baru lewat beranda KilatFood',
  'Kelola menu, stok, kategori, dan jam operasional dari aplikasi',
  'Terima pesanan masuk, cetak struk, pantau performa resto',
  'Saldo penjualan bisa dicairkan ke rekening usaha',
  'Paket promosi berbayar agar warung tampil paling atas',
  'Rating dan ulasan pelanggan untuk membangun kepercayaan',
];

const merchantRequirements = [
  'Usaha kuliner legal: warung, resto, cafe, atau UMKM',
  'KTP pemilik usaha dan NPWP atau Surat Keterangan Usaha',
  'Menu, harga, dan foto produk yang jelas',
  'HP Android untuk aplikasi Mitra KilatGo',
  'Rekening bank atau e-wallet untuk pencairan saldo',
];

const driverSteps = ['Isi formulir pendaftaran online', 'Tim KilatGo verifikasi dokumen dan KYC', 'Akun aktif, langsung terima order'];
const merchantSteps = ['Daftarkan usaha dan unggah dokumen', 'Verifikasi outlet oleh tim KilatGo', 'Upload menu, buka toko, terima pesanan'];

const faqs = [
  { q: 'Bagaimana cara memesan di KilatGo?', a: 'Buka aplikasi, tentukan titik jemput dan tujuan, pilih layanan, lalu konfirmasi. Driver terdekat langsung menuju lokasimu.' },
  { q: 'Metode pembayaran apa saja yang didukung?', a: 'Tunai, saldo KilatGo, transfer, dan e-wallet. Tarif selalu tampil di awal sebelum kamu memesan.' },
  { q: 'Apakah wilayah saya sudah terjangkau?', a: 'Cek ketersediaan langsung di aplikasi. Area layanan terus ditambah mengikuti jumlah mitra driver yang aktif.' },
  { q: 'Apa saja syarat jadi mitra driver?', a: 'KTP dan SIM aktif, usia 18 sampai 60 tahun, motor atau mobil beserta STNK, HP Android, serta rekening bank atau e-wallet pribadi. Semua dokumen diverifikasi lewat proses KYC.' },
  { q: 'Berapa lama proses verifikasi pendaftaran?', a: 'Setelah formulir dan dokumen lengkap masuk, tim kami memeriksa data lalu menghubungi kamu. Status pendaftaran juga bisa dipantau dari aplikasi.' },
  { q: 'Bagaimana cara mendaftarkan warung saya?', a: 'Isi formulir Daftar Mitra Usaha, unggah dokumen usaha dan foto outlet. Setelah diverifikasi, kamu bisa upload menu dan menerima pesanan KilatFood.' },
  { q: 'Bagaimana mitra mencairkan pendapatan?', a: 'Pendapatan masuk ke dompet mitra di aplikasi. Ajukan pencairan ke rekening sendiri dengan PIN penarikan, lalu admin memproses pengajuannya.' },
];

// Sementara app belum di Play Store, unduhan diarahkan ke Google Drive.
const APP_DOWNLOAD_URL = 'https://drive.google.com/drive/folders/1Vu7W2oWqidEwO-Hxvg2n5yOuExWwDz8p?usp=sharing';

// Peta area operasional (Stabat, Langkat) — peta asli OpenStreetMap, bukan tangkapan layar palsu.
const OSM_EMBED = 'https://www.openstreetmap.org/export/embed.html?bbox=98.40%2C3.71%2C98.52%2C3.80&layer=mapnik';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:translate-y-px shadow-lg shadow-kilatgo-accent/25';
const btnGhostDark =
  'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white border border-white/20 hover:bg-white/10 transition active:translate-y-px';
const btnSolidBlue =
  'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition active:translate-y-px shadow-lg shadow-kilatgo-600/25';

function SectionHead({ eyebrow, title, children, align = 'left' }:
  { eyebrow?: string; title: string; children?: React.ReactNode; align?: 'left' | 'center' }) {
  return (
    <div className={`${align === 'center' ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'} mb-12 lg:mb-14 reveal`}>
      {eyebrow && <p className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider mb-2.5">{eyebrow}</p>}
      <h2 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.1] tracking-tight">{title}</h2>
      {children && <p className="text-slate-500 mt-4 leading-relaxed">{children}</p>}
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const navigate = useNavigate();

  // Pengaturan publik: kontak, status pendaftaran, harga paket mitra.
  const [pub, setPub] = useState<Record<string, string>>({
    contact_email: 'costumerservice@kilatgo.com',
    contact_phone: '0895418213962',
    contact_whatsapp: '0895418213962',
    contact_address: 'Dusun 3 Rejo Sari, Kwala Begumit, Kec. Stabat, Kab. Langkat, Sumatera Utara',
  });
  useEffect(() => {
    getPublicSettings().then((s) => setPub((c) => ({ ...c, ...s }))).catch(() => {});
  }, []);

  const intl = (p: string) => '62' + (p || '').replace(/[^0-9]/g, '').replace(/^0/, '');
  const waLink = `https://wa.me/${intl(pub.contact_whatsapp)}`;
  const driverOpen = pub.driver_registration_open !== '0';
  const merchantOpen = pub.merchant_registration_open !== '0';
  const packagePrice = Number(pub.driver_package_price || 0);
  const rp = (v: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(v);

  const contactCards = [
    { icon: MessageCircle, label: 'WhatsApp', value: pub.contact_whatsapp, href: waLink },
    { icon: Phone, label: 'Telepon', value: pub.contact_phone, href: `tel:+${intl(pub.contact_phone)}` },
    { icon: Mail, label: 'Email', value: pub.contact_email, href: `mailto:${pub.contact_email}` },
    { icon: MapPin, label: 'Alamat kantor', value: pub.contact_address, href: `https://maps.google.com/?q=${encodeURIComponent(pub.contact_address)}` },
  ];

  // Driver lanjut ke formulir lengkap, merchant ke formulir mitra usaha (data ikut terisi).
  const handleMitraSubmit = (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const state = { name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), city: fd.get('city') };
    navigate(fd.get('mitraType') === 'merchant' ? '/daftar-merchant' : '/daftar-driver', { state });
  };

  const inputDark =
    'w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-kilatgo-accent focus:border-kilatgo-accent outline-none transition';

  return (
    <div className="bg-white text-slate-900">
      {/* ===== Nav: satu baris, tinggi 68px ===== */}
      <header className="sticky top-0 z-40 bg-kilatgo-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-[68px] flex items-center justify-between px-6 lg:px-10">
          <a href="#top" className="flex items-center gap-2.5">
            <img src="/logo_kilatgo_bg.png" alt="KilatGo" className="w-9 h-9 object-contain bg-white rounded-lg p-0.5" />
            <span className="text-lg font-bold tracking-tight text-white">KilatGo</span>
          </a>
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-kilatgo-200">
            <a href="#layanan" className="hover:text-white transition">Layanan</a>
            <a href="#fitur" className="hover:text-white transition">Fitur</a>
            <a href="#cara-kerja" className="hover:text-white transition">Cara Kerja</a>
            <a href="#driver" className="hover:text-white transition">Jadi Driver</a>
            <a href="#merchant" className="hover:text-white transition">Mitra Usaha</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link to="/daftar-driver" className="hidden sm:inline-flex px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition">
              Gabung Mitra
            </Link>
            <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition">
              Unduh Aplikasi
            </a>
          </div>
        </div>
        <div className="h-px brand-rule opacity-60" />
      </header>

      {/* ===== Hero: split asimetris di atas navy, ditutup strip angka ===== */}
      <section id="top" className="relative overflow-hidden bg-kilatgo-950 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 right-[-10%] w-[680px] h-[680px] rounded-full bg-kilatgo-cyan/20 blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[560px] h-[560px] rounded-full bg-kilatgo-700/40 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-14 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <span className="hero-in inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-kilatgo-100" style={{ '--i': 0 } as React.CSSProperties}>
              <Zap className="w-3.5 h-3.5 text-kilatgo-accent" />
              Ojek online, kirim barang, dan pesan makanan
            </span>
            <h1 className="hero-in text-[2.6rem] sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight leading-[1.04] mt-6 mb-5 text-white" style={{ '--i': 1 } as React.CSSProperties}>
              Pesan ojek,{' '}
              <span className="bg-gradient-to-r from-kilatgo-accent to-kilatgo-accent-light bg-clip-text text-transparent">kilat</span>{' '}
              sampai tujuan
            </h1>
            <p className="hero-in text-lg text-kilatgo-200 max-w-md mb-8 leading-relaxed" style={{ '--i': 2 } as React.CSSProperties}>
              Antar-jemput, kirim paket, dan pesan makanan dari satu aplikasi. Tarif jelas sejak awal.
            </p>
            <div className="hero-in flex flex-wrap items-center gap-3" style={{ '--i': 3 } as React.CSSProperties}>
              <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                <Smartphone className="w-5 h-5" />
                Unduh Aplikasi
              </a>
              <Link to="/daftar-driver" className={btnGhostDark}>
                Gabung Mitra
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Visual: peta asli area operasional + rute. Bukan tangkapan layar buatan. */}
          <div className="hero-in relative" style={{ '--i': 2 } as React.CSSProperties}>
            <div className="rounded-3xl bg-white/5 border border-white/12 p-3 shadow-2xl shadow-kilatgo-950/60">
              <div className="relative h-[300px] sm:h-[340px] rounded-2xl overflow-hidden">
                <iframe
                  title="Area operasional KilatGo di Stabat, Langkat"
                  src={OSM_EMBED}
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-kilatgo-950/70 via-kilatgo-950/10 to-transparent" />
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M14 24 Q 52 30 58 58 T 84 80" fill="none" stroke="#0a1f4d" strokeWidth="5.5" strokeLinecap="round" opacity="0.75" />
                  <path d="M14 24 Q 52 30 58 58 T 84 80" fill="none" stroke="#facc15" strokeWidth="2.6" strokeDasharray="5 4" strokeLinecap="round" />
                </svg>
                <span className="absolute left-[14%] top-[24%] -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-kilatgo-accent ring-4 ring-kilatgo-950/60 flex items-center justify-center">
                  <Motorbike className="w-4 h-4 text-kilatgo-950" />
                </span>
                <MapPin className="absolute left-[84%] top-[80%] w-8 h-8 -translate-x-1/2 -translate-y-full text-kilatgo-950 fill-kilatgo-accent" />
                <p className="absolute bottom-3 left-4 right-4 text-xs text-kilatgo-100">
                  Area operasional: Stabat, Kabupaten Langkat, Sumatera Utara.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {services.map((s) => (
                  <div key={s.name} className="rounded-xl bg-white/8 border border-white/10 py-2.5 flex flex-col items-center gap-1.5">
                    <s.icon className="w-4 h-4 text-kilatgo-accent" />
                    <span className="text-[10.5px] font-semibold text-kilatgo-100">{s.name.replace('Kilat', '')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strip angka: garis rambut, bukan empat kotak kartu. */}
        <div className="relative z-10 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
            {stats.map((s) => (
              <div key={s.label} className="px-2 sm:px-6 py-7 first:pl-0 lg:last:pr-0">
                <p className="text-2xl lg:text-3xl font-bold text-kilatgo-accent">{s.value}</p>
                <p className="text-[13px] text-kilatgo-300 mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Layanan: bento 4 sel, ukuran & latar bervariasi ===== */}
      <section id="layanan" className="py-20 lg:py-28 bg-kilatgo-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <SectionHead eyebrow="Layanan" title="Empat layanan, satu aplikasi">
            Dari antar-jemput sampai pesan makan malam, semuanya dipesan lewat aplikasi yang sama.
          </SectionHead>

          {/* Empat sel untuk empat layanan: satu sel lebar di atas, tiga sel sejajar
              di bawah. Jangan pakai row-span di grid 3 kolom (menyisakan sel kosong). */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 reveal-stagger">
            <div className="sm:col-span-2 lg:col-span-3 relative overflow-hidden rounded-3xl bg-gradient-to-br from-kilatgo-800 via-kilatgo-700 to-kilatgo-cyan p-8 lg:p-10">
              <div className="absolute -top-28 -right-16 w-96 h-96 rounded-full bg-kilatgo-accent/15 blur-3xl" />
              <div className="relative z-10 grid lg:grid-cols-[1.15fr_auto] gap-7 lg:gap-12 lg:items-end">
                <div>
                  <Motorbike className="w-10 h-10 text-kilatgo-accent" />
                  <h3 className="text-2xl lg:text-3xl font-bold text-white mt-4">KilatRide</h3>
                  <p className="text-kilatgo-100 mt-2 max-w-xl leading-relaxed">
                    {services[0].desc} Driver terdekat otomatis ditawari ordermu, posisinya terpantau di peta sampai tiba.
                  </p>
                </div>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:translate-y-px w-fit shrink-0">
                  Pesan sekarang <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {services.slice(1).map((s, i) => {
              // Tiga latar berbeda supaya baris ini tidak terbaca sebagai tiga kartu kembar.
              const tone = [
                'bg-white border-slate-100 hover:border-kilatgo-300',
                'bg-kilatgo-950 border-kilatgo-900',
                'bg-gradient-to-br from-kilatgo-100 to-kilatgo-50 border-kilatgo-200/70',
              ][i];
              const dark = i === 1;
              return (
                <div key={s.name} className={`rounded-3xl border p-6 lg:p-7 min-h-[188px] flex flex-col justify-between transition-colors ${tone}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-white'}`}>
                    <s.icon className={`w-5 h-5 ${dark ? 'text-kilatgo-accent' : 'text-kilatgo-600'}`} />
                  </div>
                  <div className="mt-5">
                    <h3 className={`text-lg font-bold ${dark ? 'text-white' : ''}`}>{s.name}</h3>
                    <p className={`text-sm mt-1.5 leading-relaxed ${dark ? 'text-kilatgo-200' : 'text-slate-500'}`}>{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Cara kerja: garis waktu bernomor ===== */}
      <section id="cara-kerja" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <SectionHead title="Tiga langkah sampai tujuan" align="center">
            Tanpa ribet. Beberapa ketukan, driver langsung berangkat menjemput.
          </SectionHead>
          <div className="relative">
            <div className="hidden md:block absolute left-[16%] right-[16%] top-8 h-px bg-gradient-to-r from-kilatgo-100 via-kilatgo-300 to-kilatgo-100" />
            <div className="grid md:grid-cols-3 gap-10 md:gap-8 reveal-stagger">
              {steps.map((s, i) => (
                <div key={s.title} className="relative text-center md:px-6">
                  <div className="relative mx-auto w-16 h-16 rounded-2xl bg-kilatgo-950 flex items-center justify-center">
                    <s.icon className="w-7 h-7 text-kilatgo-accent" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-kilatgo-accent text-kilatgo-950 text-sm font-bold flex items-center justify-center ring-4 ring-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mt-5">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-2 max-w-xs mx-auto">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Fitur: dua kolom garis rambut, tanpa kotak kartu ===== */}
      <section id="fitur" className="py-20 lg:py-28 bg-kilatgo-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start reveal">
            <p className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider mb-2.5">Fitur Aplikasi</p>
            <h2 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.1] tracking-tight">
              Hal kecil yang bikin perjalanan lebih tenang
            </h2>
            <p className="text-slate-500 mt-4 leading-relaxed">
              Semua yang di bawah ini sudah berjalan di aplikasi, bukan rencana.
            </p>
            <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className={`${btnSolidBlue} mt-7`}>
              <Smartphone className="w-5 h-5" />
              Coba aplikasinya
            </a>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-10 reveal-stagger">
            {appFeatures.map((f) => (
              <div key={f.title} className="flex items-start gap-4 py-5 border-b border-slate-200/80">
                <span className="shrink-0 w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center">
                  <f.icon className="w-[18px] h-[18px] text-kilatgo-600" />
                </span>
                <div>
                  <h3 className="font-semibold text-[15px]">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Kenapa bergabung ===== */}
      <section id="kenapa-gabung" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <SectionHead eyebrow="Kenapa Bergabung" title="Dibangun untuk mitra, bukan cuma untuk pengguna" align="center">
            Aturan jelas, pendapatan tercatat, dan alat kerja lengkap dalam satu aplikasi.
          </SectionHead>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 reveal-stagger">
            {joinReasons.map((r, i) => (
              <div key={r.title}
                className={`rounded-3xl p-6 lg:p-7 ${
                  i % 5 === 0
                    ? 'bg-gradient-to-br from-kilatgo-50 to-kilatgo-100 border border-kilatgo-100'
                    : 'bg-slate-50 border border-slate-100'
                }`}>
                <r.icon className="w-6 h-6 text-kilatgo-600" />
                <h3 className="font-bold mt-4">{r.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mt-1.5">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Band mitra: driver lalu mitra usaha (satu blok navy) ===== */}
      <section className="bg-kilatgo-950 text-white relative overflow-hidden">
        <div className="absolute -top-32 left-[-10%] w-[520px] h-[520px] rounded-full bg-kilatgo-700/35 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-[-10%] w-[520px] h-[520px] rounded-full bg-kilatgo-cyan/15 blur-3xl pointer-events-none" />

        {/* Driver */}
        <div id="driver" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div className="reveal">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-kilatgo-100 mb-5">
                <Users className="w-3.5 h-3.5 text-kilatgo-accent" />
                Untuk Driver
                {!driverOpen && <span className="text-amber-300">· pendaftaran ditutup</span>}
              </span>
              <h2 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.1] tracking-tight text-white mb-4">
                Narik bareng KilatGo, jam kerja kamu yang atur
              </h2>
              <p className="text-kilatgo-200 leading-relaxed mb-8">
                Satu akun driver bisa menerima order ojek, mobil, kirim barang, dan antar makanan.
                Order terdekat ditawarkan otomatis, pendapatan tercatat rapi di dompet mitra.
              </p>
              <ul className="space-y-3 mb-8">
                {driverBenefits.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-kilatgo-100">
                    <CheckCircle2 className="w-5 h-5 text-kilatgo-accent shrink-0 mt-px" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                {driverOpen ? (
                  <Link to="/daftar-driver" className={btnPrimary}>
                    Daftar jadi Driver
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-kilatgo-200 bg-white/5 border border-white/10">
                    <Lock className="w-4 h-4" />
                    Pendaftaran ditutup
                  </span>
                )}
                <a href={waLink} target="_blank" rel="noopener noreferrer" className={btnGhostDark}>
                  <MessageCircle className="w-4 h-4" />
                  Tanya via WhatsApp
                </a>
              </div>
            </div>

            <div className="space-y-4 reveal">
              <div className="rounded-3xl bg-white/6 border border-white/12 p-6 sm:p-7">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                  <ClipboardList className="w-5 h-5 text-kilatgo-accent" />
                  Syarat pendaftaran
                </h3>
                <ul className="space-y-2.5">
                  {driverRequirements.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-kilatgo-200">
                      <ChevronRight className="w-4 h-4 text-kilatgo-accent shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
                {packagePrice > 0 && (
                  <p className="mt-5 flex items-start gap-2.5 text-xs text-kilatgo-300 border-t border-white/10 pt-4">
                    <Package className="w-4 h-4 text-kilatgo-accent shrink-0 mt-px" />
                    <span>
                      Setelah lolos verifikasi tersedia Paket Mitra Driver (jaket dan helm SNI) seharga{' '}
                      <b className="text-white">{rp(packagePrice)}</b>, bisa diambil lewat aplikasi driver.
                    </span>
                  </p>
                )}
              </div>
              <div className="rounded-3xl bg-white/6 border border-white/12 p-6 sm:p-7">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                  <CalendarClock className="w-5 h-5 text-kilatgo-accent" />
                  Alur pendaftaran
                </h3>
                <ol className="space-y-4">
                  {driverSteps.map((t, i) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="w-7 h-7 shrink-0 rounded-full bg-kilatgo-accent text-kilatgo-950 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-kilatgo-100 pt-1">{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-10"><div className="h-px brand-rule opacity-50" /></div>

        {/* Mitra usaha */}
        <div id="merchant" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 lg:pb-28">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-start">
            <div className="reveal">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-kilatgo-100 mb-5">
                <Store className="w-3.5 h-3.5 text-kilatgo-accent" />
                Untuk Mitra Usaha
                {!merchantOpen && <span className="text-amber-300">· pendaftaran ditutup</span>}
              </span>
              <h2 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.1] tracking-tight text-white mb-4">
                Jualanmu naik kelas di KilatFood
              </h2>
              <p className="text-kilatgo-200 leading-relaxed mb-8">
                Daftarkan warung, resto, atau UMKM kulinermu. Kelola menu dan stok dari aplikasi mitra,
                terima pesanan yang diantar driver KilatGo, lalu cairkan saldo penjualan kapan pun.
              </p>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-8">
                {merchantBenefits.map((t) => (
                  <div key={t} className="flex items-start gap-3 text-sm text-kilatgo-100">
                    <CheckCircle2 className="w-5 h-5 text-kilatgo-accent shrink-0 mt-px" />
                    {t}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {merchantOpen ? (
                  <Link to="/daftar-merchant" className={btnPrimary}>
                    Daftarkan Usaha
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-kilatgo-200 bg-white/5 border border-white/10">
                    <Lock className="w-4 h-4" />
                    Pendaftaran ditutup
                  </span>
                )}
                <a href={waLink} target="_blank" rel="noopener noreferrer" className={btnGhostDark}>
                  <MessageCircle className="w-4 h-4" />
                  Tanya via WhatsApp
                </a>
              </div>
            </div>

            <div className="space-y-4 reveal">
              <div className="rounded-3xl bg-white/6 border border-white/12 p-6 sm:p-7">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                  <ClipboardList className="w-5 h-5 text-kilatgo-accent" />
                  Syarat usaha
                </h3>
                <ul className="space-y-2.5">
                  {merchantRequirements.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-kilatgo-200">
                      <ChevronRight className="w-4 h-4 text-kilatgo-accent shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-white/6 border border-white/12 p-6 sm:p-7">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                  <CalendarClock className="w-5 h-5 text-kilatgo-accent" />
                  Alur pendaftaran
                </h3>
                <ol className="space-y-4">
                  {merchantSteps.map((t, i) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="w-7 h-7 shrink-0 rounded-full bg-kilatgo-accent text-kilatgo-950 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-kilatgo-100 pt-1">{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: DollarSign, t: 'Tanpa biaya bulanan' },
                  { icon: Megaphone, t: 'Bisa dipromosikan' },
                  { icon: ShieldCheck, t: 'Pembayaran tercatat' },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl bg-white/6 border border-white/10 p-3.5 text-center">
                    <x.icon className="w-[18px] h-[18px] text-kilatgo-accent mx-auto" />
                    <p className="text-[11.5px] font-semibold text-kilatgo-100 mt-2 leading-snug">{x.t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Daftar cepat ===== */}
      <section id="daftar-cepat" className="py-20 lg:py-28 bg-kilatgo-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-kilatgo-950/5 overflow-hidden grid lg:grid-cols-2">
            <div className="p-8 lg:p-11">
              <h2 className="text-2xl lg:text-3xl font-bold leading-tight">Mulai jadi mitra dari empat data ini</h2>
              <p className="text-slate-500 mt-3 leading-relaxed">
                Belum siap mengisi formulir panjang? Isi data dasar di sini, kamu langsung diarahkan
                ke formulir lengkap dengan data yang sudah terisi.
              </p>
              <ul className="mt-6 space-y-2.5">
                {['Gratis, tanpa biaya pendaftaran', 'Dokumen bisa diunggah dari HP', 'Status pendaftaran diinformasikan tim kami'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 className="w-[18px] h-[18px] text-kilatgo-600 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-4 text-sm font-semibold">
                <a href="#driver" className="inline-flex items-center gap-1.5 text-kilatgo-600 hover:underline">
                  <Users className="w-4 h-4" /> Syarat driver
                </a>
                <a href="#merchant" className="inline-flex items-center gap-1.5 text-kilatgo-600 hover:underline">
                  <Store className="w-4 h-4" /> Syarat mitra usaha
                </a>
              </div>
            </div>

            <div className="bg-kilatgo-950 p-8 lg:p-11">
              <form onSubmit={handleMitraSubmit} className="space-y-4">
                <div>
                  <label htmlFor="mf-name" className="block text-sm font-medium text-kilatgo-100 mb-1.5">Nama lengkap</label>
                  <input id="mf-name" required name="name" type="text" placeholder="Nama sesuai KTP" className={inputDark} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mf-phone" className="block text-sm font-medium text-kilatgo-100 mb-1.5">Nomor HP</label>
                    <input id="mf-phone" required name="phone" type="tel" placeholder="08xxxxxxxxxx" className={inputDark} />
                  </div>
                  <div>
                    <label htmlFor="mf-email" className="block text-sm font-medium text-kilatgo-100 mb-1.5">Email</label>
                    <input id="mf-email" required name="email" type="email" placeholder="nama@email.com" className={inputDark} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="mf-city" className="block text-sm font-medium text-kilatgo-100 mb-1.5">Kota</label>
                    <input id="mf-city" required name="city" type="text" placeholder="Kota domisili" className={inputDark} />
                  </div>
                  <div>
                    <label htmlFor="mf-type" className="block text-sm font-medium text-kilatgo-100 mb-1.5">Jenis mitra</label>
                    <div className="relative">
                      <select id="mf-type" required name="mitraType" defaultValue=""
                        className={`${inputDark} peer appearance-none pr-11 cursor-pointer`}>
                        <option value="" disabled hidden className="text-slate-900">Pilih jenis mitra</option>
                        <option value="driver" className="text-slate-900">Driver</option>
                        <option value="merchant" className="text-slate-900">Mitra usaha</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-kilatgo-300" />
                    </div>
                  </div>
                </div>
                <button type="submit" className={`${btnPrimary} w-full mt-2`}>
                  <Send className="w-4 h-4" />
                  Lanjut ke formulir
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-20 lg:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-10">
          <SectionHead eyebrow="FAQ" title="Pertanyaan yang sering diajukan" align="center">
            Belum ketemu jawabannya? Hubungi kami lewat WhatsApp di bawah.
          </SectionHead>
          <div className="divide-y divide-slate-200">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q}>
                  <button onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-4 text-left group" aria-expanded={open}>
                    <span className={`font-semibold transition-colors ${open ? 'text-kilatgo-600' : 'text-kilatgo-950 group-hover:text-kilatgo-700'}`}>{f.q}</span>
                    <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${open ? 'bg-kilatgo-600 text-white' : 'bg-kilatgo-50 text-kilatgo-600'}`}>
                      {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                  {open && <p className="pb-5 text-sm text-slate-500 leading-relaxed max-w-[62ch]">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Kontak ===== */}
      <section id="kontak" className="py-20 lg:py-24 bg-kilatgo-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
          <div className="reveal">
            <h2 className="text-3xl lg:text-[2.4rem] font-bold leading-[1.1] tracking-tight">Butuh bantuan? Hubungi kami</h2>
            <p className="text-slate-500 mt-4 leading-relaxed">
              Tim dukungan KilatGo siap membantu pengguna maupun mitra. Pengguna aplikasi juga bisa
              memakai live chat langsung di dalam aplikasi.
            </p>
          </div>
          <div className="divide-y divide-slate-200 reveal">
            {contactCards.map((c) => (
              <a key={c.label} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                className="flex items-center gap-4 py-4 group">
                <span className="shrink-0 w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center group-hover:border-kilatgo-300 transition-colors">
                  <c.icon className="w-5 h-5 text-kilatgo-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider">{c.label}</p>
                  <p className="text-sm font-medium text-kilatgo-950 truncate">{c.value}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-kilatgo-500 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA unduh ===== */}
      <section id="download" className="pb-20 lg:pb-24 bg-kilatgo-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-kilatgo-900 via-kilatgo-800 to-kilatgo-700 px-8 py-12 lg:px-14 lg:py-16 text-center">
            <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[560px] h-[440px] rounded-full bg-kilatgo-accent/12 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-bold text-white">Siap berangkat bareng KilatGo?</h2>
              <p className="text-kilatgo-200 max-w-lg mx-auto mt-4">
                Unduh aplikasinya untuk memesan, atau gabung jadi mitra kalau kamu mau cari penghasilan
                dan menjual lebih banyak bersama KilatGo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                  <Smartphone className="w-5 h-5" />
                  Unduh Aplikasi
                </a>
                <Link to="/daftar-driver" className={btnGhostDark}>
                  <Users className="w-4 h-4" />
                  Jadi Driver
                </Link>
                <Link to="/daftar-merchant" className={btnGhostDark}>
                  <Store className="w-4 h-4" />
                  Jadi Mitra Usaha
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-kilatgo-950 text-white">
        <div className="h-px brand-rule opacity-50" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo_kilatgo_bg.png" alt="KilatGo" className="w-10 h-10 object-contain bg-white rounded-lg p-0.5" />
              <span className="text-lg font-bold tracking-tight text-white">KilatGo</span>
            </div>
            <p className="text-sm text-kilatgo-300 max-w-sm leading-relaxed">
              Layanan transportasi dan pengantaran on-demand: antar-jemput, kirim barang, dan pesan
              makanan dalam satu aplikasi.
            </p>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 text-sm font-semibold text-kilatgo-accent hover:gap-3 transition-all">
              <MessageCircle className="w-4 h-4" /> Chat WhatsApp
            </a>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Layanan</h4>
            <ul className="space-y-2.5 text-sm text-kilatgo-300">
              {services.map((s) => (
                <li key={s.name}><a href="#layanan" className="hover:text-kilatgo-accent transition">{s.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Gabung Mitra</h4>
            <ul className="space-y-2.5 text-sm text-kilatgo-300">
              <li><Link to="/daftar-driver" className="hover:text-kilatgo-accent transition">Daftar Mitra Driver</Link></li>
              <li><Link to="/daftar-merchant" className="hover:text-kilatgo-accent transition">Daftar Mitra Usaha</Link></li>
              <li><a href="#driver" className="hover:text-kilatgo-accent transition">Syarat dan alur driver</a></li>
              <li><a href="#merchant" className="hover:text-kilatgo-accent transition">Syarat dan alur usaha</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Informasi</h4>
            <ul className="space-y-2.5 text-sm text-kilatgo-300">
              <li><a href="#fitur" className="hover:text-kilatgo-accent transition">Fitur Aplikasi</a></li>
              <li><Link to="/faq" className="hover:text-kilatgo-accent transition">FAQ dan Bantuan</Link></li>
              <li><Link to="/kontak" className="hover:text-kilatgo-accent transition">Kontak</Link></li>
              <li><Link to="/syarat-ketentuan" className="hover:text-kilatgo-accent transition">Syarat dan Ketentuan</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-kilatgo-400">
            <span>© 2026 KilatGo. Seluruh hak cipta dilindungi.</span>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <Link to="/faq" className="hover:text-kilatgo-accent transition">FAQ</Link>
              <Link to="/refund-policy" className="hover:text-kilatgo-accent transition">Kebijakan Refund</Link>
              <Link to="/syarat-ketentuan" className="hover:text-kilatgo-accent transition">Syarat &amp; Ketentuan</Link>
              <Link to="/kebijakan-privasi" className="hover:text-kilatgo-accent transition">Kebijakan Privasi</Link>
              <Link to="/kontak" className="hover:text-kilatgo-accent transition">Kontak</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
