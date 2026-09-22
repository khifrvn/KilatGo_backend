import { useEffect, useState } from 'react';
import { Plus, Inbox, X, Trash2, Pencil, ImagePlus, Loader2 } from 'lucide-react';
import { getPromos, createPromo, updatePromo, deletePromo, getVouchers, type Promo, type Voucher } from '../api/admin';
import { IMAGE_BASE } from '../api/client';

const AUDIENCES = [
  { v: 'CUSTOMER', label: 'Pelanggan', color: 'bg-blue-100 text-blue-700' },
  { v: 'DRIVER', label: 'Driver', color: 'bg-amber-100 text-amber-700' },
  { v: 'MERCHANT', label: 'Mitra', color: 'bg-emerald-100 text-emerald-700' },
] as const;

// Beranda selalu menampilkan semua banner; placement menentukan halaman layanan tambahannya.
const PLACEMENTS = [
  { v: 'ALL', label: 'Semua layanan', hint: 'Tampil di beranda + halaman KilatFood & KilatSend' },
  { v: 'FOOD', label: 'KilatFood', hint: 'Tampil di beranda + halaman KilatFood' },
  { v: 'SEND', label: 'KilatSend', hint: 'Tampil di beranda + halaman KilatSend' },
];

const audienceInfo = (v: string) => AUDIENCES.find((a) => a.v === v) ?? { v, label: v, color: 'bg-slate-100 text-slate-600' };
const placementLabel = (v?: string) => PLACEMENTS.find((p) => p.v === v)?.label ?? 'Semua layanan';
const promoImage = (img?: string | null) => (img ? `${IMAGE_BASE}promos/${img}` : null);

export default function PromoPage() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CUSTOMER' | 'DRIVER' | 'MERCHANT'>('ALL');
  const [editing, setEditing] = useState<Promo | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { setRows(await getPromos()); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const del = async (p: Promo) => {
    if (!confirm(`Hapus banner "${p.title}"?`)) return;
    setBusy(p.id);
    try { await deletePromo(p.id); await load(); } finally { setBusy(null); }
  };

  const filtered = rows.filter((r) => filter === 'ALL' || r.audience === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Manajemen</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Promo Banner</h1>
        </div>
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition">
          <Plus className="w-4 h-4" />Tambah Banner
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', ...AUDIENCES.map((a) => a.v)] as const).map((v) => (
          <button key={v} onClick={() => setFilter(v as typeof filter)}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg transition ${filter === v ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {v === 'ALL' ? 'Semua' : audienceInfo(v).label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-slate-400"><Inbox className="w-8 h-8 mb-3" /><p className="text-sm">Belum ada banner</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const img = promoImage(p.image);
            const a = audienceInfo(p.audience);
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {img && <img src={img} alt={p.title} className="w-full h-36 object-cover" />}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.color}`}>{a.label}</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">{placementLabel(p.placement)}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{p.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    {p.voucherCode && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-mono">{p.voucherCode}</span>}
                  </div>
                  <p className="font-bold text-kilatgo-950">{p.title}</p>
                  {p.description && <p className="text-sm text-slate-500 mt-1 line-clamp-3">{p.description}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-kilatgo-50 text-kilatgo-700 hover:bg-kilatgo-100"><Pencil className="w-3.5 h-3.5" />Ubah</button>
                    <button disabled={busy === p.id} onClick={() => del(p)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" />Hapus</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <PromoModal promo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function PromoModal({ promo, onClose, onSaved }: { promo: Promo | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(promo?.title ?? '');
  const [description, setDescription] = useState(promo?.description ?? '');
  const [audience, setAudience] = useState(promo?.audience ?? 'CUSTOMER');
  const [placement, setPlacement] = useState(promo?.placement ?? 'ALL');
  const [voucherCode, setVoucherCode] = useState(promo?.voucherCode ?? '');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isActive, setIsActive] = useState(promo?.isActive ?? true);

  useEffect(() => { getVouchers().then(setVouchers).catch(() => {}); }, []);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(promoImage(promo?.image));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!title.trim()) { setErr('Judul wajib diisi'); return; }
    setSaving(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description);
      fd.append('audience', audience);
      fd.append('placement', placement);
      fd.append('isActive', String(isActive));
      fd.append('voucherCode', voucherCode); // '' = lepas kaitan
      if (file) fd.append('image', file);
      if (promo) await updatePromo(promo.id, fd); else await createPromo(fd);
      onSaved();
    } catch { setErr('Gagal menyimpan banner'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-kilatgo-950">{promo ? 'Ubah Banner' : 'Tambah Banner'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <div className="w-full h-40 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center cursor-pointer border border-dashed border-slate-300">
              {preview ? <img src={preview} alt="banner" className="w-full h-full object-cover" /> : <div className="text-slate-400 flex flex-col items-center gap-1"><ImagePlus className="w-6 h-6" /><span className="text-xs">Unggah banner</span></div>}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Judul</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diskon 20% menu favorit"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-kilatgo-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-kilatgo-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Untuk</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value as Promo['audience'])}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-kilatgo-400">
                {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tampil di</label>
              <select value={placement} onChange={(e) => setPlacement(e.target.value as Promo['placement'])}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-kilatgo-400">
                {PLACEMENTS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-2">{PLACEMENTS.find((p) => p.v === placement)?.hint}</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kaitkan voucher <span className="text-slate-400 font-normal">(opsional — banner jadi bisa diklik untuk lihat kode)</span></label>
            <select value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-kilatgo-400">
              <option value="">Tanpa voucher</option>
              {vouchers.filter((v) => v.isActive).map((v) => (
                <option key={v.id} value={v.code}>{v.code} — {v.title}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setIsActive((v) => !v)}
              className={`relative w-12 h-7 rounded-full transition ${isActive ? 'bg-kilatgo-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm font-medium text-slate-700">Aktif</span>
          </label>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
