import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { 
  Users, Ban, Trash2, RotateCcw, Copy, Check, 
  Eye, EyeOff, X, DollarSign, MessageSquare, 
  User, Mail, Phone, Calendar, ShieldAlert,
  Lock as LockIcon
} from 'lucide-react';

export default function UsersPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Toast Alert State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  // Copy feedback state tracker
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista users-ka", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard!", "info");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleToggleSuspend = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: data.is_suspended } : u));
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser((prev: any) => ({ ...prev, is_suspended: data.is_suspended }));
        }
        showToast(data.message, "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday", "danger");
    }
  };

  const handleDeleteUser = async (userId: number, name: string) => {
    if (window.confirm(`Ma hubtaa inaad tirtirayso user-ka "${name}"? Dhammaan macluumaadkiisa waa la tirtiri doonaa dibna loo soo celin maayo.`)) {
      try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (res.ok) {
          setUsers(prev => prev.filter(u => u.id !== userId));
          setSelectedUser(null);
          showToast("User-kii si guul leh ayaa loo tirtiray", "success");
        }
      } catch (err) {
        console.error(err);
        showToast("Cilad ayaa dhacday", "danger");
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.whatsapp_number?.toLowerCase().includes(search.toLowerCase())
  );

  const getUserColor = (name: string) => {
    const colors = ['#0A84FF', '#32D74B', '#FF9F0A', '#FF453A', '#BF5AF2', '#5E5CE6', '#64D2FF', '#0BF'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  return (
    <div className="panel-container" style={{ position: 'relative' }}>
      
      {/* Premium Integrated Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
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
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'currentColor'
          }} />
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>Users Management</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>Maamul, baadh, hakin ama tirtir isticmaalayaasha app-ka</p>
        </div>
        <div className="flex-center" style={{ gap: '12px' }}>
          <div className="input-group" style={{ margin: 0 }}>
             <input 
              type="text" 
              placeholder="Search users by name, email, username..." 
              className="admin-input"
              style={{ padding: '8px 12px', width: '280px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', color: '#FFF' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn primary" onClick={fetchUsers} title="Refresh users list">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Users</div>
          <div className="stat-value">{users.length}</div>
          <div className="badge primary" style={{ marginTop: '8px', display: 'inline-block' }}>All Registered</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Active Users</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {users.filter(u => !u.is_suspended).length}
          </div>
          <div className="badge success" style={{ marginTop: '8px', display: 'inline-block' }}>Access Allowed</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Suspended Users</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {users.filter(u => u.is_suspended).length}
          </div>
          <div className="badge danger" style={{ marginTop: '8px', display: 'inline-block' }}>Access Blocked</div>
        </div>
      </div>

      {/* Main Users Table */}
      <div className="card table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User Profile</th>
              <th>Username</th>
              <th>Email</th>
              <th>WhatsApp Number</th>
              <th>Status</th>
              <th>Role</th>
              <th>Joined</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="text-muted">Fetching user list database...</div>
                </td>
              </tr>
            ) : filteredUsers.map(u => (
              <tr key={u.id} onClick={() => { setSelectedUser(u); setShowPassword(false); }} style={{ cursor: 'pointer' }}>
                
                {/* Profile column */}
                <td>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '12px' }}>
                    <div 
                      className="avatar-sm animate-pulse" 
                      style={{ 
                        backgroundColor: getUserColor(u.name), 
                        borderRadius: '50%', 
                        color: '#FFF', 
                        fontWeight: 'bold', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}
                    >
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>ID: #{u.id}</div>
                    </div>
                  </div>
                </td>

                {/* Username column */}
                <td>
                  {u.username ? (
                    <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--primary)' }}>@{u.username}</span>
                      <button 
                        onClick={(e) => handleCopy(e, u.username, `uname-${u.id}`)}
                        style={{ opacity: 0.6, cursor: 'pointer' }}
                        title="Copy username"
                      >
                        {copiedId === `uname-${u.id}` ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>Not set</span>
                  )}
                </td>

                {/* Email column */}
                <td style={{ color: '#E4E4E7' }}>{u.email}</td>

                {/* WhatsApp column */}
                <td>
                  {u.whatsapp_number ? (
                    <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span style={{ fontWeight: 500 }}>{u.whatsapp_number}</span>
                      <button 
                        onClick={(e) => handleCopy(e, u.whatsapp_number, `wa-${u.id}`)}
                        style={{ opacity: 0.6, cursor: 'pointer' }}
                        title="Copy WhatsApp"
                      >
                        {copiedId === `wa-${u.id}` ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>Not set</span>
                  )}
                </td>

                {/* Status Column */}
                <td>
                  <span 
                    onClick={(e) => handleToggleSuspend(e, u.id)}
                    className={`badge ${u.is_suspended ? 'danger' : 'success'}`} 
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    title="Click to toggle status"
                  >
                    {u.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>

                {/* Role Column */}
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'danger' : u.role === 'student' ? 'primary' : 'warning'}`} style={{ textTransform: 'uppercase' }}>
                    {u.role}
                  </span>
                </td>

                {/* Joined Column */}
                <td className="text-muted" style={{ fontSize: '12px' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>

                {/* Actions Column */}
                <td style={{ textAlign: 'right' }}>
                  <div className="action-btns" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                    <button 
                      className="icon-btn success"
                      title="More details"
                      onClick={() => { setSelectedUser(u); setShowPassword(false); }}
                    >
                      <Eye size={15} />
                    </button>
                    <button 
                      className="icon-btn danger" 
                      title="Delete User"
                      onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id, u.name); }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && !loading && (
          <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
            No users match your search query.
          </div>
        )}
      </div>

      {/* Premium Glassmorphic More Details Modal with perfect non-overflow layout */}
      {selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99999,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '620px',
            height: 'fit-content',
            maxHeight: '92vh',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} className="animate-zoom">
            
            {/* Modal Header (Fixed at Top) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'between',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              background: 'rgba(255, 255, 255, 0.01)',
              flexShrink: 0
            }} className="flex-between">
              <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '16px' }}>
                <div 
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: getUserColor(selectedUser.name),
                    color: '#FFF',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                >
                  {selectedUser.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{selectedUser.name}</h3>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '8px', marginTop: '4px' }}>
                    <span className={`badge ${selectedUser.role === 'admin' ? 'danger' : selectedUser.role === 'student' ? 'primary' : 'warning'}`} style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 8px' }}>
                      {selectedUser.role}
                    </span>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: selectedUser.is_suspended ? 'var(--danger)' : 'var(--success)'
                    }} />
                    <span className="text-muted" style={{ fontSize: '11px', fontWeight: 600 }}>
                      {selectedUser.is_suspended ? 'Suspended Account' : 'Active Account'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} className="text-muted" />
              </button>
            </div>

            {/* Modal Body (Scrollable Middle Section) */}
            <div style={{
              flex: '1 1 auto',
              overflowY: 'auto',
              padding: '24px',
              boxSizing: 'border-box'
            }} className="custom-scrollbar">
              
              {/* Profile details category */}
              <div style={{ marginBottom: '24px' }}>
                <div className="text-muted" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  Macluumaadka Xisaabta (Profile Details)
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)'
                }}>
                  
                  {/* Username */}
                  <div>
                    <div className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <User size={12} /> Username
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {selectedUser.username ? `@${selectedUser.username}` : 'Not set'}
                      </span>
                      {selectedUser.username && (
                        <button 
                          onClick={(e) => handleCopy(e, selectedUser.username, 'modal-uname')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                        >
                          {copiedId === 'modal-uname' ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <div className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Mail size={12} /> Email
                    </div>
                    <div style={{ fontWeight: 500, color: '#E4E4E7', wordBreak: 'break-all' }}>{selectedUser.email}</div>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <div className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Phone size={12} /> WhatsApp
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, color: '#FFF' }}>
                        {selectedUser.whatsapp_number || 'Not set'}
                      </span>
                      {selectedUser.whatsapp_number && (
                        <button 
                          onClick={(e) => handleCopy(e, selectedUser.whatsapp_number, 'modal-wa')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                        >
                          {copiedId === 'modal-wa' ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Joined Date */}
                  <div>
                    <div className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Calendar size={12} /> Joined Date
                    </div>
                    <div style={{ fontWeight: 500, color: '#FFF' }}>
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Password Secure Box */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <div className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <LockIcon size={12} /> Password (Hash/Secure)
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <div style={{
                        flexGrow: 1,
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#A1A1AA',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap'
                      }}>
                        {showPassword ? selectedUser.password : '••••••••••••••••••••••••••••••••••••••••'}
                      </div>
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ cursor: 'pointer', opacity: 0.7, padding: '2px' }}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button 
                        onClick={(e) => handleCopy(e, selectedUser.password, 'modal-pass')}
                        style={{ cursor: 'pointer', opacity: 0.7, padding: '2px' }}
                      >
                        {copiedId === 'modal-pass' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Wallet and Activity statistics section */}
              <div>
                <div className="text-muted" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  Wallet & Activity Statistics
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '12px'
                }}>
                  
                  {/* Credits */}
                  <div style={{
                    background: 'rgba(10, 132, 255, 0.03)',
                    border: '1px solid rgba(10, 132, 255, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DollarSign size={10} style={{ color: 'var(--primary)' }} /> CREDITS
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 'black', color: '#FFF', margin: '4px 0' }}>{selectedUser.credits}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Standard Wallet</span>
                  </div>

                  {/* Shukaansi */}
                  <div style={{
                    background: 'rgba(255, 159, 10, 0.03)',
                    border: '1px solid rgba(255, 159, 10, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DollarSign size={10} style={{ color: 'var(--warning)' }} /> SHUKAANSI
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 'black', color: '#FFF', margin: '4px 0' }}>{selectedUser.shukaansi_credits}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Shukaansi Wallet</span>
                  </div>

                  {/* AI Chats */}
                  <div style={{
                    background: 'rgba(50, 215, 75, 0.03)',
                    border: '1px solid rgba(50, 215, 75, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={10} style={{ color: 'var(--success)' }} /> AI CHATS
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 'black', color: '#FFF', margin: '4px 0' }}>{selectedUser.private_messages_count}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Private messages</span>
                  </div>

                  {/* Group Chats */}
                  <div style={{
                    background: 'rgba(191, 90, 242, 0.03)',
                    border: '1px solid rgba(191, 90, 242, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={10} style={{ color: '#BF5AF2' }} /> GROUPS
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 'black', color: '#FFF', margin: '4px 0' }}>{selectedUser.group_messages_count}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Messages sent</span>
                  </div>

                </div>
              </div>

            </div>

            {/* Modal Actions Footer (Fixed at Bottom) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              flexShrink: 0
            }}>
              
              {/* Suspend/Unsuspend Toggle Button */}
              <button 
                onClick={(e) => handleToggleSuspend(e, selectedUser.id)}
                className={`btn ${selectedUser.is_suspended ? 'success' : 'warning'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: selectedUser.is_suspended ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                  color: selectedUser.is_suspended ? 'var(--success)' : 'var(--warning)',
                  transition: 'all 0.2s'
                }}
              >
                <Ban size={14} />
                {selectedUser.is_suspended ? 'Ka qaad Xayiraadda (Activate)' : 'Xayir User-ka (Suspend)'}
              </button>

              {/* Delete Button */}
              <button 
                onClick={() => handleDeleteUser(selectedUser.id, selectedUser.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: 'rgba(255, 69, 58, 0.15)',
                  color: 'var(--danger)',
                  transition: 'all 0.2s'
                }}
              >
                <Trash2 size={14} />
                Tirtir Isticmaalaha (Delete)
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
