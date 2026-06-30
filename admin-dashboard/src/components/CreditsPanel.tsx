import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
  Search, X, Edit, PlusCircle,
  User, Coins
} from 'lucide-react';

interface CreditUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  whatsapp_number: string | null;
  role: string;
  is_suspended: number;
  created_at: string;
  credits: number;
  shukaansi_credits: number;
  plan_type: string | null;
  expiry_date: string | null;
  private_messages_count: number;
}

export default function CreditsPanel() {
  const [users, setUsers] = useState<CreditUser[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]); // For the manual top up dropdown search
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [adjustModalUser, setAdjustModalUser] = useState<CreditUser | null>(null);
  const [showManualTopup, setShowManualTopup] = useState(false);

  // Form states
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustWallet, setAdjustWallet] = useState<'general' | 'shukaansi'>('general');
  const [adjustAction, setAdjustAction] = useState<'add' | 'subtract'>('add');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Manual Top-up states
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualWallet, setManualWallet] = useState<'general' | 'shukaansi'>('general');
  const [topupSearch, setTopupSearch] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const token = localStorage.getItem('adminToken');
  const authHeaders = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCreditUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/credits-subscriptions`, { headers: authHeaders });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Cilad ayaa dhacday soo qaadista xogta wallet-yada", "danger");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, { headers: authHeaders });
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCreditUsers();
    fetchAllUsers();
  }, []);

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalUser) return;
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast("Fadlan qor tiro ka weyn 0", "danger");
      return;
    }

    const finalAmount = adjustAction === 'add' ? amountNum : -amountNum;

    setAdjustLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${adjustModalUser.id}/adjust-credits`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ amount: finalAmount, walletType: adjustWallet })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(data.message, "success");
        // Update user balance locally
        setUsers(prev => prev.map(u => {
          if (u.id === adjustModalUser.id) {
            return {
              ...u,
              credits: adjustWallet === 'general' ? data.newBalance : u.credits,
              shukaansi_credits: adjustWallet === 'shukaansi' ? data.newBalance : u.shukaansi_credits
            };
          }
          return u;
        }));
        setAdjustModalUser(null);
        setAdjustAmount('');
        // Re-fetch users list just in case filter applies (e.g. if balance became 0)
        fetchCreditUsers();
      } else {
        showToast(data.message || "Cilad ayaa dhacday", "danger");
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad xiriirka server-ka", "danger");
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleManualTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) {
      showToast("Fadlan dooro qofka aad lacagta u shubayso", "danger");
      return;
    }
    const amountNum = parseFloat(manualAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast("Fadlan qor tiro ka weyn 0", "danger");
      return;
    }

    setTopupLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${targetUserId}/adjust-credits`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ amount: amountNum, walletType: manualWallet })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast("Credit-ka waa la shubay!", "success");
        setShowManualTopup(false);
        setTargetUserId(null);
        setManualAmount('');
        setTopupSearch('');
        fetchCreditUsers(); // Refresh active list
      } else {
        showToast(data.message || "Cilad ayaa dhacday", "danger");
      }
    } catch (err) {
      console.error(err);
      showToast("Cilad xiriirka server-ka", "danger");
    } finally {
      setTopupLoading(false);
    }
  };

  const filteredCreditUsers = users.filter(u => {
    const term = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      (u.whatsapp_number && u.whatsapp_number.includes(term))
    );
  });

  const filteredCandidates = allUsers.filter(u => {
    if (!topupSearch || topupSearch.length < 2) return false;
    const term = topupSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      (u.whatsapp_number && u.whatsapp_number.includes(term))
    );
  }).slice(0, 5); // Limit search results

  const selectedCandidate = allUsers.find(u => u.id === targetUserId);

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
          <h2>Credits & Subscriptions</h2>
          <p className="text-muted">La soco isticmaalayaasha credit-ka u jiro ama subscribtion-ka leh, kuna shub credit gacanta.</p>
        </div>
        <button 
          onClick={() => setShowManualTopup(true)} 
          className="btn flex-center gap-sm btn-primary"
          style={{ padding: '8px 16px' }}
        >
          <PlusCircle size={16} />
          <span>Shub credit (Manual)</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '15px' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          <p className="text-muted">Soo dejinaya xogta...</p>
        </div>
      ) : (
        <div className="card">
          {/* Search bar */}
          <div className="search-box-container mb-md" style={{ maxWidth: '400px' }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Ku raadi magac, username, ama phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Active Wallets & Subs Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>WhatsApp Phone</th>
                  <th>General Balance</th>
                  <th>Shukaansi Balance</th>
                  <th>Subscription Plan</th>
                  <th>Expiry Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCreditUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/5">
                    <td>
                      <div>
                        <strong>{u.name}</strong>
                        <div className="text-muted" style={{ fontSize: '11px' }}>@{u.username}</div>
                      </div>
                    </td>
                    <td>{u.whatsapp_number || 'None'}</td>
                    <td>
                      <span className="badge success font-bold">{u.credits} Credits</span>
                    </td>
                    <td>
                      <span className="badge info font-bold" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#EC4899' }}>
                        {u.shukaansi_credits} Credits
                      </span>
                    </td>
                    <td>
                      {u.plan_type ? (
                        <span className="badge warning font-bold" style={{ textTransform: 'capitalize' }}>{u.plan_type.replace('_', ' ')}</span>
                      ) : (
                        <span className="text-muted text-xs">No Active Plan</span>
                      )}
                    </td>
                    <td>
                      {u.expiry_date ? (
                        <span style={{ fontSize: '12px' }}>{new Date(u.expiry_date).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => setAdjustModalUser(u)}
                        className="btn-icon primary"
                        title="Manage Balance"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCreditUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                      Isticmaalayaal buuxiya shuruudahan lama helin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Credits Modal */}
      {adjustModalUser && (
        <div className="modal-overlay flex-center" onClick={() => setAdjustModalUser(null)}>
          <div className="modal-content w-sm animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between pb-md border-b">
              <h3>Manage Credits</h3>
              <button className="btn-close" onClick={() => setAdjustModalUser(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustCredits} className="modal-body py-md flex flex-col gap-4">
              <div className="flex-center gap-sm bg-gray-50/5 p-3 rounded-xl border border-gray-800">
                <User size={18} className="text-primary" />
                <div>
                  <strong>{adjustModalUser.name}</strong>
                  <div className="text-muted text-xs">@{adjustModalUser.username}</div>
                </div>
              </div>

              {/* Wallet select */}
              <div className="form-group">
                <label className="label">Dooro Wallet-ka</label>
                <select
                  value={adjustWallet}
                  onChange={(e) => setAdjustWallet(e.target.value as any)}
                  className="input-field select-field"
                >
                  <option value="general">General AI Wallet ({adjustModalUser.credits} Credits)</option>
                  <option value="shukaansi">Shukaansi Wallet ({adjustModalUser.shukaansi_credits} Credits)</option>
                </select>
              </div>

              {/* Action type */}
              <div className="form-group">
                <label className="label">Nooca Wax ka beddelka</label>
                <div className="flex gap-md">
                  <label className="flex items-center gap-sm cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      checked={adjustAction === 'add'}
                      onChange={() => setAdjustAction('add')}
                    />
                    <span>Ku Dar (Add)</span>
                  </label>
                  <label className="flex items-center gap-sm cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      checked={adjustAction === 'subtract'}
                      onChange={() => setAdjustAction('subtract')}
                    />
                    <span>Ka Jar (Subtract)</span>
                  </label>
                </div>
              </div>

              {/* Amount input */}
              <div className="form-group">
                <label className="label">Tirada Credit-ka</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-3 text-muted" size={16} />
                  <input
                    type="number"
                    placeholder="Qor inta credit ee aad rabto..."
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="input-field pl-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-sm mt-md pt-md border-t">
                <button
                  type="submit"
                  disabled={adjustLoading || !adjustAmount}
                  className="btn btn-primary"
                >
                  {adjustLoading ? 'Cusboonaysiinaya...' : 'Cusboonaysii Wallet'}
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: 'var(--border)' }} 
                  onClick={() => setAdjustModalUser(null)}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Top-up Modal */}
      {showManualTopup && (
        <div className="modal-overlay flex-center" onClick={() => { setShowManualTopup(false); setTargetUserId(null); setManualAmount(''); setTopupSearch(''); }}>
          <div className="modal-content w-sm animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between pb-md border-b">
              <h3>Manual Credit Top-Up</h3>
              <button className="btn-close" onClick={() => { setShowManualTopup(false); setTargetUserId(null); setManualAmount(''); setTopupSearch(''); }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleManualTopup} className="modal-body py-md flex flex-col gap-4">
              {/* User search box */}
              <div className="form-group">
                <label className="label">Raadi Isticmaalaha</label>
                {!targetUserId ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-muted" size={16} />
                    <input
                      type="text"
                      placeholder="Qor magac, username ama teleefan..."
                      value={topupSearch}
                      onChange={(e) => setTopupSearch(e.target.value)}
                      className="input-field pl-lg"
                    />

                    {/* Auto-suggest dropdown */}
                    {filteredCandidates.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-[#161B22] border border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden">
                        {filteredCandidates.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setTargetUserId(c.id);
                              setTopupSearch('');
                            }}
                            className="p-3 hover:bg-gray-800 cursor-pointer flex-between border-b border-gray-850 last:border-b-0"
                          >
                            <div>
                              <div className="text-sm font-bold text-white">{c.name}</div>
                              <div className="text-xs text-muted">@{c.username}</div>
                            </div>
                            <span className="text-xs badge info">{c.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-between bg-gray-50/5 p-3 rounded-xl border border-gray-800">
                    <div className="flex-center gap-sm">
                      <User size={18} className="text-primary" />
                      <div>
                        <strong>{selectedCandidate?.name}</strong>
                        <div className="text-muted text-xs">@{selectedCandidate?.username}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTargetUserId(null)}
                      className="text-danger-hover text-xs font-semibold p-1"
                    >
                      Beddel
                    </button>
                  </div>
                )}
              </div>

              {/* Wallet Type */}
              <div className="form-group">
                <label className="label">Dooro Wallet-ka</label>
                <select
                  value={manualWallet}
                  onChange={(e) => setManualWallet(e.target.value as any)}
                  className="input-field select-field"
                >
                  <option value="general">General AI Wallet</option>
                  <option value="shukaansi">Shukaansi Wallet</option>
                </select>
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="label">Tirada Credit-ka</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-3 text-muted" size={16} />
                  <input
                    type="number"
                    placeholder="Qor inta credit ee aad ku shubayso..."
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="input-field pl-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-sm mt-md pt-md border-t">
                <button
                  type="submit"
                  disabled={topupLoading || !targetUserId || !manualAmount}
                  className="btn btn-primary"
                >
                  {topupLoading ? 'Shubaya...' : 'Shub Credit'}
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: 'var(--border)' }} 
                  onClick={() => { setShowManualTopup(false); setTargetUserId(null); setManualAmount(''); setTopupSearch(''); }}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
