import { useEffect, useState } from 'react';
import { TicketPercent, Plus, X, Loader2, Trash2, Pencil, Check, Calendar, Users } from 'lucide-react';
import { getVouchers, createVoucher, updateVoucher, deleteVoucher, type Voucher, type VoucherInput } from '../api/admin';

const rp = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
const SERVICES = [
  { key: 'RIDE', label: 'KilatRide' },
  { key: 'CAR', label: 'KilatCar' },
  { key: 'SEND', label: 'KilatSend' },
  { key: 'FOOD', label: 'KilatFood' },
];
const TYPES = [
  { key: 'PERCENT', label: 'Diskon %' },
  { key: 'FIXED', label: 'Potongan Rp' },
  { key: 'FREE_ONGKIR', label: 'Gratis ongkir' },
];
const dt = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const toLocalInput = (s: string) => { const d = new Date(s); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); };

const discountSummary = (v: Voucher) =>
  v.discountType === 'PERCENT' ? `Diskon ${v.value}%${v.maxDiscount ? ` (maks ${rp(v.maxDiscount)})` : ''}`
    : v.discountType === 'FIXED' ? `Potongan ${rp(v.value)}`
    : `Gratis ongkir${v.value > 0 ? ` (maks ${rp(v.value)})` : ''}`;

