import { useEffect, useState } from 'react';
import { CalendarClock, MapPin, Inbox, Eye, Trash2, X, User } from 'lucide-react';
import { getAttendance, deleteAttendance } from '../api/admin';
import type { Attendance } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Selfie absen = file privat, token di query karena <img> tak kirim header auth.
const selfieUrl = (name?: string | null) => (name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : null);

const statusBadge = (r: Attendance) =>
  `inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'}`;
const statusText = (r: Attendance) => `${r.status}${r.matchScore != null ? ` · ${Math.round(r.matchScore * 100)}%` : ''}`;

export default function AttendancePage() {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [detail, setDetail] = useState<Attendance | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data absensi ini?')) return;
    try {
      setDeleting(id);
      await deleteAttendance(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
      if (detail?.id === id) setDetail(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menghapus absensi');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Operasional</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Absensi Driver</h1>
          <p className="text-sm text-slate-500 mt-1">Check-in driver (selfie + lokasi). Skor = kecocokan wajah vs wajah terdaftar (PRESENT ≥ ambang, FLAGGED bila tidak cocok).</p>
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
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Selfie</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Waktu</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lokasi</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const url = selfieUrl(r.selfiePhoto);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <button onClick={() => setDetail(r)} className="block w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:ring-2 hover:ring-kilatgo-400 transition">
                          {url ? (
                            <img src={url} alt="selfie" loading="lazy" className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-slate-400"><User className="w-5 h-5" /></span>
                          )}
                        </button>
                      </td>
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
                        <span className={statusBadge(r)}>{statusText(r)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => setDetail(r)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-kilatgo-700 bg-kilatgo-50 hover:bg-kilatgo-100 rounded-lg transition">
                            <Eye className="w-4 h-4" /> Detail
                          </button>
                          <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50">
                            <Trash2 className="w-4 h-4" /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-kilatgo-950">Detail Absensi</h3>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const url = selfieUrl(detail.selfiePhoto);
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="block">
                    <img src={url} alt="selfie" className="w-full max-h-72 object-contain rounded-xl bg-slate-100 border border-slate-200"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.innerHTML = '<div class=\'h-40 flex items-center justify-center text-slate-400 text-sm\'>Selfie gagal dimuat</div>'; }} />
                  </a>
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-sm">Tidak ada selfie</div>
                );
              })()}

              <div className="space-y-2 text-sm">
                <Row label="Driver" value={detail.driver?.user.name ?? '—'} />
                <Row label="Telepon" value={detail.driver?.user.phone ?? '—'} />
                <Row label="Waktu" value={new Date(detail.checkedAt).toLocaleString('id-ID')} />
                <Row label="Status" value={statusText(detail)} />
                <div className="flex justify-between">
                  <span className="text-slate-400">Lokasi</span>
                  <a className="font-semibold text-kilatgo-600 hover:underline" target="_blank" rel="noreferrer"
                    href={`https://maps.google.com/?q=${detail.latitude},${detail.longitude}`}>
                    {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                  </a>
                </div>
              </div>

              <button onClick={() => handleDelete(detail.id)} disabled={deleting === detail.id}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Hapus Absensi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4">
    <span className="text-slate-400">{label}</span>
    <span className="font-semibold text-kilatgo-950 text-right">{value}</span>
  </div>
);
