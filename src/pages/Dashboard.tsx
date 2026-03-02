import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DollarSign, ShoppingBag, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (loading) return <div className="p-4">Loading stats...</div>;

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats?.todaySales || 0)}
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard
          title="This Week"
          value={formatCurrency(stats?.weekSales || 0)}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats?.monthSales || 0)}
          icon={ShoppingBag}
          color="bg-purple-500"
        />
        <StatCard
          title="Total Invoices"
          value={stats?.totalInvoices || 0}
          icon={Package}
          color="bg-orange-500"
        />
      </div>

      {user?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Total Revenue (All Time)"
            value={formatCurrency(stats?.totalRevenue || 0)}
            icon={DollarSign}
            color="bg-indigo-600"
          />
          <StatCard
            title="Total Profit"
            value={formatCurrency(stats?.totalProfit || 0)}
            icon={TrendingUp}
            color="bg-green-600"
          />
           <StatCard
            title="Stock Value"
            value={formatCurrency(stats?.stockValue || 0)}
            icon={Package}
            color="bg-slate-600"
          />
        </div>
      )}
      
      {/* Placeholder for charts - can be expanded */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold mb-4">Sales Overview</h3>
        <div className="h-64 flex items-center justify-center text-slate-400">
          Chart visualization coming soon
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
