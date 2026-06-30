import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
  Send, Users, Ban, RefreshCw, CheckCircle, AlertTriangle,
  Search, Eye, X, MessageSquare, TrendingUp, Image, Mic,
  Activity, Hash, ChevronRight, Clock, UserCheck
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
  };
  messages: {
    user_24h: number;
    ai_24h: number;
    user_7d: number;
    ai_7d: number;
    user_30d: number;
    ai_30d: number;
  };
  geminiCost: number;
}

interface TGUser {
  id: number;
  name: string;
  username: string;
  whatsapp_number: string;
  role: string;
  is_suspended: number;
  telegram_chat_id: string;
  linked_at: string;
  balance: number;
  msg_to_bot: number;
  msg_from_bot: number;
  img_count: number;
  voice_count: number;
  last_activity: string | null;
}

const timeAgo = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function TelegramBotPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<TGUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<TGUser | null>(null);
  const [suspendLoading, setSuspendLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const token = localStorage.getItem('adminToken');
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/telegram/stats`, { headers: authHeaders });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/telegram/users`, { headers: authHeaders });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await Promise.all([fetchStats(), fetchUsers()]);
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleToggleSuspend = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    setSuspendLoading(userId);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: data.is_suspended } : u));
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, is_suspended: data.is_suspended } : null);
        }
        showToast(data.message, 'success');
      } else {
        showToast(data.message || 'Cilad ayaa dhacday', 'danger');
      }
    } catch (err) {
      console.error(err);
      showToast('Cilad xiriirka server-ka', 'danger');
    } finally {
      setSuspendLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const term = userSearch.toLowerCase();
    return (
      user.name.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term) ||
      (user.whatsapp_number && user.whatsapp_number.includes(term)) ||
      user.telegram_chat_id.includes(term)
    );
  });

  return (
    <div className="panel-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-alert alert-${toast.type} animate-in fade-in slide-in-from-top duration-300`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>Telegram Bot Panel</h2>
          <p className="text-muted">La soco falanqaynta, dadka isticmaala, iyo xaalada Telegram bot-kaaga.</p>
        </div>
        <button 
          onClick={() => loadAllData(true)} 
          disabled={refreshing || loading}
          className="btn flex-center gap-sm"
          style={{ padding: '8px 16px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Cusboonaysiin...' : 'Cusboonaysii'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-container mb-lg">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '15px' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          <p className="text-muted">Soo dejinaya xogta Telegram...</p>
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="stat-title">Total Registered</div>
                  <div className="stat-value">{stats?.totalUsers ?? 0}</div>
                  <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Linked via bot</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Active (24 Hours)</div>
                  <div className="stat-value text-primary">{stats?.activeUsers?.daily ?? 0}</div>
                  <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Unique users</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Active (7 Days)</div>
                  <div className="stat-value text-success">{stats?.activeUsers?.weekly ?? 0}</div>
                  <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Weekly active</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Active (30/90 Days)</div>
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>
                    {stats?.activeUsers?.monthly ?? 0} <span className="text-muted" style={{ fontSize: '16px' }}>/ {stats?.activeUsers?.quarterly ?? 0}</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Monthly / Quarterly</div>
                </div>
              </div>

              {/* Message Metrics & Costs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Traffic Logs */}
                <div className="card">
                  <h3 className="mb-md flex-center gap-sm">
                    <Activity size={18} className="text-primary" />
                    <span>Message Traffic Logs</span>
                  </h3>
                  
                  <div className="list-container">
                    <div className="list-item flex-between py-sm">
                      <div className="flex-center gap-sm">
                        <div className="avatar-sm flex-center" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>24h</div>
                        <div>
                          <strong>Last 24 Hours</strong>
                          <div className="text-muted" style={{ fontSize: '11px' }}>Traffic volume</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div>User: <strong>{stats?.messages?.user_24h ?? 0}</strong></div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>AI: {stats?.messages?.ai_24h ?? 0}</div>
                      </div>
                    </div>

                    <div className="list-item flex-between py-sm">
                      <div className="flex-center gap-sm">
                        <div className="avatar-sm flex-center" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>7d</div>
                        <div>
                          <strong>Last 7 Days</strong>
                          <div className="text-muted" style={{ fontSize: '11px' }}>Weekly traffic</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div>User: <strong>{stats?.messages?.user_7d ?? 0}</strong></div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>AI: {stats?.messages?.ai_7d ?? 0}</div>
                      </div>
                    </div>

                    <div className="list-item flex-between py-sm">
                      <div className="flex-center gap-sm">
                        <div className="avatar-sm flex-center" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>30d</div>
                        <div>
                          <strong>Last 30 Days</strong>
                          <div className="text-muted" style={{ fontSize: '11px' }}>Monthly traffic</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div>User: <strong>{stats?.messages?.user_30d ?? 0}</strong></div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>AI: {stats?.messages?.ai_30d ?? 0}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Cost & Bot Info */}
                <div className="card flex flex-col justify-between">
                  <div>
                    <h3 className="mb-md flex-center gap-sm">
                      <TrendingUp size={18} className="text-success" />
                      <span>API Expenses (Telegram)</span>
                    </h3>
                    
                    <div style={{ marginTop: '20px', padding: '24px', background: 'rgba(16, 185, 129, 0.04)', border: '1px border-dashed var(--success)', borderRadius: '12px', textAlign: 'center' }}>
                      <div className="text-muted" style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Estimated Costs</div>
                      <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--success)', marginTop: '8px' }}>
                        ${stats?.geminiCost ? stats.geminiCost.toFixed(4) : '0.0000'}
                      </div>
                      <p className="text-muted" style={{ fontSize: '11px', marginTop: '8px' }}>Calculated dynamically based on input/output tokens from Gemini API</p>
                    </div>
                  </div>

                  <div className="text-muted" style={{ fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '15px', marginTop: '15px' }}>
                    Darkpen AI Telegram Bot manages direct revisions, MCQs solutions, and instant answers for registered Somali students.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="card">
              {/* Search Bar */}
              <div className="flex-between mb-md gap-md">
                <div className="search-box-container flex-1">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Ka raadi magac, username, phone ama chat ID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Telegram Chat ID</th>
                      <th>Wallet Balance</th>
                      <th>Messages (To/From)</th>
                      <th>Last Activity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr 
                        key={u.id} 
                        onClick={() => setSelectedUser(u)} 
                        className="clickable-row hover:bg-gray-50/5 cursor-pointer"
                      >
                        <td>
                          <div>
                            <strong>{u.name}</strong>
                            <div className="text-muted" style={{ fontSize: '11px' }}>@{u.username}</div>
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-xs">{u.telegram_chat_id}</span>
                        </td>
                        <td>
                          <div className="badge success">{u.balance} Credits</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>
                            Incoming: <strong>{u.msg_to_bot}</strong>
                            <div className="text-muted" style={{ fontSize: '10px' }}>Outgoing: {u.msg_from_bot}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-muted" style={{ fontSize: '12px' }}>
                            {u.last_activity ? timeAgo(u.last_activity) : 'Never'}
                          </span>
                        </td>
                        <td>
                          <div className="flex-center gap-xs">
                            <button
                              onClick={(e) => handleToggleSuspend(e, u.id)}
                              disabled={suspendLoading === u.id}
                              className={`btn-icon ${u.is_suspended ? 'danger' : 'muted'}`}
                              title={u.is_suspended ? 'Unsuspend Account' : 'Suspend Account'}
                            >
                              <Ban size={15} />
                            </button>
                            <ChevronRight size={16} className="text-muted" />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                          Isticmaale raadin ku habboon lama helin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="modal-overlay flex-center" onClick={() => setSelectedUser(null)}>
          <div className="modal-content w-md animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between pb-md border-b">
              <h3>Telegram User Profile</h3>
              <button className="btn-close" onClick={() => setSelectedUser(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body py-md flex flex-col gap-4">
              <div className="flex-center gap-md border-b pb-md">
                <div className="avatar-lg">{selectedUser.name.charAt(0).toUpperCase()}</div>
                <div>
                  <h4>{selectedUser.name}</h4>
                  <p className="text-muted">@{selectedUser.username}</p>
                  <span className={`badge ${selectedUser.is_suspended ? 'danger' : 'success'} mt-sm inline-block`}>
                    {selectedUser.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>WhatsApp Phone</div>
                  <strong>{selectedUser.whatsapp_number || 'None'}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>Wallet Balance</div>
                  <strong className="text-success">{selectedUser.balance} Credits</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>Telegram Chat ID</div>
                  <span className="font-mono text-xs">{selectedUser.telegram_chat_id}</span>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>Linked Timestamp</div>
                  <span>{new Date(selectedUser.linked_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>Voice / Image Logs</div>
                  <span>Voice: <strong>{selectedUser.voice_count}</strong> | Images: <strong>{selectedUser.img_count}</strong></span>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>Last Activity</div>
                  <span>{selectedUser.last_activity ? new Date(selectedUser.last_activity).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-sm mt-lg pt-md border-t">
                <button
                  onClick={(e) => { handleToggleSuspend(e, selectedUser.id); }}
                  disabled={suspendLoading === selectedUser.id}
                  className={`btn ${selectedUser.is_suspended ? 'btn-success' : 'btn-danger'} flex-center gap-sm`}
                >
                  <Ban size={16} />
                  <span>{selectedUser.is_suspended ? 'Unsuspend' : 'Suspend User'}</span>
                </button>
                <button className="btn" style={{ background: 'var(--border)' }} onClick={() => setSelectedUser(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
