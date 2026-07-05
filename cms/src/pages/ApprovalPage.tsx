import { useEffect, useState } from 'react';
import { UserCheck, XCircle, MapPin, ShieldCheck, Inbox, Eye, X } from 'lucide-react';
import { getPendingDrivers, approveDriver } from '../api/admin';
import type { Driver } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const docUrl = (name?: string | null) =>
  name ? `${API}/admin/files/${name}?token=${localStorage.getItem('kilatgo_token')}` : '';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-kilatgo-950 text-right">{value ?? '—'}</span>
    </div>
  );
}

function DocThumb({ label, name }: { label: string; name?: string | null }) {
  if (!name) return null;
  const url = docUrl(name);
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <img src={url} alt={label} className="w-full h-28 object-cover rounded-lg border border-slate-200 group-hover:ring-2 ring-kilatgo-400 transition" />
    </a>
  );
}

function DetailModal({ driver, onClose, onAction, busy }: {
  driver: Driver;
  onClose: () => void;
  onAction: (id: string, approve: boolean) => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-kilatgo-950">{driver.user.name}</h2>
            <p className="text-sm text-slate-500">Detail pendaftaran mitra driver</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-x-8">
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Akun & Diri</h3>
              <Row label="Email" value={driver.user.email} />
              <Row label="No HP" value={driver.user.phone} />
              <Row label="NIK" value={driver.nik} />
              <Row label="Tgl lahir" value={driver.birthDate ? new Date(driver.birthDate).toLocaleDateString('id-ID') : null} />
              <Row label="Kota" value={driver.city} />
              <Row label="Alamat" value={driver.address} />
              <Row label="Layanan" value={driver.serviceType === 'CAR' ? 'Mobil (GoCar)' : 'Motor (GoRide)'} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Kendaraan & SIM</h3>
              <Row label="Kendaraan" value={driver.vehicleType} />
              <Row label="Merk" value={driver.vehicleBrand} />
              <Row label="Plat" value={driver.vehiclePlate} />
              <Row label="Tahun" value={driver.vehicleYear} />
              <Row label="Warna" value={driver.vehicleColor} />
              <Row label="SIM" value={driver.simType ? `${driver.simType} · ${driver.simNumber ?? ''}` : driver.licenseNumber} />
              <Row label="STNK" value={driver.stnkNumber} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-1">Rekening</h3>
            <div className="grid sm:grid-cols-2 gap-x-8">
              <Row label="Bank" value={driver.bankName} />
              <Row label="No rekening" value={driver.bankAccount} />
              <Row label="Atas nama" value={driver.bankHolder} />
              <Row label="NPWP" value={driver.npwp} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-kilatgo-500 uppercase tracking-wider mb-3">Dokumen (KYC)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DocThumb label="e-KTP" name={driver.ktpPhoto} />
              <DocThumb label="Selfie" name={driver.selfiePhoto} />
              <DocThumb label="SIM" name={driver.simPhoto} />
              <DocThumb label="STNK" name={driver.stnkPhoto} />
              <DocThumb label="SKCK" name={driver.skckPhoto} />
            </div>
            {!driver.ktpPhoto && !driver.selfiePhoto && (
              <p className="text-sm text-slate-400">Tidak ada dokumen terupload.</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={() => onAction(driver.id, true)}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" /> Approve
          </button>
          <button
            onClick={() => onAction(driver.id, false)}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Driver | null>(null);

  const fetchPending = async () => {
    try {
      setIsLoading(true);
      const data = await getPendingDrivers();
      setDrivers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load pending approvals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handle = async (driverId: string, approve: boolean) => {
    if (!approve && !confirm('Reject and remove this partner application?')) return;
    try {
      setActionLoading(driverId);
      await approveDriver(driverId, approve);
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      setSelected(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">Management</p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Approval</h1>
          <p className="text-sm text-slate-500 mt-1">Partner &amp; driver registrations awaiting review</p>
        </div>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-sm font-semibold self-start">
          <ShieldCheck className="w-4 h-4" />
          {drivers.length} pending
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500"></div>
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium">No pending approvals</p>
            <p className="text-xs text-slate-400 mt-1">New partner applications will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Applicant</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm">
                          {driver.user.name.charAt(0).toUpperCase()}
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
                          <p className="text-xs text-slate-400">{driver.city ?? driver.licenseNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelected(driver)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </button>
                        <button
                          onClick={() => handle(driver.id, true)}
                          disabled={actionLoading === driver.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
                        >
                          <UserCheck className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handle(driver.id, false)}
                          disabled={actionLoading === driver.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailModal
          driver={selected}
          onClose={() => setSelected(null)}
          onAction={handle}
          busy={actionLoading === selected.id}
        />
      )}
    </div>
  );
}
