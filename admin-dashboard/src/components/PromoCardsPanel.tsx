import React, { useEffect, useState } from 'react';
import { Trash2, Edit, Image as ImageIcon, Gift } from 'lucide-react';
import { API_URL } from '../config';

export default function PromoCardsPanel() {
  const [cards, setCards] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    title_en: '',
    title_so: '',
    desc_en: '',
    desc_so: '',
    button_text_en: 'Get Started',
    button_text_so: 'Hada Bilow',
    route: '/manhajka',
    overlay_color_light: 'rgba(29, 78, 216, 0.65)',
    overlay_color_dark: 'rgba(30, 41, 59, 0.75)',
    reward_credits: 0,
    reward_type: 'none',
    promo_type: 'normal'
  });
  
  const [image, setImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const ROUTE_PRESETS = [
    { label: 'Curriculum Books (/manhajka)', value: '/manhajka' },
    { label: 'State Exams (/exams)', value: '/exams' },
    { label: 'AI Chatbot (/(tabs)/chat)', value: '/(tabs)/chat' },
    { label: 'Groups (/group)', value: '/group' },
    { label: 'Billing & Topups (/billing)', value: '/billing' },
    { label: 'Custom External Link (Web URL)', value: 'custom' }
  ];

  const fetchCards = () => {
    fetch(`${API_URL}/admin/promo-cards`)
      .then(res => res.json())
      .then(data => setCards(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title_en || !form.title_so || !form.desc_en || !form.desc_so) {
      return alert('Fadlan buuxi dhammaan meelaha bannaan (Please fill all fields)');
    }
    if (!editingId && !image) {
      return alert('Fadlan soo geli sawirka xayaysiiska (Please upload a card image)');
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('title_en', form.title_en);
    formData.append('title_so', form.title_so);
    formData.append('desc_en', form.desc_en);
    formData.append('desc_so', form.desc_so);
    formData.append('button_text_en', form.button_text_en);
    formData.append('button_text_so', form.button_text_so);
    formData.append('route', form.route);
    formData.append('overlay_color_light', form.overlay_color_light);
    formData.append('overlay_color_dark', form.overlay_color_dark);
    formData.append('reward_credits', String(form.reward_credits));
    formData.append('reward_type', form.reward_type);
    formData.append('promo_type', form.promo_type);
    if (image) formData.append('image', image);

    try {
      const url = editingId 
        ? `${API_URL}/admin/promo-cards/${editingId}`
        : `${API_URL}/admin/promo-cards`;
        
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        body: formData
      });

      if (res.ok) {
        alert(editingId ? 'Xayaysiiska si guul leh ayaa loo cusboonaysiiyay!' : 'Xayaysiiska si guul leh ayaa loo soo geliyay!');
        resetForm();
        fetchCards();
      } else {
        const errorData = await res.json();
        alert('Cilad: ' + errorData.message);
      }
    } catch (err) {
      console.error(err);
      alert('Cilad ayaa dhacday soo gelinta xogta.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm({
      title_en: '',
      title_so: '',
      desc_en: '',
      desc_so: '',
      button_text_en: 'Get Started',
      button_text_so: 'Hada Bilow',
      route: '/manhajka',
      overlay_color_light: 'rgba(29, 78, 216, 0.65)',
      overlay_color_dark: 'rgba(30, 41, 59, 0.75)',
      reward_credits: 0,
      reward_type: 'none',
      promo_type: 'normal'
    });
    setImage(null);
    setEditingId(null);
  };

  const handleEdit = (card: any) => {
    setEditingId(card.id);
    setForm({
      title_en: card.title_en,
      title_so: card.title_so,
      desc_en: card.desc_en,
      desc_so: card.desc_so,
      button_text_en: card.button_text_en,
      button_text_so: card.button_text_so,
      route: card.route,
      overlay_color_light: card.overlay_color_light || 'rgba(29, 78, 216, 0.65)',
      overlay_color_dark: card.overlay_color_dark || 'rgba(30, 41, 59, 0.75)',
      reward_credits: card.reward_credits || 0,
      reward_type: card.reward_type || 'none',
      promo_type: card.promo_type || 'normal'
    });
  };

  const handleToggleActive = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/promo-cards/${id}/toggle`, {
        method: 'PUT'
      });
      if (res.ok) {
        fetchCards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ma hubtaa inaad tirtirto xayaysiiskan? (Are you sure you want to delete this promo card?)')) return;
    try {
      const res = await fetch(`${API_URL}/admin/promo-cards/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="panel-container">
      <h2>Promotional & Advertising Cards</h2>
      <p className="text-muted" style={{ marginBottom: '20px' }}>
        Maamul oo u soo geli sawirro, qoraallo iyo abaalmarino sax ah kaararka xayaysiisyada ee ka soo muuqanaya bogga hore ee Mobile App-ka.
      </p>

      <div className="grid-2">
        {/* Left Side: Form */}
        <div className="card">
          <h3>{editingId ? 'Edit Promotional Card' : 'Create New Promo Card'}</h3>
          <form onSubmit={handleSubmit} className="admin-form" style={{ marginTop: '15px' }}>
            
            {/* Title Row */}
            <div className="grid-2">
              <div className="input-group">
                <label>Title (English)</label>
                <input
                  type="text"
                  value={form.title_en}
                  onChange={e => setForm({ ...form, title_en: e.target.value })}
                  placeholder="Ex: Exams Training"
                />
              </div>
              <div className="input-group">
                <label>Title (Somali)</label>
                <input
                  type="text"
                  value={form.title_so}
                  onChange={e => setForm({ ...form, title_so: e.target.value })}
                  placeholder="Tusaale: Imtixaanada"
                />
              </div>
            </div>

            {/* Description Row */}
            <div className="input-group">
              <label>Description (English)</label>
              <textarea
                value={form.desc_en}
                onChange={e => setForm({ ...form, desc_en: e.target.value })}
                placeholder="Ex: Train yourself and prepare for official national exams."
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)' }}
              />
            </div>
            <div className="input-group">
              <label>Description (Somali)</label>
              <textarea
                value={form.desc_so}
                onChange={e => setForm({ ...form, desc_so: e.target.value })}
                placeholder="Tusaale: Tababar naftaada oo ku diyaargarow imtixaanada."
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)' }}
              />
            </div>

            {/* Buttons Row */}
            <div className="grid-2">
              <div className="input-group">
                <label>Button Text (English)</label>
                <input
                  type="text"
                  value={form.button_text_en}
                  onChange={e => setForm({ ...form, button_text_en: e.target.value })}
                  placeholder="Ex: Start Exam"
                />
              </div>
              <div className="input-group">
                <label>Button Text (Somali)</label>
                <input
                  type="text"
                  value={form.button_text_so}
                  onChange={e => setForm({ ...form, button_text_so: e.target.value })}
                  placeholder="Tusaale: Bilow Imtixaan"
                />
              </div>
            </div>

            {/* Route & Image Row */}
            <div className="grid-2">
              <div className="input-group">
                <label>App Navigation Screen</label>
                <select
                  value={form.route.startsWith('http') || form.route === 'custom' || (!ROUTE_PRESETS.some(p => p.value === form.route) && form.route !== '') ? 'custom' : form.route}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setForm({ ...form, route: 'https://' });
                    } else {
                      setForm({ ...form, route: val });
                    }
                  }}
                  className="admin-select"
                >
                  {ROUTE_PRESETS.map(preset => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>

                {(form.route.startsWith('http') || form.route === 'custom' || (!ROUTE_PRESETS.some(p => p.value === form.route) && form.route !== '')) && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                      Custom Web Link URL (Facebook, Telegram, etc.)
                    </label>
                    <input
                      type="text"
                      value={form.route}
                      onChange={e => setForm({ ...form, route: e.target.value })}
                      placeholder="Tusaale: https://facebook.com/pagekayaga"
                      className="admin-input"
                      style={{ borderColor: 'var(--primary)', background: 'rgba(0,0,0,0.3)', color: '#FFF' }}
                    />
                  </div>
                )}
              </div>
              <div className="file-input" style={{ alignSelf: 'center' }}>
                <label><ImageIcon size={16} /> Card Image Cover</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setImage(e.target.files?.[0] || null)} 
                />
              </div>
            </div>

            {/* Promo Card Type Selection */}
            <div className="input-group" style={{ marginTop: '16px' }}>
              <label style={{ fontWeight: 'bold' }}>Promo Card Type (Nooca Xayaysiiska)</label>
              <select
                value={form.promo_type}
                onChange={e => setForm({ ...form, promo_type: e.target.value })}
                className="admin-select"
                style={{ borderColor: 'var(--primary)', color: '#FFF', background: 'rgba(0,0,0,0.3)' }}
              >
                <option value="normal">Normal Advertisement (Xayaysiis Caadi Ah)</option>
                <option value="reward">Task & Reward (Hawl & Abaalmarin Free Ah)</option>
              </select>
            </div>

            {/* Interactive Promo Card Rewards (Screenshot Claim system) */}
            {form.promo_type === 'reward' && (
              <div className="grid-2" style={{ border: '1px dashed rgba(50, 215, 75, 0.3)', padding: '16px', borderRadius: '8px', margin: '20px 0', background: 'rgba(50, 215, 75, 0.04)' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gift size={14} /> Reward Credits (Free Prize)
                  </label>
                  <input
                    type="number"
                    value={form.reward_credits}
                    onChange={e => setForm({ ...form, reward_credits: parseInt(e.target.value) || 0 })}
                    placeholder="Tusaale: 100"
                    min="0"
                    style={{ borderColor: form.reward_credits > 0 ? 'var(--success)' : 'var(--border)' }}
                  />
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label style={{ color: 'var(--success)', fontWeight: 'bold' }}>Reward Wallet Type</label>
                  <select
                    value={form.reward_type}
                    onChange={e => setForm({ ...form, reward_type: e.target.value })}
                    className="admin-select"
                    style={{ borderColor: form.reward_type !== 'none' ? 'var(--success)' : 'var(--border)' }}
                  >
                    <option value="none">No Reward (Select wallet...)</option>
                    <option value="standard">Standard Wallet Credits (AI Chat)</option>
                    <option value="shukaansi">Shukaansi Wallet Credits</option>
                  </select>
                </div>
              </div>
            )}

            {/* Overlay Colors */}
            <div className="grid-2">
              <div className="input-group">
                <label>Overlay Color (Light Theme)</label>
                <input
                  type="text"
                  value={form.overlay_color_light}
                  onChange={e => setForm({ ...form, overlay_color_light: e.target.value })}
                  placeholder="rgba(29, 78, 216, 0.65)"
                />
              </div>
              <div className="input-group">
                <label>Overlay Color (Dark Theme)</label>
                <input
                  type="text"
                  value={form.overlay_color_dark}
                  onChange={e => setForm({ ...form, overlay_color_dark: e.target.value })}
                  placeholder="rgba(30, 41, 59, 0.75)"
                />
              </div>
            </div>

            <div className="flex-between" style={{ marginTop: '20px', gap: '15px' }}>
              {editingId && (
                <button 
                  type="button" 
                  className="btn secondary" 
                  onClick={resetForm} 
                  style={{ flex: 1 }}
                >
                  Cancel Edit
                </button>
              )}
              <button 
                type="submit" 
                className="btn primary" 
                disabled={uploading}
                style={{ flex: 2 }}
              >
                {uploading ? 'Processing...' : editingId ? 'Save Changes' : 'Publish Promo Card'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Existing Cards List */}
        <div className="card">
          <h3>Active Promotional Cards ({cards.length})</h3>
          <div className="list-container" style={{ marginTop: '15px' }}>
            {cards.map(card => {
              const displayImage = card.image_url.startsWith('http') 
                ? card.image_url 
                : `${API_URL}${card.image_url}`;

              return (
                <div key={card.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', padding: '16px' }}>
                  <div className="flex-between" style={{ width: '100%' }}>
                    <div className="flex-center" style={{ gap: '15px' }}>
                      <img 
                        src={displayImage} 
                        alt={card.title_en} 
                        style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)' }} 
                      />
                      <div>
                        <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '16px' }}>{card.title_so} ({card.title_en})</strong>
                          <span className={`badge ${card.promo_type === 'reward' ? 'success' : 'primary'}`} style={{ textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>
                            {card.promo_type === 'reward' ? 'Reward Card' : 'Normal Ad'}
                          </span>
                          {card.promo_type === 'reward' && card.reward_credits > 0 && (
                            <span className="badge success" style={{ textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Gift size={9} /> +{card.reward_credits} {card.reward_type}
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: '13px', marginTop: '2px' }}>
                          Route: <code style={{ color: 'var(--primary)' }}>{card.route}</code>
                        </div>
                      </div>
                    </div>

                    <div className="flex-center" style={{ gap: '10px' }}>
                      <button 
                        className={`badge ${card.is_active ? 'success' : 'muted'}`} 
                        onClick={() => handleToggleActive(card.id)}
                        style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px' }}
                      >
                        {card.is_active ? 'Active' : 'Disabled'}
                      </button>
                      <button className="icon-btn primary" onClick={() => handleEdit(card)}>
                        <Edit size={16} />
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(card.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    <strong>EN:</strong> {card.desc_en} <br/>
                    <strong>SO:</strong> {card.desc_so}
                  </div>
                </div>
              );
            })}
            {cards.length === 0 && (
              <div className="text-center text-muted" style={{ padding: '40px' }}>
                Wax xayaysiis ah kuma jiraan database-ka.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
