import { useEffect, useState } from 'react';
import { Search, Car, CheckCircle, XCircle, UserCheck, MapPin, Star } from 'lucide-react';
import { getDrivers, approveDriver } from '../api/admin';
import type { Driver } from '../types';

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
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      setIsLoading(true);
      const data = await getDrivers();
      setDrivers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleApprove = async (driverId: string) => {
    try {
      setActionLoading(driverId);
      await approveDriver(driverId, true);
      await fetchDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve driver');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (driverId: string) => {
    if (!confirm('Are you sure you want to reject this driver?')) return;
    try {
      setActionLoading(driverId);
      await approveDriver(driverId, false);
      await fetchDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject driver');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && !driver.isApproved) ||
      (filter === 'approved' && driver.isApproved);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">
            Management
          </p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Drivers</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or plate"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                filter === f
                  ? 'bg-kilatgo-600 text-white shadow-md shadow-kilatgo-600/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
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
            <p className="text-sm font-medium">No drivers found</p>
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
                    Vehicle
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Approval
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.map((driver) => (
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
                          <p className="text-xs text-slate-400">License: {driver.licenseNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={statusColors[driver.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}>
                        {driver.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {driver.isApproved ? (
                        <Badge color="bg-emerald-100 text-emerald-700 ring-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge color="bg-amber-100 text-amber-700 ring-amber-200">
                          <ClockIcon />
                          Pending
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-kilatgo-950 font-semibold">
                        <Star className="w-4 h-4 text-kilatgo-accent fill-kilatgo-accent" />
                        {driver.rating.toFixed(1)}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{driver.totalRides} rides</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!driver.isApproved ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(driver.id)}
                            disabled={actionLoading === driver.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(driver.id)}
                            disabled={actionLoading === driver.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
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

function ClockIcon() {
  return (
    <svg
      className="w-3 h-3 mr-1"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
