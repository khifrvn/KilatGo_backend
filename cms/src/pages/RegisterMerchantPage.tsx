import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Upload, ArrowLeft } from 'lucide-react';
import { registerMerchant } from '../api/auth';

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

export default function RegisterMerchantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as any) || {};
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    if (!/^\d{16}$/.test((fd.get('nik') as string) || '')) {
      setError('NIK harus 16 digit angka.');
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
                <Field label="Password" required>
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

            <Section title="Dokumen (upload foto)">
              <div className="grid sm:grid-cols-3 gap-4">
                <FileField label="Foto e-KTP" name="ktpPhoto" required />
                <FileField label="Foto outlet" name="outletPhoto" required />
                <FileField label="Foto NPWP" name="npwpPhoto" />
              </div>
            </Section>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition active:scale-[0.99] disabled:opacity-60">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Mengirim...' : 'Kirim Pendaftaran'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
