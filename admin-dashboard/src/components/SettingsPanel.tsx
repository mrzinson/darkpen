import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { Settings, Save, Trash2, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

export default function SettingsPanel() {
  const [settings, setSettings] = useState<any>({
    evc_number: '',
    edahab_number: '',
    payment_contact_whatsapp: '',
    payment_contact_email: '',
    monthly_plan_price: '',
    yearly_plan_price: '',
    credit_per_dollar: '',
    text_message_credit_cost: '',
    voice_message_credit_cost: '',
    image_generation_credit_cost: '',
    system_status: 'active'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'danger' } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev: any) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const showMsg = (text: string, type: 'success' | 'danger' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showMsg("Settings-ka si guul leh ayaa loo cusboonaysiiyey!", "success");
      } else {
        showMsg(data.message || "Cilad ayaa dhacday", "danger");
      }
    } catch (err) {
      console.error(err);
      showMsg("Cilad ayaa dhacday kaydinta settings-ka", "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (adminUser.role !== 'superadmin') {
      showMsg("Kaliya Super Admin ayaa tirtiri kara xogta tijaabada!", "danger");
      return;
    }

    const confirm1 = window.confirm(
      "DIGNIIN CULUS: Ma hubtaa inaad tirtirayso dhamaan xogta tijaabada?\n\nWaxaa la tirtiri doonaa:\n- Payments (dhamaan lacag-bixinta)\n- Farriimaha Chat-ka (Private & Group)\n- Chat Sessions-ka\n- Promo Claims-ka\n- Quiz Attempts-ka\n- AI Usage logs\n- Waxaa 0 laga dhigi doonaa credit-ka wallet-yada.\n\nWaxaa la badbaadin doonaa:\n- Users-ka app-ka ku jira (laguma tirtirayo!)\n- Buugaagta casharada (Books)\n- Imtixaanada (Exams)"
    );

    if (!confirm1) return;

    const confirm2 = window.prompt("Fadlan qor erayga 'NADIIFI' si aad u xaqiijiso tirtirista xogta:");
    if (confirm2 !== 'NADIIFI') {
      showMsg("Tirtirista xogta waa la baajiyey sababtoo ah koodhkii saxda ahaa lama qorin.", "danger");
      return;
    }

    setCleaning(true);
    try {
      const res = await fetch(`${API_URL}/admin/reset-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showMsg(data.message, "success");
      } else {
        showMsg(data.message || "Tirtiristu way guuldaraysatay", "danger");
      }
    } catch (err) {
      console.error(err);
      showMsg("Cilad ayaa ku timid tirtirista database-ka tijaabada", "danger");
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="panel-container flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="animate-spin text-primary" size={32} />
        <p className="text-muted">Soo qaadaya settings-ka...</p>
      </div>
    );
  }

  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const isSuperAdmin = adminUser.role === 'superadmin';

  return (
    <div className="panel-container" style={{ position: 'relative' }}>
      
      {/* Toast message */}
      {message && (
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
          backgroundColor: message.type === 'success' ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 69, 58, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          backdropFilter: 'blur(20px)',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>System Settings</h2>
          <p className="text-muted" style={{ fontSize: '14px' }}>Halkan ka maamul nambarka EVC/eDahab, qiimaha sub-ka, dhibcaha AI-da iyo waxyaabo kale.</p>
        </div>
        <Settings className="text-primary animate-pulse" size={24} />
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '3fr 2fr', alignItems: 'start' }}>
        {/* Settings Form */}
        <div className="card">
          <form onSubmit={handleSave} className="admin-form">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>General Configuration</h3>
            
            {/* Phone payment numbers */}
            <div className="file-inputs">
              <div className="input-group">
                <label>EVC Plus Number</label>
                <input 
                  type="text" 
                  value={settings.evc_number}
                  onChange={(e) => setSettings({ ...settings, evc_number: e.target.value })}
                  placeholder="Tusaale 637930329" 
                />
              </div>
              <div className="input-group">
                <label>eDahab Number</label>
                <input 
                  type="text" 
                  value={settings.edahab_number}
                  onChange={(e) => setSettings({ ...settings, edahab_number: e.target.value })}
                  placeholder="Tusaale 659119779" 
                />
              </div>
            </div>

            {/* Support contact info */}
            <div className="file-inputs">
              <div className="input-group">
                <label>Support WhatsApp</label>
                <input 
                  type="text" 
                  value={settings.payment_contact_whatsapp}
                  onChange={(e) => setSettings({ ...settings, payment_contact_whatsapp: e.target.value })}
                  placeholder="Tusaale +252637930329" 
                />
              </div>
              <div className="input-group">
                <label>Support Email</label>
                <input 
                  type="email" 
                  value={settings.payment_contact_email}
                  onChange={(e) => setSettings({ ...settings, payment_contact_email: e.target.value })}
                  placeholder="Tusaale team.darkpen@gmail.com" 
                />
              </div>
            </div>

            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginTop: '20px' }}>Pricing & Subscription Plans (USD)</h3>
            <div className="file-inputs">
              <div className="input-group">
                <label>Monthly Basic Price ($3.00)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={settings.monthly_plan_price}
                  onChange={(e) => setSettings({ ...settings, monthly_plan_price: e.target.value })}
                  placeholder="3.00" 
                />
              </div>
              <div className="input-group">
                <label>Monthly Premium Price ($11.00)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={settings.yearly_plan_price}
                  onChange={(e) => setSettings({ ...settings, yearly_plan_price: e.target.value })}
                  placeholder="11.00" 
                />
              </div>
            </div>

            <div className="input-group">
              <label>Credits Granted per $1 USD (for custom payments)</label>
              <input 
                type="number" 
                value={settings.credit_per_dollar}
                onChange={(e) => setSettings({ ...settings, credit_per_dollar: e.target.value })}
                placeholder="200" 
              />
            </div>

            <div className="input-group" style={{ marginTop: '10px' }}>
              <label>System Mode Status</label>
              <select 
                value={settings.system_status}
                onChange={(e) => setSettings({ ...settings, system_status: e.target.value })}
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  outline: 'none'
                }}
              >
                <option value="active">🟢 Firfircoon (Active Mode)</option>
                <option value="maintenance">🔴 Dayactir (Maintenance Mode)</option>
              </select>
            </div>

            <button type="submit" className="btn primary flex-center" style={{ gap: '10px', marginTop: '16px', width: 'fit-content' }} disabled={saving}>
              <Save size={18} />
              {saving ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </form>
        </div>

        {/* Database cleanup section */}
        <div className="card" style={{ border: '1px solid rgba(255, 69, 58, 0.25)', background: 'rgba(255, 69, 58, 0.02)' }}>
          <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '10px', marginBottom: '16px' }}>
            <ShieldAlert className="text-danger" size={24} />
            <h3 style={{ margin: 0, color: 'var(--danger)' }}>Dangerous Operations</h3>
          </div>
          <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Halkan waxaad ka nadiifin kartaa database-ka oo aad kaga saari kartaa dhamaan xogta tijaabada ah ee soo gashay intii app-ka la dhisayay (sida payments, chat history, sessions, iyo claims) adigoo badbaadinaya users-ka, books-ka, iyo exams-ka.
          </p>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '12px', borderLeft: '3px solid var(--danger)' }}>
            <strong>Fiiro Gaar Ah:</strong> Kaliya Super Admin ayaa fulin kara talaabadan. Waxay u baahan doontaa in la qoro erayga xaqiijinta si loo bilaabo.
          </div>

          {isSuperAdmin ? (
            <button 
              onClick={handleResetData}
              className="btn danger" 
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backgroundColor: 'rgba(255, 69, 58, 0.15)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                cursor: 'pointer'
              }}
              disabled={cleaning}
            >
              <Trash2 size={16} />
              {cleaning ? 'Cleaning database...' : 'Nadiifi Test Data (Clear Database)'}
            </button>
          ) : (
            <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', padding: '10px', background: 'rgba(255,69,58,0.05)', borderRadius: 'var(--radius-sm)' }}>
              🔒 Xidhan: Waxaad tahay Admin caadi ah. Super Admin oo kaliya ayaa heli kara.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
