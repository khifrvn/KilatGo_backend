import { useEffect, useState } from 'react';
import { DollarSign, Calendar, Download, TrendingUp, CreditCard } from 'lucide-react';
import { getEarningsReport } from '../api/admin';
import type { EarningsReport } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${color}`}>
    {children}
  </span>
);

export default function EarningsPage() {
  const [report, setReport] = useState<EarningsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const params: { startDate?: string; endDate?: string } = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await getEarningsReport(params);
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load earnings report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  const chartData =
    report?.payments.map((payment) => ({
      date: new Date(payment.paidAt || payment.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      }),
      amount: Number(payment.amount),
    })) || [];

  const handleExport = () => {
    if (!report) return;

    const csvContent = [
      ['Date', 'Order ID', 'Method', 'Amount', 'Status'].join(','),
      ...report.payments.map((p) =>
        [
          new Date(p.paidAt || p.createdAt).toLocaleDateString('id-ID'),
          p.orderId,
          p.method,
          Number(p.amount),
          p.status,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">
            Reports
          </p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Earnings</h1>
        </div>
        <button
          onClick={handleExport}
          disabled={!report || report.payments.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Earnings</p>
              <p className="text-3xl font-bold text-kilatgo-950 mt-2">
                Rp {report?.total.toLocaleString('id-ID') || 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">Lifetime revenue</p>
            </div>
            <div className="p-3 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/25">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Payments</p>
              <p className="text-3xl font-bold text-kilatgo-950 mt-2">
                {report?.count || 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">Successful transactions</p>
            </div>
            <div className="p-3 bg-kilatgo-500 rounded-xl shadow-lg shadow-kilatgo-500/25">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Date filter */}
      <form
        onSubmit={handleFilter}
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="px-6 py-3 bg-kilatgo-600 hover:bg-kilatgo-700 text-white font-semibold rounded-xl transition active:scale-[0.98] shadow-md shadow-kilatgo-600/20"
          >
            Apply Filter
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Chart */}
      {!isLoading && report && report.payments.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-kilatgo-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-kilatgo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-kilatgo-950">Earnings Trend</h2>
              <p className="text-xs text-slate-500">Revenue over time</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                  formatter={(value) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Amount']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payments table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500"></div>
          </div>
        ) : !report || report.payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <DollarSign className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium">No payment records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(payment.paidAt || payment.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-kilatgo-950">
                        #{payment.orderId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {payment.method}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        color={
                          payment.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                            : payment.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-700 ring-amber-200'
                            : 'bg-red-100 text-red-700 ring-red-200'
                        }
                      >
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-kilatgo-950">
                      Rp {Number(payment.amount).toLocaleString('id-ID')}
                    </td>
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
