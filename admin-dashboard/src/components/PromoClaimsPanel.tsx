import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
  Check, X, Mail, RotateCcw,
  Copy, Image as ImageIcon, ExternalLink, Award
} from 'lucide-react';

export default function PromoClaimsPanel() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/promo-claims`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setClaims(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista dalabyada", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard!", "info");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleApprove = async (claimId: number) => {
    if (!confirm("Ma hubtaa inaad ansixinayso dalabkan si user-ka loo siiyo credit-ka?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/promo-claims/${claimId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Dalabkii waa la ansixiyey!", "success");
        fetchClaims();
      } else {
        showToast(data.message || "Cilad ayaa dhacday", "danger");
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad dhinaca server-ka ah", "danger");
    }
  };

  const handleReject = async (claimId: number) => {
    if (!confirm("Ma hubtaa inaad diidayso dalabkan? Qofku wuxuu dib u soo diri karaa screenshot sax ah.")) return;
    try {
      const res = await fetch(`${API_URL}/admin/promo-claims/${claimId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Dalabkii waa la diiday, waana la tirtiray!", "info");
        fetchClaims();
      } else {
        showToast(data.message || "Cilad ayaa dhacday", "danger");
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad dhinaca server-ka ah", "danger");
    }
  };

  const filteredClaims = claims.filter(c =>
    c.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    c.promo_title_so?.toLowerCase().includes(search.toLowerCase()) ||
    c.promo_title_en?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="panel-container" style={{ position: 'relative' }}>

      {/* Premium Alert Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: toast.type === 'success' ? 'rgba(50, 215, 75, 0.15)' : toast.type === 'danger' ? 'rgba(255, 69, 58, 0.15)' : 'rgba(10, 132, 255, 0.15)',
          border: `1px solid ${toast.type === 'success' ? 'var(--success)' : toast.type === 'danger' ? 'var(--danger)' : 'var(--primary)'}`,
          color: toast.type === 'success' ? 'var(--success)' : toast.type === 'danger' ? 'var(--danger)' : 'var(--primary)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>Promo Claims Verification</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>Hubi sawirada (screenshots) ee ay users-ku soo gudbiyeen si aad u ansixiso abaalmarintooda.</p>
        </div>
        <div className="flex-center" style={{ gap: '12px' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Baadh magac, email ama promo..."
              className="admin-input"
              style={{ padding: '8px 12px', width: '260px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', color: '#FFF' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn primary" onClick={fetchClaims} title="Refresh Claims">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-title">Pending Verification</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {claims.filter(c => c.status === 'pending').length}
          </div>
          <div className="badge warning" style={{ marginTop: '8px', display: 'inline-block' }}>Awaiting Action</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Approved Rewards</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {claims.filter(c => c.status === 'approved').length}
          </div>
          <div className="badge success" style={{ marginTop: '8px', display: 'inline-block' }}>Prizes Distributed</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Claims Submitted</div>
          <div className="stat-value">{claims.length}</div>
          <div className="badge primary" style={{ marginTop: '8px', display: 'inline-block' }}>All Submissions</div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="card table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User Info</th>
              <th>WhatsApp</th>
              <th>Promo Target</th>
              <th>Reward Prize</th>
              <th>Screenshot Proof</th>
              <th>Submitted Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="text-muted">Loading claim requests...</div>
                </td>
              </tr>
            ) : filteredClaims.map(c => {
              const serverBaseUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL.replace('/api', '');
              const screenshotUrl = c.screenshot_url.startsWith('http')
                ? c.screenshot_url
                : `${serverBaseUrl}${c.screenshot_url}`;

              return (
                <tr key={c.id}>

                  {/* User Profile */}
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.user_name}</div>
                    <div className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Mail size={10} /> {c.user_email}
                    </div>
                  </td>

                  {/* WhatsApp */}
                  <td>
                    {c.user_whatsapp ? (
                      <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                        <span style={{ fontSize: '13px' }}>{c.user_whatsapp}</span>
                        <button
                          onClick={(e) => handleCopy(e, c.user_whatsapp, `wa-${c.id}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                        >
                          {copiedId === `wa-${c.id}` ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>Not set</span>
                    )}
                  </td>

                  {/* Promo Target */}
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.promo_title_so}</div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>{c.promo_title_en}</div>
                  </td>

                  {/* Reward */}
                  <td>
                    <div className="badge success" style={{ textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                      <Award size={10} /> +{c.reward_credits} {c.reward_type}
                    </div>
                  </td>

                  {/* Screenshot Thumbnail */}
                  <td>
                    <div
                      onClick={() => setSelectedScreenshot(screenshotUrl)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        width: 'fit-content'
                      }}
                      title="Click to view full screen"
                    >
                      <ImageIcon size={14} className="text-muted" />
                      <span style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>
                        View Image
                      </span>
                    </div>
                  </td>

                  {/* Submitted Date */}
                  <td className="text-muted" style={{ fontSize: '12px' }}>
                    {new Date(c.claimed_at).toLocaleString()}
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`badge ${c.status === 'approved' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'}`}>
                      {c.status}
                    </span>
                  </td>

                  {/* Action buttons */}
                  <td style={{ textAlign: 'right' }}>
                    {c.status === 'pending' ? (
                      <div className="action-btns" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          className="icon-btn success"
                          title="Ansixi (Approve)"
                          onClick={() => handleApprove(c.id)}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="icon-btn danger"
                          title="Diid (Reject & Delete)"
                          onClick={() => handleReject(c.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>Verified</span>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredClaims.length === 0 && !loading && (
          <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
            Wax dalab ah oo la gudbiyey lama helin.
          </div>
        )}
      </div>

      {/* Glassmorphic Lightbox Modal for Screenshot Preview */}
      {selectedScreenshot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99999,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box'
        }}>

          {/* Modal Header */}
          <div className="flex-between" style={{ width: '100%', maxWidth: '640px', marginBottom: '16px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={16} /> Screenshot Proof Verification
            </span>
            <button
              onClick={() => setSelectedScreenshot(null)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Screenshot Image Container */}
          <div style={{
            maxWidth: '100%',
            maxHeight: '75vh',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.1)'
          }}>
            <img
              src={selectedScreenshot}
              alt="Screenshot Proof"
              style={{
                maxWidth: '640px',
                width: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                backgroundColor: '#000'
              }}
            />
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <a
              href={selectedScreenshot}
              target="_blank"
              rel="noreferrer"
              className="btn secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}
            >
              <ExternalLink size={14} /> Open in New Tab
            </a>
          </div>

        </div>
      )}

    </div>
  );
}
