import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { Bot, Cpu, DollarSign, RefreshCw, MessageSquare } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AIStatsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAIStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/ai-stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const resData = await res.json();
      setData(resData);
    } catch (err) {
      console.error('Error fetching AI stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIStats();
  }, []);

  if (loading) {
    return (
      <div className="panel-container flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="animate-spin text-primary" size={32} />
        <p className="text-muted">Soo qaadaya xogta AI-ga (Loading AI stats)...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel-container">
        <h2>AI Chat Stats</h2>
        <p className="text-muted">Cilad ayaa dhacday soo qaadista xogta.</p>
        <button className="btn primary" onClick={fetchAIStats}>Isku day mar kale</button>
      </div>
    );
  }

  const { summary, models, chatTypes, topUsers, chartData } = data;

  return (
    <div className="panel-container">
      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>AI Chat Stats & Costs</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            La soco tokens-ka iyo kharashka ka baxa OpenAI & Gemini si looga hortago khasaare.
          </p>
        </div>
        <button className="icon-btn primary" onClick={fetchAIStats} title="Refresh Stats">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <MessageSquare size={16} className="text-primary" /> Total AI Requests
          </div>
          <div className="stat-value">{summary.totalRequests || 0}</div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>Wada-sheekaysi guud</div>
        </div>

        <div className="stat-card">
          <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <Cpu size={16} className="text-warning" /> Total Tokens used
          </div>
          <div className="stat-value">
            {new Intl.NumberFormat('en-US', { notation: 'compact' }).format((parseInt(summary.totalPromptTokens) || 0) + (parseInt(summary.totalCompletionTokens) || 0))}
          </div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            {new Intl.NumberFormat().format(parseInt(summary.totalPromptTokens) || 0)} in / {new Intl.NumberFormat().format(parseInt(summary.totalCompletionTokens) || 0)} out
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid rgba(255, 69, 58, 0.2)' }}>
          <div className="stat-title flex-center" style={{ justifyContent: 'flex-start', gap: '8px' }}>
            <DollarSign size={16} className="text-danger" /> Total AI Cost
          </div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            ${parseFloat(summary.totalCost || 0).toFixed(4)}
          </div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>Kharashka API-da ee baxay</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid-2 mb-lg" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h3>Daily AI Cost (Last 15 Days)</h3>
          <div style={{ height: '260px', marginTop: '20px' }}>
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#8884d8" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#8884d8" style={{ fontSize: '11px' }} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.1} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Area type="monotone" dataKey="cost" stroke="var(--danger)" fillOpacity={0.15} fill="var(--danger)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-center" style={{ height: '100%', color: 'var(--muted)' }}>No historical logs available</div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Usage by Service Type</h3>
          <div className="list-container" style={{ marginTop: '20px' }}>
            {chatTypes && chatTypes.map((item: any) => (
              <div key={item.chatType} className="list-item" style={{ padding: '16px 12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ textTransform: 'capitalize' }}>
                    {item.chatType === 'shukaansi' ? '❤️ Shukaansi AI' : '📚 Education AI'}
                  </strong>
                  <span className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                    {item.requests} requests
                  </span>
                </div>
                <strong style={{ color: 'var(--danger)' }}>${parseFloat(item.cost || 0).toFixed(4)}</strong>
              </div>
            ))}
            {(!chatTypes || chatTypes.length === 0) && <p className="text-muted">No service data</p>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Model Breakdown */}
        <div className="card">
          <h3>Model Breakdown & Performance</h3>
          <div className="list-container" style={{ marginTop: '15px' }}>
            {models && models.map((model: any) => (
              <div key={model.modelName} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={16} className="text-primary" />
                    <strong>{model.modelName}</strong>
                  </div>
                  <span className="badge danger" style={{ fontSize: '10px' }}>
                    ${parseFloat(model.cost || 0).toFixed(4)}
                  </span>
                </div>
                <div className="flex-between text-muted" style={{ fontSize: '11px' }}>
                  <span>Requests: {model.requests}</span>
                  <span>Tokens: {new Intl.NumberFormat().format((parseInt(model.promptTokens) || 0) + (parseInt(model.completionTokens) || 0))}</span>
                </div>
              </div>
            ))}
            {(!models || models.length === 0) && <p className="text-muted">No model statistics</p>}
          </div>
        </div>

        {/* Top AI Consumers */}
        <div className="card">
          <h3>Top Users by AI Consumption</h3>
          <div className="list-container" style={{ marginTop: '15px' }}>
            {topUsers && topUsers.map((u: any, index: number) => (
              <div key={u.id} className="list-item" style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="avatar-sm" style={{ backgroundColor: 'var(--surface-light)', color: 'var(--primary)', width: '28px', height: '28px', fontSize: '12px' }}>
                    #{index + 1}
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px' }}>{u.name}</strong>
                    <div className="text-muted" style={{ fontSize: '11px' }}>@{u.username || 'user'} • {u.requests} chats</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--danger)' }}>${parseFloat(u.cost || 0).toFixed(4)}</strong>
                  <div className="text-muted" style={{ fontSize: '10px' }}>
                    {new Intl.NumberFormat('en-US', { notation: 'compact' }).format((parseInt(u.promptTokens) || 0) + (parseInt(u.completionTokens) || 0))} tokens
                  </div>
                </div>
              </div>
            ))}
            {(!topUsers || topUsers.length === 0) && <p className="text-muted">No data available</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
