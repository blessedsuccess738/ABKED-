import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DollarSign, ShoppingBag, TrendingUp, Package, Download } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const exportToCSV = () => {
    if (!stats) return;

    const headers = ['Metric', 'Value'];
    const rows = [
      ['Today Sales', stats.todaySales],
      ['Week Sales', stats.weekSales],
      ['Month Sales', stats.monthSales],
      ['Total Invoices', stats.totalInvoices],
    ];

    if (user?.role === 'ADMIN') {
      rows.push(['Total Revenue', stats.totalRevenue]);
      rows.push(['Total Profit', stats.totalProfit]);
      rows.push(['Stock Value', stats.stockValue]);
      
      if (stats.paymentMethods) {
         stats.paymentMethods.forEach((pm: any) => {
             rows.push([`Sales via ${pm.payment_method}`, pm.total]);
         });
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dashboard_stats.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
         {user?.role === 'ADMIN' && (
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <Download size={18} />
              Export Stats CSV
            </button>
         )}
      </div>

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
        <>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Payment Method Chart */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold mb-4">Sales by Payment Method</h3>
                <div className="h-64">
                  {stats?.paymentMethods && stats.paymentMethods.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.paymentMethods}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="total"
                          nameKey="payment_method"
                        >
                          {stats.paymentMethods.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      No sales data available
                    </div>
                  )}
                </div>
             </div>
             
             {/* Placeholder for other charts */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold mb-4">Sales Trend</h3>
                <div className="h-64 flex items-center justify-center text-slate-400">
                  Chart visualization coming soon
                </div>
             </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
