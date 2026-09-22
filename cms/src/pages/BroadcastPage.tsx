import { useEffect, useState } from 'react';
import { Send, Users, Car, Store, CheckCircle2, AlertTriangle, History } from 'lucide-react';
import { broadcastNotification, getBroadcasts, type Broadcast, type BroadcastResult } from '../api/admin';

type Audience = 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
const AUDIENCES: { key: Audience; label: string; icon: React.ElementType }[] = [
  { key: 'CUSTOMER', label: 'Pelanggan', icon: Users },
  { key: 'DRIVER', label: 'Driver', icon: Car },
  { key: 'MERCHANT', label: 'Mitra', icon: Store },
];
const audienceLabel: Record<Audience, string> = { CUSTOMER: 'Pelanggan', DRIVER: 'Driver', MERCHANT: 'Mitra' };

const inputCls =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition';

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function BroadcastPage() {
  const [selected, setSelected] = useState<Audience[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    try { setHistory(await getBroadcasts()); } catch { /* abaikan */ } finally { setLoadingHistory(false); }
  };
  useEffect(() => { loadHistory(); }, []);

  const toggle = (a: Audience) =>
    setSelected((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));

  const send = async () => {
    setError(''); setResult(null);
    if (!selected.length) { setError('Pilih minimal satu penerima'); return; }
    if (!title.trim()) { setError('Judul wajib diisi'); return; }
    if (!body.trim()) { setError('Isi pesan wajib diisi'); return; }
    if (!confirm(`Kirim notifikasi ke: ${selected.map((s) => audienceLabel[s]).join(', ')}?`)) return;
    try {
      setSending(true);
      const r = await broadcastNotification({ audiences: selected, title: title.trim(), body: body.trim() });
      setResult(r);
      setTitle(''); setBody(''); setSelected([]);
      loadHistory();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal mengirim notifikasi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Operasional</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Broadcast Notifikasi</h1>
        <p className="text-sm text-slate-500 mt-1">Kirim notifikasi push (FCM) &amp; in-app ke pengguna terpilih.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Form */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-700">Penerima</label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {AUDIENCES.map(({ key, label, icon: Icon }) => {
                const on = selected.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition ${on ? 'border-kilatgo-500 bg-kilatgo-50 text-kilatgo-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Judul</label>
            <input className={`${inputCls} mt-2`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Judul notifikasi" />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Isi pesan</label>
            <textarea className={`${inputCls} mt-2`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Tulis pesan notifikasi…" />
            <p className="text-xs text-slate-400 mt-1 text-right">{body.length}/500</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
          {result && (() => {
            const warn = result.pushed === 0;
            return (
              <div className={`rounded-xl p-4 flex items-start gap-3 border ${warn ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                {warn ? <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />}
                <div className="text-sm space-y-1">
                  <p className="font-semibold">Notifikasi in-app tersimpan untuk {result.recipients} pengguna.</p>
                  <p>Punya token perangkat: <b>{result.withToken}</b> · Push FCM berhasil: <b>{result.pushed}</b></p>
                  {!result.fcmReady && <p className="font-semibold">⚠️ FCM belum dikonfigurasi di server (secrets/firebase-admin.json). Push tidak akan terkirim.</p>}
                  {result.fcmReady && result.withToken === 0 && <p>Tidak ada penerima dengan token perangkat — pengguna perlu buka aplikasi & izinkan notifikasi agar token tersimpan.</p>}
                  {result.fcmReady && result.withToken > 0 && result.pushed === 0 && <p>Semua pengiriman gagal — token mungkin kedaluwarsa. Minta pengguna buka ulang aplikasi.</p>}
                </div>
              </div>
            );
          })()}

          <button
            onClick={send}
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 py-3 bg-kilatgo-600 hover:bg-kilatgo-700 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {sending ? 'Mengirim…' : 'Kirim Notifikasi'}
          </button>
        </div>

        {/* Riwayat */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-kilatgo-950">Riwayat Broadcast</h3>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 px-4 text-center">
                <History className="w-8 h-8 mb-2" />
                <p className="text-sm">Belum ada broadcast</p>
              </div>
            ) : (
              history.map((b) => (
                <div key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-kilatgo-950">{b.title}</p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(b.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{b.body}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {b.audiences.map((a) => (
                      <span key={a} className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-kilatgo-50 text-kilatgo-700 ring-1 ring-kilatgo-200">{audienceLabel[a]}</span>
                    ))}
                    <span className="text-xs text-slate-400 ml-auto">{b.recipients} penerima · {b.pushed} push</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
