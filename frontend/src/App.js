import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import OrganizationPage from '@/pages/OrganizationPage';
import TasksPage from '@/pages/TasksPage';
import AdminPage from '@/pages/AdminPage';
import PaymentSuccess from '@/pages/PaymentSuccess';
import PaymentCancel from '@/pages/PaymentCancel';
import '@/App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const ProtectedRoute = ({ children }) => {
    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    if (!user) return <Navigate to="/auth" replace />;
    return children;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage setUser={setUser} />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard user={user} setUser={setUser} /></ProtectedRoute>} />
          <Route path="/organization/:orgId" element={<ProtectedRoute><OrganizationPage user={user} /></ProtectedRoute>} />
          <Route path="/organization/:orgId/tasks" element={<ProtectedRoute><TasksPage user={user} /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage user={user} /></ProtectedRoute>} />
          <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/payment-cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/auth"} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;