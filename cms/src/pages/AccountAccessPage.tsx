import { useEffect, useState } from 'react';
import { Search, UserCog, X, Save, KeyRound, RefreshCw, Wallet, Plus, Minus, Copy, Check, Ban, UserCheck, Trash2, Image as ImageIcon } from 'lucide-react';
import { getAllUsers, getUserAccount, updateUserAccount, adjustUserBalance, deleteUserAccount, suspendUser, activateUser, type UserAccount } from '../api/admin';
import { IMAGE_BASE } from '../api/client';
import type { User } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const avatarUrl = (a?: string | null) => (a ? `${IMAGE_BASE}avatars/${a}` : null);
const logoUrl = (a?: string | null) => (a ? `${IMAGE_BASE}logos/${a}` : null);
// Dokumen privat (selfie/KTP/SIM/STNK/outlet) — token di query karena <img> tak kirim header auth.
const docUrl = (name?: string | null) => (name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : null);
const rp = (v?: number | string | null) => 'Rp ' + Number(v ?? 0).toLocaleString('id-ID');

const roleColors: Record<string, string> = {
  CUSTOMER: 'bg-kilatgo-100 text-kilatgo-700 ring-kilatgo-200',
  DRIVER: 'bg-kilatgo-accent/30 text-kilatgo-900 ring-kilatgo-accent/50',
  MERCHANT: 'bg-amber-100 text-amber-700 ring-amber-200',
};
const roleLabel: Record<string, string> = { CUSTOMER: 'Pelanggan', DRIVER: 'Driver', MERCHANT: 'Mitra' };
const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  SUSPENDED: 'bg-red-100 text-red-700 ring-red-200',
  PENDING: 'bg-amber-100 text-amber-700 ring-amber-200',
};

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${color}`}>{children}</span>
);

// Avatar bulat: foto (URL lengkap) bila ada, else inisial nama.
const UserAvatar = ({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) => (
  <div className="rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm flex-shrink-0 overflow-hidden" style={{ width: size, height: size }}>
    {src ? <img src={src} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : name.charAt(0).toUpperCase()}
  </div>
);

// Foto profil sesuai peran: driver = selfie (privat), mitra = logo (publik), pelanggan = avatar.
const listPhoto = (u: User): string | null =>
  u.role === 'DRIVER' ? docUrl(u.driver?.selfiePhoto)
    : u.role === 'MERCHANT' ? logoUrl(u.merchant?.logo)
      : avatarUrl(u.avatar);

export default function AccountAccessPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CUSTOMER' | 'DRIVER' | 'MERCHANT'>('ALL');
  const [editId, setEditId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getAllUsers();
      setUsers(data.filter((u) => u.role !== 'ADMIN')); // akun admin dikelola di menu Admin & Hak Akses
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat akun');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(
    (u) =>
      (roleFilter === 'ALL' || u.role === roleFilter) &&
      (u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Bantuan Akun</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Akses Semua Akun</h1>
        <p className="text-sm text-slate-500 mt-1">Bantu pengguna: ubah profil, alamat, saldo, dan kata sandi.</p>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, email, atau telepon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'CUSTOMER', 'DRIVER', 'MERCHANT'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${roleFilter === r ? 'bg-kilatgo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {r === 'ALL' ? 'Semua' : roleLabel[r]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><UserCog className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Tidak ada akun</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengguna</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Peran</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.name} src={listPhoto(u)} />
                        <div>
                          <p className="font-semibold text-sm text-kilatgo-950">{u.name}</p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                          <p className="text-xs text-slate-400">{u.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Badge color={roleColors[u.role] || 'bg-slate-100 text-slate-700 ring-slate-200'}>{roleLabel[u.role] || u.role}</Badge></td>
                    <td className="px-6 py-4"><Badge color={statusColors[u.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}>{u.status}</Badge></td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setEditId(u.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-kilatgo-700 bg-kilatgo-50 hover:bg-kilatgo-100 rounded-lg transition">
                        <UserCog className="w-4 h-4" /> Kelola
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editId && <ManageModal userId={editId} onClose={() => setEditId(null)} onSaved={fetchUsers} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition text-sm';

// Field profil per peran, dikelompokkan seperti form pendaftaran. type: text|date|number|textarea|select.
type FieldCfg = { key: string; label: string; type?: string; options?: string[]; full?: boolean };
type Section = { title: string; fields: FieldCfg[] };
const DRIVER_SECTIONS: Section[] = [
  { title: 'Data Diri (KTP)', fields: [
    { key: 'nik', label: 'NIK (16 digit)' },
    { key: 'birthDate', label: 'Tanggal lahir', type: 'date' },
    { key: 'address', label: 'Alamat domisili', type: 'textarea', full: true },
    { key: 'city', label: 'Kota' },
    { key: 'serviceType', label: 'Jenis layanan', type: 'select', options: ['RIDE', 'CAR', 'SEND', 'FOOD'] },
  ] },
  { title: 'SIM & Kendaraan', fields: [
    { key: 'simType', label: 'Jenis SIM' },
    { key: 'simNumber', label: 'Nomor SIM' },
    { key: 'simExpiry', label: 'Masa berlaku SIM', type: 'date' },
    { key: 'vehicleType', label: 'Jenis kendaraan' },
    { key: 'vehicleBrand', label: 'Merk / model' },
    { key: 'vehiclePlate', label: 'Plat nomor' },
    { key: 'vehicleYear', label: 'Tahun', type: 'number' },
    { key: 'vehicleColor', label: 'Warna' },
    { key: 'stnkNumber', label: 'Nomor STNK' },
    { key: 'licenseNumber', label: 'Nomor lisensi/SIM (registrasi)' },
  ] },
  { title: 'Rekening & Pajak', fields: [
    { key: 'bankName', label: 'Nama bank' },
    { key: 'bankAccount', label: 'Nomor rekening' },
    { key: 'bankHolder', label: 'Nama pemilik rekening (= KTP)' },
    { key: 'npwp', label: 'NPWP (opsional)' },
  ] },
];
const MERCHANT_SECTIONS: Section[] = [
  { title: 'Data Usaha', fields: [
    { key: 'businessName', label: 'Nama usaha' },
    { key: 'category', label: 'Kategori' },
    { key: 'description', label: 'Deskripsi', type: 'textarea', full: true },
    { key: 'ownerName', label: 'Nama pemilik' },
    { key: 'phone', label: 'Telepon usaha' },
    { key: 'operatingHours', label: 'Jam operasional' },
  ] },
  { title: 'Data Diri (KTP)', fields: [
    { key: 'nik', label: 'NIK (16 digit)' },
    { key: 'address', label: 'Alamat usaha', type: 'textarea', full: true },
    { key: 'city', label: 'Kota' },
  ] },
  { title: 'Rekening & Legalitas', fields: [
    { key: 'bankName', label: 'Nama bank' },
    { key: 'bankAccount', label: 'Nomor rekening' },
    { key: 'bankHolder', label: 'Nama pemilik rekening' },
    { key: 'npwp', label: 'NPWP' },
    { key: 'nib', label: 'NIB' },
    { key: 'siup', label: 'SIUP' },
  ] },
];
// Pelanggan: alamat domisili (wajib diisi agar bisa memesan layanan).
const CUSTOMER_SECTIONS: Section[] = [
  { title: 'Data Pelanggan', fields: [
    { key: 'address', label: 'Alamat domisili (wajib agar bisa memesan)', type: 'textarea', full: true },
  ] },
];
// Label ramah untuk pilihan jenis layanan driver.
const SERVICE_LABELS: Record<string, string> = { RIDE: 'Motor (RIDE)', CAR: 'Mobil (CAR)', SEND: 'Kirim Barang (SEND)', FOOD: 'Makanan (FOOD)' };
const DATE_KEYS = new Set(['birthDate', 'simExpiry']);
// Isi awal form dari data akun (tanggal ISO → yyyy-mm-dd untuk <input date>).
function initRoleForm(src: Record<string, any> | null | undefined, fields: FieldCfg[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = src?.[f.key];
    out[f.key] = v == null ? '' : DATE_KEYS.has(f.key) ? String(v).slice(0, 10) : String(v);
  }
  return out;
}

function ManageModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [acc, setAcc] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  // Form profil
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleForm, setRoleForm] = useState<Record<string, string>>({});

  // Saldo & sandi
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState<'EARNINGS' | 'CREDIT'>('EARNINGS');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [newPass, setNewPass] = useState('');
  const [tempPass, setTempPass] = useState('');
  const [copied, setCopied] = useState(false);

  const roleSections = acc?.role === 'DRIVER' ? DRIVER_SECTIONS : acc?.role === 'MERCHANT' ? MERCHANT_SECTIONS : acc?.role === 'CUSTOMER' ? CUSTOMER_SECTIONS : [];

  const load = async () => {
    try {
      setLoading(true);
      const a = await getUserAccount(userId);
      setAcc(a);
      setName(a.name); setEmail(a.email); setPhone(a.phone);
      if (a.role === 'DRIVER') setRoleForm(initRoleForm(a.driver, DRIVER_SECTIONS.flatMap((s) => s.fields)));
      else if (a.role === 'MERCHANT') setRoleForm(initRoleForm(a.merchant, MERCHANT_SECTIONS.flatMap((s) => s.fields)));
      else if (a.role === 'CUSTOMER') setRoleForm(initRoleForm(a.customer, CUSTOMER_SECTIONS.flatMap((s) => s.fields)));
      else setRoleForm({});
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Gagal memuat akun');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [userId]);

  const flash = (m: string) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 3000); };
  const fail = (e: any) => setErr(e.response?.data?.message || 'Terjadi kesalahan');
  const setField = (k: string, v: string) => setRoleForm((f) => ({ ...f, [k]: v }));

  const hasBalance = !!(acc && (acc.customer || acc.driver || acc.merchant));
  const isDriver = acc?.role === 'DRIVER';

  // Foto & dokumen (KYC). Selfie/KTP/SIM/STNK/SKCK/outlet/NPWP = privat (token); logo mitra = publik.
  const photos: { label: string; url: string }[] = [];
  if (acc?.driver) {
    const d = acc.driver;
    ([['Selfie', d.selfiePhoto], ['KTP', d.ktpPhoto], ['SIM', d.simPhoto], ['STNK', d.stnkPhoto], ['SKCK', d.skckPhoto]] as const)
      .forEach(([label, f]) => { const u = docUrl(f); if (u) photos.push({ label, url: u }); });
  }
  if (acc?.merchant) {
    const m = acc.merchant;
    const lg = logoUrl(m.logo); if (lg) photos.push({ label: 'Logo', url: lg });
    ([['Foto Outlet', m.outletPhoto], ['KTP', m.ktpPhoto], ['NPWP', m.npwpPhoto]] as const)
      .forEach(([label, f]) => { const u = docUrl(f); if (u) photos.push({ label, url: u }); });
  }
  if (acc?.customer) {
    const av = avatarUrl(acc.avatar); if (av) photos.push({ label: 'Foto Profil', url: av });
  }

  const currentBalance = () => {
    if (!acc) return 0;
    if (acc.customer) return acc.customer.balance;
    if (acc.merchant) return acc.merchant.balance;
    if (acc.driver) return wallet === 'CREDIT' ? acc.driver.creditBalance : acc.driver.earningsBalance;
    return 0;
  };

  const saveProfile = async () => {
    try {
      setBusy('profile');
      const patch: any = { name, email, phone };
      if (acc?.role === 'DRIVER') patch.driver = roleForm;
      else if (acc?.role === 'MERCHANT') patch.merchant = roleForm;
      else if (acc?.role === 'CUSTOMER') patch.customer = roleForm;
      const r = await updateUserAccount(userId, patch);
      setAcc(r.account);
      flash('Profil diperbarui');
      onSaved();
    } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const toggleSuspend = async () => {
    if (!acc) return;
    const suspend = acc.status !== 'SUSPENDED';
    let reason: string | undefined;
    if (suspend) {
      const r = window.prompt('Alasan blokir (ditampilkan ke pengguna di aplikasi):', '');
      if (r === null) return;
      reason = r.trim() || undefined;
    }
    try {
      setBusy('status');
      if (suspend) await suspendUser(userId, reason); else await activateUser(userId);
      setAcc({ ...acc, status: suspend ? 'SUSPENDED' : 'ACTIVE' });
      flash(suspend ? 'Akun diblokir' : 'Akun diaktifkan');
      onSaved();
    } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const removeAccount = async () => {
    if (!confirm('HAPUS akun ini permanen? Tindakan tidak bisa dibatalkan.')) return;
    try {
      setBusy('delete');
      await deleteUserAccount(userId);
      onSaved();
      onClose();
    } catch (e) { fail(e); setBusy(''); }
  };

  const applyBalance = async (sign: 1 | -1) => {
    const val = Number(amount);
    if (!val || val <= 0) { setErr('Masukkan nominal lebih dari 0'); return; }
    if (!/^\d{6}$/.test(pin)) { setErr('Masukkan PIN isi saldo (6 digit)'); return; }
    try {
      setBusy('balance');
      const r = await adjustUserBalance(userId, { amount: sign * val, wallet: isDriver ? wallet : undefined, note, pin });
      setAcc(r.account);
      setAmount(''); setNote(''); setPin('');
      flash(sign > 0 ? 'Saldo ditambahkan' : 'Saldo dikurangi');
      onSaved();
    } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const setPassword = async () => {
    if (newPass.length < 6) { setErr('Kata sandi minimal 6 karakter'); return; }
    try {
      setBusy('pass');
      await updateUserAccount(userId, { password: newPass });
      setNewPass(''); setTempPass('');
      flash('Kata sandi diganti');
    } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const resetPassword = async () => {
    if (!confirm('Reset kata sandi? Sandi lama tidak bisa dipakai lagi.')) return;
    try {
      setBusy('reset');
      const r = await updateUserAccount(userId, { resetPassword: true });
      setTempPass(r.tempPassword || '');
      setCopied(false);
      flash('Kata sandi direset');
    } catch (e) { fail(e); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-kilatgo-950">Kelola Akun</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : !acc ? (
          <div className="p-6 text-red-600">{err || 'Akun tidak ditemukan'}</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <UserAvatar name={acc.name} size={52} src={acc.role === 'DRIVER' ? docUrl(acc.driver?.selfiePhoto) : acc.role === 'MERCHANT' ? logoUrl(acc.merchant?.logo) : avatarUrl(acc.avatar)} />
              <div>
                <p className="font-bold text-kilatgo-950">{acc.merchant?.businessName || acc.name}</p>
                <Badge color={roleColors[acc.role] || 'bg-slate-100 text-slate-700 ring-slate-200'}>{roleLabel[acc.role] || acc.role}</Badge>
              </div>
            </div>

            {msg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm">{msg}</div>}
            {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{err}</div>}

            {/* Profil */}
            <section className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-kilatgo-600 uppercase tracking-wider">Akun</h4>
                <Field label="Nama pengguna"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <Field label="Nomor HP (login)"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                </div>
              </div>

              {roleSections.map((sec) => (
                <div key={sec.title} className="space-y-3 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-kilatgo-600 uppercase tracking-wider">{sec.title}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {sec.fields.map((f) => (
                      <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                        <Field label={f.label}>
                          {f.type === 'textarea' ? (
                            <textarea className={inputCls} rows={2} value={roleForm[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
                          ) : f.type === 'select' ? (
                            <select className={inputCls} value={roleForm[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
                              <option value="">—</option>
                              {f.options!.map((o) => <option key={o} value={o}>{SERVICE_LABELS[o] ?? o}</option>)}
                            </select>
                          ) : (
                            <input type={f.type || 'text'} className={inputCls} value={roleForm[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
                          )}
                        </Field>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={saveProfile} disabled={busy === 'profile'} className="inline-flex items-center gap-2 px-4 py-2 bg-kilatgo-600 hover:bg-kilatgo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                <Save className="w-4 h-4" /> Simpan profil
              </button>
            </section>

            {/* Foto & dokumen */}
            {photos.length > 0 && (
              <section className="space-y-3 border-t border-slate-100 pt-5">
                <h4 className="text-sm font-bold text-kilatgo-950 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Foto & Dokumen</h4>
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <a key={p.label} href={p.url} target="_blank" rel="noreferrer" className="group block" title={`Buka ${p.label}`}>
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group-hover:ring-2 group-hover:ring-kilatgo-400 transition">
                        <img src={p.url} alt={p.label} loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.innerHTML = '<div class=\'w-full h-full flex items-center justify-center text-slate-400 text-xs\'>gagal muat</div>'; }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-center">{p.label}</p>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Saldo */}
            {hasBalance && (
              <section className="space-y-3 border-t border-slate-100 pt-5">
                <h4 className="text-sm font-bold text-kilatgo-950 flex items-center gap-2"><Wallet className="w-4 h-4" /> Saldo</h4>
                {isDriver && (
                  <div className="flex gap-2">
                    {(['EARNINGS', 'CREDIT'] as const).map((w) => (
                      <button key={w} onClick={() => setWallet(w)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${wallet === w ? 'bg-kilatgo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {w === 'EARNINGS' ? 'Dompet Pendapatan' : 'Dompet Kredit'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-xl bg-gradient-to-br from-kilatgo-500 to-kilatgo-700 text-white p-4">
                  <p className="text-white/80 text-xs">Saldo saat ini</p>
                  <p className="text-2xl font-extrabold mt-0.5">{rp(currentBalance())}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nominal (Rp)"><input type="number" min={0} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
                  <Field label="Catatan (opsional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan penyesuaian" /></Field>
                </div>
                <Field label="PIN Isi Saldo (6 digit)">
                  <input type="password" inputMode="numeric" maxLength={6} className={inputCls} value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" autoComplete="off" />
                </Field>
                <div className="flex gap-2">
                  <button onClick={() => applyBalance(1)} disabled={busy === 'balance'} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                    <Plus className="w-4 h-4" /> Tambah
                  </button>
                  <button onClick={() => applyBalance(-1)} disabled={busy === 'balance'} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                    <Minus className="w-4 h-4" /> Kurangi
                  </button>
                </div>
              </section>
            )}

            {/* Kata sandi */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              <h4 className="text-sm font-bold text-kilatgo-950 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Kata Sandi</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Field label="Kata sandi baru"><input className={inputCls} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min. 6 karakter" /></Field></div>
                <button onClick={setPassword} disabled={busy === 'pass'} className="px-4 py-2 bg-kilatgo-600 hover:bg-kilatgo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">Ganti</button>
              </div>
              <button onClick={resetPassword} disabled={busy === 'reset'} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                <RefreshCw className="w-4 h-4" /> Reset (buat sandi acak)
              </button>
              {tempPass && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-amber-700">Kata sandi sementara (salin & beri ke pengguna):</p>
                    <p className="font-mono font-bold text-amber-900 text-lg">{tempPass}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(tempPass); setCopied(true); }}
                    className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </section>

            {/* Status & hapus */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              <h4 className="text-sm font-bold text-red-600">Status Akun</h4>
              <div className="flex flex-wrap gap-2">
                {acc.status === 'SUSPENDED' ? (
                  <button onClick={toggleSuspend} disabled={busy === 'status'} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                    <UserCheck className="w-4 h-4" /> Aktifkan akun
                  </button>
                ) : (
                  <button onClick={toggleSuspend} disabled={busy === 'status'} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                    <Ban className="w-4 h-4" /> Blokir akun
                  </button>
                )}
                <button onClick={removeAccount} disabled={busy === 'delete'} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Hapus akun
                </button>
              </div>
              <p className="text-xs text-slate-400">Blokir mencegah login. Hapus bersifat permanen dan gagal bila akun masih punya riwayat pesanan.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
