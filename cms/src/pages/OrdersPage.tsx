import { useEffect, useState } from 'react';
import { Search, ClipboardList, ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { getAllOrders } from '../api/admin';
import type { Order } from '../types';

const orderStatuses = [
  'PENDING',
  'ACCEPTED',
  'DRIVER_ARRIVED',
  'ON_RIDE',
  'COMPLETED',
  'CANCELLED',
];

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 ring-amber-200',
  ACCEPTED: 'bg-kilatgo-100 text-kilatgo-700 ring-kilatgo-200',
  DRIVER_ARRIVED: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  ON_RIDE: 'bg-purple-100 text-purple-700 ring-purple-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-red-100 text-red-700 ring-red-200',
};

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${color}`}>
    {children}
  </span>
);

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const result = await getAllOrders({
        status: statusFilter || undefined,
        page,
        limit: 10,
      });
      setOrders(result.data);
      setMeta(result.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, page]);

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.driver?.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">
            Management
          </p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Orders</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search order number, customer, or driver"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-kilatgo-400 focus:border-kilatgo-400 outline-none min-w-[180px]"
        >
          <option value="">All Statuses</option>
          {orderStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-kilatgo-500"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium">No orders found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Fare
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-kilatgo-950">
                          #{order.orderNumber.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-sm text-kilatgo-950">{order.customer.user.name}</p>
                        <p className="text-xs text-slate-500">{order.customer.user.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        {order.driver ? (
                          <div>
                            <p className="font-semibold text-sm text-kilatgo-950">{order.driver.user.name}</p>
                            <p className="text-xs text-slate-500">{order.driver.user.phone}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-700 truncate" title={order.pickupAddress}>
                              {order.pickupAddress}
                            </p>
                          </div>
                          <div className="flex items-start gap-2 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-kilatgo-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-700 truncate" title={order.dropoffAddress}>
                              {order.dropoffAddress}
                            </p>
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">{order.distanceKm.toFixed(1)} km</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge color={statusColors[order.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}>
                          {order.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-kilatgo-950">
                          Rp {Number(order.totalFare).toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-slate-500">{order.paymentMethod}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(order.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing {orders.length} of {meta.total} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-semibold text-kilatgo-950 px-2">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page === meta.totalPages || meta.totalPages === 0}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
