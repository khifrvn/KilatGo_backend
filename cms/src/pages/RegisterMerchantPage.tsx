import { useState, useEffect, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Upload, ArrowLeft } from 'lucide-react';
import { registerMerchant } from '../api/auth';
import { getPublicSettings } from '../api/admin';
import { RegistrationClosed } from './RegisterDriverPage';

const inputCls =
  'w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function FileField({ label, name, required }: { label: string; name: string; required?: boolean }) {
  const [fileName, setFileName] = useState('');
  return (
    <Field label={label} required={required}>
      <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 cursor-pointer hover:bg-slate-100 transition">
        <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm text-slate-500 truncate">{fileName || 'Pilih foto (JPG/PNG, maks 5MB)'}</span>
        <input type="file" name={name} accept="image/jpeg,image/png,image/webp" required={required} className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
      </label>
    </Field>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-kilatgo-600 uppercase tracking-wider border-b border-slate-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

export const MERCHANT_TERMS: { title: string; note?: string; items: string[] }[] = [
  {
    title: 'A. Syarat Pendaftaran',
    items: [
      'Memiliki usaha kuliner legal: warung, resto, cafe, UMKM',
      'Memiliki KTP pemilik usaha & NPWP/Surat Keterangan Usaha',
      'Memiliki menu, harga, dan foto produk yang jelas',
      'Memiliki HP Android untuk aplikasi Merchant KilatGo',
      'Memiliki rekening bank/e-wallet atas nama usaha/pribadi',
    ],
  },
  {
    title: 'B. Kewajiban Merchant',
    items: [
      'Menjaga kualitas, kebersihan, dan keamanan makanan',
      'Harga di aplikasi = harga di outlet (markup sewajarnya)',
      'Konfirmasi & siapkan pesanan dalam 10–15 menit',
      'Update status menu "Habis/Tersedia" secara berkala',
      'Bersedia menerima order dari jam buka s/d jam tutup',
    ],
  },
  {
    title: 'C. Hak & Keuntungan Merchant',
    items: [
      'Komisi KilatGo hanya 20% per transaksi',
      'Pencairan dana kapan saja, biaya admin Rp 2.500',
      'Promosi gratis melalui aplikasi KilatGo & media sosial',
      'Laporan penjualan real-time di aplikasi Merchant',
      'Dukungan Tim CS KilatGo',
    ],
  },
  {
    title: 'D. Ketentuan Biaya & Transaksi',
    items: [
      'Komisi: 20% dari total harga makanan. Ongkir ditanggung customer',
      'Minimal order: tidak ada minimal order dari merchant',
      'Pembatalan: jika merchant cancel >3x/minggu, akun bisa disuspend',
    ],
  },
  {
    title: 'E. Larangan & Sanksi',
    note: 'Sanksi: teguran, denda, hingga pemutusan mitra jika:',
    items: [
      'Menjual makanan expired, tidak layak, atau berbeda dari foto',
      'Menolak pesanan yang sudah masuk tanpa alasan jelas',
      'Melakukan kecurangan harga atau transaksi di luar aplikasi',
      'Rating resto < 3.5 terus-menerus karena komplain',
    ],
  },
  {
    title: 'F. Ketentuan Lain',
    items: [
      'Hubungan ini adalah kemitraan, bukan franchise',
      'KilatGo berhak mengubah S&K kapan pun tanpa pemberitahuan',
      'Data usaha dijaga kerahasiaannya sesuai UU PDP',
    ],
  },
];

export default function RegisterMerchantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as any) || {};
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [regClosed, setRegClosed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getPublicSettings()
      .then((s) => setRegClosed(s.merchant_registration_open === '0'))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    if (!/^\d{16}$/.test((fd.get('nik') as string) || '')) {
      setError('NIK harus 16 digit angka.');
      return;
    }
    if (!agreed) {
      setError('Anda harus menyetujui Syarat & Ketentuan Mitra Merchant.');
      return;
    }
    try {
      setLoading(true);
      await registerMerchant(fd);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Pendaftaran gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-kilatgo-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>;
  }
  if (regClosed) return <RegistrationClosed title="Pendaftaran Mitra Ditutup" />;

  if (done) {
    return (
      <div className="min-h-screen bg-kilatgo-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-10 max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-kilatgo-950 mb-2">Pendaftaran usaha terkirim!</h2>
          <p className="text-slate-500 mb-6">Data &amp; dokumenmu sedang direview admin. Kami hubungi dalam 1×24 jam.</p>
          <Link to="/" className="inline-flex px-6 py-3 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition">Kembali ke Beranda</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold text-kilatgo-500 uppercase tracking-wider">Jadi Mitra Usaha</p>
            <h1 className="text-3xl font-bold text-kilatgo-950 mt-1">Pendaftaran Merchant (KilatFood)</h1>
            <p className="text-slate-500 mt-2">Isi data usaha sesuai dokumen resmi. Bertanda <span className="text-red-500">*</span> wajib.</p>
          </div>

          {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-8">
            <Section title="Akun & Pemilik">
              <Field label="Nama pemilik (sesuai KTP)" required>
                <input name="ownerName" required defaultValue={prefill.name} placeholder="Nama sesuai KTP" className={inputCls} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email" required>
                  <input name="email" type="email" required defaultValue={prefill.email} placeholder="usaha@email.com" className={inputCls} />
                </Field>
                <Field label="Nomor HP" required>
                  <input name="phone" required defaultValue={prefill.phone} placeholder="08xxxxxxxxxx" className={inputCls} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Kata Sandi" required>
                  <input name="password" type="password" required minLength={6} placeholder="••••••••" className={inputCls} />
                </Field>
                <Field label="NIK pemilik (16 digit)" required>
                  <input name="nik" required inputMode="numeric" maxLength={16} placeholder="3200xxxxxxxxxxxx" className={inputCls} />
                </Field>
              </div>
            </Section>

            <Section title="Data Usaha">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nama usaha / outlet" required>
                  <input name="businessName" required placeholder="Warung Makan Berkah" className={inputCls} />
                </Field>
                <Field label="Kategori">
                  <input name="category" placeholder="Makanan / Minuman" className={inputCls} />
                </Field>
              </div>
              <Field label="Alamat outlet">
                <input name="address" defaultValue={prefill.city ? '' : ''} placeholder="Alamat lengkap outlet" className={inputCls} />
              </Field>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Kota">
                  <input name="city" defaultValue={prefill.city} placeholder="Kota" className={inputCls} />
                </Field>
                <Field label="Latitude (Maps)">
                  <input name="latitude" placeholder="-6.2088" className={inputCls} />
                </Field>
                <Field label="Longitude (Maps)">
                  <input name="longitude" placeholder="106.8456" className={inputCls} />
                </Field>
              </div>
              <Field label="Jam operasional">
                <input name="operatingHours" placeholder="08:00 - 21:00" className={inputCls} />
              </Field>
            </Section>

            <Section title="Legalitas & Rekening">
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="NPWP (opsional)"><input name="npwp" placeholder="NPWP" className={inputCls} /></Field>
                <Field label="NIB (badan usaha)"><input name="nib" placeholder="NIB" className={inputCls} /></Field>
                <Field label="SIUP (badan usaha)"><input name="siup" placeholder="SIUP" className={inputCls} /></Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Nama bank"><input name="bankName" placeholder="BCA" className={inputCls} /></Field>
                <Field label="No rekening"><input name="bankAccount" inputMode="numeric" placeholder="Nomor rekening" className={inputCls} /></Field>
                <Field label="Atas nama (= KTP)"><input name="bankHolder" placeholder="Nama pemilik rekening" className={inputCls} /></Field>
              </div>
            </Section>

            <Section title="Dokumen (unggah foto)">
              <div className="grid sm:grid-cols-3 gap-4">
                <FileField label="Foto e-KTP" name="ktpPhoto" required />
                <FileField label="Foto outlet" name="outletPhoto" required />
                <FileField label="Foto NPWP" name="npwpPhoto" />
              </div>
            </Section>

            {/* Syarat & Ketentuan Mitra Merchant */}
            <Section title="Syarat & Ketentuan">
              <p className="text-sm text-slate-600 -mt-1 mb-2">
                Dengan mendaftar sebagai Mitra Merchant KilatGo, Anda dianggap telah membaca, memahami, dan menyetujui seluruh poin di bawah ini:
              </p>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                {MERCHANT_TERMS.map((sec) => (
                  <div key={sec.title}>
                    <p className="text-sm font-bold text-kilatgo-900">{sec.title}</p>
                    {sec.note && <p className="text-xs text-slate-500 mt-1">{sec.note}</p>}
                    <ol className="mt-1.5 space-y-1 list-decimal list-inside text-sm text-slate-600 marker:text-kilatgo-400 marker:font-semibold">
                      {sec.items.map((it, i) => <li key={i} className="pl-1">{it}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-3 cursor-pointer mt-3 select-none">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-kilatgo-600 focus:ring-kilatgo-400 accent-kilatgo-600" />
                <span className="text-sm text-slate-700">
                  Saya telah membaca dan <span className="font-semibold">menyetujui seluruh Syarat &amp; Ketentuan</span> menjadi Mitra Merchant KilatGo, termasuk{' '}
                  <Link to="/kebijakan-privasi" target="_blank" className="font-semibold text-kilatgo-600 hover:underline">Kebijakan Privasi</Link>.
                </span>
              </label>
            </Section>

            <button type="submit" disabled={loading || !agreed}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Mengirim...' : 'Saya Setuju & Kirim Pendaftaran'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
