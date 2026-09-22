import { useEffect, useState } from 'react';
import {
  Percent, Save, Loader2, CheckCircle2, Phone, Wrench, CreditCard,
  Eye, EyeOff, Award, Plus, Trash2, HelpCircle, Mail, MapPin, MessageCircle, ShieldCheck, Info,
  UserPlus, Car, Store, Megaphone, Music, Smartphone,
} from 'lucide-react';
import { getSettings, updateSettings, uploadMaintenanceMusic, getPpobVendorBalance, refreshPpobCatalog } from '../api/admin';
import { youtubeId, youtubeEmbed } from '../utils/youtube';

const COMMISSION_FIELDS: { key: string; label: string; suffix: string; hint?: string }[] = [
  { key: 'commission_percent', label: 'Komisi driver (Ride/Car/Send/Food)', suffix: '%' },
  { key: 'food_commission_percent', label: 'Komisi KilatFood (dari merchant)', suffix: '%' },
  { key: 'service_fee', label: 'Biaya layanan (per order, semua layanan)', suffix: 'Rp' },
  { key: 'ride_base_fare', label: 'KilatRide — tarif dasar', suffix: 'Rp' },
  { key: 'ride_per_km', label: 'KilatRide — tarif per km', suffix: 'Rp' },
  { key: 'ride_min_fare', label: 'KilatRide — tarif minimum', suffix: 'Rp' },
  { key: 'car_base_fare', label: 'KilatCar — tarif dasar', suffix: 'Rp' },
  { key: 'car_per_km', label: 'KilatCar — tarif per km', suffix: 'Rp' },
  { key: 'car_min_fare', label: 'KilatCar — tarif minimum', suffix: 'Rp' },
  { key: 'send_base_fare', label: 'KilatSend — tarif dasar', suffix: 'Rp' },
  { key: 'send_per_km', label: 'KilatSend — tarif per km', suffix: 'Rp' },
  { key: 'send_min_fare', label: 'KilatSend — tarif minimum', suffix: 'Rp' },
  { key: 'food_base_fare', label: 'KilatFood — ongkir dasar', suffix: 'Rp' },
  { key: 'food_per_km', label: 'KilatFood — ongkir per km', suffix: 'Rp' },
  { key: 'food_min_fare', label: 'KilatFood — ongkir minimum', suffix: 'Rp' },
  { key: 'food_merchant_radius_km', label: 'KilatFood — radius tampil merchant', suffix: 'km' },
  { key: 'withdraw_admin_fee', label: 'Biaya admin penarikan', suffix: 'Rp' },
  { key: 'dispatch_radius_km', label: 'Radius pencarian driver', suffix: 'km' },
  { key: 'min_topup', label: 'Minimal top up kredit', suffix: 'Rp' },
  { key: 'min_withdraw', label: 'Minimal penarikan', suffix: 'Rp' },
  { key: 'order_cancel_grace_sec', label: 'Jendela batal setelah memesan', suffix: 'detik' },
  { key: 'merchant_confirm_min', label: 'Batas warung konfirmasi pesanan', suffix: 'menit' },
  { key: 'dispatch_no_driver_warn_min', label: 'Notif "belum dapat driver"', suffix: 'menit' },
  { key: 'dispatch_no_driver_min', label: 'Batal otomatis bila tanpa driver', suffix: 'menit' },
];

// Suffix per key (untuk grup di tampilan grid).
const FIELD_SUFFIX: Record<string, string> = Object.fromEntries(COMMISSION_FIELDS.map((f) => [f.key, f.suffix]));

