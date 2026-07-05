import { useEffect, useState } from 'react';
import { CalendarClock, MapPin, Inbox } from 'lucide-react';
import { getAttendance } from '../api/admin';
import type { Attendance } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const docUrl = (name?: string | null) =>
  name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : '';

export default function AttendancePage() {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');

  const fetchData = async (d?: string) => {
    try {
      setLoading(true);
      setRows(await getAttendance(d || undefined));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat absensi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Operasional</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Absensi Driver</h1>
          <p className="text-sm text-slate-500 mt-1">Check-in driver (selfie + lokasi). Skor face-match terisi saat KYC vendor aktif.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tanggal</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-kilatgo-400" />
          </div>
          <button onClick={() => fetchData(date)} className="px-4 py-2.5 rounded-xl font-semibold text-white bg-kilatgo-600 hover:bg-kilatgo-700 transition">Filter</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm font-medium">Belum ada absensi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Waktu</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lokasi</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Selfie</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-kilatgo-950">{r.driver?.user.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{r.driver?.user.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-slate-400" />{new Date(r.checkedAt).toLocaleString('id-ID')}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <a className="inline-flex items-center gap-1 text-kilatgo-600 hover:underline" target="_blank" rel="noreferrer"
                        href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}>
                        <MapPin className="w-4 h-4" />{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {r.selfiePhoto ? (
                        <a href={docUrl(r.selfiePhoto)} target="_blank" rel="noreferrer">
                          <img src={docUrl(r.selfiePhoto)} alt="selfie" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                        </a>
                      ) : <span className="text-slate-400 text-sm">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'}`}>
                        {r.status}{r.matchScore != null ? ` · ${Math.round(r.matchScore * 100)}%` : ''}
                      </span>
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
