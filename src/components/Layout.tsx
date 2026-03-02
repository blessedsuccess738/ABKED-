import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, LogOut, FileText, History } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-emerald-400">ABKED POS</h1>
          <p className="text-xs text-slate-400 mt-1">Enterprise System</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/') ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </Link>

          <Link
            to="/pos"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/pos') ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ShoppingCart size={20} />
            POS System
          </Link>

          {user?.role === 'ADMIN' && (
            <Link
              to="/inventory"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/inventory') ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Package size={20} />
              Inventory
            </Link>
          )}

          <Link
            to="/sales"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/sales') ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <History size={20} />
            Sales History
          </Link>
          
          {user?.role === 'ADMIN' && (
             <Link
              to="/price-logs"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive('/price-logs') ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText size={20} />
              Price Logs
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold">
              {user?.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {location.pathname === '/' ? 'Dashboard' : 
             location.pathname === '/pos' ? 'Point of Sale' :
             location.pathname === '/inventory' ? 'Inventory Management' :
             location.pathname === '/sales' ? 'Sales History' :
             location.pathname === '/price-logs' ? 'Price Change Logs' : ''}
          </h2>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
