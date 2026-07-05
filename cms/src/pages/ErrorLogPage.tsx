import { useEffect, useState } from 'react';
import { Bug, RefreshCw, Trash2, ChevronDown, Inbox } from 'lucide-react';
import { getErrors, clearErrors, type ErrorLog } from '../api/admin';

const levelColor: Record<string, string> = {
  ERROR: 'bg-red-100 text-red-700 ring-red-200',
  CLIENT: 'bg-violet-100 text-violet-700 ring-violet-200',
  WARN: 'bg-amber-100 text-amber-700 ring-amber-200',
};

const FILTERS = [['', 'Semua'], ['ERROR', 'API / Server'], ['CLIENT', 'Client']];

export default function ErrorLogPage() {
  const [rows, setRows] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (lv?: string) => {
    setLoading(true);
    try { setRows(await getErrors(lv || undefined)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const doClear = async () => {
    if (!confirm('Hapus SEMUA log error?')) return;
    setBusy(true);
    try { await clearErrors(); await load(level); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Sistem</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Log Error</h1>
          <p className="text-sm text-slate-500 mt-1">Error API/server & client terekam otomatis ({rows.length}).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(level)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"><RefreshCw className="w-4 h-4" />Refresh</button>
          <button onClick={doClear} disabled={busy || rows.length === 0} className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"><Trash2 className="w-4 h-4" />Bersihkan</button>
        </div>
      </div>

      <div className="flex gap-2">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => { setLevel(v); load(v); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${level === v ? 'bg-kilatgo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>{l}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kilatgo-500" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-emerald-500" /></div>
            <p className="text-sm font-medium text-slate-600">Tidak ada error 🎉</p>
            <p className="text-xs text-slate-400 mt-1">Sistem berjalan bersih.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((e) => (
              <div key={e.id}>
                <button onClick={() => setOpen(open === e.id ? null : e.id)} className="w-full text-left px-5 py-4 hover:bg-slate-50/80 transition flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${levelColor[e.level] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{e.level}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.statusCode && <span className="text-xs font-mono font-semibold text-red-600">{e.statusCode}</span>}
                      {e.method && <span className="text-xs font-mono font-semibold text-slate-500">{e.method}</span>}
                      {e.path && <span className="text-xs font-mono text-slate-400 truncate">{e.path}</span>}
                    </div>
                    <p className="text-sm text-kilatgo-950 font-medium mt-0.5 truncate">{e.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(e.createdAt).toLocaleString('id-ID')}</p>
                  </div>
                  <Bug className="w-4 h-4 text-slate-300 shrink-0" />
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition ${open === e.id ? 'rotate-180' : ''}`} />
                </button>
                {open === e.id && (
                  <div className="px-5 pb-4">
                    <pre className="text-xs bg-slate-950 text-slate-200 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words max-h-80">{e.message}{e.stack ? '\n\n' + e.stack : ''}</pre>
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
