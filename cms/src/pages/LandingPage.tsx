import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPublicSettings } from '../api/admin';
import {
  Zap,
  Motorbike,
  Package,
  UtensilsCrossed,
  MapPin,
  Shield,
  Clock,
  Wallet,
  Star,
  ArrowRight,
  Smartphone,
  CheckCircle2,
  Navigation,
  Plus,
  Minus,
  Mail,
  Phone,
  MessageCircle,
  Send,
} from 'lucide-react';

const services = [
  { icon: Motorbike, name: 'KilatRide', desc: 'Ojek motor cepat sampai tujuan, tarif transparan.' },
  { icon: Package, name: 'KilatSend', desc: 'Kirim paket & dokumen instan dalam kota.' },
  { icon: UtensilsCrossed, name: 'KilatFood', desc: 'Pesan makanan favorit, diantar hangat.' },
];

const steps = [
  { icon: MapPin, title: 'Tentukan tujuan', desc: 'Masukkan titik jemput dan tujuan kamu di aplikasi.' },
  { icon: Navigation, title: 'Driver menjemput', desc: 'Driver terdekat langsung berangkat, pantau real-time.' },
  { icon: CheckCircle2, title: 'Sampai tujuan', desc: 'Nikmati perjalanan, bayar cashless, beri rating.' },
];

const benefits = [
  { icon: Zap, title: 'Cepat & responsif', desc: 'Pencarian driver dalam hitungan detik berkat jaringan mitra luas.' },
  { icon: Shield, title: 'Aman & terpercaya', desc: 'Driver terverifikasi, perjalanan terlacak, dan asuransi perjalanan.' },
  { icon: Wallet, title: 'Harga transparan', desc: 'Tarif jelas di awal, tanpa biaya tersembunyi.' },
  { icon: Clock, title: 'Siap 24 jam', desc: 'Butuh transportasi kapan pun? KilatGo selalu siaga.' },
];

const stats = [
  { value: '10rb+', label: 'Driver mitra' },
  { value: '50rb+', label: 'Pengguna aktif' },
  { value: '25+', label: 'Kota terjangkau' },
  { value: '4.9', label: 'Rating aplikasi' },
];