// Komisi & Tarif dikelompokkan supaya tidak jadi satu kolom panjang.
const COMMISSION_GROUPS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: 'Komisi & Biaya',
    fields: [
      { key: 'commission_percent', label: 'Komisi driver' },
      { key: 'food_commission_percent', label: 'Komisi KilatFood' },
      { key: 'service_fee', label: 'Biaya layanan / order' },
    ],
  },
  { title: 'KilatRide', fields: [{ key: 'ride_base_fare', label: 'Tarif dasar' }, { key: 'ride_per_km', label: 'Per km' }, { key: 'ride_min_fare', label: 'Minimum' }] },
  { title: 'KilatCar', fields: [{ key: 'car_base_fare', label: 'Tarif dasar' }, { key: 'car_per_km', label: 'Per km' }, { key: 'car_min_fare', label: 'Minimum' }] },
  { title: 'KilatSend', fields: [{ key: 'send_base_fare', label: 'Tarif dasar' }, { key: 'send_per_km', label: 'Per km' }, { key: 'send_min_fare', label: 'Minimum' }] },
  { title: 'KilatFood (ongkir)', fields: [{ key: 'food_base_fare', label: 'Ongkir dasar' }, { key: 'food_per_km', label: 'Per km' }, { key: 'food_min_fare', label: 'Minimum' }, { key: 'food_merchant_radius_km', label: 'Radius tampil merchant (0 = tanpa batas)' }] },
  {
    title: 'Saldo & Penarikan',
    fields: [
      { key: 'withdraw_admin_fee', label: 'Biaya admin penarikan' },
      { key: 'min_topup', label: 'Min. top up' },
      { key: 'min_withdraw', label: 'Min. penarikan' },
    ],
  },
  {
    title: 'Pencarian Driver',
    fields: [
      { key: 'dispatch_radius_km', label: 'Radius pencarian driver (default; bisa ditambah pengguna via Boost +2km)' },
    ],
  },
  {
    title: 'Batas Waktu Pesanan (dihitung sejak pesanan dibuat)',
    fields: [
      { key: 'order_cancel_grace_sec', label: 'Tombol "Batalkan pesanan" tampil selama (detik)' },
      { key: 'merchant_confirm_min', label: 'KilatFood: warung harus konfirmasi dalam (menit), lewat → batal otomatis' },
      { key: 'dispatch_no_driver_warn_min', label: 'Notif "belum dapat driver" + tombol batal/boost muncul (menit)' },
      { key: 'dispatch_no_driver_min', label: 'Tetap tanpa driver sampai (menit) → batal otomatis' },
    ],
  },
];

const KONTAK_FIELDS: { key: string; label: string; placeholder: string; icon: any }[] = [
  { key: 'contact_email', label: 'Email', placeholder: 'costumerservice@kilatgo.com', icon: Mail },
  { key: 'contact_phone', label: 'Telepon', placeholder: '08xxxxxxxxxx', icon: Phone },
  { key: 'contact_whatsapp', label: 'WhatsApp', placeholder: '08xxxxxxxxxx', icon: MessageCircle },
  { key: 'contact_address', label: 'Alamat', placeholder: 'Alamat lengkap', icon: MapPin },
];

// ===== Komponen bersama =====
const spinner = <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>;