function VoucherModal({ editing, onClose, onDone }: { editing: Voucher | null; onClose: () => void; onDone: () => void }) {
  const isEdit = !!editing;
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 864e5);
  const [f, setF] = useState<any>(editing ? {
    ...editing,
    startAt: toLocalInput(editing.startAt), endAt: toLocalInput(editing.endAt),
    maxDiscount: editing.maxDiscount ?? '', totalQuota: editing.totalQuota ?? '',
  } : {
    code: '', title: '', description: '', discountType: 'PERCENT', value: '', maxDiscount: '',
    minSpend: 0, services: ['FOOD'], startAt: toLocalInput(now.toISOString()), endAt: toLocalInput(in30.toISOString()),
    totalQuota: '', perUserLimit: 1, newUserOnly: false, isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const toggleSvc = (k: string) => set('services', f.services.includes(k) ? f.services.filter((x: string) => x !== k) : [...f.services, k]);

  const submit = async () => {
    setErr('');
    try {
      setSaving(true);
      const payload: VoucherInput = {
        code: (f.code || '').toUpperCase(), title: f.title, description: f.description || null,
        discountType: f.discountType, value: Number(f.value) || 0,
        maxDiscount: f.maxDiscount === '' ? null : Number(f.maxDiscount),
        minSpend: Number(f.minSpend) || 0, services: f.services,
        startAt: f.startAt, endAt: f.endAt,
        totalQuota: f.totalQuota === '' ? null : Number(f.totalQuota),
        perUserLimit: Number(f.perUserLimit) || 1, newUserOnly: !!f.newUserOnly, isActive: !!f.isActive,
      };
      if (isEdit) await updateVoucher(editing!.id, payload); else await createVoucher(payload);
      onDone();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Gagal menyimpan.'); } finally { setSaving(false); }
  };

  const valueLabel = f.discountType === 'PERCENT' ? 'Persen (%)' : f.discountType === 'FIXED' ? 'Nominal potongan (Rp)' : 'Batas ongkir (Rp, 0 = penuh)';
  const inp = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-kilatgo-950 flex items-center gap-2"><TicketPercent className="w-5 h-5 text-kilatgo-600" />{isEdit ? 'Edit Voucher' : 'Tambah Voucher'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kode</label>
              <input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} disabled={isEdit}
                placeholder="KILATFOOD50" className={`${inp} font-mono disabled:opacity-60`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Judul</label>
              <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Diskon 50% KilatFood" className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Deskripsi</label>
            <input value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Berlaku untuk pesanan makanan" className={inp} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Jenis potongan</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button key={t.key} onClick={() => set('discountType', t.key)}
                  className={`flex-1 px-2 py-2 rounded-xl text-sm font-semibold transition ${f.discountType === t.key ? 'bg-kilatgo-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>{t.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{valueLabel}</label>
              <input type="number" min={0} value={f.value} onChange={(e) => set('value', e.target.value)} className={inp} />
            </div>
            {f.discountType === 'PERCENT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Maks potongan (Rp)</label>
                <input type="number" min={0} value={f.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} placeholder="tanpa batas" className={inp} />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Min. transaksi (Rp)</label>
              <input type="number" min={0} value={f.minSpend} onChange={(e) => set('minSpend', e.target.value)} className={inp} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Berlaku untuk layanan</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map((s) => {
                const on = f.services.includes(s.key);
                return (
                  <button key={s.key} onClick={() => toggleSvc(s.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition ${on ? 'bg-kilatgo-50 border-kilatgo-300 text-kilatgo-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span className={`w-4 h-4 rounded flex items-center justify-center ${on ? 'bg-kilatgo-600 text-white' : 'border border-slate-300'}`}>{on && <Check className="w-3 h-3" />}</span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mulai</label>
              <input type="datetime-local" value={f.startAt} onChange={(e) => set('startAt', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Selesai</label>
              <input type="datetime-local" value={f.endAt} onChange={(e) => set('endAt', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kuota total</label>
              <input type="number" min={0} value={f.totalQuota} onChange={(e) => set('totalQuota', e.target.value)} placeholder="tanpa batas" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Maks per user</label>
              <input type="number" min={1} value={f.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} className={inp} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 cursor-pointer flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <button type="button" onClick={() => set('newUserOnly', !f.newUserOnly)} className={`relative w-10 h-6 rounded-full transition ${f.newUserOnly ? 'bg-kilatgo-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${f.newUserOnly ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-sm font-medium text-slate-700">Pengguna baru saja</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <button type="button" onClick={() => set('isActive', !f.isActive)} className={`relative w-10 h-6 rounded-full transition ${f.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${f.isActive ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-sm font-medium text-slate-700">Aktif</span>
            </label>
          </div>

          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>
        <div className="flex gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">Batal</button>
          <button onClick={submit} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VouchersPage() {
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editing: Voucher | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => { setLoading(true); try { setRows(await getVouchers()); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const del = async (v: Voucher) => {
    if (!confirm(`Hapus voucher "${v.code}"?`)) return;
    try { setBusy(v.id); await deleteVoucher(v.id); await load(); } finally { setBusy(null); }
  };

  const expired = (v: Voucher) => new Date(v.endAt) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Operasional</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Voucher</h1>
          <p className="text-sm text-slate-500 mt-1">Kupon yang dipakai pelanggan saat checkout untuk memotong biaya transaksi.</p>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 shadow-sm shadow-kilatgo-600/20 transition">
          <Plus className="w-4 h-4" />Tambah Voucher
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-kilatgo-500" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 text-slate-400"><TicketPercent className="w-8 h-8 mb-3" /><p className="text-sm">Belum ada voucher</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-kilatgo-700 bg-kilatgo-50 px-2 py-0.5 rounded-lg text-sm">{v.code}</span>
                    {!v.isActive ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>
                      : expired(v) ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Kedaluwarsa</span>
                      : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>}
                    {v.newUserOnly && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">User baru</span>}
                  </div>
                  <p className="font-bold text-kilatgo-950 mt-1.5">{v.title}</p>
                  <p className="text-sm text-kilatgo-600 font-semibold">{discountSummary(v)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setModal({ editing: v })} className="p-2 rounded-lg bg-kilatgo-50 text-kilatgo-700 hover:bg-kilatgo-100"><Pencil className="w-4 h-4" /></button>
                  <button disabled={busy === v.id} onClick={() => del(v)} className="p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100">{busy === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {v.services.map((s) => <span key={s} className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{SERVICES.find((x) => x.key === s)?.label ?? s}</span>)}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{dt(v.startAt)} – {dt(v.endAt)}</span>
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Terpakai {v.usedCount}{v.totalQuota != null ? `/${v.totalQuota}` : ''} · maks {v.perUserLimit}/user</span>
                {v.minSpend > 0 && <span>Min. {rp(v.minSpend)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <VoucherModal editing={modal.editing} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}
