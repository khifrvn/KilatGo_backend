import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, CheckCircle2, Inbox, RefreshCw, Bot, User, Headphones, Star } from 'lucide-react';
import {
  getSupportTickets, getSupportTicket, replySupportTicket, closeSupportTicket,
  type SupportTicketRow, type SupportTicketDetail,
} from '../api/admin';
import { IMAGE_BASE } from '../api/client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Foto pengguna: selfie driver = privat (token), logo mitra & avatar pelanggan = publik.
const photoUrl = (photo?: string | null, kind?: string | null): string | null => {
  if (!photo) return null;
  if (kind === 'selfie') return `${API}/admin/files/${photo}?token=${localStorage.getItem('kilatgo_token')}`;
  if (kind === 'logo') return `${IMAGE_BASE}logos/${photo}`;
  if (kind === 'avatar') return `${IMAGE_BASE}avatars/${photo}`;
  return null;
};
const Avatar = ({ name, url, size = 40 }: { name?: string | null; url: string | null; size?: number }) => (
  <div className="rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold flex-shrink-0 overflow-hidden"
    style={{ width: size, height: size, fontSize: size * 0.4 }}>
    {url ? <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : (name || '?').charAt(0).toUpperCase()}
  </div>
);

const roleLabel: Record<string, string> = { CUSTOMER: 'Pelanggan', DRIVER: 'Driver', MERCHANT: 'Mitra' };
const statusLabel: Record<string, string> = { OPEN: 'Terbuka', IN_PROGRESS: 'Ditangani', RESOLVED: 'Selesai' };
const statusColor: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700 ring-amber-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 ring-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};
const fmt = (s: string) => new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async (silent = false) => {
    try { if (!silent) setLoading(true); setTickets(await getSupportTickets(filter || undefined)); }
    catch { /* ignore */ } finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  // Auto-refresh: daftar tiket + chat yang terbuka tiap 5 detik.
  const selIdRef = useRef<string | null>(null);
  selIdRef.current = selId;
  useEffect(() => {
    const t = setInterval(() => {
      load(true);
      const id = selIdRef.current;
      if (id) getSupportTicket(id).then((d) => setDetail((prev) => (prev && prev.id === id ? d : prev))).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openTicket = async (id: string) => {
    setSelId(id);
    try { setDetail(await getSupportTicket(id)); } catch { /* ignore */ }
  };
  // Scroll ke bawah hanya saat jumlah pesan bertambah (biar tak mengganggu saat baca lama).
  const msgCountRef = useRef(0);
  useEffect(() => {
    if (detail && detail.messages.length !== msgCountRef.current) {
      msgCountRef.current = detail.messages.length;
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    }
  }, [detail]);

  const send = async () => {
    if (!reply.trim() || !selId) return;
    try {
      setBusy(true);
      setDetail(await replySupportTicket(selId, reply.trim()));
      setReply('');
      load();
    } catch { /* ignore */ } finally { setBusy(false); }
  };
  const close = async () => {
    if (!selId || !confirm('Tutup laporan ini?')) return;
    try { setBusy(true); setDetail(await closeSupportTicket(selId)); load(); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Bantuan</p>
        <h1 className="text-3xl font-bold text-kilatgo-950">Live Chat Support</h1>
        <p className="text-sm text-slate-500 mt-1">Tiket bantuan dari pelanggan, driver &amp; mitra. Bot menjawab pertanyaan umum; ambil alih bila perlu.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Daftar tiket */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-kilatgo-400">
              <option value="">Semua status</option>
              <option value="OPEN">Terbuka</option>
              <option value="IN_PROGRESS">Ditangani</option>
              <option value="RESOLVED">Selesai</option>
            </select>
            <button onClick={() => load()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400"><Inbox className="w-8 h-8 mb-2" /><p className="text-sm">Belum ada tiket</p></div>
            ) : tickets.map((t) => (
              <button key={t.id} onClick={() => openTicket(t.id)} className={`w-full text-left p-4 hover:bg-slate-50 transition flex gap-3 ${selId === t.id ? 'bg-kilatgo-50' : ''}`}>
                <Avatar name={t.fromName} url={photoUrl(t.photo, t.photoKind)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-kilatgo-950 truncate">{t.subject}</p>
                    {t.unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{t.unread}</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{t.fromName} · {roleLabel[t.role]}</p>
                  {t.lastMessage && <p className="text-xs text-slate-400 truncate mt-0.5">{t.lastMessage}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${statusColor[t.status]}`}>{statusLabel[t.status]}</span>
                    {t.needsAdmin && t.status !== 'RESOLVED' && !t.handledByAdmin && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 bg-red-100 text-red-700 ring-red-200">Butuh CS</span>}
                    <span className="text-[10px] text-slate-400 ml-auto">{fmt(t.updatedAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[620px]">
          {!detail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-10 h-10 mb-2" /><p className="text-sm">Pilih tiket untuk membuka chat</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => { const u = photoUrl(detail.photo, detail.photoKind); if (u) window.open(u, '_blank'); }} className="flex-shrink-0">
                    <Avatar name={detail.user?.name} url={photoUrl(detail.photo, detail.photoKind)} size={44} />
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold text-kilatgo-950 truncate">{detail.subject}</p>
                    <p className="text-xs text-slate-500 truncate">{detail.user?.name} · {roleLabel[detail.role]} · {detail.user?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${statusColor[detail.status]}`}>{statusLabel[detail.status]}</span>
                  {detail.status !== 'RESOLVED' && (
                    <button onClick={close} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4" /> Tutup
                    </button>
                  )}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
                {detail.messages.map((m) => {
                  const mine = m.sender === 'ADMIN';
                  const bot = m.sender === 'BOT';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-kilatgo-600 text-white' : bot ? 'bg-white border border-slate-200 text-slate-700' : 'bg-white border border-slate-200 text-slate-800'}`}>
                        <div className={`flex items-center gap-1 mb-0.5 text-[10px] font-semibold ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                          {bot ? <><Bot className="w-3 h-3" /> Bot KilatGo</> : mine ? <><Headphones className="w-3 h-3" /> CS</> : <><User className="w-3 h-3" /> {detail.fromName}</>}
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-slate-400'}`}>{fmt(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                {detail.status === 'RESOLVED' && (
                  <div className="text-center text-xs text-slate-400 py-2">
                    Laporan ditutup{detail.closedBy ? ` oleh ${detail.closedBy === 'admin' ? 'CS' : detail.closedBy === 'bot' ? 'bot' : 'pengguna'}` : ''}.
                    {detail.rating ? <span className="inline-flex items-center gap-1 ml-1 text-amber-500">· {detail.rating}<Star className="w-3 h-3 fill-amber-400" /></span> : ''}
                  </div>
                )}
              </div>

              {detail.status !== 'RESOLVED' && (
                <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                    placeholder="Balas sebagai CS…" className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-kilatgo-400 focus:bg-white" />
                  <button onClick={send} disabled={busy || !reply.trim()} className="p-2.5 bg-kilatgo-600 hover:bg-kilatgo-700 text-white rounded-xl disabled:opacity-50"><Send className="w-5 h-5" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
