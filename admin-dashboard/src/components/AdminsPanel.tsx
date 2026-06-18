import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { 
  UserPlus, Ban, Trash2, Shield, 
  RotateCcw, Activity, CheckCircle, AlertTriangle 
} from 'lucide-react';

export default function AdminsPanel() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  const showToast = (message: string, type: 'success' | 'danger' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await fetch(`${API_URL}/admin/admins`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista admins-ka", "danger");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/admin/admin-logs`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchLogs();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password) {
      showToast("Fadlan buuxi dhamaan xogta khasabka ah", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/admin/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          name,
          username,
          email,
          whatsapp_number: phone,
          password,
          role
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast("Admin-ka si guul leh ayaa loo abuuray!", "success");
        // Clear form
        setName('');
        setUsername('');
        setEmail('');
        setPhone('');
        setPassword('');
        setRole('admin');
        setShowAddForm(false);
        // Refresh Lists
        fetchAdmins();
        fetchLogs();
      } else {
        showToast(data.message || "Cilad ayaa dhacday", "danger");
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday abuurista admin-ka", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (adminId: number) => {
    const activeAdmin = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (activeAdmin.id === adminId) {
      showToast("Iskama joojin kartid koontadaada!", "danger");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/admin/admins/${adminId}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(data.message, "success");
        setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, is_suspended: data.is_suspended } : a));
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday", "danger");
    }
  };

  const handleDeleteAdmin = async (adminId: number, adminName: string) => {
    const activeAdmin = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (activeAdmin.id === adminId) {
      showToast("Ma tirtiri kartid koontadaada!", "danger");
      return;
    }

    if (window.confirm(`Ma hubtaa inaad gabi ahaanba tirtirayso admin-ka "${adminName}"?`)) {
      try {
        const res = await fetch(`${API_URL}/admin/admins/${adminId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          showToast("Admin-kii waa la tirtiray!", "success");
          setAdmins(prev => prev.filter(a => a.id !== adminId));
          fetchLogs();
        }
      } catch (err) {
        console.error(err);
        showToast("Cilad ayaa dhacday", "danger");
      }
    }
  };

  return (
    <div className="panel-container" style={{ position: 'relative' }}>
      
      {/* Toast Alert */}
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
          backgroundColor: toast.type === 'success' ? '#1A2F1F' : '#2F1F1F',
          border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: toast.type === 'success' ? '#4ADE80' : '#F87171',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>Manage Administrators</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            Kaliya Super Admin ayaa geli kara qaybtan. Halkan ka abuuro admins kale, xanib ama ka saar, lana soco falalkooda (Activity Audit trail).
          </p>
        </div>
        <button 
          className="btn primary flex-center" 
          style={{ gap: '8px' }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <UserPlus size={18} />
          {showAddForm ? 'Close Form' : 'Register Admin'}
        </button>
      </div>

      {/* Register Admin Form */}
      {showAddForm && (
        <div className="card animate-zoom" style={{ maxWidth: '650px', marginBottom: '24px', borderLeft: '3px solid var(--primary)' }}>
          <h3>Register New Administrator</h3>
          <form onSubmit={handleCreateAdmin} className="admin-form" style={{ marginTop: '15px' }}>
            <div className="file-inputs">
              <div className="input-group">
                <label>Magaca Buuxa (Full Name) *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Tusaale Hamze Ali" 
                  required
                />
              </div>
              <div className="input-group">
                <label>Username *</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Tusaale hamze11" 
                  required
                />
              </div>
            </div>

            <div className="file-inputs">
              <div className="input-group">
                <label>Email Address *</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Tusaale hamze@darkpen.com" 
                  required
                />
              </div>
              <div className="input-group">
                <label>WhatsApp Number (Optional)</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Tusaale +252659119779" 
                />
              </div>
            </div>

            <div className="file-inputs">
              <div className="input-group">
                <label>Password *</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Aad u adkee..." 
                  required
                />
              </div>
              <div className="input-group">
                <label>Admin Privilege Level</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                >
                  <option value="admin">Admin caadi ah (Normal Admin)</option>
                  <option value="superadmin">Super Admin (Full Access)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn primary" style={{ width: 'fit-content', marginTop: '8px' }} disabled={submitting}>
              {submitting ? 'Creating...' : 'Register Account'}
            </button>
          </form>
        </div>
      )}

      {/* Admin Users Table */}
      <div className="card table-card mb-lg">
        <div className="flex-between" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> Active Administrators</h3>
          <button className="icon-btn" onClick={fetchAdmins} title="Refresh admin list"><RotateCcw size={14} /></button>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Privilege</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingAdmins ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px' }} className="text-muted">Loading admins database...</td>
              </tr>
            ) : admins.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>ID: #{a.id}</div>
                </td>
                <td style={{ color: 'var(--primary)' }}>@{a.username}</td>
                <td>{a.email}</td>
                <td>
                  <span className={`badge ${a.role === 'superadmin' ? 'danger' : 'primary'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                    {a.role}
                  </span>
                </td>
                <td>
                  <span 
                    onClick={() => handleToggleSuspend(a.id)}
                    className={`badge ${a.is_suspended ? 'danger' : 'success'}`}
                    style={{ cursor: 'pointer' }}
                    title="Click to suspend/unsuspend"
                  >
                    {a.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleToggleSuspend(a.id)}
                      className="icon-btn danger" 
                      title={a.is_suspended ? 'Activate Admin' : 'Suspend Admin'}
                    >
                      <Ban size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteAdmin(a.id, a.name)}
                      className="icon-btn danger" 
                      style={{ backgroundColor: 'rgba(255,69,58,0.1)' }}
                      title="Delete Admin"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Admin Audit Logs Section */}
      <div className="card table-card">
        <div className="flex-between" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} /> Admin Activity Logs (Audit Trail)</h3>
          <button className="icon-btn" onClick={fetchLogs} title="Refresh Logs"><RotateCcw size={14} /></button>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }} className="custom-scrollbar">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Action Type</th>
                <th>Operation Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px' }} className="text-muted">Loading audit trail logs...</td>
                </tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.admin_name}</div>
                    <div className="text-muted" style={{ fontSize: '10px' }}>
                      <span className={`badge ${l.admin_role === 'superadmin' ? 'danger' : 'primary'}`} style={{ padding: '1px 6px', fontSize: '9px' }}>
                        {l.admin_role}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '11px', 
                      color: l.action_type.includes('DELETE') || l.action_type.includes('SUSPEND') || l.action_type.includes('RESET') ? 'var(--danger)' : 'var(--success)',
                      fontWeight: 'bold' 
                    }}>
                      {l.action_type}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: '#E4E4E7' }}>{l.details}</td>
                  <td className="text-muted" style={{ fontSize: '11px' }}>
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loadingLogs && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }} className="text-muted">
                    No activity logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
