import { useEffect, useMemo, useState } from 'react';
import { Inbox, Loader2, RefreshCw, Plus, X, Wallet, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  getTopups, manualTopup, getAllUsers, getMerchants,
  getTopupPinStatus, setTopupPin, resetTopupPin, type AdminTopup,
} from '../api/admin';

const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID');
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const roleLabel: Record<string, string> = { CUSTOMER: 'Pelanggan', DRIVER: 'Driver', MERCHANT: 'Mitra' };
const roleBadge: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-amber-100 text-amber-700',
  MERCHANT: 'bg-violet-100 text-violet-700',
};

const statusStyle = (s: string) =>
  s === 'PAID'
    ? 'bg-emerald-100 text-emerald-700'
    : s === 'FAILED' || s === 'EXPIRED' || s === 'CANCELLED'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-amber-100 text-amber-700';

type Target = { id: string; label: string; sub?: string };

function ManualTopupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState<'CUSTOMER' | 'DRIVER' | 'MERCHANT'>('CUSTOMER');
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Langkah PIN
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [pinIsSet, setPinIsSet] = useState<boolean | null>(null); // null = loading
  const [forgot, setForgot] = useState(false); // mode reset PIN
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState(''); // konfirmasi / password akun saat reset
  const [pinErr, setPinErr] = useState('');

  useEffect(() => {
    getTopupPinStatus().then((s) => setPinIsSet(s.isSet)).catch(() => setPinIsSet(false));
  }, []);

  useEffect(() => {
    setTargetId(''); setSearch('');
    setLoadingList(true);
    (async () => {
      try {
        if (role === 'MERCHANT') {
          const m = await getMerchants();
          setTargets(m.map((x) => ({ id: x.id, label: x.businessName, sub: x.ownerName ?? undefined })));
        } else {
          const u = await getAllUsers(role);
          setTargets(u.map((x) => ({ id: x.id, label: x.name, sub: x.phone || x.email })));
        }
      } finally {
        setLoadingList(false);
      }
    })();
  }, [role]);

  const filtered = useMemo(
    () => targets.filter((t) => (t.label + ' ' + (t.sub ?? '')).toLowerCase().includes(search.toLowerCase())),
    [targets, search],
  );

  const selected = targets.find((t) => t.id === targetId);
  const amt = Number(amount);

  // Validasi form → lanjut ke langkah PIN.
  const proceed = () => {
    setErr('');
    if (!targetId) return setErr('Pilih penerima terlebih dahulu.');
    if (!amt || amt <= 0) return setErr('Nominal tidak valid.');
    setPin(''); setPin2(''); setPinErr(''); setForgot(false);
    setStep('pin');
  };

  // Kirim top-up dengan PIN yang sudah divalidasi.
  const doTopup = async (usePin: string) => {
    await manualTopup({ role, targetId, amount: amt, pin: usePin, note: note.trim() || undefined });
    onDone();
  };

  const confirmPin = async () => {
    setPinErr('');
    try {
      setSaving(true);
      if (pinIsSet === false) {
        // Buat PIN pertama kali
        if (!/^\d{6}$/.test(pin)) throw new Error('PIN harus 6 digit angka.');
        if (pin !== pin2) throw new Error('Konfirmasi PIN tidak sama.');
        await setTopupPin(pin);
        await doTopup(pin);
      } else if (forgot) {
        // Lupa PIN: reset pakai password akun, lalu pakai PIN baru
        if (!pin2) throw new Error('Password akun wajib diisi.');
        if (!/^\d{6}$/.test(pin)) throw new Error('PIN baru harus 6 digit angka.');
        await resetTopupPin(pin2, pin);
        await doTopup(pin);
      } else {
        // Masukkan PIN yang ada
        if (!/^\d{6}$/.test(pin)) throw new Error('PIN harus 6 digit angka.');
        await doTopup(pin);
      }
    } catch (e: any) {
      setPinErr(e?.response?.data?.message || e?.message || 'Gagal memproses.');
    } finally {
      setSaving(false);
    }
  };

  const quick = [10000, 25000, 50000, 100000, 200000, 500000];
  const pinInput = (val: string, set: (v: string) => void, ph: string) => (
    <input value={val} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
      autoComplete="off" placeholder={ph}
      className="w-full text-center tracking-[0.5em] text-lg font-bold px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-kilatgo-400" />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-kilatgo-950 flex items-center gap-2">
            {step === 'pin' ? <Lock className="w-5 h-5 text-kilatgo-600" /> : <Wallet className="w-5 h-5 text-kilatgo-600" />}
            {step === 'pin' ? (pinIsSet === false ? 'Buat PIN Isi Saldo' : forgot ? 'Reset PIN' : 'Masukkan PIN') : 'Isi Saldo Manual'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        {step === 'form' && (
        <div className="p-5 space-y-4">
          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Untuk</label>
            <div className="flex gap-2">
              {(['CUSTOMER', 'DRIVER', 'MERCHANT'] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${role === r ? 'bg-kilatgo-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                  {roleLabel[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Target select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Penerima</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / telepon..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400 mb-2" />
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {loadingList ? (
                <div className="flex justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Tidak ada data</p>
              ) : (
                filtered.map((t) => (
                  <button key={t.id} onClick={() => setTargetId(t.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition ${targetId === t.id ? 'bg-kilatgo-50' : ''}`}>
                    <p className="text-sm font-semibold text-kilatgo-950">{t.label}</p>
                    {t.sub && <p className="text-xs text-slate-400">{t.sub}</p>}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nominal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quick.map((q) => (
                <button key={q} onClick={() => setAmount(String(q))}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-kilatgo-100 hover:text-kilatgo-700">
                  {rp(q)}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Catatan (opsional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. kompensasi order gagal"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400" />
          </div>

          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>
        )}

        {step === 'pin' && (
        <div className="p-5 space-y-4">
          {/* Ringkasan */}
          <div className="rounded-xl bg-kilatgo-50 border border-kilatgo-100 p-3 text-sm">
            <p className="text-slate-500">Menambah saldo untuk</p>
            <p className="font-bold text-kilatgo-950">{selected?.label} <span className="font-normal text-slate-400">· {roleLabel[role]}</span></p>
            <p className="font-bold text-kilatgo-700 text-lg mt-0.5">{rp(amt)}</p>
          </div>

          {pinIsSet === false ? (
            <>
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" />Buat PIN 6 digit untuk mengamankan isi saldo manual. PIN ini dipakai untuk transaksi berikutnya.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">PIN Baru</label>
                {pinInput(pin, setPin, '••••••')}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Konfirmasi PIN</label>
                {pinInput(pin2, setPin2, '••••••')}
              </div>
            </>
          ) : forgot ? (
            <>
              <p className="text-sm text-slate-500">Masukkan password akun admin untuk mereset PIN, lalu tentukan PIN baru.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password Akun</label>
                <input type="password" value={pin2} onChange={(e) => setPin2(e.target.value)} autoComplete="off" placeholder="Password login admin"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-kilatgo-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">PIN Baru (6 digit)</label>
                {pinInput(pin, setPin, '••••••')}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">PIN Isi Saldo</label>
                {pinInput(pin, setPin, '••••••')}
              </div>
              <button onClick={() => { setForgot(true); setPin(''); setPin2(''); setPinErr(''); }}
                className="text-sm font-semibold text-kilatgo-600 hover:underline">Lupa PIN?</button>
            </>
          )}

          {pinErr && <p className="text-sm text-rose-600">{pinErr}</p>}
        </div>
        )}

        <div className="flex gap-2 p-5 border-t border-slate-100">
          {step === 'form' ? (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={proceed} disabled={pinIsSet === null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 disabled:opacity-60">
                {pinIsSet === null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}Lanjut
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep('form'); setPinErr(''); }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">
                <ArrowLeft className="w-4 h-4" />Kembali
              </button>
              <button onClick={confirmPin} disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {pinIsSet === false ? 'Buat & Tambah' : 'Konfirmasi'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TopupsPage() {
  const [rows, setRows] = useState<AdminTopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CUSTOMER' | 'DRIVER' | 'MERCHANT'>('ALL');
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getTopups());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => filter === 'ALL' || r.role === filter);
  const paidTotal = rows.filter((r) => r.status === 'PAID').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-kilatgo-950">Riwayat Isi Saldo</h2>
          <p className="text-sm text-slate-500">Isi saldo pelanggan, kredit driver & saldo mitra.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />Muat ulang
          </button>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl bg-kilatgo-600 text-white hover:bg-kilatgo-700">
            <Plus className="w-4 h-4" />Isi Saldo Manual
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {(['ALL', 'CUSTOMER', 'DRIVER', 'MERCHANT'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold ${filter === v ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {v === 'ALL' ? 'Semua' : roleLabel[v]}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">Total masuk (PAID): <b className="text-kilatgo-950">{rp(paidTotal)}</b></span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Inbox className="w-10 h-10 mb-2" />Belum ada isi saldo
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Waktu</th>
                  <th className="text-left font-semibold px-4 py-3">Nama</th>
                  <th className="text-left font-semibold px-4 py-3">Tipe</th>
                  <th className="text-right font-semibold px-4 py-3">Nominal</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Referensi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{dt(t.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-kilatgo-950">
                      {t.who}
                      {t.note && <span className="block text-xs font-normal text-slate-400">{t.note}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadge[t.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {roleLabel[t.role] ?? t.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-kilatgo-950">{rp(t.amount)}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle(t.status)}`}>{t.status}</span></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{t.referenceId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && <ManualTopupModal onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); load(); }} />}
    </div>
  );
}
