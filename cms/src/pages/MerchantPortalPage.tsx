import { useEffect, useState, type FormEvent } from 'react';
import { Store, Plus, LogOut, Loader2, UtensilsCrossed, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getMyMerchant, addMenu } from '../api/merchant';
import type { Merchant, MerchantMenu } from '../types';

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 outline-none transition';

export default function MerchantPortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [menus, setMenus] = useState<MerchantMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const m = await getMyMerchant();
      setMerchant(m);
      setMenus(m.menus || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleAddMenu = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      setSaving(true);
      const created = await addMenu(new FormData(form));
      setMenus((p) => [created, ...p]);
      form.reset();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal tambah menu');
    } finally { setSaving(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-kilatgo-950 text-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kilatgo-accent flex items-center justify-center"><Store className="w-5 h-5 text-kilatgo-950" /></div>
            <div>
              <p className="font-bold leading-tight">{merchant?.businessName || 'Merchant'}</p>
              <p className="text-xs text-kilatgo-300">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 text-sm text-kilatgo-200 hover:text-white"><LogOut className="w-4 h-4" />Keluar</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : merchant ? (
          <>
            <div className={`rounded-2xl p-5 flex items-center gap-3 ${merchant.isApproved ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              {merchant.isApproved ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
              <div>
                <p className="font-semibold">{merchant.isApproved ? 'Usaha aktif' : 'Menunggu verifikasi admin'}</p>
                <p className="text-sm opacity-80">{merchant.isApproved ? 'Menu kamu tampil ke pelanggan.' : 'Kamu tetap bisa menyiapkan menu selagi menunggu approval.'}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-kilatgo-950 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-kilatgo-500" />Tambah Menu</h2>
              <form onSubmit={handleAddMenu} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input name="name" required placeholder="Nama menu *" className={inputCls} />
                  <input name="price" required type="number" min={0} step="100" placeholder="Harga (Rp) *" className={inputCls} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input name="category" placeholder="Kategori (mis. Nasi)" className={inputCls} />
                  <input name="description" placeholder="Deskripsi singkat" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">Foto menu (opsional)</label>
                  <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm text-slate-500" />
                </div>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-kilatgo-950 bg-kilatgo-accent hover:bg-kilatgo-accent-dark transition disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Tambah
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-bold text-kilatgo-950">Daftar Menu ({menus.length})</h2></div>
              {menus.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <UtensilsCrossed className="w-10 h-10 mb-3" /><p className="text-sm">Belum ada menu. Tambahkan di atas.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {menus.map((m) => (
                    <div key={m.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-kilatgo-950">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.category || 'Tanpa kategori'}{m.description ? ` · ${m.description}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-kilatgo-950">Rp {Number(m.price).toLocaleString('id-ID')}</p>
                        <span className={`text-xs ${m.isAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>{m.isAvailable ? 'Tersedia' : 'Nonaktif'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
