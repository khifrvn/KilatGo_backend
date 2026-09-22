import { useEffect, useState } from 'react';
import { Plus, X, Inbox, MapPin, Copy, Check, RefreshCw, Search, Link2, Bike, Zap, Map as MapIcon } from 'lucide-react';
import MapPicker from '../components/MapPicker';
import {
  createManualOrder, getManualOrders, getManualOrder, updateManualOrderPrice, manualOrderPaymentLink, confirmManualOrderPayment,
  dispatchManualOrder, getOnlineDrivers, searchLinkCustomers,
  type ManualOrder, type OnlineDriver, type LinkCustomer,
} from '../api/admin';

const rp = (v?: number | null) => (v == null ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID'));
const fmt = (s: string) => new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const PAY_LABEL: Record<string, string> = { CASH: 'COD', EWALLET: 'Payment Gateway', BALANCE: 'Saldo KilatGo' };
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu driver', ACCEPTED: 'Diterima driver', DRIVER_ARRIVED: 'Driver di toko',
  ON_RIDE: 'Sedang diantar', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 ring-amber-200', ACCEPTED: 'bg-blue-100 text-blue-700 ring-blue-200',
  DRIVER_ARRIVED: 'bg-indigo-100 text-indigo-700 ring-indigo-200', ON_RIDE: 'bg-purple-100 text-purple-700 ring-purple-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 ring-emerald-200', CANCELLED: 'bg-red-100 text-red-700 ring-red-200',
};
const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 outline-none transition';

// Parse "lat, lng" (paste dari Google Maps) → {lat,lng} atau null.
function parseCoord(s: string): { lat: number; lng: number } | null {
  const m = s.split(',').map((x) => parseFloat(x.trim()));
  if (m.length === 2 && Number.isFinite(m[0]) && Number.isFinite(m[1])) return { lat: m[0], lng: m[1] };
  return null;
}

