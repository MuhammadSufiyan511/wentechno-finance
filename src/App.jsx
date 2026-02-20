import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layouts/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EcomPanel from './pages/EcomPanel';
import UrbanFitPanel from './pages/UrbanFit';
import SchoolSaasPanel from './pages/SchoolSaas';
import PhysicalSchoolPanel from './pages/PhysicalSchoolPanel';
import ITCoursesPanel from './pages/ITCoursesPanel';
import OfficeExpensesPanel from './pages/OfficeExpensesPanel';
import Reports from './pages/Reports';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="ecom" element={<EcomPanel />} />
            <Route path="urbanfit" element={<UrbanFitPanel />} />
            <Route path="school-saas" element={<SchoolSaasPanel />} />
            <Route path="physical-school" element={<PhysicalSchoolPanel />} />
            <Route path="it-courses" element={<ITCoursesPanel />} />
            <Route path="office" element={<OfficeExpensesPanel />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
