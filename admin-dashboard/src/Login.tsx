import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import './Login.css';
import { API_URL } from './config';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Fadlan geli email-ka iyo password-ka');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok && data.status === 'success') {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        onLogin();
      } else {
        setError(data.message || 'Email ama Password waa khalad');
      }
    } catch (err) {
      console.error(err);
      setError('Cilad ayaa dhacday, fadlan isku day mar kale.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container flex-center">
      <div className="login-card">
        <div className="login-header">
          <div className="icon-container flex-center">
            <Lock size={32} color="var(--primary)" />
          </div>
          <h1>Admin Portal</h1>
          <p>Login to manage Darkpen application</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input 
              type="email" 
              placeholder="Admin Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="login-button flex-center" disabled={loading}>
            {loading ? 'Authenticating...' : 'Access Dashboard'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}
