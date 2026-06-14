import { useEffect, useRef, useState } from 'react';
import { Check, X, Bell, RefreshCw, DollarSign, Clock, User, Hash, Copy } from 'lucide-react';
import { API_URL } from '../config';

// Pleasant sound alert on new payments using Web Audio API
const playNotifSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
    
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.error('Failed to play sound', e);
  }
};

// Copy button helper component
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'none', border: 'none', color: copied ? 'var(--success)' : 'var(--text-muted)',
        cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center',
        marginLeft: '6px', transition: 'color 0.2s', verticalAlign: 'middle'
      }}
      title="Koobi garee Reference-ka"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

interface Payment {
  id: number;
  user_name: string;
  user_email: string;
  reference_number: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  service_type?: string;
  created_at: string;
}

// Request browser notification permission once
const requestNotifPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const sendBrowserNotif = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'payment-alert',
      requireInteraction: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
  }
};

export default function PaymentsPanel() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(Notification.permission === 'granted');
  const [newBadge, setNewBadge] = useState(0);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const prevPendingIds = useRef<Set<number>>(new Set());
  const isInitialLoad = useRef(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = localStorage.getItem('adminToken');
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  const showToast = (msg: string, type: 'success' | 'danger' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPayments = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/payments`, { headers: authHeaders });
      const data: Payment[] = await res.json();
      const arr = Array.isArray(data) ? data : [];

      // Detect NEW pending payments since last fetch
      const currentPendingIds = new Set(arr.filter(p => p.status === 'pending').map(p => p.id));
      
      // If it is not the initial page load, alert the user about any new pending payments
      if (!isInitialLoad.current) {
        const newOnes = arr.filter(p => p.status === 'pending' && !prevPendingIds.current.has(p.id));
        if (newOnes.length > 0) {
          newOnes.forEach(p => {
            sendBrowserNotif(
              `💰 New Payment Request!`,
              `${p.user_name} sent $${p.amount} — Ref: ${p.reference_number}`
            );
          });
          playNotifSound();
          setNewBadge(prev => prev + newOnes.length);
        }
      }

      prevPendingIds.current = currentPendingIds;
      isInitialLoad.current = false;
      setPayments(arr);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    requestNotifPermission().then(() => {
      setNotifEnabled(Notification.permission === 'granted');
    });
    fetchPayments();

    // Poll every 30 seconds for new payments
    pollingRef.current = setInterval(() => fetchPayments(true), 30000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleEnableNotifs = async () => {
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
    if (perm === 'granted') showToast('Notifications enabled! You will be alerted on new payments.', 'success');
    else showToast('Notification permission denied.', 'danger');
  };

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/admin/payments/${id}/${action}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Payment ${action}d successfully`, 'success');
        await fetchPayments(true);
      } else {
        showToast(data.message || 'Action failed', 'danger');
      }
    } catch (err) {
      showToast('Network error', 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = payments.filter(p => filter === 'all' || p.status === filter);
  const pendingCount = payments.filter(p => p.status === 'pending').length;

  const statusColor = (s: string) =>
    s === 'approved' ? { bg: 'rgba(52,199,89,0.12)', color: 'var(--success)' } :
    s === 'pending'  ? { bg: 'rgba(255,159,10,0.12)', color: 'var(--warning)' } :
                       { bg: 'rgba(255,69,58,0.12)', color: 'var(--danger)' };

  return (
    <div style={{ padding: 0, position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 2000,
          padding: '12px 20px', borderRadius: '8px', fontWeight: 600,
          animation: 'slideInRight 0.3s ease',
          background: toast.type === 'success' ? 'rgba(52,199,89,0.15)' : 'rgba(255,69,58,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(255,159,10,0.3), rgba(255,69,58,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <DollarSign size={20} color="var(--warning)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Payment Requests</h2>
            </div>
            {pendingCount > 0 && (
              <div style={{
                minWidth: '24px', height: '24px', borderRadius: '12px', padding: '0 8px',
                background: 'var(--danger)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 800, animation: 'pulse 2s infinite'
              }}>
                {pendingCount}
              </div>
            )}
          </div>
          <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
            Automatic polling every 30s • Browser notifications enabled when approved
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Notification toggle */}
          {!notifEnabled ? (
            <button
              onClick={handleEnableNotifs}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px', borderRadius: '8px', cursor: 'pointer',
                background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)',
                color: 'var(--warning)', fontWeight: 700, fontSize: '13px'
              }}
            >
              <Bell size={15} /> Enable Notifications
            </button>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '8px',
              background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)',
              color: 'var(--success)', fontWeight: 600, fontSize: '13px'
            }}>
              <Bell size={14} /> Notifications ON
              {newBadge > 0 && (
                <span style={{
                  background: 'var(--danger)', color: '#fff',
                  borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 800
                }}>{newBadge} new</span>
              )}
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => { setNewBadge(0); fetchPayments(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text)', fontWeight: 600, fontSize: '13px'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Pending', count: payments.filter(p => p.status === 'pending').length, color: 'var(--warning)', bg: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.2)' },
          { label: 'Approved', count: payments.filter(p => p.status === 'approved').length, color: 'var(--success)', bg: 'rgba(52,199,89,0.1)', border: 'rgba(52,199,89,0.2)' },
          { label: 'Rejected', count: payments.filter(p => p.status === 'rejected').length, color: 'var(--danger)', bg: 'rgba(255,69,58,0.1)', border: 'rgba(255,69,58,0.2)' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '16px 20px', borderRadius: '12px',
            background: s.bg, border: `1px solid ${s.border}`,
            cursor: 'pointer', transition: 'all 0.2s',
            outline: filter === s.label.toLowerCase() ? `2px solid ${s.color}` : 'none'
          }} onClick={() => setFilter(filter === s.label.toLowerCase() as any ? 'all' : s.label.toLowerCase() as any)}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: s.color, marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        background: 'rgba(255,255,255,0.02)', padding: '4px',
        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)',
        width: 'fit-content'
      }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, transition: 'all 0.2s', textTransform: 'capitalize',
            background: filter === f ? 'rgba(10,132,255,0.15)' : 'transparent',
            color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && payments.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', gap: '12px', flexDirection: 'column' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.05)',
            borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite'
          }} />
          <span className="text-muted" style={{ fontSize: '13px' }}>Loading payments...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px', color: 'var(--text-muted)',
          borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <DollarSign size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ margin: 0 }}>No {filter !== 'all' ? filter : ''} payments found</p>
        </div>
      ) : (
        <div style={{
          borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden', background: 'rgba(255,255,255,0.01)'
        }}>
          {/* Mobile card view */}
          <div className="payments-mobile-cards">
            {filtered.map(p => (
              <div key={p.id} style={{
                padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'none'
              }} className="payment-mobile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.user_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.user_email}</div>
                  </div>
                  <span style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 700,
                    ...statusColor(p.status)
                  }}>{p.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Amount</span><strong>${p.amount}</strong></div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Ref</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', display: 'inline-flex', alignItems: 'center' }}>
                      {p.reference_number}
                      <CopyButton text={p.reference_number} />
                    </span>
                  </div>
                </div>
                {p.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleAction(p.id, 'approve')}
                      disabled={actionLoading === p.id}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: 'var(--success)', color: '#fff', cursor: 'pointer',
                        fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      {actionLoading === p.id ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Approve
                    </button>
                    <button
                      onClick={() => handleAction(p.id, 'reject')}
                      disabled={actionLoading === p.id}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: 'rgba(255,69,58,0.12)', color: 'var(--danger)', cursor: 'pointer',
                        fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} />User</div></th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Hash size={13} />Reference</div></th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={13} />Amount</div></th>
                  <th>Status</th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={13} />Date</div></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const sc = statusColor(p.status);
                  return (
                    <tr key={p.id} style={{ transition: 'background 0.15s' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: 'rgba(10,132,255,0.1)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 700, flexShrink: 0
                          }}>
                            {p.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.user_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.user_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}>
                          {p.reference_number}
                          <CopyButton text={p.reference_number} />
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--success)' }}>
                          ${p.amount}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px', padding: '4px 12px', borderRadius: '12px',
                          fontWeight: 700, ...sc
                        }}>
                          {p.status === 'pending' && '⏳ '}{p.status === 'approved' && '✅ '}{p.status === 'rejected' && '❌ '}
                          {p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'N/A'}
                      </td>
                      <td>
                        {p.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleAction(p.id, 'approve')}
                              disabled={actionLoading === p.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '7px 14px', borderRadius: '7px', border: 'none',
                                background: 'var(--success)', color: '#fff', cursor: 'pointer',
                                fontWeight: 700, fontSize: '12px'
                              }}
                            >
                              {actionLoading === p.id ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(p.id, 'reject')}
                              disabled={actionLoading === p.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '7px 14px', borderRadius: '7px', border: 'none',
                                background: 'rgba(255,69,58,0.12)', color: 'var(--danger)', cursor: 'pointer',
                                fontWeight: 700, fontSize: '12px'
                              }}
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 1s linear infinite; }

        @media (max-width: 640px) {
          .payment-mobile-card { display: block !important; }
          table.admin-table { display: none; }
        }
      `}</style>
    </div>
  );
}
