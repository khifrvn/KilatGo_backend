import { useEffect, useState } from 'react';
import { Percent, MessageSquareWarning, Save, Loader2, Inbox, CheckCircle2, Phone, Wrench } from 'lucide-react';
import { getSettings, updateSettings, getComplaints, updateComplaint, type Complaint } from '../api/admin';

const COMMISSION_FIELDS: { key: string; label: string; suffix: string; hint?: string }[] = [
  { key: 'commission_percent', label: 'Komisi platform (Ride/Send)', suffix: '%' },
  { key: 'food_commission_percent', label: 'Komisi KilatFood', suffix: '%' },
  { key: 'base_fare', label: 'Tarif dasar', suffix: 'Rp' },
  { key: 'per_km', label: 'Tarif per km', suffix: 'Rp' },
  { key: 'min_fare', label: 'Tarif minimum', suffix: 'Rp' },
];

const KONTAK_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'contact_email', label: 'Email', placeholder: 'costumerservice@kilatgo.com' },
  { key: 'contact_phone', label: 'Telepon', placeholder: '08xxxxxxxxxx' },
  { key: 'contact_whatsapp', label: 'WhatsApp', placeholder: '08xxxxxxxxxx' },
  { key: 'contact_address', label: 'Alamat', placeholder: 'Alamat lengkap' },
];

const statusColor: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700 ring-amber-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 ring-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

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

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
      <h3 className="font-bold text-kilatgo-950 mb-1">Kontak</h3>
      <p className="text-sm text-slate-500 mb-5">Info ini tampil di bagian "Hubungi kami" pada landing page.</p>
      <div className="space-y-4">
        {KONTAK_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
            {f.key === 'contact_address' ? (
              <textarea rows={2} value={values[f.key] ?? ''} placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400 resize-none" />
            ) : (
              <input value={values[f.key] ?? ''} placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Simpan
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

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
      setValues(await updateSettings({ maintenance_mode: values.maintenance_mode ?? '0', maintenance_message: values.maintenance_message ?? '', ...patch }));
      setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
      <h3 className="font-bold text-kilatgo-950 mb-1">Mode Perbaikan</h3>
      <p className="text-sm text-slate-500 mb-5">Saat aktif, aplikasi driver/pengguna diblokir dan menampilkan pesan di bawah. Panel admin tetap bisa diakses.</p>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 mb-4">
        <div>
          <p className="font-semibold text-slate-800">Aktifkan mode perbaikan</p>
          <p className={`text-sm ${on ? 'text-amber-600' : 'text-slate-500'}`}>{on ? 'Aplikasi sedang diblokir' : 'Aplikasi berjalan normal'}</p>
        </div>
        <button
          onClick={() => save({ maintenance_mode: on ? '0' : '1' })}
          disabled={saving}
          className={`relative w-14 h-8 rounded-full transition disabled:opacity-60 ${on ? 'bg-amber-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-1.5">Pesan perbaikan</label>
      <textarea rows={2} value={values.maintenance_message ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, maintenance_message: e.target.value }))}
        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400 resize-none" />

      <div className="flex items-center gap-3 mt-6">
        <button onClick={() => save({})} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Simpan pesan
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

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
      const updated = await updateSettings(patch);
      setValues(updated); setMsg('Tersimpan ✓');
    } catch { setMsg('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
      <h3 className="font-bold text-kilatgo-950 mb-1">Komisi & Tarif</h3>
      <p className="text-sm text-slate-500 mb-5">Nilai ini dipakai untuk perhitungan tarif & potongan platform.</p>
      <div className="space-y-4">
        {COMMISSION_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center gap-4">
            <label className="flex-1 text-sm font-medium text-slate-700">{f.label}</label>
            <div className="relative w-40">
              <input type="number" min={0} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{f.suffix}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Simpan
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

function KendalaTab() {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (status?: string) => {
    setLoading(true);
    try { setRows(await getComplaints(status || undefined)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    try { setBusy(id); await updateComplaint(id, { status }); await load(filter); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[['', 'Semua'], ['OPEN', 'Open'], ['IN_PROGRESS', 'Proses'], ['RESOLVED', 'Selesai']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); load(v); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${filter === v ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>{l}</button>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Inbox className="w-8 h-8 mb-3" /><p className="text-sm">Tidak ada kendala</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((c) => (
              <div key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.fromRole === 'DRIVER' ? 'Driver' : 'Mitra'}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${statusColor[c.status]}`}>{c.status}</span>
                      {c.category && <span className="text-xs text-slate-400">{c.category}</span>}
                    </div>
                    <p className="font-semibold text-kilatgo-950">{c.subject}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{c.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{c.fromName ?? ''} · {new Date(c.createdAt).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {c.status !== 'IN_PROGRESS' && c.status !== 'RESOLVED' && (
                      <button disabled={busy === c.id} onClick={() => setStatus(c.id, 'IN_PROGRESS')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">Proses</button>
                    )}
                    {c.status !== 'RESOLVED' && (
                      <button disabled={busy === c.id} onClick={() => setStatus(c.id, 'RESOLVED')} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="w-3.5 h-3.5" />Selesai</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'komisi' | 'kontak' | 'maintenance' | 'kendala'>('komisi');
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Konfigurasi</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Pengaturan</h1>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setTab('komisi')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition ${tab === 'komisi' ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}><Percent className="w-4 h-4" />Komisi & Tarif</button>
        <button onClick={() => setTab('kontak')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition ${tab === 'kontak' ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}><Phone className="w-4 h-4" />Kontak</button>
        <button onClick={() => setTab('maintenance')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition ${tab === 'maintenance' ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}><Wrench className="w-4 h-4" />Mode Perbaikan</button>
        <button onClick={() => setTab('kendala')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition ${tab === 'kendala' ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}><MessageSquareWarning className="w-4 h-4" />Kendala Driver & Mitra</button>
      </div>
      {tab === 'komisi' ? <KomisiTab /> : tab === 'kontak' ? <KontakTab /> : tab === 'maintenance' ? <MaintenanceTab /> : <KendalaTab />}
    </div>
  );
}
