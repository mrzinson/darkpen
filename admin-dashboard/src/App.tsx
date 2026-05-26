import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import DashboardLayout from './DashboardLayout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return null; // Loading state
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            !isAuthenticated ? 
            <Login onLogin={() => setIsAuthenticated(true)} /> : 
            <Navigate to="/" replace />
          } 
        />
        
        <Route 
          path="/*" 
          element={
            isAuthenticated ? 
            <DashboardLayout onLogout={() => {
              localStorage.removeItem('adminToken');
              localStorage.removeItem('adminUser');
              setIsAuthenticated(false);
            }} /> : 
            <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
