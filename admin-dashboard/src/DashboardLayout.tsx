import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LogOut, CreditCard, Book, FileText, PieChart, LayoutDashboard, Users, Bot, Settings 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

// Panels
import UsersPanel from './components/UsersPanel';
import PaymentsPanel from './components/PaymentsPanel';
import ExamsPanel from './components/ExamsPanel';
import BooksPanel from './components/BooksPanel';
import ReportsPanel from './components/ReportsPanel';
import GroupsPanel from './components/GroupsPanel';

import { API_URL } from './config';

interface LayoutProps {
  onLogout: () => void;
}

const Overview = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/admin/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  return (
    <div className="overview-container">
      <div className="flex-between mb-lg">
        <h2>Dashboard Overview</h2>
        <div className="text-muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Users</div>
          <div className="stat-value">{stats ? stats.totalUsers : '...'}</div>
          <div className="text-muted" style={{fontSize: '12px', marginTop: '4px'}}>+12% from last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Pending Payments</div>
          <div className="stat-value" style={{color: 'var(--warning)'}}>{stats ? stats.pendingPayments : '...'}</div>
          <div className="text-muted" style={{fontSize: '12px', marginTop: '4px'}}>Requires attention</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Revenue</div>
          <div className="stat-value" style={{color: 'var(--success)'}}>${stats ? stats.totalRevenue : '0'}</div>
          <div className="text-muted" style={{fontSize: '12px', marginTop: '4px'}}>Cumulative</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Active AI Sessions</div>
          <div className="stat-value">{stats ? stats.activeChats : '0'}</div>
          <div className="text-muted" style={{fontSize: '12px', marginTop: '4px'}}>Real-time</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="recent-users">
          <h3>Recent Registrations</h3>
          {stats?.recentUsers && stats.recentUsers.map((u: any) => (
            <div key={u.id} className="user-row">
              <div className="flex-center" style={{gap: '10px'}}>
                <div className="avatar-sm">{u.name.charAt(0)}</div>
                <div>
                  <strong>{u.name}</strong>
                  <div className="text-muted" style={{fontSize: '12px'}}>{u.email}</div>
                </div>
              </div>
              <div className="badge success">{u.role}</div>
            </div>
          ))}
          {(!stats?.recentUsers || stats.recentUsers.length === 0) && <p className="text-muted">No recent users.</p>}
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>Revenue Overview (Last 7 Days)</h3>
          <div style={{ height: '300px', marginTop: '20px' }}>
            {stats?.chartData && stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#8884d8" />
                  <YAxis stroke="#8884d8" />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-center" style={{ height: '100%', color: 'var(--muted)' }}>No revenue data available</div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Quick Actions</h3>
          <div className="list-container" style={{marginTop: '15px'}}>
            <Link to="/exams" className="list-item">
              <div className="flex-center" style={{gap: '12px'}}>
                <div className="icon-btn primary"><FileText size={18}/></div>
                <span>Upload New Exam</span>
              </div>
            </Link>
            <Link to="/books" className="list-item">
              <div className="flex-center" style={{gap: '12px'}}>
                <div className="icon-btn primary"><Book size={18}/></div>
                <span>Add Curriculum Book</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const AIPanel = () => <div><h2>AI Chat Stats</h2><p className="text-muted">Detailed monitoring of Gemini & ElevenLabs usage coming soon.</p></div>;
const SettingsPanel = () => <div><h2>Settings</h2><p className="text-muted">System configuration and API keys management.</p></div>;

export default function DashboardLayout({ onLogout }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Overview' },
    { path: '/users', icon: <Users size={20} />, label: 'Users' },
    { path: '/payments', icon: <CreditCard size={20} />, label: 'Payments' },
    { path: '/exams', icon: <FileText size={20} />, label: 'Exams' },
    { path: '/books', icon: <Book size={20} />, label: 'Books' },
    { path: '/ai-stats', icon: <Bot size={20} />, label: 'AI Stats' },
    { path: '/groups', icon: <Users size={20} />, label: 'Groups' },
    { path: '/reports', icon: <PieChart size={20} />, label: 'Reports' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Darkpen<span className="text-primary">Admin</span></h2>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={onLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="header-title">
            {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
          </div>
          <div className="admin-profile">
            <div className="avatar">A</div>
            <span>Admin</span>
          </div>
        </header>

        <div className="content-area">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/users" element={<UsersPanel />} />
            <Route path="/payments" element={<PaymentsPanel />} />
            <Route path="/exams" element={<ExamsPanel />} />
            <Route path="/books" element={<BooksPanel />} />
            <Route path="/ai-stats" element={<AIPanel />} />
            <Route path="/groups" element={<GroupsPanel />} />
            <Route path="/reports" element={<ReportsPanel />} />
            <Route path="/settings" element={<SettingsPanel />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
