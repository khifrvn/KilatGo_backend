import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Save, Search, CheckCircle2, Inbox, AlertTriangle } from 'lucide-react';
import {
  getPpobCatalog, savePpobActiveSkus, refreshPpobCatalog,
  type PpobCatalogItem,
} from '../api/admin';

const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID');

// Alasan sebuah produk tidak bisa dijual — ditampilkan apa adanya supaya admin
// tahu ini keputusan vendor, bukan aplikasi yang menyembunyikan produk.
function unavailableReason(p: PpobCatalogItem): string | null {
  if (!p.buyerStatus) return 'Dinonaktifkan di akun Digiflazz kamu';
  if (!p.sellerStatus) return 'Seller sedang offline';
  if (!p.unlimitedStock && p.stock <= 0) return 'Stok habis';
  return null;
}

export default function PpobProductsPage() {
  const [items, setItems] = useState<PpobCatalogItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(true); // belum pernah diseleksi admin
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [brand, setBrand] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const load = async () => {
    try {
      setLoading(true); setErr('');
      const data = await getPpobCatalog();
      setItems(data.items);
      setSelectAllMode(data.selectAll);
      setSelected(new Set(data.items.filter((i) => i.active).map((i) => i.sku)));
    } catch {
      setErr('Gagal memuat katalog. Pastikan kredensial Digiflazz sudah benar di tab Pengaturan → PPOB.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort(),
    [items],
  );
  const brands = useMemo(
    () => [...new Set(items.filter((i) => !cat || i.category === cat).map((i) => i.brand))].sort(),
    [items, cat],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) =>
      (!cat || i.category === cat) &&
      (!brand || i.brand === brand) &&
      (!onlyAvailable || i.available) &&
      (!s || i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s)),
    );
  }, [items, q, cat, brand, onlyAvailable]);

  const toggle = (sku: string) => {
    setMsg('');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
    setSelectAllMode(false);
  };

  // Pilih/lepas seluruh hasil filter sekaligus — penting karena katalog ribuan baris.
  const toggleFiltered = (on: boolean) => {
    setMsg('');
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((i) => (on ? next.add(i.sku) : next.delete(i.sku)));
      return next;
    });
    setSelectAllMode(false);
  };

  const save = async () => {
    try {
      setSaving(true); setMsg(''); setErr('');
      const n = await savePpobActiveSkus([...selected]);
      setSelectAllMode(n === 0);
      setMsg(n === 0 ? 'Tersimpan ✓ — semua produk yang tersedia dijual' : `Tersimpan ✓ — ${n} produk dijual di aplikasi`);
    } catch { setErr('Gagal menyimpan.'); } finally { setSaving(false); }
  };

  const refresh = async () => {
    try {
      setRefreshing(true); setMsg(''); setErr('');
      await refreshPpobCatalog();
      await load();
      setMsg('Katalog diambil ulang dari Digiflazz ✓');
    } catch { setErr('Gagal memuat ulang katalog dari Digiflazz.'); } finally { setRefreshing(false); }
  };

  const availableCount = items.filter((i) => i.available).length;
  const filteredSelected = filtered.filter((i) => selected.has(i.sku)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">PPOB</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Produk PPOB</h1>
          <p className="text-sm text-slate-500 mt-1">
            Katalog Digiflazz. Centang produk yang mau dijual di aplikasi — yang tidak dicentang tidak akan muncul.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Muat ulang
          </button>
          <button onClick={save} disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 shadow-sm shadow-kilatgo-600/20 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Simpan
          </button>
        </div>
      </div>

      {(msg || err) && (
        <div className={`rounded-xl p-3 text-sm font-medium inline-flex items-center gap-2 ${err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {err ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{err || msg}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Total produk vendor', items.length],
          ['Bisa dijual sekarang', availableCount],
          ['Dicentang', selectAllMode ? items.length : selected.size],
          ['Hasil filter', filtered.length],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-kilatgo-950 mt-0.5">{(value as number).toLocaleString('id-ID')}</p>
          </div>
        ))}
      </div>

      {selectAllMode && !loading && (
        <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm text-sky-800">
          <Inbox className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Belum ada seleksi — saat ini <b>semua produk yang tersedia</b> dijual di aplikasi. Begitu kamu simpan seleksi, hanya yang dicentang yang dipakai.</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama produk atau SKU"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-kilatgo-400" />
          </div>
          <select value={cat} onChange={(e) => { setCat(e.target.value); setBrand(''); }}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none">
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 outline-none">
            <option value="">Semua brand</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="w-4 h-4 rounded accent-kilatgo-600" />
            Hanya yang bisa dijual
          </label>
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-sm">
          <span className="text-slate-600">{filteredSelected} dari {filtered.length} baris tercentang</span>
          <button onClick={() => toggleFiltered(true)} className="text-kilatgo-600 font-semibold hover:underline">Centang semua hasil filter</button>
          <button onClick={() => toggleFiltered(false)} className="text-slate-500 font-semibold hover:underline">Lepas semua</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">Tidak ada produk yang cocok.</div>
        ) : (
          <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2.5 w-10"></th>
                  <th className="px-4 py-2.5">Produk</th>
                  <th className="px-4 py-2.5">Kategori</th>
                  <th className="px-4 py-2.5 text-right">Modal</th>
                  <th className="px-4 py-2.5 text-right">Harga jual</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const reason = unavailableReason(p);
                  const checked = selectAllMode || selected.has(p.sku);
                  return (
                    <tr key={p.sku} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <input type="checkbox" checked={checked} onChange={() => toggle(p.sku)}
                          className="w-4 h-4 rounded accent-kilatgo-600" />
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.sku} · {p.seller}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {p.category}
                        <span className="text-slate-400"> · {p.brand}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{rp(p.cost)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{rp(p.price)}</td>
                      <td className="px-4 py-2.5">
                        {reason ? (
                          <span className="inline-block px-2 py-0.5 rounded-lg text-xs bg-rose-100 text-rose-700">{reason}</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-lg text-xs bg-emerald-100 text-emerald-700">Tersedia</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