export default function ManualOrdersPage() {
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setOrders(await getManualOrders()); }
    catch (e: any) { setError(e.response?.data?.message || 'Gagal memuat'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Operasional</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Order Manual</h1>
          <p className="text-sm text-slate-500 mt-1">Buatkan order untuk pelanggan yang pesan via WhatsApp.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-kilatgo-600 hover:bg-kilatgo-700 text-white font-semibold rounded-xl transition">
          <Plus className="w-4 h-4" /> Buat Order Manual
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Belum ada order manual</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Pelanggan', 'Pesanan', 'Total', 'Bayar', 'Driver', 'Status', 'Waktu'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} onClick={() => setDetailId(o.id)} className="hover:bg-slate-50/80 cursor-pointer">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-sm text-kilatgo-950">{o.customerName}</p>
                      <p className="text-xs text-slate-500">{o.customerPhone}{o.linked && ' · terkait akun'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[200px] truncate">{o.items || '—'}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-kilatgo-950">{o.itemsKnown ? rp(o.totalFare) : <span className="text-amber-600">Harga belum diisi</span>}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{PAY_LABEL[o.paymentMethod]}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{o.driver?.name ?? '—'}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{fmt(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

// Input koordinat: ketik "lat, lng" ATAU pilih di peta (toggle).
function CoordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [showMap, setShowMap] = useState(false);
  const coord = parseCoord(value);
  return (
    <Field label={label} hint="ketik 'lat, lng' atau pilih di peta">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="-6.20, 106.81" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShowMap((s) => !s)} className="px-3 py-2 bg-kilatgo-50 text-kilatgo-700 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-kilatgo-100">
          <MapIcon className="w-4 h-4" /> {showMap ? 'Tutup' : 'Peta'}
        </button>
      </div>
      {showMap && (
        <div className="mt-2">
          <MapPicker value={coord} onChange={(v) => onChange(`${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}`)} height={260} />
          <p className="text-[11px] text-slate-400 mt-1">Klik atau geser pin untuk memilih titik.</p>
        </div>
      )}
    </Field>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ customerName: '', customerPhone: '', customerAddress: '', cust: '', store: '', items: '', itemsTotal: '', paymentMethod: 'CASH', notes: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const [linked, setLinked] = useState<LinkCustomer | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LinkCustomer[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => { searchLinkCustomers(q).then(setResults).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    setErr('');
    const cust = parseCoord(f.cust); const store = parseCoord(f.store);
    if (!cust) { setErr('Titik koordinat pelanggan tidak valid (format: lat, lng)'); return; }
    if (!store) { setErr('Titik koordinat toko tidak valid (format: lat, lng)'); return; }
    try {
      setSaving(true);
      await createManualOrder({
        customerName: f.customerName, customerPhone: f.customerPhone, customerAddress: f.customerAddress,
        custLat: cust.lat, custLng: cust.lng, storeLat: store.lat, storeLng: store.lng,
        items: f.items, itemsTotal: f.itemsTotal.trim() === '' ? null : Number(f.itemsTotal),
        paymentMethod: f.paymentMethod as any, linkedCustomerId: linked?.id ?? null, notes: f.notes,
      });
      onCreated();
    } catch (e: any) { setErr(e.response?.data?.message || 'Gagal membuat order'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-kilatgo-950">Buat Order Manual</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Nama pelanggan"><input className={inputCls} value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></Field>
          <Field label="Nomor HP pelanggan"><input className={inputCls} value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} /></Field>
          <Field label="Alamat pelanggan"><textarea rows={2} className={inputCls} value={f.customerAddress} onChange={(e) => set('customerAddress', e.target.value)} /></Field>
          <CoordField label="Titik koordinat pelanggan" value={f.cust} onChange={(v) => set('cust', v)} />
          <CoordField label="Titik koordinat toko" value={f.store} onChange={(v) => set('store', v)} />
          <Field label="Pesanan pelanggan"><textarea rows={2} className={inputCls} placeholder="mis. 2 Nasi Goreng, 1 Es Teh" value={f.items} onChange={(e) => set('items', e.target.value)} /></Field>
          <Field label="Harga pesanan" hint="kosongkan bila belum diketahui (driver cek di toko)"><input type="number" min={0} className={inputCls} placeholder="Belum diketahui" value={f.itemsTotal} onChange={(e) => set('itemsTotal', e.target.value)} /></Field>
          <Field label="Sistem pembayaran">
            <select className={inputCls} value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
              <option value="CASH">COD (bayar tunai ke driver)</option>
              <option value="EWALLET">Payment Gateway (link transfer)</option>
              <option value="BALANCE">Saldo Dompet KilatGo (wajib kaitkan akun)</option>
            </select>
          </Field>
          <Field label="Kaitkan pelanggan (opsional)" hint="untuk Live Tracking — pelanggan wajib punya akun KilatGo">
            {linked ? (
              <div className="flex items-center justify-between bg-kilatgo-50 border border-kilatgo-200 rounded-lg px-3 py-2">
                <div><p className="text-sm font-semibold text-kilatgo-800">{linked.name}</p><p className="text-xs text-slate-500">{linked.email} · {linked.phone}</p></div>
                <button onClick={() => setLinked(null)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input className={`${inputCls} pl-9`} placeholder="Cari nama / email / HP" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {results.map((c) => (
                      <button key={c.id} onClick={() => { setLinked(c); setQ(''); setResults([]); }} className="block w-full text-left px-3 py-2 hover:bg-slate-50">
                        <p className="text-sm font-medium text-slate-800">{c.name}</p><p className="text-xs text-slate-500">{c.email} · {c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
          <Field label="Catatan pelanggan (opsional)"><textarea rows={2} className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>

          {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{err}</div>}
          <button onClick={submit} disabled={saving} className="w-full py-3 bg-kilatgo-600 hover:bg-kilatgo-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Buat Order & Lanjut Pilih Driver'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [o, setO] = useState<ManualOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);
  const [priceInput, setPriceInput] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try { const d = await getManualOrder(id); setO(d); setPriceInput(d.itemsTotal != null ? String(d.itemsTotal) : ''); }
    catch (e: any) { setErr(e.response?.data?.message || 'Gagal memuat'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const flash = (m: string) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500); };
  const fail = (e: any) => setErr(e.response?.data?.message || 'Terjadi kesalahan');

  const loadDrivers = async () => { try { setDrivers(await getOnlineDrivers()); } catch (e) { fail(e); } };

  const doDispatch = async (payload: { driverId?: string; auto?: boolean }) => {
    try { setBusy('dispatch'); await dispatchManualOrder(id, payload); flash('Order ditawarkan ke driver'); await load(); onChanged(); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  const savePrice = async () => {
    try { setBusy('price'); setO(await updateManualOrderPrice(id, Number(priceInput))); flash('Harga diperbarui'); onChanged(); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  const genLink = async () => {
    try { setBusy('link'); setO(await manualOrderPaymentLink(id)); flash('Link bayar dibuat'); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };
  const confirmPay = async () => {
    if (!confirm('Konfirmasi pembayaran pelanggan sudah diterima? Setelah ini pesanan bisa diselesaikan.')) return;
    try { setBusy('confirm'); setO(await confirmManualOrderPayment(id)); flash('Pembayaran dikonfirmasi'); onChanged(); }
    catch (e) { fail(e); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-kilatgo-950">Detail Order Manual</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        {loading || !o ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              <span className="text-xs text-slate-400">{PAY_LABEL[o.paymentMethod]}</span>
            </div>
            {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm">{msg}</div>}
            {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{err}</div>}

            <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
              <p className="font-bold text-kilatgo-950">{o.customerName} · {o.customerPhone}</p>
              <p className="text-slate-600 flex items-start gap-1.5"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />{o.customerAddress}</p>
              {o.items && <p className="text-slate-600">Pesanan: {o.items}</p>}
              {o.notes && <p className="text-slate-500 text-xs">Catatan: {o.notes}</p>}
              {o.linked && <p className="text-emerald-600 text-xs flex items-center gap-1"><Link2 className="w-3 h-3" /> Terkait akun {o.linked.name} — Live Tracking aktif</p>}
              <div className="flex gap-2 pt-1">
                <a href={`https://maps.google.com/?q=${o.storeLat},${o.storeLng}`} target="_blank" rel="noreferrer" className="text-xs text-kilatgo-600 hover:underline">📍 Toko</a>
                <a href={`https://maps.google.com/?q=${o.custLat},${o.custLng}`} target="_blank" rel="noreferrer" className="text-xs text-kilatgo-600 hover:underline">📍 Pelanggan</a>
              </div>
            </div>

            {/* Rincian biaya */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Ongkir</span><span>{rp(o.baseFare)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Biaya layanan</span><span>{rp(o.serviceFee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Harga pesanan</span><span>{o.itemsKnown ? rp(o.itemsTotal) : <span className="text-amber-600">belum diisi</span>}</span></div>
              <div className="flex justify-between font-bold text-kilatgo-950 pt-1.5 border-t border-slate-100"><span>Total</span><span>{o.itemsKnown ? rp(o.totalFare) : '—'}</span></div>
            </div>

            {/* Pilih driver (saat masih PENDING) */}
            {o.status === 'PENDING' && !o.driver && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-kilatgo-950">Pilih Driver</h4>
                <button onClick={() => doDispatch({ auto: true })} disabled={busy === 'dispatch'} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-kilatgo-600 hover:bg-kilatgo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                  <Zap className="w-4 h-4" /> Cari otomatis driver terdekat
                </button>
                {drivers.length === 0 ? (
                  <button onClick={loadDrivers} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition">
                    <Bike className="w-4 h-4" /> Pilih driver online manual
                  </button>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {drivers.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2">
                        <div><p className="text-sm font-medium text-slate-800">{d.name}</p><p className="text-xs text-slate-500">{d.phone} · ⭐ {d.rating.toFixed(1)}</p></div>
                        <button onClick={() => doDispatch({ driverId: d.id })} disabled={busy === 'dispatch'} className="px-3 py-1.5 text-xs font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 rounded-lg disabled:opacity-50">Tawarkan</button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400">Driver tetap harus konfirmasi dari aplikasinya.</p>
              </div>
            )}

            {o.driver && <div className="text-sm text-slate-600">Driver: <b className="text-kilatgo-950">{o.driver.name}</b> · {o.driver.phone}</div>}

            {/* Update harga pesanan */}
            {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <h4 className="text-sm font-bold text-kilatgo-950">Update Harga Pesanan</h4>
                <div className="flex gap-2">
                  <input type="number" min={0} className={inputCls} placeholder="Harga barang di toko" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} />
                  <button onClick={savePrice} disabled={busy === 'price' || priceInput.trim() === ''} className="px-4 py-2 bg-kilatgo-600 hover:bg-kilatgo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 whitespace-nowrap">Simpan</button>
                </div>
                <p className="text-xs text-slate-400">Total = ongkir + biaya layanan + harga pesanan.</p>
              </div>
            )}

            {/* Payment gateway link */}
            {o.paymentMethod === 'EWALLET' && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-kilatgo-950">Link Pembayaran</h4>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${o.paymentPaid ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'}`}>
                    {o.paymentPaid ? 'Sudah dibayar ✓' : 'Belum dibayar'}
                  </span>
                </div>
                {o.paymentUrl ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-600 truncate flex-1">{o.paymentUrl}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(o.paymentUrl!); setCopied(true); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-600">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                  </div>
                ) : null}
                <button onClick={genLink} disabled={busy === 'link' || !o.itemsKnown} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                  <RefreshCw className="w-4 h-4" /> {o.paymentUrl ? 'Buat ulang link' : 'Buat link bayar'}
                </button>
                {!o.itemsKnown && <p className="text-xs text-amber-600">Isi harga pesanan dulu sebelum membuat link.</p>}
                {!o.paymentPaid && o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                  <button onClick={confirmPay} disabled={busy === 'confirm' || !o.itemsKnown} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Konfirmasi pembayaran diterima
                  </button>
                )}
                <p className="text-xs text-slate-400">Salin & kirim link ke WhatsApp pelanggan. Pesanan <b>tidak bisa diselesaikan</b> sebelum pembayaran dikonfirmasi (link lunas atau tekan tombol konfirmasi bila transfer manual sudah masuk).</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
