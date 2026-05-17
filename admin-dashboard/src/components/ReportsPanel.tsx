import { useEffect, useState } from 'react';
import { TrendingUp, Users } from 'lucide-react';

export default function ReportsPanel() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching report data
    setTimeout(() => {
      setReportData({
        totalRevenue: 450.50,
        monthlyGrowth: 15.2,
        activeSubscriptions: 42,
        creditsSold: 12500,
        popularPlan: 'Basic Monthly ($3)',
        revenueByService: [
          { name: 'Education Chat', value: '40%' },
          { name: 'Shukaansi AI', value: '35%' },
          { name: 'Curriculum Books', value: '15%' },
          { name: 'Exams Access', value: '10%' }
        ]
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <div className="text-muted">Loading reports...</div>;

  return (
    <div className="panel-container">
      <h2>Financial & Usage Reports</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Monthly Revenue</div>
          <div className="stat-value" style={{color: 'var(--success)'}}>${reportData.totalRevenue}</div>
          <div className="text-muted" style={{fontSize: '12px'}}>+${reportData.monthlyGrowth}% from last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Active Subscriptions</div>
          <div className="stat-value">{reportData.activeSubscriptions}</div>
          <div className="text-muted" style={{fontSize: '12px'}}>Recurring users</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Credits Sold</div>
          <div className="stat-value">{reportData.creditsSold}</div>
          <div className="text-muted" style={{fontSize: '12px'}}>Pay-as-you-go</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Revenue by Service</h3>
          <div className="list-container" style={{marginTop: '20px'}}>
            {reportData.revenueByService.map((item: any) => (
              <div key={item.name} className="list-item">
                <span>{item.name}</span>
                <strong style={{color: 'var(--primary)'}}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Platform Insights</h3>
          <div className="list-container" style={{marginTop: '20px'}}>
            <div className="flex-center" style={{gap: '15px', padding: '10px'}}>
              <div className="icon-btn success"><TrendingUp size={18}/></div>
              <div>
                <div style={{fontWeight: '700'}}>Popular Plan</div>
                <div className="text-muted" style={{fontSize: '13px'}}>{reportData.popularPlan}</div>
              </div>
            </div>
            <div className="flex-center" style={{gap: '15px', padding: '10px'}}>
              <div className="icon-btn primary"><Users size={18}/></div>
              <div>
                <div style={{fontWeight: '700'}}>Peak Activity</div>
                <div className="text-muted" style={{fontSize: '13px'}}>8:00 PM - 11:00 PM</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
