import { useEffect, useState } from 'react';
import { Package, Save, Inbox, RefreshCw } from 'lucide-react';
import {
  getPackagePrice, setPackagePrice, getPackageOrders, updatePackageOrder,
  PACKAGE_STATUSES, PACKAGE_STATUS_LABEL, type PackageOrder, type PackageStatus,
} from '../api/admin';

const rp = (v?: number | string | null) => 'Rp ' + Number(v ?? 0).toLocaleString('id-ID');
const fmtDate = (s: string) => new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusColor: Record<PackageStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700 ring-amber-200',
  VERIFIED: 'bg-blue-100 text-blue-700 ring-blue-200',
  PROCESSING: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  SHIPPING: 'bg-purple-100 text-purple-700 ring-purple-200',
  RECEIVED: 'bg-teal-100 text-teal-700 ring-teal-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export default function PackagesPage() {
  const [price, setPrice] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [savingPrice, setSavingPrice] = useState(false);
  const [orders, setOrders] = useState<PackageOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [p, o] = await Promise.all([getPackagePrice(), getPackageOrders()]);
      setPrice(String(p.price)); setItems(p.items); setOrders(o);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const flash = (m: string) => { setMsg(m); setError(''); setTimeout(() => setMsg(''), 2500); };

  const savePrice = async () => {
    try {
      setSavingPrice(true);
      await setPackagePrice(Number(price));
      flash('Harga paket disimpan');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal menyimpan harga');
    } finally {
      setSavingPrice(false);
    }
  };

  const changeStatus = async (o: PackageOrder, status: PackageStatus) => {
    try {
      setUpdating(o.id);
      await updatePackageOrder(o.id, { status });
      setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status } : x)));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal update status');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Operasional</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Paket Mitra Driver</h1>
        <p className="text-sm text-slate-500 mt-1">Atur harga & kelola pesanan paket (Jacket + Helm SNI). Pengiriman manual, driver hanya lihat status.</p>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-emerald-700 text-sm">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-sm">{error}</div>}

      {/* Harga & isi paket */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-kilatgo-600" />
          <h3 className="font-bold text-kilatgo-950">Harga & Isi Paket</h3>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500">Harga paket (Rp)</label>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 outline-none" />
          </div>
          <button onClick={savePrice} disabled={savingPrice}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-kilatgo-600 hover:bg-kilatgo-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
            <Save className="w-4 h-4" /> Simpan Harga
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((it) => (
            <span key={it} className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-kilatgo-50 text-kilatgo-700 ring-1 ring-kilatgo-200">{it}</span>
          ))}
        </div>
      </div>

      {/* Pesanan */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-kilatgo-950">Pesanan Paket</h3>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-kilatgo-700">
            <RefreshCw className="w-4 h-4" /> Muat ulang
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Belum ada pesanan paket</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nominal</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dibuat</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ubah Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-kilatgo-950">{o.driverName ?? '—'}</p>
                      <p className="text-xs text-slate-500">{o.driverPhone}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-kilatgo-950">{rp(o.amount)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${statusColor[o.status]}`}>
                        {PACKAGE_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={o.status}
                        disabled={updating === o.id || o.status === 'PENDING_PAYMENT'}
                        onChange={(e) => changeStatus(o, e.target.value as PackageStatus)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-kilatgo-400 outline-none disabled:opacity-60"
                        title={o.status === 'PENDING_PAYMENT' ? 'Menunggu pembayaran driver' : undefined}
                      >
                        {PACKAGE_STATUSES.map((s) => <option key={s} value={s}>{PACKAGE_STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
