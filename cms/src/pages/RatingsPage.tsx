import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, RefreshCw, Search, MessageSquare, Inbox, Car, Store, Users, X } from 'lucide-react';
import { getRatings, type RatingRow, type RatingsResponse } from '../api/admin';

// Isi rating (komentar) dari pelanggan → driver/mitra, dan dari driver → pelanggan.
// Admin bisa filter per pihak yang dinilai, per bintang, dan cari nama/komentar/no. order.

const TARGETS: { key: 'DRIVER' | 'MERCHANT' | 'CUSTOMER'; label: string; icon: any; note: string }[] = [
  { key: 'DRIVER', label: 'Driver', icon: Car, note: 'Penilaian pelanggan terhadap driver' },
  { key: 'MERCHANT', label: 'Mitra / Warung', icon: Store, note: 'Penilaian pelanggan terhadap warung (KilatFood)' },
  { key: 'CUSTOMER', label: 'Pelanggan', icon: Users, note: 'Penilaian driver terhadap pelanggan' },
];

const SERVICE_LABEL: Record<string, string> = { RIDE: 'KilatRide', CAR: 'KilatCar', SEND: 'KilatSend', FOOD: 'KilatFood' };

function Stars({ n, size = 'w-4 h-4' }: { n: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
      ))}
    </span>
  );
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RatingsPage() {
  // Bisa dibuka dari daftar Driver/Mitra: /admin/ratings?target=DRIVER&subjectId=..&name=..
  const [sp, setSp] = useSearchParams();
  const urlTarget = (sp.get('target') || '').toUpperCase();
  const [target, setTarget] = useState<'DRIVER' | 'MERCHANT' | 'CUSTOMER'>(
    urlTarget === 'MERCHANT' || urlTarget === 'CUSTOMER' ? urlTarget : 'DRIVER'
  );
  const [subjectId, setSubjectId] = useState(sp.get('subjectId') || '');
  const subjectName = sp.get('name') || '';
  const [stars, setStars] = useState<number | ''>('');
  const [onlyComment, setOnlyComment] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState<RatingsResponse>({ summary: { total: 0, average: null, distribution: {} }, ratings: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getRatings({
        target,
        subjectId: subjectId || undefined,
        stars: stars || undefined,
        withComment: onlyComment ? '1' : undefined,
        q: q.trim() || undefined,
      }));
    } finally {
      setLoading(false);
    }
  };

  // Ganti tab / filter bintang / toggle komentar → muat ulang. Pencarian pakai tombol/Enter.
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [target, subjectId, stars, onlyComment]);

  // Pindah tab membatalkan filter "satu pihak" (subjectId milik tab sebelumnya).
  const switchTarget = (t: 'DRIVER' | 'MERCHANT' | 'CUSTOMER') => {
    setTarget(t);
    if (subjectId) { setSubjectId(''); setSp({}, { replace: true }); }
  };
  const clearSubject = () => { setSubjectId(''); setSp({}, { replace: true }); };

  const { summary, ratings } = data;
  const active = TARGETS.find((t) => t.key === target)!;
  const maxDist = Math.max(1, ...[5, 4, 3, 2, 1].map((s) => summary.distribution[s] ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Kualitas Layanan</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Rating &amp; Ulasan</h1>
          <p className="text-sm text-slate-500 mt-1">{active.note}. Isi komentar tampil apa adanya dari pengguna.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
          <RefreshCw className="w-4 h-4" />Muat ulang
        </button>
      </div>

      {/* Tab: siapa yang dinilai */}
      <div className="flex flex-wrap gap-2">
        {TARGETS.map((t) => (
          <button key={t.key} onClick={() => switchTarget(t.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition ${target === t.key ? 'bg-kilatgo-600 text-white shadow-sm shadow-kilatgo-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Sedang melihat ulasan satu pihak (dibuka dari daftar Driver/Mitra) */}
      {subjectId && (
        <div className="flex items-center gap-2 rounded-xl bg-kilatgo-50 border border-kilatgo-100 px-4 py-2.5 text-sm">
          <span className="text-slate-600">
            Menampilkan ulasan untuk <b className="text-kilatgo-950">{subjectName || 'pihak terpilih'}</b> saja.
          </span>
          <button onClick={clearSubject} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-kilatgo-600 hover:underline">
            <X className="w-3.5 h-3.5" />Tampilkan semua
          </button>
        </div>
      )}

      {/* Ringkasan: rata-rata + sebaran bintang */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 grid gap-6 sm:grid-cols-[auto_1fr] items-center">
        <div className="text-center sm:pr-6 sm:border-r sm:border-slate-100">
          <p className="text-4xl font-bold text-kilatgo-950">{summary.average?.toFixed(2) ?? '—'}</p>
          <div className="mt-1.5 flex justify-center"><Stars n={Math.round(summary.average ?? 0)} /></div>
          <p className="text-xs text-slate-500 mt-1.5">{summary.total} penilaian</p>
        </div>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = summary.distribution[s] ?? 0;
            return (
              <button key={s} onClick={() => setStars(stars === s ? '' : s)}
                className={`w-full flex items-center gap-3 group ${stars === s ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}>
                <span className={`w-8 text-xs font-semibold ${stars === s ? 'text-kilatgo-700' : 'text-slate-500'}`}>{s} ★</span>
                <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(n / maxDist) * 100}%` }} />
                </span>
                <span className="w-10 text-right text-xs text-slate-500">{n}</span>
              </button>
            );
          })}
          {stars !== '' && (
            <button onClick={() => setStars('')} className="text-xs font-semibold text-kilatgo-600 hover:underline mt-1">Tampilkan semua bintang</button>
          )}
        </div>
      </div>

      {/* Filter: cari + hanya berkomentar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Cari komentar, nama, atau nomor order…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
        </form>
        <button onClick={() => setOnlyComment((v) => !v)}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${onlyComment ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
          <MessageSquare className="w-4 h-4" />Hanya yang berkomentar
        </button>
      </div>

      {/* Daftar ulasan */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : ratings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-slate-300" /></div>
            <p className="text-sm font-medium text-slate-600">Belum ada ulasan yang cocok</p>
            <p className="text-xs text-slate-400 mt-1">Coba ganti filter bintang atau kata pencarian.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ratings.map((r: RatingRow) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stars n={r.stars} />
                      <span className="text-sm font-bold text-kilatgo-950">{r.subject.name ?? '(tanpa nama)'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {SERVICE_LABEL[r.order.serviceType] ?? r.order.serviceType}
                      </span>
                      {r.tip > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                          Tip Rp{new Intl.NumberFormat('id-ID').format(r.tip)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Dinilai oleh <b className="text-slate-700">{r.author.name ?? '-'}</b>
                      {' '}({r.byRole === 'DRIVER' ? 'driver' : 'pelanggan'}) · Order #{r.order.orderNumber.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{fmtDate(r.createdAt)}</span>
                </div>
                {r.comment ? (
                  <p className="mt-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap">
                    {r.comment}
                  </p>
                ) : (
                  <p className="mt-2 text-xs italic text-slate-400">Tanpa komentar — hanya memberi bintang.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {!loading && ratings.length >= 200 && (
        <p className="text-xs text-slate-400 text-center">Menampilkan 200 ulasan terbaru. Pakai filter atau pencarian untuk mempersempit.</p>
      )}
    </div>
  );
}