function SectionCard({ icon: Icon, tone, title, subtitle, children, className = 'max-w-2xl' }:
  { icon: any; tone: string; title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      <div className="flex items-start gap-3.5 p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className={`p-2.5 rounded-xl shadow-sm ${tone}`}><Icon className="w-5 h-5 text-white" /></div>
        <div>
          <h3 className="font-bold text-kilatgo-950">{title}</h3>
          <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function SaveBar({ onSave, saving, msg, label = 'Simpan' }: { onSave: () => void; saving: boolean; msg: string; label?: string }) {
  const ok = msg.includes('✓');
  return (
    <div className="flex items-center gap-3 mt-6">
      <button onClick={onSave} disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 shadow-sm shadow-kilatgo-600/20 transition disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{label}
      </button>
      {msg && (
        <span className={`text-sm font-medium inline-flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {ok && <CheckCircle2 className="w-4 h-4" />}{msg}
        </span>
      )}
    </div>
  );
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 transition';

// ===== Tab: Kontak =====
function KontakTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      const patch: Record<string, string> = {};
      KONTAK_FIELDS.forEach((f) => { patch[f.key] = values[f.key] ?? ''; });
      setValues(await updateSettings(patch)); setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;

  return (
    <SectionCard icon={Phone} tone="bg-gradient-to-br from-sky-500 to-blue-600" title="Kontak"
      subtitle='Info ini tampil di bagian "Hubungi kami" pada landing page.'>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {KONTAK_FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'contact_address' ? 'sm:col-span-2' : ''}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
            {f.key === 'contact_address' ? (
              <div className="relative">
                <f.icon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <textarea rows={2} value={values[f.key] ?? ''} placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={`${inputCls} pl-10 resize-none`} />
              </div>
            ) : (
              <div className="relative">
                <f.icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={values[f.key] ?? ''} placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={`${inputCls} pl-10`} />
              </div>
            )}
          </div>
        ))}
      </div>
      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

// ===== Tab: Mode Perbaikan =====
function MaintenanceTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const on = values.maintenance_mode === '1';

  const save = async (patch: Record<string, string>) => {
    try {
      setSaving(true); setMsg('');
      setValues(await updateSettings({
        maintenance_mode: values.maintenance_mode ?? '0',
        maintenance_message: values.maintenance_message ?? '',
        maintenance_music_url: values.maintenance_music_url ?? '',
        ...patch,
      }));
      setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  // Unggah file musik → server balas URL-nya, langsung tersimpan di settings.
  const pickMusic = async (file?: File | null) => {
    if (!file) return;
    try {
      setSaving(true); setMsg('');
      const url = await uploadMaintenanceMusic(file);
      setValues((v) => ({ ...v, maintenance_music_url: url }));
      setMsg('Musik diunggah ✓');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Gagal mengunggah musik (maks 10MB, format audio)');
    } finally { setSaving(false); }
  };

  if (loading) return spinner;

  return (
    <SectionCard icon={Wrench} tone="bg-gradient-to-br from-orange-500 to-amber-600" title="Mode Perbaikan"
      subtitle="Saat aktif, aplikasi driver/pengguna diblokir dan menampilkan pesan di bawah. Panel admin tetap bisa diakses.">
      <div className={`flex items-center justify-between rounded-xl border px-4 py-3.5 mb-5 transition ${on ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <span className={`relative flex h-3 w-3 ${on ? '' : 'opacity-40'}`}>
            {on && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${on ? 'bg-amber-500' : 'bg-slate-400'}`} />
          </span>
          <div>
            <p className="font-semibold text-slate-800">Aktifkan mode perbaikan</p>
            <p className={`text-sm ${on ? 'text-amber-600' : 'text-slate-500'}`}>{on ? 'Aplikasi sedang diblokir' : 'Aplikasi berjalan normal'}</p>
          </div>
        </div>
        <button onClick={() => save({ maintenance_mode: on ? '0' : '1' })} disabled={saving}
          className={`relative w-14 h-8 rounded-full transition disabled:opacity-60 ${on ? 'bg-amber-500' : 'bg-slate-300'}`}>
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-1.5">Pesan perbaikan</label>
      <textarea rows={3} value={values.maintenance_message ?? ''} placeholder="Pesan yang tampil ke pengguna saat maintenance…"
        onChange={(e) => setValues((v) => ({ ...v, maintenance_message: e.target.value }))}
        className={`${inputCls} resize-none`} />

      {/* Musik latar layar perbaikan — diputar di web & aplikasi, bisa di-pause pengguna. */}
      <label className="block text-sm font-medium text-slate-700 mt-5 mb-1.5">Musik latar (opsional)</label>
      <p className="text-xs text-slate-500 mb-2">Diputar berulang di layar perbaikan (web & aplikasi). Pengguna tetap bisa jeda/putar sendiri. Unggah MP3/M4A maks 10MB, tempel URL audio, atau tempel link YouTube.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="url" value={values.maintenance_music_url ?? ''} placeholder="https://…/musik.mp3 atau https://youtu.be/…"
          onChange={(e) => setValues((v) => ({ ...v, maintenance_music_url: e.target.value }))}
          className={`${inputCls} flex-1`} />
        <label className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
          <Music className="w-4 h-4" /> Unggah
          <input type="file" accept="audio/*" className="hidden" disabled={saving}
            onChange={(e) => { pickMusic(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {(values.maintenance_music_url ?? '') && (
        <div className="mt-3 flex items-start gap-3">
          {youtubeId(values.maintenance_music_url) ? (
            <iframe className="w-56 aspect-video rounded-xl border border-slate-200" title="Pratinjau musik"
              src={youtubeEmbed(youtubeId(values.maintenance_music_url)!, false)} allow="encrypted-media" />
          ) : (
            <audio controls src={values.maintenance_music_url} className="h-9 flex-1 min-w-0" />
          )}
          <button onClick={() => save({ maintenance_music_url: '' })} disabled={saving}
            className="text-sm text-rose-600 hover:underline disabled:opacity-60">Hapus</button>
        </div>
      )}

      <SaveBar onSave={() => save({})} saving={saving} msg={msg} label="Simpan pengaturan" />
    </SectionCard>
  );
}

// ===== Tab: Komisi & Tarif =====
function KomisiTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      const patch: Record<string, string> = {};
      COMMISSION_FIELDS.forEach((f) => { patch[f.key] = values[f.key] ?? ''; });
      setValues(await updateSettings(patch)); setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;

  return (
    <SectionCard icon={Percent} tone="bg-gradient-to-br from-kilatgo-500 to-kilatgo-700" title="Komisi & Tarif"
      subtitle="Nilai ini dipakai untuk perhitungan tarif & potongan platform." className="">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {COMMISSION_GROUPS.map((g) => (
          <div key={g.title} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-sm font-bold text-kilatgo-900 mb-3">{g.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {g.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                  <div className="relative">
                    <input type="number" min={0} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full pl-3 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{FIELD_SUFFIX[f.key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

// ===== Tab: Pembayaran =====
function PembayaranTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const mode = values.ipaymu_mode === 'production' ? 'production' : 'sandbox';
  const prefix = mode === 'production' ? 'ipaymu_prod' : 'ipaymu_sandbox';
  const fields = [
    { key: `${prefix}_va`, label: 'Virtual Account (VA)', placeholder: mode === 'production' ? 'VA produksi' : '0000002273624493' },
    { key: `${prefix}_api_key`, label: 'API Key', placeholder: mode === 'production' ? 'API key produksi' : 'SANDBOX...' },
  ];

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      const patch: Record<string, string> = { ipaymu_mode: mode };
      fields.forEach((f) => { patch[f.key] = values[f.key] ?? ''; });
      setValues(await updateSettings(patch)); setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;

  return (
    <SectionCard icon={CreditCard} tone="bg-gradient-to-br from-emerald-500 to-teal-600" title="Gerbang Pembayaran — iPaymu"
      subtitle="Credential ini dipakai backend untuk transaksi pembayaran di aplikasi mobile. Sandbox & Production disimpan terpisah — ganti mode otomatis menampilkan VA/API key mode tersebut.">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
      <div className="inline-flex bg-slate-100 rounded-xl p-1 mb-4">
        {[['sandbox', 'Sandbox'], ['production', 'Production']].map(([v, l]) => (
          <button key={v} onClick={() => { setValues((s) => ({ ...s, ipaymu_mode: v })); setMsg(''); }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${mode === v ? 'bg-white text-kilatgo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {mode === 'production' && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 mb-4">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Mode <b>Production</b> memakai transaksi uang asli. Pastikan VA & API Key sudah benar.</span>
        </div>
      )}

      <div className="space-y-4">
        {fields.map((f) => {
          const secret = f.key.endsWith('_api_key');
          return (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
              <div className="relative">
                <input type={secret && !showKey ? 'password' : 'text'} value={values[f.key] ?? ''} placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={`${inputCls} font-mono text-sm ${secret ? 'pr-11' : ''}`} />
                {secret && (
                  <button type="button" onClick={() => setShowKey((s) => !s)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

// ===== Tab: PPOB (Digiflazz) =====
function PpobTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [vendorMsg, setVendorMsg] = useState('');

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const mode = values.digiflazz_mode === 'production' ? 'production' : 'development';
  const keyField = mode === 'production' ? 'digiflazz_prod_key' : 'digiflazz_dev_key';
  const enabled = values.ppob_enabled === '1';
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      setValues(await updateSettings({
        ppob_enabled: enabled ? '1' : '0',
        digiflazz_mode: mode,
        digiflazz_username: values.digiflazz_username ?? '',
        [keyField]: values[keyField] ?? '',
        digiflazz_webhook_secret: values.digiflazz_webhook_secret ?? '',
        ppob_markup_percent: values.ppob_markup_percent ?? '0',
        ppob_markup_flat: values.ppob_markup_flat ?? '0',
      }));
      setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  // Cek saldo sekaligus membuktikan username + API key sudah benar.
  const checkVendor = async () => {
    try {
      setChecking(true); setVendorMsg('');
      setDeposit(await getPpobVendorBalance());
    } catch {
      setDeposit(null);
      setVendorMsg('Gagal — cek username & API key, lalu simpan dulu.');
    } finally { setChecking(false); }
  };

  const refreshCatalog = async () => {
    try {
      setChecking(true); setVendorMsg('');
      setVendorMsg(`Katalog diperbarui — ${await refreshPpobCatalog()} produk.`);
    } catch {
      setVendorMsg('Gagal memuat katalog dari Digiflazz.');
    } finally { setChecking(false); }
  };

  if (loading) return spinner;

  const webhookUrl = 'https://api.kilatgo.com/api/ppob/webhook';

  return (
    <SectionCard icon={Smartphone} tone="bg-gradient-to-br from-sky-500 to-blue-600" title="PPOB — Digiflazz"
      subtitle="Kredensial vendor untuk pulsa, paket data, token PLN, e-wallet, dan voucher game. Mode Development memakai flag testing (tidak memotong deposit vendor).">

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5">
        <div>
          <p className="font-semibold text-slate-800">Aktifkan layanan PPOB</p>
          <p className="text-sm text-slate-500">Kalau mati, aplikasi menampilkan "Fitur PPOB belum tersedia".</p>
        </div>
        <button type="button" onClick={() => { set('ppob_enabled', enabled ? '0' : '1'); setMsg(''); }}
          className={`relative w-14 h-8 rounded-full transition shrink-0 ${enabled ? 'bg-kilatgo-600' : 'bg-slate-300'}`}>
          <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
      <div className="inline-flex bg-slate-100 rounded-xl p-1 mb-4">
        {[['development', 'Development'], ['production', 'Production']].map(([v, l]) => (
          <button key={v} onClick={() => { set('digiflazz_mode', v); setMsg(''); }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${mode === v ? 'bg-white text-kilatgo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {mode === 'production' && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 mb-4">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Mode <b>Production</b> memotong deposit Digiflazz sungguhan setiap transaksi.</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Username API</label>
          <input value={values.digiflazz_username ?? ''} placeholder="username Digiflazz"
            onChange={(e) => set('digiflazz_username', e.target.value)} className={`${inputCls} font-mono text-sm`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            API Key ({mode === 'production' ? 'Production' : 'Development'})
          </label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={values[keyField] ?? ''} placeholder="API key dari dashboard Digiflazz"
              onChange={(e) => set(keyField, e.target.value)} className={`${inputCls} font-mono text-sm pr-11`} />
            <button type="button" onClick={() => setShowKey((s) => !s)} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Key Development & Production disimpan terpisah — ganti mode menampilkan key mode tersebut.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook Secret</label>
          <input value={values.digiflazz_webhook_secret ?? ''} placeholder="secret yang sama dengan di dashboard Digiflazz"
            onChange={(e) => set('digiflazz_webhook_secret', e.target.value)} className={`${inputCls} font-mono text-sm`} />
          <p className="text-xs text-slate-400 mt-1">Wajib diisi — tanpa ini semua callback ditolak, status transaksi tidak pernah menutup sendiri.</p>
        </div>
      </div>

      <div className="rounded-xl bg-sky-50 border border-sky-100 p-4 mt-5">
        <p className="text-sm font-semibold text-sky-900 mb-1">URL Webhook</p>
        <p className="text-xs text-sky-800 mb-2">Tempel URL ini di dashboard Digiflazz → Atur Koneksi → Webhook, dan isi secret-nya sama persis.</p>
        <code className="block bg-white rounded-lg px-3 py-2 text-xs font-mono text-slate-700 break-all">{webhookUrl}</code>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Margin (%)</label>
          <input type="number" min={0} value={values.ppob_markup_percent ?? ''}
            onChange={(e) => set('ppob_markup_percent', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Margin tambahan (Rp)</label>
          <input type="number" min={0} value={values.ppob_markup_flat ?? ''}
            onChange={(e) => set('ppob_markup_flat', e.target.value)} className={inputCls} />
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">
        Harga jual = harga vendor + margin% + margin flat, dibulatkan ke atas per Rp100.
      </p>

      <div className="rounded-xl border border-slate-200 p-4 mt-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-slate-800">Cek koneksi vendor</p>
            <p className="text-sm text-slate-500">
              {deposit === null ? 'Simpan dulu, lalu cek saldo untuk memastikan kredensial benar.'
                : `Sisa deposit Digiflazz: Rp${deposit.toLocaleString('id-ID')}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={checkVendor} disabled={checking}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              {checking ? 'Memuat…' : 'Cek saldo'}
            </button>
            <button type="button" onClick={refreshCatalog} disabled={checking}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              Muat ulang katalog
            </button>
          </div>
        </div>
        {vendorMsg && <p className="text-sm text-slate-600 mt-3">{vendorMsg}</p>}
      </div>

      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

type Tier = { name: string; minPoints: number };
const TIER_TONE = ['from-slate-400 to-slate-500', 'from-amber-400 to-amber-600', 'from-slate-300 to-slate-400', 'from-yellow-400 to-amber-500', 'from-cyan-400 to-blue-500', 'from-violet-400 to-purple-500'];

// ===== Tab: Keanggotaan =====
function MembershipTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setValues(s);
      try {
        const parsed = JSON.parse(s.member_tiers || '[]');
        setTiers(Array.isArray(parsed) ? parsed.map((t: { name?: unknown; minPoints?: unknown }) => ({ name: String(t.name ?? ''), minPoints: Number(t.minPoints) || 0 })) : []);
      } catch { setTiers([]); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const setTier = (i: number, patch: Partial<Tier>) => setTiers((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      const clean = tiers.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), minPoints: Number(t.minPoints) || 0 })).sort((a, b) => a.minPoints - b.minPoints);
      setValues(await updateSettings({ points_per_order: values.points_per_order ?? '0', member_tiers: JSON.stringify(clean) }));
      setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;

  return (
    <SectionCard icon={Award} tone="bg-gradient-to-br from-amber-400 to-amber-600" title="Keanggotaan Driver"
      subtitle="Poin per order & tier member. Poin driver = jumlah order selesai × poin per order.">
      <div className="flex items-center justify-between rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3.5 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white shadow-sm"><Award className="w-4 h-4 text-amber-500" /></div>
          <span className="text-sm font-medium text-slate-700">Poin per order selesai</span>
        </div>
        <div className="relative w-36">
          <input type="number" min={0} value={values.points_per_order ?? ''} onChange={(e) => setValues((v) => ({ ...v, points_per_order: e.target.value }))}
            className="w-full pl-3 pr-12 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-kilatgo-400" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">poin</span>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-2">Tier member <span className="text-slate-400 font-normal">(nama + minimal poin)</span></label>
      <div className="space-y-2.5">
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${TIER_TONE[i % TIER_TONE.length]} text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-sm`}>{i + 1}</div>
            <input value={t.name} placeholder="Nama tier (mis. Gold)" onChange={(e) => setTier(i, { name: e.target.value })}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-kilatgo-400" />
            <div className="relative w-36 shrink-0">
              <input type="number" min={0} value={t.minPoints} onChange={(e) => setTier(i, { minPoints: Number(e.target.value) || 0 })}
                className="w-full pl-3 pr-16 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">min poin</span>
            </div>
            <button onClick={() => setTiers((ts) => ts.filter((_, idx) => idx !== i))} className="p-2 rounded-lg text-red-500 hover:bg-red-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => setTiers((ts) => [...ts, { name: '', minPoints: 0 }])}
        className="w-full mt-3 border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-kilatgo-600 hover:border-kilatgo-300 hover:bg-kilatgo-50 inline-flex items-center justify-center gap-1.5 transition">
        <Plus className="w-4 h-4" />Tambah tier
      </button>

      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

// ===== Tab: Promosi Mitra (paket "Promosikan Jualan kamu") =====
type PromoPkg = { name: string; minutes: number; price: number };
const UNITS: [string, number][] = [['menit', 1], ['jam', 60], ['hari', 1440]];

// Tampilkan durasi dalam satuan terbesar yang pas (1440 → 1 hari).
function splitDuration(minutes: number): { value: number; unit: number } {
  for (const [, f] of [...UNITS].reverse()) if (minutes % f === 0 && minutes >= f) return { value: minutes / f, unit: f };
  return { value: minutes, unit: 1 };
}

function PromosiMitraTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pkgs, setPkgs] = useState<PromoPkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setValues(s);
      try {
        const parsed = JSON.parse(s.merchant_promo_packages || '[]');
        setPkgs(Array.isArray(parsed)
          ? parsed.map((p: Record<string, unknown>) => ({ name: String(p.name ?? ''), minutes: Number(p.minutes) || 0, price: Number(p.price) || 0 }))
          : []);
      } catch { setPkgs([]); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const setPkg = (i: number, patch: Partial<PromoPkg>) => setPkgs((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      const clean = pkgs
        .filter((p) => p.name.trim() && p.minutes > 0)
        .map((p) => ({ name: p.name.trim(), minutes: Math.floor(p.minutes), price: Math.max(0, Math.round(p.price)) }))
        .sort((a, b) => a.minutes - b.minutes);
      setValues(await updateSettings({
        merchant_promo_packages: JSON.stringify(clean),
        merchant_promo_min_topup: values.merchant_promo_min_topup ?? '0',
      }));
      setPkgs(clean);
      setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;

  return (
    <SectionCard icon={Megaphone} tone="bg-gradient-to-br from-pink-500 to-rose-600" title="Promosi Mitra"
      subtitle='Paket "Promosikan Jualan kamu" di aplikasi mitra. Mitra membayar pakai saldo; warungnya tampil paling atas + berlabel "Promosi" di beranda KilatFood selama durasi paket. Daftar kosong = fitur promosi dimatikan.'
      className="max-w-3xl">
      <div className="flex items-center justify-between rounded-xl bg-rose-50/60 border border-rose-100 px-4 py-3.5 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white shadow-sm"><CreditCard className="w-4 h-4 text-rose-500" /></div>
          <span className="text-sm font-medium text-slate-700">Minimal isi saldo mitra</span>
        </div>
        <div className="relative w-40">
          <input type="number" min={0} value={values.merchant_promo_min_topup ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, merchant_promo_min_topup: e.target.value }))}
            className="w-full pl-3 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-kilatgo-400" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rp</span>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-2">Paket promosi <span className="text-slate-400 font-normal">(nama, durasi, harga)</span></label>
      <div className="space-y-2.5">
        {pkgs.map((p, i) => {
          const d = splitDuration(p.minutes);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
              <input value={p.name} placeholder="Nama paket (mis. 1 Jam)" onChange={(e) => setPkg(i, { name: e.target.value })}
                className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-kilatgo-400" />
              <div className="flex items-center gap-1.5">
                <input type="number" min={1} value={d.value}
                  onChange={(e) => setPkg(i, { minutes: Math.max(1, Number(e.target.value) || 0) * d.unit })}
                  className="w-20 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
                <select value={d.unit} onChange={(e) => setPkg(i, { minutes: d.value * Number(e.target.value) })}
                  className="px-2 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400">
                  {UNITS.map(([label, f]) => <option key={f} value={f}>{label}</option>)}
                </select>
              </div>
              <div className="relative w-40">
                <input type="number" min={0} value={p.price} onChange={(e) => setPkg(i, { price: Number(e.target.value) || 0 })}
                  className="w-full pl-3 pr-9 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rp</span>
              </div>
              <button onClick={() => setPkgs((ps) => ps.filter((_, idx) => idx !== i))} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>
      <button onClick={() => setPkgs((ps) => [...ps, { name: '', minutes: 60, price: 0 }])}
        className="w-full mt-3 border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-kilatgo-600 hover:border-kilatgo-300 hover:bg-kilatgo-50 inline-flex items-center justify-center gap-1.5 transition">
        <Plus className="w-4 h-4" />Tambah paket
      </button>

      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

// ===== Tab: Bantuan & Tips =====
function MitraHelpTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const save = async () => {
    try {
      setSaving(true); setMsg('');
      setValues(await updateSettings({ merchant_help: values.merchant_help ?? '', merchant_tips: values.merchant_tips ?? '' }));
      setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;

  const hint = 'Pisahkan tiap item dengan baris berisi "---". Baris pertama tiap item = judul, sisanya = isi.';
  const areaCls = 'w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 font-mono text-sm leading-relaxed transition';

  return (
    <SectionCard icon={HelpCircle} tone="bg-gradient-to-br from-violet-500 to-purple-600" title="Bantuan & Tips Mitra"
      subtitle="Konten ini tampil di aplikasi mitra (menu Bantuan & Tips)." className="max-w-4xl">
      <div className="flex items-start gap-2 rounded-xl bg-violet-50 border border-violet-100 p-3 text-sm text-violet-800 mb-5">
        <Info className="w-4 h-4 mt-0.5 shrink-0" /><span>{hint}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Bantuan (FAQ)</label>
          <textarea rows={12} value={values.merchant_help ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, merchant_help: e.target.value }))} className={areaCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tips</label>
          <textarea rows={12} value={values.merchant_tips ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, merchant_tips: e.target.value }))} className={areaCls} />
        </div>
      </div>
      <SaveBar onSave={save} saving={saving} msg={msg} />
    </SectionCard>
  );
}

// ===== Tab: Pendaftaran (buka/tutup lamaran driver & mitra) =====
function RegToggle({ open, saving, onToggle, icon: Icon, title, url }:
  { open: boolean; saving: boolean; onToggle: () => void; icon: any; title: string; url: string }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3.5 transition ${open ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${open ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{title}</p>
          <p className={`text-sm ${open ? 'text-emerald-600' : 'text-red-600'}`}>{open ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{url}</p>
        </div>
      </div>
      <button onClick={onToggle} disabled={saving}
        className={`relative w-14 h-8 rounded-full transition disabled:opacity-60 ${open ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${open ? 'translate-x-6' : ''}`} />
      </button>
    </div>
  );
}

function PendaftaranTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getSettings().then((s) => { setValues(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const save = async (patch: Record<string, string>) => {
    try {
      setSaving(true); setMsg('');
      setValues(await updateSettings(patch));
      setMsg('Tersimpan ✓'); setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return spinner;
  const driverOpen = values.driver_registration_open !== '0';
  const merchantOpen = values.merchant_registration_open !== '0';

  return (
    <SectionCard icon={UserPlus} tone="bg-gradient-to-br from-emerald-500 to-teal-600" title="Pendaftaran Driver & Mitra"
      subtitle="Tutup lamaran kapan saja. Saat ditutup, halaman pendaftaran publik menampilkan info 'pendaftaran sedang ditutup' dan menolak pengiriman form.">
      <div className="space-y-4">
        <RegToggle open={driverOpen} saving={saving} icon={Car} title="Pendaftaran Driver" url="kilatgo.com/daftar-driver"
          onToggle={() => save({ driver_registration_open: driverOpen ? '0' : '1' })} />
        <RegToggle open={merchantOpen} saving={saving} icon={Store} title="Pendaftaran Mitra" url="kilatgo.com/daftar-merchant"
          onToggle={() => save({ merchant_registration_open: merchantOpen ? '0' : '1' })} />
      </div>
      {msg && <p className="text-sm text-emerald-600 font-medium mt-4">{msg}</p>}
    </SectionCard>
  );
}

const TABS: { key: string; label: string; icon: any }[] = [
  { key: 'komisi', label: 'Komisi & Tarif', icon: Percent },
  { key: 'membership', label: 'Keanggotaan', icon: Award },
  { key: 'promosi', label: 'Promosi Mitra', icon: Megaphone },
  { key: 'kontak', label: 'Kontak', icon: Phone },
  { key: 'bantuan', label: 'Bantuan & Tips', icon: HelpCircle },
  { key: 'pembayaran', label: 'Pembayaran', icon: CreditCard },
  { key: 'ppob', label: 'PPOB', icon: Smartphone },
  { key: 'pendaftaran', label: 'Pendaftaran', icon: UserPlus },
  { key: 'maintenance', label: 'Mode Perbaikan', icon: Wrench },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('komisi');
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Konfigurasi</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Pengaturan</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition ${tab === t.key ? 'bg-kilatgo-600 text-white shadow-sm shadow-kilatgo-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>
      {tab === 'komisi' ? <KomisiTab /> : tab === 'membership' ? <MembershipTab /> : tab === 'promosi' ? <PromosiMitraTab /> : tab === 'kontak' ? <KontakTab /> : tab === 'bantuan' ? <MitraHelpTab /> : tab === 'pembayaran' ? <PembayaranTab /> : tab === 'ppob' ? <PpobTab /> : tab === 'pendaftaran' ? <PendaftaranTab /> : <MaintenanceTab />}
    </div>
  );
}