const faqs = [
  { q: 'Bagaimana cara memesan di KilatGo?', a: 'Buka aplikasi, tentukan titik jemput & tujuan, pilih layanan, lalu konfirmasi. Driver terdekat langsung menuju lokasimu.' },
  { q: 'Metode pembayaran apa saja yang didukung?', a: 'Tunai maupun cashless lewat KilatPay. Tarif selalu tampil di awal sebelum kamu memesan.' },
  { q: 'Apakah wilayah saya sudah terjangkau?', a: 'KilatGo hadir di 25+ kota dan terus bertambah. Cek ketersediaan langsung di aplikasi.' },
  { q: 'Bagaimana cara menjadi mitra driver?', a: 'Isi formulir pendaftaran mitra di bawah. Tim kami akan menghubungi untuk proses verifikasi dokumen.' },
  { q: 'Apakah perjalanan saya diasuransikan?', a: 'Ya, setiap perjalanan dilindungi asuransi dan dapat dilacak real-time demi keamananmu.' },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const navigate = useNavigate();

  // Kontak dari Pengaturan (dengan fallback default).
  const [contact, setContact] = useState({
    contact_email: 'costumerservice@kilatgo.com',
    contact_phone: '0895418213962',
    contact_whatsapp: '0895418213962',
    contact_address: 'Dusun 3 Rejo Sari, Kwala Begumit, Kec. Stabat, Kab. Langkat, Sumatera Utara',
  });
  useEffect(() => {
    getPublicSettings().then((s) => setContact((c) => ({ ...c, ...s }))).catch(() => {});
  }, []);
  const intl = (p: string) => '62' + (p || '').replace(/[^0-9]/g, '').replace(/^0/, '');
  const contactCards = [
    { icon: Mail, label: 'Email', value: contact.contact_email, href: `mailto:${contact.contact_email}` },
    { icon: Phone, label: 'Telepon', value: contact.contact_phone, href: `tel:+${intl(contact.contact_phone)}` },
    { icon: MessageCircle, label: 'WhatsApp', value: contact.contact_whatsapp, href: `https://wa.me/${intl(contact.contact_whatsapp)}` },
    { icon: MapPin, label: 'Alamat', value: contact.contact_address, href: `https://maps.google.com/?q=${encodeURIComponent(contact.contact_address)}` },
  ];

  // Driver → lanjut ke form lengkap (prefill). Merchant → Fase 2 (teaser terkirim).
  const handleMitraSubmit = (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const state = {
      name: fd.get('name'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      city: fd.get('city'),
    };
    navigate(fd.get('mitraType') === 'merchant' ? '/daftar-merchant' : '/daftar-driver', { state });
  };

  return (
    <div className="bg-white text-slate-900">
      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-40 bg-kilatgo-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto h-18 flex items-center justify-between px-6 lg:px-10 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo_kilatgo_bg.png"
              alt="KilatGo"
              className="w-11 h-11 object-contain bg-white rounded-xl p-1"
            />
            <span className="text-xl font-bold tracking-tight text-white">KilatGo</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-kilatgo-200">
            <a href="#layanan" className="hover:text-white transition">Layanan</a>
            <a href="#cara-kerja" className="hover:text-white transition">Cara Kerja</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <a href="#mitra" className="hover:text-white transition">Jadi Mitra</a>
            <a href="#kontak" className="hover:text-white transition">Kontak</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="#download"
              className="hidden sm:inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:scale-[0.98]"
            >
              Download Aplikasi
            </a>
            <Link
              to="/login"
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/15 hover:bg-white/10 transition"
            >
              Masuk Admin
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-kilatgo-950 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-1/4 -right-1/4 w-[700px] h-[700px] rounded-full bg-kilatgo-700/40 blur-3xl" />
          <div className="absolute -bottom-1/3 -left-1/4 w-[600px] h-[600px] rounded-full bg-kilatgo-accent/10 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-kilatgo-200 mb-6">
              <Zap className="w-3.5 h-3.5 text-kilatgo-accent" />
              Ride-hailing • Ojek Online #1
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6 text-white">
              Pesan ojek,{' '}
              <span className="text-kilatgo-accent">kilat</span> sampai tujuan
            </h1>
            <p className="text-lg text-kilatgo-200 max-w-lg mb-8 leading-relaxed">
              Satu aplikasi untuk semua kebutuhan mobilitasmu — antar-jemput,
              kirim barang, pesan makanan, sampai belanja harian. Cepat, aman,
              dan harga transparan.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#download"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:scale-[0.98] shadow-lg shadow-kilatgo-accent/20"
              >
                <Smartphone className="w-5 h-5" />
                Pesan Sekarang
              </a>
              <a
                href="#cara-kerja"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white border border-white/15 hover:bg-white/10 transition"
              >
                Cara Kerja
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <div className="flex items-center gap-6 mt-10 text-sm text-kilatgo-300">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-kilatgo-accent fill-kilatgo-accent" />
                <span className="font-semibold text-white">4.9</span> rating
              </div>
              <div className="w-px h-5 bg-white/15" />
              <span><span className="font-semibold text-white">50rb+</span> pengguna aktif</span>
            </div>
          </div>

          {/* Visual: fake map/order card */}
          <div className="relative">
            <div className="relative mx-auto w-full max-w-sm rounded-[2rem] bg-gradient-to-b from-kilatgo-800 to-kilatgo-900 border border-white/10 p-4 shadow-2xl shadow-kilatgo-950/60">
              {/* map area — peta asli OpenStreetMap */}
              <div className="relative h-64 rounded-3xl overflow-hidden">
                <iframe
                  title="Peta KilatGo"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=106.79%2C-6.24%2C106.88%2C-6.16&layer=mapnik"
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                  loading="lazy"
                />
                {/* polyline rute */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* halo navy biar polyline kontras di peta */}
                  <path d="M12 20 Q 55 25 60 55 T 86 78" fill="none" stroke="#0a1f4d" strokeWidth="5" strokeLinecap="round" />
                  <path d="M12 20 Q 55 25 60 55 T 86 78" fill="none" stroke="#facc15" strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" />
                </svg>
                {/* foto driver di ujung awal garis */}
                <div className="absolute left-[12%] top-[20%] -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <img
                      src="https://i.pravatar.cc/100?img=12"
                      alt="Driver"
                      className="w-12 h-12 rounded-full object-cover ring-4 ring-kilatgo-accent shadow-lg shadow-kilatgo-950/40"
                    />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-kilatgo-accent flex items-center justify-center ring-2 ring-white">
                      <Motorbike className="w-3.5 h-3.5 text-kilatgo-950" />
                    </span>
                  </div>
                </div>
                {/* marker tujuan di ujung akhir garis */}
                <div className="absolute left-[86%] top-[78%] -translate-x-1/2 -translate-y-full">
                  <MapPin className="w-8 h-8 text-kilatgo-950 fill-kilatgo-accent drop-shadow-lg" />
                </div>
              </div>
              {/* driver card */}
              <div className="mt-4 p-4 rounded-2xl bg-white/10 border border-white/10">
                <div className="flex items-center gap-3">
                  <img src="https://i.pravatar.cc/100?img=12" alt="Budi Santoso" className="w-11 h-11 rounded-full object-cover ring-2 ring-kilatgo-accent/40" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Budi Santoso</p>
                    <p className="text-xs text-kilatgo-300 flex items-center gap-1">
                      <Star className="w-3 h-3 text-kilatgo-accent fill-kilatgo-accent" /> 4.9 • B 1234 KLT
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-kilatgo-accent/20 text-kilatgo-accent text-xs font-semibold">3 mnt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className="bg-kilatgo-900 text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-kilatgo-accent">{s.value}</p>
              <p className="text-sm text-kilatgo-300 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Layanan ===== */}
      <section id="layanan" className="py-20 lg:py-28 bg-kilatgo-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider">Layanan</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-2 mb-4">Semua ada dalam satu aplikasi</h2>
            <p className="text-slate-500">Dari antar-jemput sampai belanja harian, KilatGo siap membantu keseharianmu.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => (
              <div
                key={s.name}
                className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-kilatgo-200 hover:shadow-xl hover:shadow-kilatgo-950/5 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-kilatgo-50 group-hover:bg-kilatgo-accent/15 flex items-center justify-center mb-4 transition-colors">
                  <s.icon className="w-6 h-6 text-kilatgo-600 group-hover:text-kilatgo-accent-dark transition-colors" />
                </div>
                <h3 className="text-lg font-semibold mb-1.5">{s.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Cara Kerja ===== */}
      <section id="cara-kerja" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider">Cara Kerja</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-2 mb-4">Pesan dalam 3 langkah mudah</h2>
            <p className="text-slate-500">Tanpa ribet — cukup beberapa ketukan, driver langsung menjemput.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {steps.map((s, i) => (
              <div key={s.title} className="relative text-center px-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-kilatgo-950 flex items-center justify-center mb-5 relative">
                  <s.icon className="w-7 h-7 text-kilatgo-accent" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-kilatgo-accent text-kilatgo-950 text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Keunggulan ===== */}
      <section id="keunggulan" className="py-20 lg:py-28 bg-kilatgo-950 text-white relative overflow-hidden">
        <div className="absolute -top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-kilatgo-accent/5 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-sm font-semibold text-kilatgo-accent uppercase tracking-wider">Keunggulan</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-2 mb-4 text-white">Kenapa pilih KilatGo?</h2>
            <p className="text-kilatgo-200">Dibangun untuk kecepatan, keamanan, dan kenyamanan setiap perjalananmu.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-kilatgo-accent/15 flex items-center justify-center mb-4">
                  <b.icon className="w-6 h-6 text-kilatgo-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-1.5 text-white">{b.title}</h3>
                <p className="text-sm text-kilatgo-300 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-20 lg:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider">FAQ</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-2 mb-4">Pertanyaan yang sering diajukan</h2>
            <p className="text-slate-500">Belum menemukan jawabannya? Hubungi kami di bagian kontak.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition"
                    aria-expanded={open}
                  >
                    <span className="font-semibold text-kilatgo-950">{f.q}</span>
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-kilatgo-50 flex items-center justify-center text-kilatgo-600">
                      {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">{f.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Daftar Mitra Driver ===== */}
      <section id="mitra" className="py-20 lg:py-28 bg-kilatgo-950 text-white relative overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-kilatgo-700/30 blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 lg:px-10 relative z-10 grid lg:grid-cols-2 gap-14 items-center">
          {/* Copy */}
          <div>
            <span className="text-sm font-semibold text-kilatgo-accent uppercase tracking-wider">Jadi Mitra</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-2 mb-4 text-white">Gabung jadi mitra driver KilatGo</h2>
            <p className="text-kilatgo-200 mb-8 leading-relaxed">
              Penghasilan fleksibel, jam kerja bebas, dan bonus harian. Daftarkan dirimu
              sekarang — tim kami akan menghubungi untuk proses verifikasi.
            </p>
            <ul className="space-y-3">
              {['Penghasilan kompetitif + bonus', 'Atur jadwal kerjamu sendiri', 'Perlindungan asuransi mitra', 'Dukungan 24 jam'].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-kilatgo-100">
                  <CheckCircle2 className="w-5 h-5 text-kilatgo-accent shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div className="rounded-3xl bg-white/5 border border-white/10 p-6 sm:p-8 backdrop-blur-sm">
            <form onSubmit={handleMitraSubmit} className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-1">Formulir Pendaftaran Mitra</h3>
                <p className="text-sm text-kilatgo-300 mb-4">Isi data di bawah ini dengan lengkap.</p>
                <div>
                  <label className="block text-sm text-kilatgo-200 mb-1.5">Nama lengkap</label>
                  <input required name="name" type="text" placeholder="Nama sesuai KTP" className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-kilatgo-400 focus:ring-2 focus:ring-kilatgo-accent focus:border-kilatgo-accent outline-none transition" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-kilatgo-200 mb-1.5">Nomor HP</label>
                    <input required name="phone" type="tel" placeholder="08xxxxxxxxxx" className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-kilatgo-400 focus:ring-2 focus:ring-kilatgo-accent focus:border-kilatgo-accent outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm text-kilatgo-200 mb-1.5">Email</label>
                    <input required name="email" type="email" placeholder="nama@email.com" className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-kilatgo-400 focus:ring-2 focus:ring-kilatgo-accent focus:border-kilatgo-accent outline-none transition" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-kilatgo-200 mb-1.5">Kota</label>
                    <input required name="city" type="text" placeholder="Kota domisili" className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-kilatgo-400 focus:ring-2 focus:ring-kilatgo-accent focus:border-kilatgo-accent outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm text-kilatgo-200 mb-1.5">Jenis mitra</label>
                    <select required name="mitraType" defaultValue="" className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white focus:ring-2 focus:ring-kilatgo-accent focus:border-kilatgo-accent outline-none transition">
                      <option value="" disabled className="text-slate-900">Pilih jenis mitra</option>
                      <option value="driver" className="text-slate-900">Driver</option>
                      <option value="merchant" className="text-slate-900">Merchant</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:scale-[0.98] shadow-lg shadow-kilatgo-accent/20">
                  <Send className="w-4 h-4" />
                  Daftar Sekarang
                </button>
              </form>
          </div>
        </div>
      </section>

      {/* ===== Kontak ===== */}
      <section id="kontak" className="py-20 lg:py-28 bg-kilatgo-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider">Kontak Kami</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-2 mb-4">Butuh bantuan? Hubungi kami</h2>
            <p className="text-slate-500">Tim dukungan KilatGo siap membantu setiap hari.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {contactCards.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-kilatgo-200 hover:shadow-xl hover:shadow-kilatgo-950/5 transition-all text-center"
              >
                <div className="mx-auto w-12 h-12 rounded-xl bg-kilatgo-50 group-hover:bg-kilatgo-accent/15 flex items-center justify-center mb-4 transition-colors">
                  <c.icon className="w-6 h-6 text-kilatgo-600 group-hover:text-kilatgo-accent-dark transition-colors" />
                </div>
                <p className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">{c.label}</p>
                <p className="text-sm font-medium text-kilatgo-950">{c.value}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA Download ===== */}
      <section id="download" className="py-20 lg:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <div className="rounded-3xl bg-gradient-to-br from-kilatgo-800 to-kilatgo-950 p-10 lg:p-14 text-center relative overflow-hidden">
            <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full bg-kilatgo-accent/10 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Siap berangkat bareng KilatGo?</h2>
              <p className="text-kilatgo-200 max-w-lg mx-auto mb-8">
                Unduh aplikasinya sekarang dan nikmati perjalanan kilat pertamamu.
              </p>
              <div className="flex items-center justify-center">
                <a href="#" className="inline-flex items-center gap-3 px-7 py-3.5 rounded-xl bg-kilatgo-accent text-kilatgo-950 font-semibold hover:bg-kilatgo-accent-dark transition active:scale-[0.98] shadow-lg shadow-kilatgo-accent/20">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
                  </svg>
                  Google Play
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-kilatgo-950 text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo_kilatgo_bg.png" alt="KilatGo" className="w-11 h-11 object-contain bg-white rounded-xl p-1" />
              <span className="text-xl font-bold tracking-tight text-white">KilatGo</span>
            </div>
            <p className="text-sm text-kilatgo-300 max-w-sm leading-relaxed">
              Solusi transportasi dan pengantaran on-demand yang cepat, aman, dan terjangkau untuk keseharianmu.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Layanan</h4>
            <ul className="space-y-2.5 text-sm text-kilatgo-300">
              {services.slice(0, 4).map((s) => (
                <li key={s.name}><a href="#layanan" className="hover:text-kilatgo-accent transition">{s.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Perusahaan</h4>
            <ul className="space-y-2.5 text-sm text-kilatgo-300">
              <li><a href="#keunggulan" className="hover:text-kilatgo-accent transition">Tentang Kami</a></li>
              <li><Link to="/login" className="hover:text-kilatgo-accent transition">Masuk Admin</Link></li>
              <li><a href="#download" className="hover:text-kilatgo-accent transition">Jadi Mitra Driver</a></li>
              <li><a href="#" className="hover:text-kilatgo-accent transition">Bantuan</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 text-center text-xs text-kilatgo-400">
            © 2026 KilatGo. Seluruh hak cipta dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}
