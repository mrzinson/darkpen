import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { TrendingUp, DollarSign, Cpu, Calendar, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ReportsPanel() {
  const [range, setRange] = useState('30');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/reports?range=${range}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const reportData = await res.json();
        setData(reportData);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [range]);

  if (loading) {
    return (
      <div className="panel-container flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="animate-spin text-primary" size={32} />
        <p className="text-muted">Soo qaadaya xogta warbixinta (Loading reports)...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel-container">
        <h2>Financial & Usage Reports</h2>
        <p className="text-muted">Cilad ayaa dhacday soo qaadista xogta.</p>
        <button className="btn primary" onClick={fetchReportData}>Isku day mar kale</button>
      </div>
    );
  }

  const { summary, recentTransactions, signupChartData } = data;

  return (
    <div className="panel-container">
      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>Financial & Usage Reports</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            La soco faa'idada nadiifta ah ee app-ka, signups-ka cusub iyo lacag-bixinnada isticmaalayaasha.
          </p>
        </div>
        
        {/* Timeframe selector */}
        <div className="flex-center" style={{ gap: '10px' }}>
          <Calendar size={18} className="text-muted" />
          <select 
            value={range} 
            onChange={(e) => setRange(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              outline: 'none',
              fontWeight: 600
            }}
          >
            <option value="7">Todobaadkii u dambeeyay (7 Days)</option>
            <option value="30">30-kii casho ee u dambeeyay (30 Days)</option>
            <option value="60">60-kii casho ee u dambeeyay (60 Days)</option>
            <option value="90">90-kii casho ee u dambeeyay (90 Days)</option>
            <option value="all">Waligeedba (All Time)</option>
          </select>
          <button className="icon-btn primary" onClick={fetchReportData} title="Refresh Report">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        {/* Total Revenue */}
        <div className="stat-card">
          <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <DollarSign size={16} className="text-success" /> Total Revenue
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            ${parseFloat(summary.totalRevenue || 0).toLocaleString()}
          </div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Lacagtii la ansixiyay ee soo gashay
          </div>
        </div>

        {/* AI Cost */}
        <div className="stat-card">
          <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <Cpu size={16} className="text-danger" /> Total AI Cost
          </div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            ${parseFloat(summary.totalAICost || 0).toFixed(4)}
          </div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Kharashka API keys-ka ee baxay
          </div>
        </div>

        {/* Net Profit */}
        <div className="stat-card" style={{ background: 'rgba(50, 215, 75, 0.02)', border: '1px solid rgba(50, 215, 75, 0.15)' }}>
          <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <TrendingUp size={16} className="text-success" /> Net Profit
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            ${parseFloat(summary.netProfit || 0).toFixed(4)}
          </div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Revenue ka dib markii laga gooyay AI cost
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>New Signups</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>{summary.newUsers}</div>
          <span className="badge primary" style={{ fontSize: '10px', padding: '2px 8px' }}>Users joined</span>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Approved Transactions</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>{summary.approvedPaymentsCount}</div>
          <span className="badge success" style={{ fontSize: '10px', padding: '2px 8px' }}>Payments processed</span>
        </div>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Active AI Chatters</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>{summary.activeAIChats}</div>
          <span className="badge warning" style={{ fontSize: '10px', padding: '2px 8px' }}>Unique chatters</span>
        </div>
      </div>

      {/* Chart and Table Grid */}
      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Signups Chart */}
        <div className="card">
          <h3>User Signups Growth</h3>
          <div style={{ height: '260px', marginTop: '20px' }}>
            {signupChartData && signupChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signupChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#8884d8" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#8884d8" style={{ fontSize: '11px' }} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.1} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Area type="monotone" dataKey="users" stroke="var(--primary)" fillOpacity={0.15} fill="var(--primary)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-center" style={{ height: '100%', color: 'var(--muted)' }}>No signup data available for selected timeframe</div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <h3 style={{ padding: '16px 20px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Recent Payments Audit</h3>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }} className="custom-scrollbar">
            <table className="admin-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px' }}>User</th>
                  <th style={{ padding: '10px 16px' }}>Amount</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px' }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions && recentTransactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td style={{ padding: '10px 16px' }}>
                      <strong>{tx.user_name}</strong>
                      <div className="text-muted" style={{ fontSize: '10px' }}>{tx.user_email || 'no email'}</div>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 'bold', color: tx.status === 'approved' ? 'var(--success)' : 'inherit' }}>
                      ${tx.amount}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span className={`badge ${tx.status === 'approved' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '11px' }}>{tx.reference_number}</td>
                  </tr>
                ))}
                {(!recentTransactions || recentTransactions.length === 0) && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }} className="text-muted">No transactions found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
