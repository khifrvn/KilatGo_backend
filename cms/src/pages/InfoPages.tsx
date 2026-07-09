import { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Phone, MessageCircle, MapPin, ArrowLeft, ChevronDown,
  HelpCircle, RefreshCw, FileText, Headset, Zap,
} from 'lucide-react';
import { getPublicSettings } from '../api/admin';

// ponytail: kontak default = fallback saat Pengaturan belum termuat; sama seperti LandingPage.
const DEFAULT_CONTACT = {
  contact_email: 'costumerservice@kilatgo.com',
  contact_phone: '0895418213962',
  contact_whatsapp: '0895418213962',
  contact_address: 'Dusun 3 Rejo Sari, Kwala Begumit, Kec. Stabat, Kab. Langkat, Sumatera Utara',
};

function useContact() {
  const [contact, setContact] = useState(DEFAULT_CONTACT);
  useEffect(() => {
    getPublicSettings().then((s) => setContact((c) => ({ ...c, ...s }))).catch(() => {});
  }, []);
  return contact;
}

const intl = (p: string) => '62' + (p || '').replace(/[^0-9]/g, '').replace(/^0/, '');

// Layout bersama: nav + hero + isi + footer, mengikuti tema LandingPage.
function InfoLayout({ icon: Icon, eyebrow, title, subtitle, updated, children }: {
  icon: ComponentType<{ className?: string }>; eyebrow: string;
  title: string; subtitle?: string; updated?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-slate-900 min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-kilatgo-950/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto h-18 flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo_kilatgo_bg.png" alt="KilatGo" className="w-11 h-11 object-contain bg-white rounded-xl p-1" />
            <span className="text-xl font-bold tracking-tight text-white">KilatGo</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-kilatgo-200 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Beranda
          </Link>
        </div>
      </header>

      {/* Hero dekoratif — gradient blobs + badge, senada Hero LandingPage */}
      <section className="relative overflow-hidden bg-kilatgo-950 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-kilatgo-700/40 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[500px] h-[500px] rounded-full bg-kilatgo-accent/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:44px_44px]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 lg:py-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-kilatgo-200 mb-6">
            <Icon className="w-3.5 h-3.5 text-kilatgo-accent" />
            {eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-lg text-kilatgo-200 mt-4 max-w-2xl leading-relaxed">{subtitle}</p>}
          {updated && (
            <p className="inline-flex items-center gap-2 text-xs text-kilatgo-300 mt-6 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Zap className="w-3 h-3 text-kilatgo-accent" /> Terakhir diperbarui: {updated}
            </p>
          )}
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 lg:py-16 -mt-8 relative z-10">{children}</main>

      <footer className="bg-kilatgo-950 text-white border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <span className="text-kilatgo-400 text-xs">© 2026 KilatGo. Seluruh hak cipta dilindungi.</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-kilatgo-300">
            <Link to="/faq" className="hover:text-kilatgo-accent transition">FAQ</Link>
            <Link to="/refund-policy" className="hover:text-kilatgo-accent transition">Kebijakan Refund</Link>
            <Link to="/syarat-ketentuan" className="hover:text-kilatgo-accent transition">Syarat &amp; Ketentuan</Link>
            <Link to="/kontak" className="hover:text-kilatgo-accent transition">Kontak</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// Blok teks kebijakan: kartu bernomor.
function Article({ sections }: { sections: { h: string; body: string[] }[] }) {
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <section key={i} className="flex gap-4 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-kilatgo-50 text-kilatgo-600 font-bold flex items-center justify-center">{i + 1}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold mb-2">{s.h}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="text-slate-600 leading-relaxed mb-2 last:mb-0">{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ===== FAQ =====
const FAQS = [
  { q: 'Bagaimana cara memesan di KilatGo?', a: 'Buka aplikasi, tentukan titik jemput & tujuan, pilih layanan (KilatRide, KilatCar, KilatSend, atau KilatFood), lalu konfirmasi. Driver terdekat langsung menuju lokasimu.' },
  { q: 'Metode pembayaran apa saja yang didukung?', a: 'Tunai maupun cashless. Tarif selalu tampil di awal sebelum kamu memesan, tanpa biaya tersembunyi.' },
  { q: 'Apakah wilayah saya sudah terjangkau?', a: 'KilatGo hadir di 25+ kota dan terus bertambah. Cek ketersediaan langsung di aplikasi berdasarkan lokasimu.' },
  { q: 'Bagaimana cara menjadi mitra driver?', a: 'Isi formulir pendaftaran mitra di halaman utama. Tim kami akan menghubungi untuk proses verifikasi dokumen.' },
  { q: 'Apakah perjalanan saya diasuransikan?', a: 'Ya, setiap perjalanan dilindungi asuransi dan dapat dilacak real-time demi keamananmu.' },
  { q: 'Bagaimana jika saya membatalkan pesanan?', a: 'Pembatalan sebelum driver berangkat tidak dikenakan biaya. Setelah driver menuju lokasi, biaya pembatalan dapat berlaku sesuai kebijakan.' },
  { q: 'Bagaimana cara menghubungi customer service?', a: 'Melalui email, telepon, atau WhatsApp yang tercantum di halaman Kontak. Kami siap membantu setiap hari.' },
];

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <InfoLayout icon={HelpCircle} eyebrow="Pusat Bantuan" title="Pertanyaan Umum (FAQ)" subtitle="Jawaban atas pertanyaan yang paling sering ditanyakan seputar layanan KilatGo.">
      <div className="space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition ${open === i ? 'border-kilatgo-300 ring-1 ring-kilatgo-200' : 'border-slate-200/80'}`}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left font-semibold hover:bg-slate-50/70 transition"
            >
              {f.q}
              <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${open === i ? 'rotate-180 text-kilatgo-600' : 'text-slate-400'}`} />
            </button>
            {open === i && <p className="px-6 pb-5 -mt-1 text-slate-600 leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>
    </InfoLayout>
  );
}

// ===== Refund Policy =====
export function RefundPage() {
  return (
    <InfoLayout icon={RefreshCw} eyebrow="Kebijakan" title="Kebijakan Pengembalian Dana (Refund)" updated="8 Juli 2026"
      subtitle="Ketentuan pengembalian dana untuk transaksi yang dilakukan melalui aplikasi KilatGo.">
      <Article sections={[
        { h: 'Ketentuan Umum', body: ['Pengembalian dana (refund) berlaku untuk transaksi yang gagal, dibatalkan sesuai ketentuan, atau tidak sesuai dengan layanan yang dipesan. Setiap pengajuan akan ditinjau oleh tim KilatGo.'] },
        { h: 'Pembatalan oleh Pengguna', body: ['Pembatalan sebelum driver menerima/berangkat ke lokasi tidak dikenakan biaya dan dana dikembalikan penuh.', 'Pembatalan setelah driver menuju lokasi dapat dikenakan biaya pembatalan; sisa dana dikembalikan ke metode pembayaran semula.'] },
        { h: 'Pesanan Gagal atau Bermasalah', body: ['Jika pesanan gagal diproses, pembayaran terpotong ganda, atau layanan tidak diterima, seluruh dana akan dikembalikan 100%.'] },
        { h: 'KilatFood & KilatSend', body: ['Untuk pesanan makanan atau pengiriman barang yang tidak sesuai (rusak, salah, atau tidak sampai), refund diajukan dengan menyertakan bukti (foto/keterangan) melalui customer service.'] },
        { h: 'Proses & Waktu', body: ['Pengajuan refund diproses maksimal 3–7 hari kerja setelah diverifikasi. Dana dikembalikan ke metode pembayaran yang digunakan saat transaksi.'] },
        { h: 'Cara Mengajukan', body: ['Hubungi customer service melalui email, telepon, atau WhatsApp pada halaman Kontak dengan menyertakan nomor pesanan dan alasan pengajuan.'] },
      ]} />
    </InfoLayout>
  );
}

// ===== Syarat & Ketentuan =====
export function TermsPage() {
  return (
    <InfoLayout icon={FileText} eyebrow="Legal" title="Syarat & Ketentuan" updated="8 Juli 2026"
      subtitle="Dengan menggunakan aplikasi dan layanan KilatGo, Anda menyetujui syarat dan ketentuan berikut.">
      <Article sections={[
        { h: 'Penerimaan Ketentuan', body: ['Dengan mengunduh, mendaftar, atau menggunakan layanan KilatGo, Anda menyatakan setuju terikat pada syarat dan ketentuan ini serta kebijakan lain yang berlaku.'] },
        { h: 'Layanan', body: ['KilatGo menyediakan layanan antar-jemput (KilatRide, KilatCar), pengiriman barang (KilatSend), dan pemesanan makanan (KilatFood) yang mempertemukan pengguna dengan mitra driver.'] },
        { h: 'Akun Pengguna', body: ['Pengguna wajib memberikan data yang benar dan menjaga kerahasiaan akunnya. Segala aktivitas pada akun menjadi tanggung jawab pemilik akun.'] },
        { h: 'Kewajiban Pengguna', body: ['Pengguna dilarang menyalahgunakan layanan untuk tujuan melanggar hukum, menipu, atau merugikan pihak lain, termasuk mitra driver.'] },
        { h: 'Tarif & Pembayaran', body: ['Tarif ditampilkan di awal sebelum pemesanan. Pembayaran dilakukan secara tunai maupun cashless sesuai metode yang tersedia.'] },
        { h: 'Pembatalan & Refund', body: ['Pembatalan dan pengembalian dana mengikuti Kebijakan Refund yang berlaku pada halaman terpisah.'] },
        { h: 'Batasan Tanggung Jawab', body: ['KilatGo berupaya menyediakan layanan terbaik, namun tidak bertanggung jawab atas kerugian yang timbul di luar kendali wajar, termasuk keterlambatan akibat kondisi lalu lintas atau cuaca.'] },
        { h: 'Perubahan Ketentuan', body: ['KilatGo dapat memperbarui syarat dan ketentuan ini sewaktu-waktu. Perubahan berlaku sejak dipublikasikan pada halaman ini.'] },
      ]} />
    </InfoLayout>
  );
}

// ===== Kontak =====
export function ContactPage() {
  const contact = useContact();
  const cards = [
    { icon: Mail, label: 'Email', value: contact.contact_email, href: `mailto:${contact.contact_email}` },
    { icon: Phone, label: 'Telepon', value: contact.contact_phone, href: `tel:+${intl(contact.contact_phone)}` },
    { icon: MessageCircle, label: 'WhatsApp', value: contact.contact_whatsapp, href: `https://wa.me/${intl(contact.contact_whatsapp)}` },
    { icon: MapPin, label: 'Alamat Usaha', value: contact.contact_address, href: `https://maps.google.com/?q=${encodeURIComponent(contact.contact_address)}` },
  ];
  return (
    <InfoLayout icon={Headset} eyebrow="Kontak" title="Hubungi Kami" subtitle="Ada pertanyaan atau kendala? Tim customer service KilatGo siap membantu Anda.">
      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
            className="group flex items-start gap-4 p-5 rounded-2xl border border-slate-200 hover:border-kilatgo-200 hover:shadow-lg hover:shadow-kilatgo-950/5 transition">
            <div className="w-11 h-11 rounded-xl bg-kilatgo-50 group-hover:bg-kilatgo-accent/15 flex items-center justify-center shrink-0 transition-colors">
              <c.icon className="w-5 h-5 text-kilatgo-600 group-hover:text-kilatgo-accent-dark transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{c.label}</p>
              <p className="text-slate-700 break-words leading-relaxed">{c.value}</p>
            </div>
          </a>
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-8">
        KilatGo — Solusi transportasi dan pengantaran on-demand. Jam operasional customer service: setiap hari, 24 jam.
      </p>
    </InfoLayout>
  );
}
