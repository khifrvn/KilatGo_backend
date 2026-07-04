import { useEffect, useState } from 'react';
import {
  Users,
  UserCircle,
  Car,
  ClipboardList,
  DollarSign,
  Clock,
  TrendingUp,
  ArrowUpRight,
  MapPin,
  Star,
  Calendar,
  CreditCard,
  Activity,
  UserCheck,
  Package,
} from 'lucide-react';
import { getDashboardStats, getPendingDrivers } from '../api/admin';
import type { DashboardStats, Driver, Order } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  trend?: string;
}

const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }: StatCardProps) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          <ArrowUpRight className="w-3 h-3" />
          {trend}
        </span>
      )}
    </div>
    <p className="text-sm font-medium text-slate-500">{title}</p>
    <p className="text-2xl font-bold text-kilatgo-950 mt-1">{value}</p>
    {subtitle && <p className="text-xs text-slate-400 mt-2">{subtitle}</p>}
  </div>
);

const SectionHeader = ({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: React.ElementType }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="p-2 bg-kilatgo-50 rounded-lg">
      <Icon className="w-5 h-5 text-kilatgo-600" />
    </div>
    <div>
      <h2 className="text-lg font-bold text-kilatgo-950">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  </div>
);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const statusColors: Record<string, string> = {
  PENDING: '#facc15',
  ACCEPTED: '#3b82f6',
  DRIVER_ARRIVED: '#6366f1',
  ON_RIDE: '#a855f7',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
};

const formatStatus = (status: string) => status.replace(/_/g, ' ');

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, driversData] = await Promise.all([
          getDashboardStats(),
          getPendingDrivers(),
        ]);
        setStats(statsData);
        setPendingDrivers(driversData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kilatgo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-kilatgo-500 uppercase tracking-wider mb-1">
            Overview
          </p>
          <h1 className="text-3xl font-bold text-kilatgo-950">Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500">Platform performance at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Users"
          value={stats?.users.total || 0}
          icon={Users}
          color="bg-kilatgo-500"
          subtitle={`${stats?.users.customers || 0} customers · ${stats?.users.drivers || 0} drivers`}
        />
        <StatCard
          title="Total Orders"
          value={stats?.orders.total || 0}
          icon={ClipboardList}
          color="bg-kilatgo-700"
          subtitle={`${stats?.orders.pending || 0} pending approval`}
        />
        <StatCard
          title="Total Earnings"
          value={`Rp ${(stats?.earnings || 0).toLocaleString('id-ID')}`}
          icon={DollarSign}
          color="bg-emerald-500"
          trend="Lifetime"
        />
        <StatCard
          title="Customers"
          value={stats?.users.customers || 0}
          icon={UserCircle}
          color="bg-kilatgo-400"
        />
        <StatCard
          title="Drivers"
          value={stats?.users.drivers || 0}
          icon={Car}
          color="bg-kilatgo-600"
          subtitle={`${stats?.drivers.pendingApproval || 0} awaiting approval`}
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.drivers.pendingApproval || 0}
          icon={Clock}
          color="bg-kilatgo-accent"
          subtitle="Driver registration approvals"
        />
      </div>

      {/* Trends charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Earnings trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="Earnings Trend"
            subtitle="Last 14 days revenue"
            icon={TrendingUp}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.earningsTrend || []}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                  labelFormatter={(label) => formatDate(label as string)}
                  formatter={(value) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Earnings']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#earningsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Driver status distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="Driver Status"
            subtitle="Current driver availability"
            icon={Activity}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.driverStatusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {(stats?.driverStatusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                  formatter={(value, _name, props) => [`${value} drivers`, props.payload.status]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-600 capitalize">{value.toLowerCase()}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Orders and user growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders trend */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="Orders Trend"
            subtitle="Daily orders in the last 14 days"
            icon={Package}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.ordersTrend || []} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                  labelFormatter={(label) => formatDate(label as string)}
                  formatter={(value) => [`${value} orders`, 'Orders']}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User growth */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="User Growth"
            subtitle="New user registrations last 14 days"
            icon={UserCheck}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.userGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatDate}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                  labelFormatter={(label) => formatDate(label as string)}
                  formatter={(value) => [`${value} users`, 'New Users']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#facc15"
                  strokeWidth={3}
                  dot={{ fill: '#facc15', strokeWidth: 2, r: 4, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Distribution and lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order status distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="Order Status"
            subtitle="Distribution by current status"
            icon={ClipboardList}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.orderStatusDistribution || []}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {(stats?.orderStatusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                  formatter={(value, name) => [`${value} orders`, formatStatus(name as string)]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={50}
                  iconType="circle"
                  formatter={(value: string) => (
                    <span className="text-[10px] text-slate-600">{formatStatus(value)}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="Recent Orders"
            subtitle="Latest ride bookings"
            icon={Calendar}
          />
          <div className="space-y-3">
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              stats.recentOrders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-kilatgo-200 transition"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm flex-shrink-0">
                      {order.customer.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-kilatgo-950 truncate">
                        {order.customer.user.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{order.dropoffAddress}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-bold text-sm text-kilatgo-950">
                      Rp {Number(order.totalFare).toLocaleString('id-ID')}
                    </p>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1"
                      style={{
                        backgroundColor: `${statusColors[order.status] || '#64748b'}20`,
                        color: statusColors[order.status] || '#64748b',
                      }}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                No recent orders
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top drivers and pending approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top drivers */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <SectionHeader
            title="Top Drivers"
            subtitle="Highest completed rides"
            icon={Star}
          />
          <div className="space-y-3">
            {stats?.topDrivers && stats.topDrivers.length > 0 ? (
              stats.topDrivers.map((driver: Driver, index: number) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100"
                >
                  <div className="w-7 h-7 rounded-full bg-kilatgo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm flex-shrink-0">
                    {driver.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-kilatgo-950 truncate">
                      {driver.user.name}
                    </p>
                    <p className="text-xs text-slate-500">{driver.vehicleType}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-sm font-bold text-kilatgo-950">
                      <Star className="w-4 h-4 text-kilatgo-accent fill-kilatgo-accent" />
                      {driver.rating.toFixed(1)}
                    </div>
                    <p className="text-xs text-slate-500">{driver.totalRides} rides</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">No drivers yet</div>
            )}
          </div>
        </div>

        {/* Pending drivers */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-kilatgo-50 rounded-lg">
                <Clock className="w-5 h-5 text-kilatgo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-kilatgo-950">Pending Approvals</h2>
                <p className="text-xs text-slate-500">Driver registration requests</p>
              </div>
            </div>
            <span className="bg-kilatgo-accent/20 text-kilatgo-900 text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingDrivers.length}
            </span>
          </div>

          {pendingDrivers.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-kilatgo-100 flex items-center justify-center">
                <Car className="w-6 h-6 text-kilatgo-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
              {pendingDrivers.slice(0, 5).map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-kilatgo-200 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-kilatgo-100 flex items-center justify-center text-kilatgo-700 font-semibold text-sm flex-shrink-0">
                    {driver.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-kilatgo-950 truncate">
                      {driver.user.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{driver.user.email}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <CreditCard className="w-3 h-3" />
                      <span>{driver.vehicleType}</span>
                      <span>·</span>
                      <span>{driver.vehiclePlate}</span>
                    </div>
                  </div>
                  <a
                    href="/drivers"
                    className="text-xs font-bold text-kilatgo-600 hover:text-kilatgo-800 whitespace-nowrap"
                  >
                    Review
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
