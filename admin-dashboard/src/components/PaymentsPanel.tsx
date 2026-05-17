import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { API_URL } from '../config';

export default function PaymentsPanel() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = () => {
    setLoading(true);
    fetch(`${API_URL}/admin/payments`)
      .then(res => res.json())
      .then(data => {
        setPayments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`${API_URL}/admin/payments/${id}/${action}`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchPayments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && payments.length === 0) return <div>Loading payments...</div>;

  return (
    <div className="panel-container">
      <div className="flex-between mb-lg">
        <h2>Payment Requests</h2>
        <div className="badge warning">
          {payments.filter(p => p.status === 'pending').length} Pending
        </div>
      </div>

      <div className="card table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Reference No.</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td>{p.user_name}</td>
                <td style={{ fontFamily: 'monospace' }}>{p.reference_number}</td>
                <td>${p.amount}</td>
                <td>
                  <span className={`badge ${p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}`}>
                    {p.status}
                  </span>
                </td>
                <td>
                  {p.status === 'pending' && (
                    <div className="action-btns">
                      <button 
                        className="icon-btn success" 
                        onClick={() => handleAction(p.id, 'approve')}
                        title="Approve"
                      >
                        <Check size={18} />
                      </button>
                      <button 
                        className="icon-btn danger" 
                        onClick={() => handleAction(p.id, 'reject')}
                        title="Reject"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                  {p.status !== 'pending' && <span className="text-muted">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
