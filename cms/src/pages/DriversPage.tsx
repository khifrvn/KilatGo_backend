import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Car, CheckCircle, UserCheck, MapPin, Star, Info, X, Ban } from 'lucide-react';
import { getDrivers, verifyKyc, suspendUser, activateUser } from '../api/admin';
import type { Driver } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const docUrl = (name?: string | null) =>
  name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : '';
const rp = (v?: number | string | null) => 'Rp ' + Number(v ?? 0).toLocaleString('id-ID');

const statusColors: Record<string, string> = {
  OFFLINE: 'bg-slate-100 text-slate-600 ring-slate-200',
  ONLINE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  BUSY: 'bg-kilatgo-100 text-kilatgo-700 ring-kilatgo-200',
};

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${color}`}>
    {children}
  </span>
);

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detail, setDetail] = useState<Driver | null>(null);

  const fetchDrivers = async () => {
    try {
      setIsLoading(true);
      const data = await getDrivers();
      setDrivers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat driver');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleSuspend = async (userId: string) => {
    const reason = window.prompt('Alasan blokir (ditampilkan ke driver di aplikasi):', '');
    if (reason === null) return;
    try {
      setActionLoading(userId);
      await suspendUser(userId, reason.trim() || undefined);
      await fetchDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memblokir driver');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      setActionLoading(userId);
      await activateUser(userId);
      await fetchDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengaktifkan driver');
    } finally {
      setActionLoading(null);
    }
  };

  // Halaman ini hanya untuk driver yang sudah disetujui — pendaftar baru & yang ditolak
  // hidup di halaman Persetujuan.
  const filteredDrivers = drivers.filter((driver) => {
    if (!driver.isApproved) return false;

    const matchesSearch =
      driver.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'online' && driver.status === 'ONLINE') ||
      (filter === 'offline' && driver.status !== 'ONLINE');

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">
            Manajemen
          </p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Driver</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, email, atau plat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'online', 'offline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                filter === f
                  ? 'bg-kilatgo-600 text-white shadow-md shadow-kilatgo-600/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {{ all: 'Semua', online: 'Online', offline: 'Offline' }[f]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Drivers table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500"></div>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium">Tidak ada driver</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Kendaraan
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm relative overflow-hidden shrink-0">
                          <span>{driver.user.name.charAt(0).toUpperCase()}</span>
                          {driver.selfiePhoto && (
                            <img src={docUrl(driver.selfiePhoto)} alt="" loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              className="absolute inset-0 w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-kilatgo-950">{driver.user.name}</p>
                          <p className="text-sm text-slate-500">{driver.user.email}</p>
                          <p className="text-xs text-slate-400">{driver.user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-kilatgo-950">{driver.vehicleType}</p>
                          <p className="text-xs text-slate-500">{driver.vehiclePlate}</p>
                          <p className="text-xs text-slate-400">SIM: {driver.licenseNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {driver.user.status === 'SUSPENDED' ? (
                        <Badge color="bg-red-100 text-red-700 ring-red-200">DIBLOKIR</Badge>
                      ) : (
                        <Badge color={statusColors[driver.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}>
                          {driver.status}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {/* Klik → halaman Rating & Ulasan, difilter ke driver ini. */}
                      <Link
                        to={`/admin/ratings?target=DRIVER&subjectId=${driver.id}&name=${encodeURIComponent(driver.user?.name ?? '')}`}
                        className="inline-flex items-center gap-1 text-sm text-kilatgo-950 font-semibold hover:text-kilatgo-600 transition"
                        title="Lihat isi ulasan driver ini"
                      >
                        <Star className="w-4 h-4 text-kilatgo-accent fill-kilatgo-accent" />
                        {driver.rating.toFixed(1)}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">{driver.totalRides} order</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-kilatgo-950">
                      {rp(driver.earningsBalance)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDetail(driver)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-kilatgo-700 bg-kilatgo-50 hover:bg-kilatgo-100 rounded-lg transition"
                        >
                          <Info className="w-4 h-4" />
                          Detail
                        </button>
                        {driver.user.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => handleActivate(driver.userId)}
                            disabled={actionLoading === driver.userId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                            Aktifkan
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(driver.userId)}
                            disabled={actionLoading === driver.userId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                          >
                            <Ban className="w-4 h-4" />
                            Blokir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <DriverDetailModal
          driver={detail}
          onClose={() => setDetail(null)}
          onKyc={async (approve) => {
            await verifyKyc('driver', detail.id, approve, approve ? undefined : 'Dokumen tidak sesuai');
            await fetchDrivers();
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

function DriverDetailModal({ driver, onClose, onKyc }: { driver: Driver; onClose: () => void; onKyc: (approve: boolean) => Promise<void> }) {
  const [kycBusy, setKycBusy] = useState(false);
  const d = driver as Driver & { creditBalance?: number; earningsBalance?: number; enabledServices?: string | null };
  const rows: [string, React.ReactNode][] = [
    ['Nama', driver.user.name],
    ['Email', driver.user.email],
    ['Telepon', driver.user.phone ?? '-'],
    ['Kota', driver.city ?? '-'],
    ['Layanan', d.enabledServices || driver.serviceType || '-'],
    ['Kendaraan', `${driver.vehicleBrand ?? ''} ${driver.vehicleType} · ${driver.vehiclePlate}`],
    ['No. SIM', `${driver.simType ?? ''} ${driver.simNumber ?? '-'}`],
    ['Rekening', driver.bankName ? `${driver.bankName} · ${driver.bankAccount} (a.n. ${driver.bankHolder})` : '-'],
    ['Status KYC', driver.kycStatus ?? 'UNVERIFIED'],
    ['Bergabung', new Date(driver.user.createdAt).toLocaleDateString('id-ID')],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-lg text-kilatgo-950">Detail Driver</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-bold text-xl relative overflow-hidden">
              <span>{driver.user.name.charAt(0).toUpperCase()}</span>
              {driver.selfiePhoto && (
                <img src={docUrl(driver.selfiePhoto)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            <div>
              <p className="font-bold text-lg text-kilatgo-950">{driver.user.name}</p>
              <div className="flex items-center gap-1 text-sm"><Star className="w-4 h-4 text-kilatgo-accent fill-kilatgo-accent" />{driver.rating.toFixed(1)} · {driver.totalRides} trip</div>
            </div>
          </div>

          {/* Ringkasan angka */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label="Trip selesai" value={String(driver.totalRides)} />
            <Stat label="Rating" value={driver.rating.toFixed(1)} />
            <Stat label="Status" value={driver.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Stat label="Dompet Kredit" value={rp(d.creditBalance)} />
            <Stat label="Dompet Pendapatan" value={rp(d.earningsBalance)} />
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium text-slate-800 text-right">{v}</span>
              </div>
            ))}
          </div>

          {/* Verifikasi KYC */}
          {driver.kycStatus !== 'VERIFIED' ? (
            <div className="mt-5 flex gap-2">
              <button
                disabled={kycBusy}
                onClick={async () => { setKycBusy(true); try { await onKyc(true); } finally { setKycBusy(false); } }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-60"
              >
                <CheckCircle className="w-4 h-4" />Verifikasi KYC
              </button>
              <button
                disabled={kycBusy}
                onClick={async () => { setKycBusy(true); try { await onKyc(false); } finally { setKycBusy(false); } }}
                className="px-4 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition disabled:opacity-60"
              >
                Tolak
              </button>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle className="w-4 h-4" />KYC terverifikasi</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-kilatgo-950 truncate">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

