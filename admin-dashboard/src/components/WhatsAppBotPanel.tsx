import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
  MessageSquare, Users, Ban, DollarSign,
  RefreshCw, CheckCircle, AlertTriangle,
  Search, Eye, X, Phone
} from 'lucide-react';

interface Stats {
  status: {
    localBot: string;
    cloudBot: string;
  };
  todayUsersCount: number;
  messages: {
    user_24h: number;
    ai_24h: number;
    user_48h: number;
    ai_48h: number;
    user_7d: number;
    ai_7d: number;
    user_30d: number;
    ai_30d: number;
  };
  geminiCost: number;
  activeUsers: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  groups: {
    total: number;
    active: number;
  };
}

interface WAUser {
  id: number;
  name: string;
  username: string;
  whatsapp_number: string;
  role: string;
  is_suspended: number;
  balance: string | number;
  plan_type: string | null;
  expiry_date: string | null;
  msg_to_bot: number;
  msg_from_bot: number;
  img_count: number;
  voice_count: number;
}

interface WAGroup {
  group_id: string;
  group_name: string;
  bot_message_count: number;
  bot_mention_count: number;
  status: string;
  last_activity: string;
}

export default function WhatsAppBotPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'groups'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<WAUser[]>([]);
  const [groups, setGroups] = useState<WAGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Search filter states
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // Selected Detail Modal states
  const [selectedUser, setSelectedUser] = useState<WAUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<WAGroup | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista stats", "danger");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista users", "danger");
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/groups`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setGroups(data);
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista groups", "danger");
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchUsers(), fetchGroups()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleToggleSuspend = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast(data.message, "success");
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: data.is_suspended } : u));
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, is_suspended: data.is_suspended } : null);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday", "danger");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'connected':
      case 'active':
        return <span className="badge success flex-center" style={{ gap: '4px', width: 'fit-content' }}><CheckCircle size={12} /> Active</span>;
      case 'qr_ready':
        return <span className="badge warning flex-center" style={{ gap: '4px', width: 'fit-content' }}><RefreshCw size={12} className="animate-spin" /> QR Ready</span>;
      case 'initializing':
        return <span className="badge warning flex-center" style={{ gap: '4px', width: 'fit-content' }}><RefreshCw size={12} className="animate-spin" /> Loading</span>;
      case 'disconnected':
        return <span className="badge danger flex-center" style={{ gap: '4px', width: 'fit-content' }}><AlertTriangle size={12} /> Disconnected</span>;
      default:
        return <span className="badge danger flex-center" style={{ gap: '4px', width: 'fit-content' }}><Ban size={12} /> Inactive</span>;
    }
  };

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.whatsapp_number || '').includes(userSearch)
  );

  const filteredGroups = groups.filter(g =>
    (g.group_name || '').toLowerCase().includes(groupSearch.toLowerCase()) ||
    (g.group_id || '').includes(groupSearch)
  );

  return (
    <div className="panel-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>WhatsApp Bot Dashboard</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            Maamul oo la soco wada-sheekaysiga labada bot (Local iyo Cloud), xogta maalinlaha ah, users-ka iyo group-yada.
          </p>
        </div>
        <button className="icon-btn primary" onClick={loadAllData} title="Refresh Data">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '24px' }}>
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
        >
          Overview & Stats
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
          style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
        >
          WhatsApp Users ({users.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
          style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'groups' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'groups' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
        >
          WhatsApp Groups ({groups.length})
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-muted">Soo qaadaya xogta WhatsApp Bot...</p>
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && stats && (
            <div className="tab-content">
              {/* Bot status banner */}
              <div className="grid-2 mb-lg" style={{ gap: '20px' }}>
                <div className="card flex-between" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--text-muted)' }}>Local WhatsApp Bot</h4>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Web-Puppeteer Engine</div>
                  </div>
                  {getStatusBadge(stats.status.localBot)}
                </div>
                <div className="card flex-between" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--text-muted)' }}>Cloud WhatsApp Bot</h4>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Meta API Webhook Engine</div>
                  </div>
                  {getStatusBadge(stats.status.cloudBot)}
                </div>
              </div>

              {/* Stat grid */}
              <div className="stats-grid mb-lg">
                <div className="stat-card">
                  <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                    <Users size={16} className="text-primary" /> Active Users (Today)
                  </div>
                  <div className="stat-value">{stats.todayUsersCount}</div>
                  <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>Unique registered chats</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                    <MessageSquare size={16} className="text-success" /> Active Groups
                  </div>
                  <div className="stat-value">{stats.groups.active} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {stats.groups.total} total</span></div>
                  <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>Groups participating in</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                    <DollarSign size={16} className="text-danger" /> Gemini API Cost
                  </div>
                  <div className="stat-value" style={{ color: 'var(--danger)' }}>${stats.geminiCost.toFixed(5)}</div>
                  <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>Cumulative WhatsApp API spend</div>
                </div>
              </div>

              {/* Message frequency overview */}
              <div className="card mb-lg">
                <h3>Message Volume Breakdown</h3>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '20px', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Last 24 Hours</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{(stats.messages.user_24h || 0) + (stats.messages.ai_24h || 0)}</div>
                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                      📥 {stats.messages.user_24h || 0} in | 📤 {stats.messages.ai_24h || 0} out
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Last 48 Hours</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{(stats.messages.user_48h || 0) + (stats.messages.ai_48h || 0)}</div>
                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                      📥 {stats.messages.user_48h || 0} in | 📤 {stats.messages.ai_48h || 0} out
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Last 7 Days</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{(stats.messages.user_7d || 0) + (stats.messages.ai_7d || 0)}</div>
                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                      📥 {stats.messages.user_7d || 0} in | 📤 {stats.messages.ai_7d || 0} out
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Last 30 Days</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{(stats.messages.user_30d || 0) + (stats.messages.ai_30d || 0)}</div>
                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                      📥 {stats.messages.user_30d || 0} in | 📤 {stats.messages.ai_30d || 0} out
                    </div>
                  </div>
                </div>
              </div>

              {/* User Activity Ratios (DAU, MAU, YAU) */}
              <div className="card">
                <h3>User Engagement Metrics</h3>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '20px' }}>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Daily Active Users (DAU)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.activeUsers.daily}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Messaged within 24h</div>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Monthly Active Users (MAU)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success)' }}>{stats.activeUsers.monthly}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Messaged within 30 days</div>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Yearly Active Users (YAU)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.activeUsers.yearly}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Messaged within 365 days</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="tab-content">
              {/* Search tool */}
              <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', marginBottom: '16px' }}>
                <Search size={18} className="text-muted" />
                <input 
                  type="text" 
                  placeholder="Ka raadi magac, username, ama nambarka..." 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', outline: 'none', width: '100%', fontSize: '14px' }}
                />
              </div>

              {/* Users Table */}
              <div className="card table-card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Magaca</th>
                        <th>WhatsApp Number</th>
                        <th>Role</th>
                        <th>Credits</th>
                        <th>Plan Type</th>
                        <th>To Bot</th>
                        <th>From Bot</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedUser(u)}>
                          <td>
                            <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '10px' }}>
                              <div className="avatar-sm" style={{ background: u.is_suspended ? 'rgba(255,69,58,0.1)' : 'rgba(10,132,255,0.1)', color: u.is_suspended ? 'var(--danger)' : 'var(--primary)' }}>
                                {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <div>
                                <strong>{u.name || 'Unknown'}</strong>
                                <div className="text-muted" style={{ fontSize: '11px' }}>@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '6px', fontSize: '13px' }}>
                              <Phone size={12} className="text-muted" />
                              {u.whatsapp_number || 'N/A'}
                            </div>
                          </td>
                          <td><span className={`badge ${u.role === 'admin' || u.role === 'superadmin' ? 'danger' : 'primary'}`}>{u.role}</span></td>
                          <td style={{ fontWeight: 600 }}>{u.balance}</td>
                          <td>
                            {u.plan_type ? (
                              <span className="badge success">{u.plan_type.includes('11') ? 'Premium' : 'Basic'}</span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>None</span>
                            )}
                          </td>
                          <td>{u.msg_to_bot}</td>
                          <td>{u.msg_from_bot}</td>
                          <td>
                            <div className="flex-center" style={{ gap: '8px' }} onClick={e => e.stopPropagation()}>
                              <button 
                                className="icon-btn" 
                                onClick={() => setSelectedUser(u)} 
                                title="View Details"
                                style={{ background: 'rgba(255,255,255,0.04)', border: 'none', padding: '6px', borderRadius: '4px', color: 'var(--text)' }}
                              >
                                <Eye size={14} />
                              </button>
                              <button 
                                className={`icon-btn ${u.is_suspended ? 'success' : 'danger'}`}
                                onClick={(e) => handleToggleSuspend(e, u.id)}
                                title={u.is_suspended ? 'Unsuspend User' : 'Suspend User'}
                                style={{ background: u.is_suspended ? 'rgba(50,215,75,0.1)' : 'rgba(255,69,58,0.1)', border: 'none', padding: '6px', borderRadius: '4px', color: u.is_suspended ? 'var(--success)' : 'var(--danger)' }}
                              >
                                <Ban size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>
                            Ma jiraan isticmaalayaal buuxiya shuruudahan (No matching users found).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* GROUPS TAB */}
          {activeTab === 'groups' && (
            <div className="tab-content">
              {/* Search tool */}
              <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', marginBottom: '16px' }}>
                <Search size={18} className="text-muted" />
                <input 
                  type="text" 
                  placeholder="Ka raadi magaca group-ka ama Group ID..." 
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', outline: 'none', width: '100%', fontSize: '14px' }}
                />
              </div>

              {/* Groups Table */}
              <div className="card table-card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Group Name</th>
                        <th>Group ID</th>
                        <th>Mentions (Asked)</th>
                        <th>Bot Sent Messages</th>
                        <th>Xaaladda</th>
                        <th>Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroups.map((g) => (
                        <tr key={g.group_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedGroup(g)}>
                          <td>
                            <strong>{g.group_name}</strong>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {g.group_id}
                          </td>
                          <td style={{ fontWeight: 600 }}>{g.bot_mention_count}</td>
                          <td style={{ fontWeight: 600 }}>{g.bot_message_count}</td>
                          <td>
                            <span className={`badge ${g.status === 'active' ? 'success' : 'danger'}`}>
                              {g.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {g.last_activity ? new Date(g.last_activity).toLocaleString('en-US') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {filteredGroups.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>
                            Ma jiraan group-yo buuxiya shuruudahan (No matching groups found).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* USER DETAILS MODAL */}
      {selectedUser && (
        <div className="modal-backdrop flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1050 }}>
          <div className="card modal-card" style={{ width: '500px', maxWidth: '95%', padding: '24px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            <div className="flex-between mb-lg" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Isticmaalaha: {selectedUser.name}</h3>
              <button 
                onClick={() => setSelectedUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex-between">
                <span className="text-muted">Username:</span>
                <strong>@{selectedUser.username}</strong>
              </div>
              <div className="flex-between">
                <span className="text-muted">Phone Number:</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={12} className="text-muted" /> {selectedUser.whatsapp_number || 'None'}
                </strong>
              </div>
              <div className="flex-between">
                <span className="text-muted">Status:</span>
                <span className={`badge ${selectedUser.is_suspended ? 'danger' : 'success'}`}>
                  {selectedUser.is_suspended ? 'Suspended' : 'Active'}
                </span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Credits Balance:</span>
                <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>{selectedUser.balance} Credits</strong>
              </div>
              <div className="flex-between">
                <span className="text-muted">Active Subscription:</span>
                <strong>
                  {selectedUser.plan_type ? (
                    <span className="badge success">{selectedUser.plan_type.includes('11') ? 'Premium Plan ($11/Yr)' : 'Basic Plan ($3/Mo)'}</span>
                  ) : (
                    'None (Pay-As-You-Go)'
                  )}
                </strong>
              </div>
              {selectedUser.expiry_date && (
                <div className="flex-between">
                  <span className="text-muted">Sub Expiry:</span>
                  <strong>{new Date(selectedUser.expiry_date).toLocaleDateString()}</strong>
                </div>
              )}

              {/* Bot Interaction Counts (The detailed counts requested) */}
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>Bot Interactions Detail</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="flex-between">
                    <span className="text-muted">Messages Sent To Bot:</span>
                    <strong>{selectedUser.msg_to_bot}</strong>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">Messages Received From Bot:</span>
                    <strong>{selectedUser.msg_from_bot}</strong>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">Total Images Sent:</span>
                    <strong>{selectedUser.img_count}</strong>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">Total Audio/Voice Sent:</span>
                    <strong>{selectedUser.voice_count}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button 
                onClick={(e) => handleToggleSuspend(e, selectedUser.id)}
                className={`btn ${selectedUser.is_suspended ? 'success' : 'danger'}`}
                style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 600, background: selectedUser.is_suspended ? 'var(--success)' : 'var(--danger)', color: '#fff' }}
              >
                {selectedUser.is_suspended ? 'Unsuspend User' : 'Suspend User'}
              </button>
              <button 
                onClick={() => setSelectedUser(null)}
                className="btn"
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}
              >
                Haye
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP DETAILS MODAL */}
      {selectedGroup && (
        <div className="modal-backdrop flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1050 }}>
          <div className="card modal-card" style={{ width: '450px', maxWidth: '95%', padding: '24px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            <div className="flex-between mb-lg" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Group: {selectedGroup.group_name}</h3>
              <button 
                onClick={() => setSelectedGroup(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex-between">
                <span className="text-muted">Group ID (JID):</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>{selectedGroup.group_id}</strong>
              </div>
              <div className="flex-between">
                <span className="text-muted">Status:</span>
                <span className={`badge ${selectedGroup.status === 'active' ? 'success' : 'danger'}`}>
                  {selectedGroup.status}
                </span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Mentions (Asked Count):</span>
                <strong>{selectedGroup.bot_mention_count} mentions</strong>
              </div>
              <div className="flex-between">
                <span className="text-muted">Bot Sent Messages:</span>
                <strong>{selectedGroup.bot_message_count} messages</strong>
              </div>
              <div className="flex-between">
                <span className="text-muted">Last Activity:</span>
                <strong>{selectedGroup.last_activity ? new Date(selectedGroup.last_activity).toLocaleString('en-US') : 'N/A'}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="btn"
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}
              >
                Haye
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
