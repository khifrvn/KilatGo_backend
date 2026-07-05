import { useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, CreditCard, Wallet, Receipt, Percent, ArrowUpRight, Banknote } from 'lucide-react';
import { getEarningsReport, getSettings } from '../api/admin';
import type { EarningsReport, Payment } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const rp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const rpShort = (n: number) =>
  n >= 1e9 ? `Rp ${(n / 1e9).toFixed(1)} M` : n >= 1e6 ? `Rp ${(n / 1e6).toFixed(1)} jt` : n >= 1e3 ? `Rp ${Math.round(n / 1e3)} rb` : `Rp ${Math.round(n)}`;

const METHOD_META: Record<string, { label: string; color: string }> = {
  CASH: { label: 'Tunai', color: '#10b981' },
  EWALLET: { label: 'E-Wallet', color: '#8b5cf6' },
  BANK_TRANSFER: { label: 'Transfer', color: '#2563eb' },
  CARD: { label: 'Kartu', color: '#f59e0b' },
};

const RANGES = [
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: '90', label: '90 hari' },
  { key: 'all', label: 'Semua' },
];

function MetricCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-kilatgo-950 mt-1.5 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${tone}`}><Icon className="w-5 h-5 text-white" /></div>
      </div>
    </div>
  );
}

export default function EarningsPage() {
  const [report, setReport] = useState<EarningsReport | null>(null);
  const [commissionPct, setCommissionPct] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [range, setRange] = useState('30');

  const fetchReport = async (params: { startDate?: string; endDate?: string } = {}) => {
    try {
      setIsLoading(true);
      const data = await getEarningsReport(params);
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat laporan pendapatan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getSettings().then((s) => setCommissionPct(Number(s.commission_percent) || 15)).catch(() => {});
    applyRange('30');
  }, []);

  const applyRange = (key: string) => {
    setRange(key);
    setStartDate(''); setEndDate('');
    if (key === 'all') return fetchReport();
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - Number(key));
    fetchReport({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) });
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setRange('');
    const params: { startDate?: string; endDate?: string } = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    fetchReport(params);
  };

  const payments: Payment[] = report?.payments || [];
  const total = report?.total || 0;
  const count = report?.count || 0;
  const commission = total * (commissionPct / 100);
  const avg = count ? total / count : 0;

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of payments) {
      const d = new Date(p.paidAt || p.createdAt).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + Number(p.amount));
    }
    return [...byDay.entries()].sort().map(([d, amount]) => ({
      date: new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      amount,
    }));
  }, [payments]);

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) m.set(p.method, (m.get(p.method) || 0) + Number(p.amount));
    return [...m.entries()].map(([method, value]) => ({ method, value, ...(METHOD_META[method] || { label: method, color: '#94a3b8' }) }));
  }, [payments]);

  const handleExport = () => {
    if (!payments.length) return;
    const csv = [
      ['Tanggal', 'Order ID', 'Metode', 'Jumlah', 'Status'].join(','),
      ...payments.map((p) => [new Date(p.paidAt || p.createdAt).toLocaleDateString('id-ID'), p.orderId, p.method, Number(p.amount), p.status].join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `pendapatan-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const empty = !isLoading && payments.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Laporan</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Pendapatan</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-white border border-slate-200 rounded-xl p-1">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => applyRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${range === r.key ? 'bg-kilatgo-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>{r.label}</button>
            ))}
          </div>
          <button onClick={handleExport} disabled={empty}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
            <Download className="w-4 h-4" />Export CSV
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      {/* Hero + metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Hero total */}
        <div className="lg:col-span-1 relative overflow-hidden rounded-2xl bg-gradient-to-br from-kilatgo-900 to-kilatgo-700 p-6 text-white shadow-lg">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-kilatgo-accent/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-kilatgo-200 text-sm font-medium"><Wallet className="w-4 h-4" />Total Pendapatan</div>
            <p className="text-4xl font-bold mt-3 tracking-tight">{rp(total)}</p>
            <div className="flex items-center gap-1.5 mt-3 text-sm text-kilatgo-200">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10"><ArrowUpRight className="w-3.5 h-3.5" />{count} transaksi</span>
              <span>· {range === 'all' ? 'sepanjang waktu' : range ? `${range} hari terakhir` : 'rentang custom'}</span>
            </div>
          </div>
        </div>

        {/* 3 metrics */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <MetricCard icon={Percent} label={`Komisi Platform (${commissionPct}%)`} value={rp(commission)} sub="potongan dari total" tone="bg-kilatgo-600 shadow-lg shadow-kilatgo-600/25" />
          <MetricCard icon={Receipt} label="Rata-rata / transaksi" value={rp(avg)} sub={`${count} pembayaran`} tone="bg-violet-500 shadow-lg shadow-violet-500/25" />
          <MetricCard icon={Banknote} label="Bersih ke mitra" value={rp(total - commission)} sub="setelah komisi" tone="bg-emerald-500 shadow-lg shadow-emerald-500/25" />
        </div>
      </div>

      {/* Custom date filter */}
      <form onSubmit={applyCustom} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Dari tanggal</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kilatgo-400 outline-none transition" />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Sampai tanggal</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kilatgo-400 outline-none transition" />
        </div>
        <button type="submit" className="px-6 py-2.5 bg-kilatgo-600 hover:bg-kilatgo-700 text-white font-semibold rounded-xl transition active:scale-[0.98] shadow-md shadow-kilatgo-600/20">Terapkan</button>
      </form>

      {/* Charts */}
      {!empty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-kilatgo-50 rounded-lg"><TrendingUp className="w-5 h-5 text-kilatgo-600" /></div>
              <div><h2 className="text-lg font-semibold text-kilatgo-950">Tren Pendapatan</h2><p className="text-xs text-slate-500">Total per hari</p></div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => rpShort(v)} width={64} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} formatter={(v) => [rp(Number(v)), 'Pendapatan']} />
                  <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-kilatgo-950 mb-1">Metode Bayar</h2>
            <p className="text-xs text-slate-500 mb-4">Distribusi pembayaran</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byMethod} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {byMethod.map((m) => <Cell key={m.method} fill={m.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => rp(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {byMethod.map((m) => (
                <div key={m.method} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} /><span className="text-slate-600">{m.label}</span></span>
                  <span className="font-semibold text-kilatgo-950">{rp(m.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-kilatgo-950">Transaksi</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-56"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center h-56 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Wallet className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Belum ada transaksi pada rentang ini</p>
            <p className="text-xs text-slate-400 mt-1">Pendapatan muncul otomatis saat ada order berbayar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metode</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-700">{new Date(p.paidAt || p.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-6 py-4"><span className="font-mono text-sm font-semibold text-kilatgo-950">#{p.orderId.slice(0, 8)}</span></td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <span className="w-2 h-2 rounded-full" style={{ background: METHOD_META[p.method]?.color || '#94a3b8' }} />
                        {METHOD_META[p.method]?.label || p.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-kilatgo-950">{rp(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
