import { useEffect, useState } from 'react';
import { Trophy, ShieldAlert, Award, Save, RefreshCw, PlusCircle } from 'lucide-react';
import { API_URL } from '../config';

export default function TournamentPanel() {
  const [settings, setSettings] = useState<any>({
    is_active: 1,
    reward_description: '',
    gen_ad_title: '',
    gen_ad_desc: '',
    gen_ad_btn_text: '',
    gen_ad_btn_route: '',
    result_ad_title: '',
    result_ad_desc: '',
    result_ad_btn_text: '',
    result_ad_btn_route: ''
  });
  const [contestants, setContestants] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState('');

  const fetchSettings = () => {
    fetch(`${API_URL}/admin/tournament/settings`)
      .then(res => res.json())
      .then(data => {
        setSettings(data);
      })
      .catch(err => {
        console.error(err);
      });
  };

  const fetchContestants = () => {
    fetch(`${API_URL}/admin/tournament/contestants`)
      .then(res => res.json())
      .then(data => {
        setContestants(data);
      })
      .catch(err => {
        console.error(err);
      });
  };

  useEffect(() => {
    fetchSettings();
    fetchContestants();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Saving...');
    try {
      const res = await fetch(`${API_URL}/admin/tournament/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveStatus('✅ Settings saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('❌ Failed to save settings');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('❌ Error connection error');
    }
  };

  const handleAdjustXp = async (id: number) => {
    const amount = prompt('Fadlan qor dhibcaha (XP) aad rabto in lagu daro ama laga gooyo (e.g. 50 or -50):');
    if (amount === null || isNaN(Number(amount)) || amount.trim() === '') return;

    try {
      const res = await fetch(`${API_URL}/admin/tournament/contestants/${id}/adjust-xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) })
      });
      if (res.ok) {
        fetchContestants();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSuspend = async (id: number) => {
    if (!confirm('Ma hubtaa in aad rabto in aad bedesho xaaladda contestant-kan?')) return;

    try {
      const res = await fetch(`${API_URL}/admin/tournament/contestants/${id}/toggle-suspend`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchContestants();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="panel-container">
      <div className="flex-between mb-lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={28} className="text-primary" />
          <h2>Monthly Quiz Tournament</h2>
        </div>
        <button className="icon-btn" onClick={() => { fetchSettings(); fetchContestants(); }} title="Refresh List">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid-2">
        {/* Settings Card */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>Tournament Settings</h3>
          <form onSubmit={handleSaveSettings} style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <input
                type="checkbox"
                id="is_active"
                checked={settings.is_active === 1}
                onChange={e => setSettings({ ...settings, is_active: e.target.checked ? 1 : 0 })}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="is_active" style={{ fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
                Tournament Active (Enable Quiz Reward Mode)
              </label>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
                Tournament Reward / Rules Description (Somali)
              </label>
              <textarea
                value={settings.reward_description}
                onChange={e => setSettings({ ...settings, reward_description: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1.5px solid #d4dce9',
                  fontFamily: 'inherit',
                  fontSize: '14px'
                }}
                placeholder="Qor abaalmarinta bishaan..."
              />
            </div>

            {/* Advertising Configuration Section */}
            <div style={{ marginTop: '25px', borderTop: '1px dashed var(--border)', paddingTop: '20px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '15px' }}>
                📢 Quiz Tournament Advertising Settings
              </h4>
              
              <div className="grid-2">
                {/* Ad 1: Questions Generation Screen */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                  <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                    1. Xayaysiiska Samaynta Su'aalaha (While Generating Questions)
                  </h5>
                  
                  <div className="input-group">
                    <label>Ad Title</label>
                    <input
                      type="text"
                      value={settings.gen_ad_title || ''}
                      onChange={e => setSettings({ ...settings, gen_ad_title: e.target.value })}
                      placeholder="Tusaale: Dugsiga Caalamiga ah ee ZinsonAI"
                    />
                  </div>

                  <div className="input-group">
                    <label>Ad Description</label>
                    <textarea
                      value={settings.gen_ad_desc || ''}
                      onChange={e => setSettings({ ...settings, gen_ad_desc: e.target.value })}
                      placeholder="Tusaale: Hada is-diiwaangeli oo hel waxbarasho digital ah oo bilaash ah!"
                      rows={2}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div className="grid-2" style={{ marginTop: '10px' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Button Text</label>
                      <input
                        type="text"
                        value={settings.gen_ad_btn_text || ''}
                        onChange={e => setSettings({ ...settings, gen_ad_btn_text: e.target.value })}
                        placeholder="Baro Dheeraad"
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Button Route / URL Link</label>
                      <input
                        type="text"
                        value={settings.gen_ad_btn_route || ''}
                        onChange={e => setSettings({ ...settings, gen_ad_btn_route: e.target.value })}
                        placeholder="/manhajka ama https://..."
                      />
                    </div>
                  </div>
                </div>

                {/* Ad 2: Result Screen Transition */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                  <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                    2. Xayaysiiska Kahor Natiijada (Before Results Screen)
                  </h5>
                  
                  <div className="input-group">
                    <label>Ad Title</label>
                    <input
                      type="text"
                      value={settings.result_ad_title || ''}
                      onChange={e => setSettings({ ...settings, result_ad_title: e.target.value })}
                      placeholder="Tusaale: Darkpen Premium Wallet"
                    />
                  </div>

                  <div className="input-group">
                    <label>Ad Description</label>
                    <textarea
                      value={settings.result_ad_desc || ''}
                      onChange={e => setSettings({ ...settings, result_ad_desc: e.target.value })}
                      placeholder="Tusaale: Ku shubo 100 Credits oo dheeraad ah kaliya $1 si aad u kordhiso isku-dayadaada!"
                      rows={2}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div className="grid-2" style={{ marginTop: '10px' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Button Text</label>
                      <input
                        type="text"
                        value={settings.result_ad_btn_text || ''}
                        onChange={e => setSettings({ ...settings, result_ad_btn_text: e.target.value })}
                        placeholder="Hada Iibso"
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label>Button Route / URL Link</label>
                      <input
                        type="text"
                        value={settings.result_ad_btn_route || ''}
                        onChange={e => setSettings({ ...settings, result_ad_btn_route: e.target.value })}
                        placeholder="/billing ama https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-between">
              <button type="submit" className="flex-center" style={{ gap: '8px', padding: '10px 20px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <Save size={16} /> Save Settings
              </button>
              {saveStatus && <span style={{ fontWeight: 'bold' }}>{saveStatus}</span>}
            </div>
          </form>
        </div>

        {/* Contestants Table */}
        <div className="card table-card" style={{ gridColumn: 'span 2', marginTop: '10px' }}>
          <div className="flex-between mb-md" style={{ padding: '0 15px' }}>
            <h3>Contestants Leaderboard</h3>
            <div className="badge success">{contestants.length} Enrolled</div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th>User Details</th>
                <th>XP Points</th>
                <th>Total Entries</th>
                <th>Last Active</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contestants.map((c, idx) => {
                const isTop3 = idx < 3;
                const trophyColor = idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : "#B45309";
                
                return (
                  <tr key={c.id} style={c.is_suspended_from_tournament ? { opacity: 0.6 } : {}}>
                    <td>
                      {isTop3 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Award size={18} color={trophyColor} />
                          <strong>#{idx + 1}</strong>
                        </div>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td>
                      <div>
                        <strong>{c.name}</strong>
                        <div className="text-muted" style={{ fontSize: '11px' }}>@{c.username} • {c.whatsapp_number}</div>
                      </div>
                    </td>
                    <td>
                      <span className="text-success" style={{ fontWeight: '800' }}>
                        {c.xp} XP
                      </span>
                    </td>
                    <td>{c.total_attempts} attempts</td>
                    <td>
                      {c.last_attempt_at ? new Date(c.last_attempt_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${c.is_suspended_from_tournament ? 'danger' : 'success'}`}>
                        {c.is_suspended_from_tournament ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button 
                          className="icon-btn success" 
                          onClick={() => handleAdjustXp(c.id)}
                          title="Adjust XP"
                        >
                          <PlusCircle size={16} />
                        </button>
                        <button 
                          className={`icon-btn ${c.is_suspended_from_tournament ? 'success' : 'danger'}`} 
                          onClick={() => handleToggleSuspend(c.id)}
                          title={c.is_suspended_from_tournament ? 'Allow Contestant' : 'Block Contestant'}
                        >
                          <ShieldAlert size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {contestants.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }} className="text-muted">
                    No contestants have opted in for the tournament yet.
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
