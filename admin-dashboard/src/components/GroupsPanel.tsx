import { useState, useEffect } from 'react';
import { Users, Ban, Trash2, Globe, Lock, RotateCcw } from 'lucide-react';
import { API_URL } from '../config';

export default function GroupsPanel() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/groups`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await fetch(`${API_URL}/admin/groups/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async (id: number, name: string) => {
    if (window.confirm(`Ma hubtaa inaad tirtirayso group-ka "${name}"? Tani dib looma soo celin karo.`)) {
      try {
        const res = await fetch(`${API_URL}/admin/groups/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (res.ok) {
          fetchGroups();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    g.admin_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="panel-container">
      {/* Page Header */}
      <div className="flex-between mb-lg">
        <div>
          <h2>Community Groups</h2>
          <p className="text-muted" style={{fontSize: '14px'}}>Manage and moderate social & educational groups</p>
        </div>
        <div className="flex-center" style={{gap: '12px'}}>
          <div className="input-group" style={{margin: 0}}>
             <input 
              type="text" 
              placeholder="Search groups..." 
              className="admin-input"
              style={{padding: '8px 12px', width: '240px'}}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn primary" onClick={fetchGroups}>
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Groups</div>
          <div className="stat-value">{groups.length}</div>
          <div className="badge primary" style={{marginTop: '8px'}}>Active Community</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Messages</div>
          <div className="stat-value" style={{color: 'var(--success)'}}>
            {groups.reduce((acc, curr) => acc + (curr.message_count || 0), 0)}
          </div>
          <div className="text-muted" style={{fontSize: '12px', marginTop: '4px'}}>Across all groups</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Flagged Groups</div>
          <div className="stat-value" style={{color: 'var(--danger)'}}>
            {groups.filter(g => !g.is_active).length}
          </div>
          <div className="badge danger" style={{marginTop: '8px'}}>Requires Review</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Group Profile</th>
              <th>Admin / Creator</th>
              <th>Activity</th>
              <th>Visibility</th>
              <th style={{textAlign: 'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{textAlign: 'center', padding: '40px'}}>
                  <div className="text-muted">Fetching community data...</div>
                </td>
              </tr>
            ) : filteredGroups.map(group => (
              <tr key={group.id}>
                <td>
                  <div className="flex-center" style={{justifyContent: 'flex-start', gap: '12px'}}>
                    {group.image_url ? (
                      <img src={group.image_url} alt="" className="avatar-sm" style={{borderRadius: '8px', objectFit: 'cover'}} />
                    ) : (
                      <div className="avatar-sm"><Users size={16}/></div>
                    )}
                    <div>
                      <div style={{fontWeight: 600}}>{group.name}</div>
                      <div className="text-muted" style={{fontSize: '11px'}}>{new Date(group.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </td>
                
                <td>
                  <div>
                    <div>{group.admin_name}</div>
                    <div className="text-primary" style={{fontSize: '12px'}}>@{group.admin_handle}</div>
                  </div>
                </td>

                <td>
                  <div className="flex-center" style={{justifyContent: 'flex-start', gap: '15px'}}>
                    <div>
                      <div style={{fontWeight: 'bold', fontSize: '14px'}}>{group.member_count}</div>
                      <div className="text-muted" style={{fontSize: '10px', textTransform: 'uppercase'}}>Members</div>
                    </div>
                    <div>
                      <div style={{fontWeight: 'bold', fontSize: '14px'}}>{group.message_count}</div>
                      <div className="text-muted" style={{fontSize: '10px', textTransform: 'uppercase'}}>Messages</div>
                    </div>
                  </div>
                </td>

                <td>
                  {group.is_private ? (
                    <span className="badge warning"><Lock size={10} style={{marginRight: '4px'}}/> Private</span>
                  ) : (
                    <span className="badge success"><Globe size={10} style={{marginRight: '4px'}}/> Public</span>
                  )}
                </td>

                <td style={{textAlign: 'right'}}>
                  <div className="action-btns" style={{justifyContent: 'flex-end'}}>
                    <button 
                      className={`icon-btn ${group.is_active ? 'warning' : 'success'}`}
                      onClick={() => handleToggleStatus(group.id)}
                      title={group.is_active ? 'Restrict Group' : 'Activate Group'}
                    >
                      <Ban size={16} />
                    </button>
                    <button 
                      className="icon-btn danger" 
                      title="Delete Group"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredGroups.length === 0 && !loading && (
          <div style={{padding: '40px', textAlign: 'center'}} className="text-muted">
            No groups match your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
