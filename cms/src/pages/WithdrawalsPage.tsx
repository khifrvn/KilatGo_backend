import { useEffect, useState } from 'react';
import { Inbox, Check, X, Loader2, Banknote } from 'lucide-react';
import { getWithdrawals, approveWithdrawal, rejectWithdrawal, type Withdrawal } from '../api/admin';

const rp = (v: number) => 'Rp ' + v.toLocaleString('id-ID');

const statusColor: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 ring-amber-200',
  PROCESSING: 'bg-blue-100 text-blue-700 ring-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 ring-rose-200',
};
const statusLabel: Record<string, string> = {
  PENDING: 'Menunggu', PROCESSING: 'Diproses', COMPLETED: 'Berhasil', REJECTED: 'Ditolak',
};

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (status?: string) => {
    setLoading(true);
    try { setRows(await getWithdrawals(status || undefined)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approve = async (w: Withdrawal) => {
    const ref = window.prompt(`No. referensi transfer untuk ${w.partyName ?? w.driverName} (${rp(w.netAmount)}):`, '');
    if (ref === null) return;
    try { setBusy(w.id); await approveWithdrawal(w.id, ref); await load(filter); } finally { setBusy(null); }
  };
  const reject = async (w: Withdrawal) => {
    const reason = window.prompt(`Alasan penolakan untuk ${w.partyName ?? w.driverName} (wajib):`, '');
    if (reason === null) return;
    if (!reason.trim()) { alert('Alasan penolakan wajib diisi.'); return; }
    try { setBusy(w.id); await rejectWithdrawal(w.id, reason.trim()); await load(filter); } catch { alert('Gagal menolak.'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Keuangan</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Penarikan Saldo</h1>
      </div>
      <div className="flex gap-2">
        {[['', 'Semua'], ['PENDING', 'Menunggu'], ['PROCESSING', 'Diproses'], ['COMPLETED', 'Berhasil'], ['REJECTED', 'Ditolak']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); load(v); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${filter === v ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>{l}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Inbox className="w-8 h-8 mb-3" /><p className="text-sm">Tidak ada penarikan</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((w) => (
              <div key={w.id} className="p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${w.type === 'merchant' ? 'bg-violet-50 text-violet-700 ring-violet-200' : w.type === 'customer' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}>{w.type === 'merchant' ? 'Mitra' : w.type === 'customer' ? 'Pelanggan' : 'Driver'}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${statusColor[w.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabel[w.status] ?? w.status}</span>
                    <span className="text-xs text-slate-400">{new Date(w.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                  <p className="font-bold text-kilatgo-950 text-lg">{rp(w.amount)} <span className="text-sm font-normal text-slate-500">(diterima {rp(w.netAmount)}{w.adminFee > 0 ? `, fee ${rp(w.adminFee)}` : ''})</span></p>
                  <p className="text-sm text-slate-700">{w.partyName ?? w.driverName} · {w.partyPhone ?? w.driverPhone ?? '-'}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><Banknote className="w-4 h-4" />{w.bankName} · {w.bankAccount} · a.n. {w.bankHolder}</p>
                  {w.status === 'REJECTED' && w.rejectionReason && <p className="text-xs text-rose-600 mt-1">Alasan: {w.rejectionReason}</p>}
                  {w.status === 'COMPLETED' && w.referenceNumber && <p className="text-xs text-emerald-600 mt-1">No. ref: {w.referenceNumber}</p>}
                </div>
                {(w.status === 'PENDING' || w.status === 'PROCESSING') && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button disabled={busy === w.id} onClick={() => approve(w)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                      {busy === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Setujui
                    </button>
                    <button disabled={busy === w.id} onClick={() => reject(w)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100">
                      <X className="w-3.5 h-3.5" />Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
