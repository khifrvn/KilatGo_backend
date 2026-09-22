import { useEffect, useState } from 'react';
import { UserCog, Plus, X, Loader2, Trash2, Pencil, ShieldCheck, Crown, Check } from 'lucide-react';
import { getAdmins, createAdminAccount, updateAdminAccount, deleteAdminAccount, type AdminAccount } from '../api/admin';
import { PERMISSIONS } from '../constants/permissions';
import { useAuth } from '../contexts/AuthContext';

const statusColor: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-rose-100 text-rose-700',
};

function PermPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className={`grid grid-cols-2 gap-2 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {PERMISSIONS.map((p) => {
        const on = value.includes(p.key);
        return (
          <button key={p.key} type="button" onClick={() => toggle(p.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition text-left ${on ? 'bg-kilatgo-50 border-kilatgo-300 text-kilatgo-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${on ? 'bg-kilatgo-600 text-white' : 'border border-slate-300'}`}>{on && <Check className="w-3 h-3" />}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function AdminModal({ editing, onClose, onDone }: { editing: AdminAccount | null; onClose: () => void; onDone: () => void }) {
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [password, setPassword] = useState('');
  const [perms, setPerms] = useState<string[]>(editing?.permissions ?? []);
  const [isSuper, setIsSuper] = useState(editing?.isSuperAdmin ?? false);
  const [status, setStatus] = useState(editing?.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    try {
      setSaving(true);
      if (isEdit) {
        const patch: any = { name, permissions: perms, isSuperAdmin: isSuper, status };
        if (password.trim()) patch.password = password.trim();
        await updateAdminAccount(editing!.id, patch);
      } else {
        if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) throw new Error('Semua field wajib diisi.');
        if (password.trim().length < 6) throw new Error('Password minimal 6 karakter.');
        await createAdminAccount({ name: name.trim(), email: email.trim(), phone: phone.trim(), password: password.trim(), permissions: perms, isSuperAdmin: isSuper });
      }
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-kilatgo-950 flex items-center gap-2"><UserCog className="w-5 h-5 text-kilatgo-600" />{isEdit ? 'Edit Admin' : 'Tambah Admin'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Telepon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isEdit}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400 disabled:opacity-60" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400 disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{isEdit ? 'Reset Password (kosongkan bila tak diubah)' : 'Password'}</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? '••••••' : 'Min. 6 karakter'}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400" />
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
              <div className="flex gap-2">
                {['ACTIVE', 'SUSPENDED'].map((s) => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${status === s ? 'bg-kilatgo-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                    {s === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Superadmin toggle */}
          <label className="flex items-center justify-between rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><Crown className="w-4 h-4 text-amber-500" />Jadikan Superadmin (akses penuh)</span>
            <button type="button" onClick={() => setIsSuper((v) => !v)} className={`relative w-11 h-6 rounded-full transition ${isSuper ? 'bg-amber-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isSuper ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Izin menu {isSuper && <span className="text-amber-600 font-normal">(superadmin punya semua akses)</span>}</label>
            <PermPicker value={perms} onChange={setPerms} disabled={isSuper} />
          </div>

          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>

        <div className="flex gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">Batal</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editing: AdminAccount | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRows(await getAdmins()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (a: AdminAccount) => {
    if (!confirm(`Hapus admin "${a.name}"? Tindakan ini permanen.`)) return;
    try { setBusy(a.id); await deleteAdminAccount(a.id); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Gagal menghapus.'); }
    finally { setBusy(null); }
  };

  const permLabels = (a: AdminAccount) =>
    a.isSuperAdmin ? 'Semua akses' : a.permissions.length
      ? PERMISSIONS.filter((p) => a.permissions.includes(p.key)).map((p) => p.label).join(', ')
      : 'Belum ada izin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Kontrol Akses</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Admin & Hak Akses</h1>
        </div>
        <button onClick={() => setModal({ editing: null })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 shadow-sm shadow-kilatgo-600/20 transition">
          <Plus className="w-4 h-4" />Tambah Admin
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-kilatgo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${a.isSuperAdmin ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-kilatgo-500 to-kilatgo-700'}`}>
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-kilatgo-950 truncate">{a.name}</p>
                      {a.isSuperAdmin
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Crown className="w-3 h-3" />Superadmin</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"><ShieldCheck className="w-3 h-3" />Admin</span>}
                      {a.userId === user?.id && <span className="text-xs text-slate-400">(Anda)</span>}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{a.email}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor[a.status] ?? 'bg-slate-100 text-slate-600'}`}>{a.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</span>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-xs font-semibold text-slate-400 mb-0.5">Izin menu</p>
                <p className="text-sm text-slate-700">{permLabels(a)}</p>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => setModal({ editing: a })} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-kilatgo-50 text-kilatgo-700 hover:bg-kilatgo-100"><Pencil className="w-3.5 h-3.5" />Edit</button>
                {a.userId !== user?.id && (
                  <button disabled={busy === a.id} onClick={() => remove(a)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100">
                    {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Hapus
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <AdminModal editing={modal.editing} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}
