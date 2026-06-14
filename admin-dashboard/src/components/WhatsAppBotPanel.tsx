import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
  MessageSquare, Users, Ban, DollarSign,
  RefreshCw, CheckCircle, AlertTriangle,
  Search, Eye, X, Phone, Wifi, WifiOff,
  TrendingUp, Image, Mic, Activity, Hash,
  ChevronRight, Globe, Clock, UserCheck
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

const formatNumber = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function WhatsAppBotPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'groups'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<WAUser[]>([]);
  const [groups, setGroups] = useState<WAGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<WAUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<WAGroup | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [suspendLoading, setSuspendLoading] = useState<number | null>(null);

  const token = localStorage.getItem('adminToken');
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/stats`, { headers: authHeaders });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/users`, { headers: authHeaders });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/groups`, { headers: authHeaders });
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await Promise.all([fetchStats(), fetchUsers(), fetchGroups()]);
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => { loadAllData(); }, []);

  const handleToggleSuspend = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    setSuspendLoading(userId);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast(data.message, 'success');
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: data.is_suspended } : u));
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, is_suspended: data.is_suspended } : null);
        }
      }
    } catch (err) {
      showToast('Cilad ayaa dhacday', 'danger');
    } finally {
      setSuspendLoading(null);
    }
  };

  const getBotStatusUI = (status: string) => {
    switch (status.toLowerCase()) {
      case 'connected':
      case 'active':
        return {
          icon: <Wifi size={16} />,
          label: 'Connected',
          color: 'var(--success)',
          bg: 'rgba(52,199,89,0.12)',
          pulse: true
        };
      case 'qr_ready':
        return {
          icon: <RefreshCw size={16} className="animate-spin" />,
          label: 'QR Ready',
          color: 'var(--warning)',
          bg: 'rgba(255,159,10,0.12)',
          pulse: false
        };
      case 'initializing':
        return {
          icon: <RefreshCw size={16} className="animate-spin" />,
          label: 'Initializing',
          color: 'var(--warning)',
          bg: 'rgba(255,159,10,0.12)',
          pulse: false
        };
      default:
        return {
          icon: <WifiOff size={16} />,
          label: 'Offline',
          color: 'var(--danger)',
          bg: 'rgba(255,69,58,0.12)',
          pulse: false
        };
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
    <div style={{ padding: '0', position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.type}`}
          style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 2000,
            padding: '12px 20px', borderRadius: '8px', fontWeight: 600,
            animation: 'slideInRight 0.3s ease',
            background: toast.type === 'success' ? 'rgba(52,199,89,0.15)' :
              toast.type === 'danger' ? 'rgba(255,69,58,0.15)' : 'rgba(10,132,255,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'var(--success)' :
              toast.type === 'danger' ? 'var(--danger)' : 'var(--primary)'}`,
            color: toast.type === 'success' ? 'var(--success)' :
              toast.type === 'danger' ? 'var(--danger)' : 'var(--primary)',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '28px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MessageSquare size={20} color="#fff" />
            </div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>WhatsApp Bot Dashboard</h2>
          </div>
          <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
            Dhammaan xogta la xidh labada bot — Local iyo Cloud. Live data.
          </p>
        </div>
        <button
          onClick={() => loadAllData(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: 'var(--text)', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, transition: 'all 0.2s'
          }}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        background: 'rgba(255,255,255,0.02)', padding: '4px',
        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)',
        width: 'fit-content', maxWidth: '100%', overflowX: 'auto', whiteSpace: 'nowrap'
      }}>
        {[
          { key: 'overview', label: 'Overview', icon: <Activity size={15} /> },
          { key: 'users', label: `Users (${users.length})`, icon: <Users size={15} /> },
          { key: 'groups', label: `Groups (${groups.length})`, icon: <Hash size={15} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
              background: activeTab === tab.key ? 'rgba(10,132,255,0.15)' : 'transparent',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
            }}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.05)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p className="text-muted" style={{ fontSize: '13px' }}>Soo qaadaya xogta WhatsApp Bot...</p>
        </div>
      ) : (
        <>
          {/* ══════════════ OVERVIEW TAB ══════════════ */}
          {activeTab === 'overview' && stats && (
            <div>
              {/* Bot Status Cards */}
              <div className="wabp-status-grid" style={{ marginBottom: '20px' }}>
                {[
                  { name: 'Local Bot', sub: 'Puppeteer Engine', status: stats.status.localBot },
                  { name: 'Cloud Bot', sub: 'Meta API Webhook', status: stats.status.cloudBot },
                ].map(bot => {
                  const ui = getBotStatusUI(bot.status);
                  return (
                    <div key={bot.name} style={{
                      padding: '20px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${ui.color}30`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{bot.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bot.sub}</div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 14px', borderRadius: '20px',
                        background: ui.bg, color: ui.color, fontWeight: 700, fontSize: '13px'
                      }}>
                        {ui.pulse && (
                          <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: ui.color, animation: 'pulse 2s infinite'
                          }} />
                        )}
                        {ui.icon}
                        {ui.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Key Metrics Row */}
              <div className="wabp-metrics-grid" style={{ marginBottom: '20px' }}>
                {[
                  {
                    icon: <UserCheck size={20} />, label: 'Users Today',
                    value: formatNumber(stats.todayUsersCount),
                    sub: 'Unique chats today', color: 'var(--primary)',
                    bg: 'rgba(10,132,255,0.1)'
                  },
                  {
                    icon: <Users size={20} />, label: 'Active Groups',
                    value: `${stats.groups.active}/${stats.groups.total}`,
                    sub: 'Active / Total', color: '#25D366',
                    bg: 'rgba(37,211,102,0.1)'
                  },
                  {
                    icon: <DollarSign size={20} />, label: 'Gemini Cost',
                    value: `$${stats.geminiCost.toFixed(4)}`,
                    sub: 'Total API spend', color: 'var(--danger)',
                    bg: 'rgba(255,69,58,0.1)'
                  },
                  {
                    icon: <TrendingUp size={20} />, label: 'DAU',
                    value: formatNumber(stats.activeUsers.daily),
                    sub: 'Daily active users', color: 'var(--warning)',
                    bg: 'rgba(255,159,10,0.1)'
                  },
                ].map(m => (
                  <div key={m.label} style={{
                    padding: '20px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: m.bg, color: m.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '14px'
                    }}>
                      {m.icon}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: m.color, lineHeight: 1 }}>
                      {m.value}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Message Volume Breakdown */}
              <div style={{
                padding: '24px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <MessageSquare size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Message Volume</h3>
                </div>
                <div className="wabp-volume-grid">
                  {[
                    {
                      period: 'Last 24h', in: stats.messages.user_24h || 0,
                      out: stats.messages.ai_24h || 0
                    },
                    {
                      period: 'Last 48h', in: stats.messages.user_48h || 0,
                      out: stats.messages.ai_48h || 0
                    },
                    {
                      period: 'Last 7 Days', in: stats.messages.user_7d || 0,
                      out: stats.messages.ai_7d || 0
                    },
                    {
                      period: 'Last 30 Days', in: stats.messages.user_30d || 0,
                      out: stats.messages.ai_30d || 0
                    },
                  ].map(p => {
                    const numIn = Number(p.in) || 0;
                    const numOut = Number(p.out) || 0;
                    const total = numIn + numOut;
                    const inPct = total > 0 ? Math.round((numIn / total) * 100) : 50;
                    return (
                      <div key={p.period} style={{
                        padding: '16px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px' }}>
                          {p.period}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                          {formatNumber(total)}
                        </div>
                        {/* Progress bar */}
                        <div style={{
                          height: '5px', borderRadius: '3px',
                          background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: '8px'
                        }}>
                          <div style={{
                            height: '100%', width: `${inPct}%`,
                            background: 'linear-gradient(90deg, var(--primary), #25D366)',
                            borderRadius: '3px', transition: 'width 0.8s ease'
                          }} />
                        </div>
                        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--primary)' }}>📥 {formatNumber(p.in)} in</span>
                          <span style={{ color: '#25D366' }}>📤 {formatNumber(p.out)} out</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User Engagement (DAU/MAU/YAU) */}
              <div style={{
                padding: '24px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <Globe size={18} color="var(--success)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>User Engagement (WhatsApp)</h3>
                </div>
                <div className="wabp-engagement-grid">
                  {[
                    { label: 'Daily Active (DAU)', value: stats.activeUsers.daily, sub: 'Active today', color: 'var(--primary)' },
                    { label: 'Monthly Active (MAU)', value: stats.activeUsers.monthly, sub: 'Active this month', color: 'var(--success)' },
                    { label: 'Yearly Active (YAU)', value: stats.activeUsers.yearly, sub: 'Active this year', color: 'var(--warning)' },
                  ].map(m => (
                    <div key={m.label} style={{
                      padding: '20px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: m.color }}>{formatNumber(m.value)}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '6px' }}>{m.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{m.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ USERS TAB ══════════════ */}
          {activeTab === 'users' && (
            <div>
              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '16px'
              }}>
                <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Ka raadi magac, username, ama nambarka WhatsApp..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text)',
                    outline: 'none', width: '100%', fontSize: '14px'
                  }}
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Summary bar */}
              <div className="wabp-users-summary-grid" style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '14px 18px', borderRadius: '10px',
                  background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.15)',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <Users size={16} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{users.length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total WA Users</div>
                  </div>
                </div>
                <div style={{
                  padding: '14px 18px', borderRadius: '10px',
                  background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.15)',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <CheckCircle size={16} color="var(--success)" />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{users.filter(u => !u.is_suspended).length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Users</div>
                  </div>
                </div>
                <div style={{
                  padding: '14px 18px', borderRadius: '10px',
                  background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.15)',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <Ban size={16} color="var(--danger)" />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{users.filter(u => u.is_suspended).length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Suspended</div>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div style={{
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden', background: 'rgba(255,255,255,0.01)'
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table" style={{ minWidth: '750px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <th>Isticmaalaha</th>
                        <th>Nambarka</th>
                        <th>Role</th>
                        <th>Credits</th>
                        <th style={{ textAlign: 'center' }}>📥 Bot-ga</th>
                        <th style={{ textAlign: 'center' }}>📤 Bot-ka</th>
                        <th style={{ textAlign: 'center' }}>🖼 Sawiro</th>
                        <th style={{ textAlign: 'center' }}>🎙 Cod</th>
                        <th style={{ textAlign: 'center' }}>Faahfaahin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr
                          key={u.id}
                          style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                          onClick={() => setSelectedUser(u)}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '14px', fontWeight: 700, flexShrink: 0,
                                background: u.is_suspended ? 'rgba(255,69,58,0.12)' : 'rgba(10,132,255,0.12)',
                                color: u.is_suspended ? 'var(--danger)' : 'var(--primary)'
                              }}>
                                {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{u.name || 'Unknown'}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{u.username}</div>
                              </div>
                              {u.is_suspended ? (
                                <span style={{
                                  fontSize: '9px', padding: '2px 7px', borderRadius: '10px',
                                  background: 'rgba(255,69,58,0.12)', color: 'var(--danger)', fontWeight: 700
                                }}>BANNED</span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                              <Phone size={11} style={{ color: 'var(--text-muted)' }} />
                              {u.whatsapp_number || '—'}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 700,
                              background: (u.role === 'admin' || u.role === 'superadmin') ? 'rgba(255,69,58,0.12)' : 'rgba(10,132,255,0.12)',
                              color: (u.role === 'admin' || u.role === 'superadmin') ? 'var(--danger)' : 'var(--primary)'
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{u.balance}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{u.msg_to_bot}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#25D366' }}>{u.msg_from_bot}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{u.img_count}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{u.voice_count}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedUser(u)}
                                style={{
                                  width: '30px', height: '30px', borderRadius: '6px', border: 'none',
                                  background: 'rgba(10,132,255,0.1)', color: 'var(--primary)',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="View Details"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={(e) => handleToggleSuspend(e, u.id)}
                                disabled={suspendLoading === u.id}
                                style={{
                                  width: '30px', height: '30px', borderRadius: '6px', border: 'none',
                                  background: u.is_suspended ? 'rgba(52,199,89,0.1)' : 'rgba(255,69,58,0.1)',
                                  color: u.is_suspended ? 'var(--success)' : 'var(--danger)',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title={u.is_suspended ? 'Unsuspend' : 'Suspend'}
                              >
                                {suspendLoading === u.id ? <RefreshCw size={13} className="animate-spin" /> : <Ban size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            Ma jiraan isticmaalayaal la helay
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ GROUPS TAB ══════════════ */}
          {activeTab === 'groups' && (
            <div>
              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '16px'
              }}>
                <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Ka raadi magaca group-ka ama Group ID..."
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text)',
                    outline: 'none', width: '100%', fontSize: '14px'
                  }}
                />
                {groupSearch && (
                  <button
                    onClick={() => setGroupSearch('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Groups summary */}
              <div className="wabp-groups-summary-grid" style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '14px 18px', borderRadius: '10px',
                  background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <CheckCircle size={16} style={{ color: '#25D366' }} />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{groups.filter(g => g.status === 'active').length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Groups</div>
                  </div>
                </div>
                <div style={{
                  padding: '14px 18px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <Hash size={16} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{groups.reduce((s, g) => s + (g.bot_message_count || 0), 0)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Messages Sent</div>
                  </div>
                </div>
              </div>

              {/* Groups Table */}
              <div style={{
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden', background: 'rgba(255,255,255,0.01)'
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <th>Group Name</th>
                        <th>Group ID</th>
                        <th style={{ textAlign: 'center' }}>📣 Mentions</th>
                        <th style={{ textAlign: 'center' }}>💬 Bot Messages</th>
                        <th>Status</th>
                        <th>Last Active</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroups.map((g) => (
                        <tr
                          key={g.group_id}
                          style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                          onClick={() => setSelectedGroup(g)}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                background: g.status === 'active' ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: g.status === 'active' ? '#25D366' : 'var(--text-muted)', flexShrink: 0
                              }}>
                                <Hash size={16} />
                              </div>
                              <strong style={{ fontSize: '13px' }}>{g.group_name}</strong>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {g.group_id.substring(0, 20)}...
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--warning)' }}>
                            {g.bot_mention_count}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                            {g.bot_message_count}
                          </td>
                          <td>
                            <span style={{
                              fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 700,
                              background: g.status === 'active' ? 'rgba(37,211,102,0.12)' : 'rgba(255,69,58,0.12)',
                              color: g.status === 'active' ? '#25D366' : 'var(--danger)'
                            }}>
                              {g.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={11} />{timeAgo(g.last_activity)}
                            </div>
                          </td>
                          <td>
                            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                          </td>
                        </tr>
                      ))}
                      {filteredGroups.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            Ma jiraan group-yo la helay
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

      {/* ══════════════ USER DETAILS MODAL ══════════════ */}
      {selectedUser && (
        <div
          onClick={() => setSelectedUser(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1500, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '520px', maxWidth: '100%',
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              overflow: 'hidden',
              animation: 'slideUp 0.25s ease'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px', height: '46px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 800,
                  background: selectedUser.is_suspended ? 'rgba(255,69,58,0.15)' : 'rgba(10,132,255,0.15)',
                  color: selectedUser.is_suspended ? 'var(--danger)' : 'var(--primary)'
                }}>
                  {selectedUser.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{selectedUser.name || 'Unknown'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{selectedUser.username}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Info rows */}
              {[
                { label: 'Phone Number', value: <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} />{selectedUser.whatsapp_number || 'N/A'}</span> },
                { label: 'Role', value: <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 700, background: 'rgba(10,132,255,0.12)', color: 'var(--primary)' }}>{selectedUser.role}</span> },
                { label: 'Status', value: <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 700, background: selectedUser.is_suspended ? 'rgba(255,69,58,0.12)' : 'rgba(52,199,89,0.12)', color: selectedUser.is_suspended ? 'var(--danger)' : 'var(--success)' }}>{selectedUser.is_suspended ? '🚫 Suspended' : '✅ Active'}</span> },
                { label: 'Credits Balance', value: <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '16px' }}>{selectedUser.balance}</span> },
                { label: 'Subscription', value: selectedUser.plan_type ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 700, background: 'rgba(52,199,89,0.12)', color: 'var(--success)' }}>{selectedUser.plan_type.includes('11') ? '⭐ Premium' : '📦 Basic'}</span> : 'None (Pay-As-You-Go)' },
                ...(selectedUser.expiry_date ? [{ label: 'Sub Expiry', value: new Date(selectedUser.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }] : []),
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}

              {/* Bot Interactions */}
              <div style={{
                marginTop: '20px', padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bot Interactions
                </div>
                <div className="wabp-interactions-grid">
                  {[
                    { icon: <MessageSquare size={16} />, label: 'Sent to Bot', value: selectedUser.msg_to_bot, color: 'var(--primary)' },
                    { icon: <MessageSquare size={16} />, label: 'Received from Bot', value: selectedUser.msg_from_bot, color: '#25D366' },
                    { icon: <Image size={16} />, label: 'Images Sent', value: selectedUser.img_count, color: 'var(--warning)' },
                    { icon: <Mic size={16} />, label: 'Voice Notes', value: selectedUser.voice_count, color: 'var(--danger)' },
                  ].map(m => (
                    <div key={m.label} style={{
                      padding: '12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: m.color, marginBottom: '4px' }}>{m.icon}</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: '10px', justifyContent: 'flex-end',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button
                onClick={(e) => handleToggleSuspend(e, selectedUser.id)}
                disabled={suspendLoading === selectedUser.id}
                style={{
                  padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '13px', transition: 'all 0.2s',
                  background: selectedUser.is_suspended ? 'var(--success)' : 'var(--danger)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {suspendLoading === selectedUser.id ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
                {selectedUser.is_suspended ? 'Unsuspend' : 'Suspend'}
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  padding: '9px 18px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'none', color: 'var(--text)',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                }}
              >
                Xidh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ GROUP DETAILS MODAL ══════════════ */}
      {selectedGroup && (
        <div
          onClick={() => setSelectedGroup(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1500, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '480px', maxWidth: '100%',
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px', overflow: 'hidden',
              animation: 'slideUp 0.25s ease'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px', height: '46px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selectedGroup.status === 'active' ? 'rgba(37,211,102,0.15)' : 'rgba(255,69,58,0.15)',
                  color: selectedGroup.status === 'active' ? '#25D366' : 'var(--danger)'
                }}>
                  <Hash size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{selectedGroup.group_name}</div>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 700,
                    background: selectedGroup.status === 'active' ? 'rgba(37,211,102,0.12)' : 'rgba(255,69,58,0.12)',
                    color: selectedGroup.status === 'active' ? '#25D366' : 'var(--danger)'
                  }}>
                    {selectedGroup.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Group ID */}
              <div style={{
                padding: '12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                marginBottom: '20px', fontFamily: 'monospace', fontSize: '11px',
                color: 'var(--text-muted)', wordBreak: 'break-all'
              }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>Group ID (JID)</span>
                {selectedGroup.group_id}
              </div>

              {/* Stats Grid */}
              <div className="wabp-group-stats-grid" style={{ marginBottom: '20px' }}>
                {[
                  { label: 'Times Mentioned', value: selectedGroup.bot_mention_count, icon: <AlertTriangle size={18} />, color: 'var(--warning)', sub: '@mention count' },
                  { label: 'Bot Messages', value: selectedGroup.bot_message_count, icon: <MessageSquare size={18} />, color: 'var(--primary)', sub: 'Messages sent by bot' },
                ].map(m => (
                  <div key={m.label} style={{
                    padding: '18px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: m.color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{m.icon}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>{m.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Last activity */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} /> Last Activity
                </span>
                <strong style={{ fontSize: '13px' }}>
                  {selectedGroup.last_activity
                    ? new Date(selectedGroup.last_activity).toLocaleString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                    : 'N/A'}
                </strong>
              </div>

              {/* Note about mentions */}
              <div style={{
                marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
                background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)',
                fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6
              }}>
                ℹ️ <strong style={{ color: 'var(--warning)' }}>Note:</strong> Bot-ku group-ka wuxuu kaliya ka jawaabaa marka sawir la diro. @mention ama qoraal kaliya lama jawaabo — taas waxay ka ilaalinaysaa spam.
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'flex-end',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button
                onClick={() => setSelectedGroup(null)}
                style={{
                  padding: '9px 20px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'none', color: 'var(--text)',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                }}
              >
                Xidh
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        /* Responsive Grid layouts */
        .wabp-status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .wabp-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .wabp-volume-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .wabp-engagement-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .wabp-users-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .wabp-groups-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .wabp-interactions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .wabp-group-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 768px) {
          .wabp-status-grid {
            grid-template-columns: 1fr;
          }
          .wabp-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .wabp-volume-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .wabp-engagement-grid {
            grid-template-columns: 1fr;
          }
          .wabp-users-summary-grid {
            grid-template-columns: 1fr;
          }
          .wabp-groups-summary-grid {
            grid-template-columns: 1fr;
          }
          .wabp-group-stats-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .wabp-metrics-grid {
            grid-template-columns: 1fr;
          }
          .wabp-volume-grid {
            grid-template-columns: 1fr;
          }
          .wabp-interactions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
